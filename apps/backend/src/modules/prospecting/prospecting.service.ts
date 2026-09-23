import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Interval } from '@nestjs/schedule';
import axios from 'axios';
import OpenAI from 'openai';
import * as PDFDocumentLib from 'pdfkit';
import { mkdir, readFile, readdir, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';
import {
  CreateAutomationDto, CreateContactEventDto, GenerateMessagesDto,
  UpdateAutomationDto, UpdateLeadCrmDto, ValidateContactsDto,
} from './dto/prospecting.dto';
import { SiteStudioService } from '../site-studio/site-studio.service';

const PDFDocument = (PDFDocumentLib as any).default || PDFDocumentLib;

type CrmStatus = 'NEW' | 'CONTACTED' | 'REPLIED' | 'MEETING' | 'PROPOSAL' | 'WON' | 'REJECTED';

export interface LeadState {
  companyId: string;
  status: CrmStatus;
  notes: string;
  nextFollowUpAt?: string;
  doNotContact: boolean;
  doNotContactReason?: string;
  consentBasis?: string;
  validity: 'UNKNOWN' | 'VALID' | 'PARTIAL' | 'INVALID';
  phoneStatus: string;
  phoneNormalized?: string;
  whatsappStatus: string;
  websiteStatus: string;
  instagramStatus: string;
  issues: string[];
  lastValidatedAt?: string;
  lastContactedAt?: string;
  lastResponseAt?: string;
  updatedAt: string;
  websiteAudit?: WebsiteAudit;
}

export interface WebsiteAudit {
  status: 'MISSING' | 'REACHABLE' | 'UNREACHABLE';
  score: number;
  statusCode?: number;
  responseMs?: number;
  https: boolean;
  mobileReady: boolean;
  hasTitle: boolean;
  hasDescription: boolean;
  hasContactAction: boolean;
  findings: string[];
  checkedAt: string;
}

export interface ContactEvent {
  id: string; companyId: string; companyName: string; channel: string;
  direction: string; status: string; content: string; campaignId?: string;
  providerMessageId?: string; createdAt: string;
}

export interface SearchAutomation {
  id: string; name: string; category: string; city: string; country: string;
  radius: number; frequencyHours: number; enabled: boolean; lastRunAt?: string;
  nextRunAt: string; lastSearchId?: string; lastError?: string; createdAt: string;
}

interface ProspectingData {
  leads: Record<string, LeadState>;
  events: ContactEvent[];
  automations: SearchAutomation[];
}

@Injectable()
export class ProspectingService {
  private readonly logger = new Logger(ProspectingService.name);
  private readonly dataDir = process.env.LEADHUNTER_DATA_DIR || join(process.cwd(), 'runtime-data');
  private readonly writeLocks = new Map<string, Promise<void>>();
  private readonly ai: OpenAI | null;
  private readonly aiModel: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly searches: SearchService,
    private readonly notifications: NotificationsService,
    config: ConfigService,
    private readonly siteStudio?: SiteStudioService,
  ) {
    const deepseek = config.get<string>('DEEPSEEK_API_KEY');
    const openai = config.get<string>('openai.apiKey');
    this.ai = deepseek ? new OpenAI({ apiKey: deepseek, baseURL: 'https://api.deepseek.com' })
      : openai ? new OpenAI({ apiKey: openai }) : null;
    this.aiModel = deepseek ? 'deepseek-chat' : 'gpt-4o-mini';
  }

  private file(userId: string) { return join(this.dataDir, `prospecting-${userId}.json`); }
  private empty(): ProspectingData { return { leads: {}, events: [], automations: [] }; }

  private async load(userId: string): Promise<ProspectingData> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      const data = JSON.parse(await readFile(this.file(userId), 'utf8'));
      return { leads: data.leads || {}, events: data.events || [], automations: data.automations || [] };
    } catch { return this.empty(); }
  }

  private async save(userId: string, data: ProspectingData) {
    await mkdir(this.dataDir, { recursive: true });
    const previous = this.writeLocks.get(userId) || Promise.resolve();
    const next = previous.then(async () => {
      const temp = `${this.file(userId)}.${process.pid}.tmp`;
      await writeFile(temp, JSON.stringify(data, null, 2), 'utf8');
      await rename(temp, this.file(userId));
    });
    this.writeLocks.set(userId, next.catch(() => undefined));
    await next;
  }

  private state(companyId: string, current?: Partial<LeadState>): LeadState {
    return {
      companyId, status: 'NEW', notes: '', doNotContact: false, validity: 'UNKNOWN',
      phoneStatus: 'UNKNOWN', whatsappStatus: 'UNKNOWN', websiteStatus: 'UNKNOWN',
      instagramStatus: 'UNKNOWN', issues: [], updatedAt: new Date().toISOString(), ...current,
    };
  }

  private async ownedCompany(userId: string, companyId: string) {
    const company = await this.prisma.company.findFirst({
      where: { id: companyId, search: { userId } }, include: { enrichedData: true },
    });
    if (!company) throw new NotFoundException('Lead não encontrado.');
    return company;
  }

  async pipeline(userId: string) {
    const [data, companies] = await Promise.all([
      this.load(userId),
      this.prisma.company.findMany({
        where: { search: { userId } }, take: 10000, orderBy: { createdAt: 'desc' },
        include: { enrichedData: true },
      }),
    ]);
    const leads = companies.map((company) => {
      const crm = this.state(company.id, data.leads[company.id]);
      return { ...company, crm, opportunity: this.opportunity(company, crm) };
    }).sort((a, b) => b.opportunity.score - a.opportunity.score);
    const counts = leads.reduce((acc: Record<string, number>, lead) => {
      acc[lead.crm.status] = (acc[lead.crm.status] || 0) + 1; return acc;
    }, {});
    return { leads, counts };
  }

  async states(userId: string, companyIds: string[]) {
    const data = await this.load(userId);
    return Object.fromEntries(companyIds.map((id) => [id, this.state(id, data.leads[id])]));
  }

  async updateLead(userId: string, companyId: string, dto: UpdateLeadCrmDto) {
    const company = await this.ownedCompany(userId, companyId);
    const data = await this.load(userId);
    const current = this.state(companyId, data.leads[companyId]);
    const next: LeadState = {
      ...current, ...dto,
      nextFollowUpAt: dto.nextFollowUpAt === '' ? undefined : dto.nextFollowUpAt || current.nextFollowUpAt,
      status: (dto.doNotContact ? 'REJECTED' : dto.status || current.status) as CrmStatus,
      updatedAt: new Date().toISOString(),
    };
    data.leads[companyId] = next;
    await this.save(userId, data);
    if (dto.doNotContact) {
      await this.notifications.create(userId, 'Contato bloqueado', `${company.name} não receberá novas campanhas.`, 'warning', { companyId });
    }
    return next;
  }

  normalizePhone(value?: string | null) {
    if (!value) return '';
    let digits = value.replace(/\D/g, '');
    if (digits.startsWith('00')) digits = digits.slice(2);
    if (digits.length === 9 && /^[239]/.test(digits)) digits = `351${digits}`;
    return digits;
  }

  private instagramUrl(value?: string | null) {
    if (!value) return '';
    const cleaned = value.trim();
    return /^https?:\/\//i.test(cleaned) ? cleaned
      : `https://www.instagram.com/${cleaned.replace(/^@/, '').replace(/^instagram\.com\//i, '')}`;
  }

  private async urlStatus(url: string) {
    if (!url) return 'MISSING';
    try {
      const response = await axios.get(url, {
        timeout: 7000, maxRedirects: 5, validateStatus: () => true,
        headers: { 'User-Agent': 'Mozilla/5.0 LeadHunter/1.0' },
      });
      return response.status >= 200 && response.status < 400 ? 'REACHABLE' : `HTTP_${response.status}`;
    } catch { return 'UNREACHABLE'; }
  }

  private async validateOne(company: any): Promise<LeadState> {
    const phone = this.normalizePhone(company.whatsapp || company.phone);
    const phoneValid = /^351[239]\d{8}$/.test(phone);
    const [websiteStatus, instagramStatus] = await Promise.all([
      this.urlStatus(company.website || ''), this.urlStatus(this.instagramUrl(company.instagram)),
    ]);
    const issues: string[] = [];
    if (!phone) issues.push('Sem telefone'); else if (!phoneValid) issues.push('Telefone português inválido ou incompleto');
    if (!company.whatsapp && phoneValid) issues.push('Telefone encontrado, mas WhatsApp não confirmado');
    if (websiteStatus === 'UNREACHABLE' || websiteStatus.startsWith('HTTP_4') || websiteStatus.startsWith('HTTP_5')) issues.push('Site indisponível');
    if (instagramStatus === 'UNREACHABLE' || instagramStatus.startsWith('HTTP_4') || instagramStatus.startsWith('HTTP_5')) issues.push('Instagram indisponível');
    const useful = phoneValid || company.email || websiteStatus === 'REACHABLE' || instagramStatus === 'REACHABLE';
    return this.state(company.id, {
      validity: !useful ? 'INVALID' : issues.length ? 'PARTIAL' : 'VALID',
      phoneStatus: !phone ? 'MISSING' : phoneValid ? 'VALID_PT' : 'INVALID',
      phoneNormalized: phone || undefined,
      whatsappStatus: company.whatsapp && phoneValid ? 'LINK_PRESENT' : phoneValid ? 'PHONE_ONLY' : 'UNAVAILABLE',
      websiteStatus, instagramStatus, issues, lastValidatedAt: new Date().toISOString(),
    });
  }

  async validateContacts(userId: string, dto: ValidateContactsDto) {
    const companies = await this.prisma.company.findMany({
      where: { search: { userId }, ...(dto.companyIds?.length ? { id: { in: dto.companyIds } } : {}) },
      take: dto.limit || 200, orderBy: { createdAt: 'desc' },
    });
    const data = await this.load(userId);
    const results: LeadState[] = [];
    for (let index = 0; index < companies.length; index += 8) {
      const batch = await Promise.all(companies.slice(index, index + 8).map((company) => this.validateOne(company)));
      for (const result of batch) {
        data.leads[result.companyId] = { ...this.state(result.companyId, data.leads[result.companyId]), ...result };
        results.push(data.leads[result.companyId]!);
      }
    }
    await this.save(userId, data);
    const summary = results.reduce((acc: Record<string, number>, item) => {
      acc[item.validity] = (acc[item.validity] || 0) + 1; return acc;
    }, {});
    await this.notifications.create(userId, 'Validação concluída', `${results.length} contatos verificados.`, 'success', summary);
    return { total: results.length, summary, results };
  }

  private opportunity(company: any, crm: LeadState) {
    let score = 10;
    const reasons: string[] = [];
    if (!company.hasWebsite || !company.website) { score += 35; reasons.push('Não possui site próprio'); }
    else if (crm.websiteAudit && crm.websiteAudit.score < 65) { score += 22; reasons.push('Site precisa de melhorias'); }
    if (!company.hasInstagram) { score += 10; reasons.push('Instagram não identificado'); }
    if (company.hasWhatsapp || company.whatsapp) { score += 18; reasons.push('WhatsApp disponível para abordagem'); }
    else if (company.hasEmail || company.email || company.phone) { score += 12; reasons.push('Possui contacto público'); }
    if ((company.rating || 0) >= 4) { score += 8; reasons.push('Boa reputação pública'); }
    if ((company.totalRatings || 0) >= 10) score += 5;
    if (crm.validity === 'VALID') score += 5;
    if (crm.doNotContact || crm.status === 'REJECTED' || crm.status === 'WON') score = 0;
    score = Math.min(100, Math.max(0, score));
    const priority = score >= 65 ? 'HIGH' : score >= 50 ? 'MEDIUM' : 'LOW';
    const recommendedAction = !company.website ? 'Criar demonstração de landing page'
      : crm.websiteAudit?.score && crm.websiteAudit.score < 65 ? 'Preparar proposta de modernização'
      : company.hasWhatsapp ? 'Preparar mensagem personalizada' : 'Validar contactos antes da abordagem';
    return { score, priority, reasons, recommendedAction };
  }

  private async auditCompanyWebsite(company: any): Promise<WebsiteAudit> {
    const checkedAt = new Date().toISOString();
    if (!company.website) return {
      status: 'MISSING', score: 0, https: false, mobileReady: false, hasTitle: false,
      hasDescription: false, hasContactAction: false, findings: ['Empresa sem site próprio'], checkedAt,
    };
    const started = Date.now();
    try {
      const response = await axios.get(company.website, {
        timeout: 12000, maxRedirects: 5, validateStatus: () => true,
        maxContentLength: 3 * 1024 * 1024,
        headers: { 'User-Agent': 'Mozilla/5.0 LeadHunter-SiteAudit/1.0' }, responseType: 'text',
      });
      const html = String(response.data || '');
      const https = String(response.request?.res?.responseUrl || company.website).startsWith('https://');
      const mobileReady = /<meta[^>]+name=["']viewport["']/i.test(html);
      const hasTitle = /<title[^>]*>\s*[^<]{3,}/i.test(html);
      const hasDescription = /<meta[^>]+name=["']description["'][^>]+content=["'][^"']{20,}/i.test(html)
        || /<meta[^>]+content=["'][^"']{20,}["'][^>]+name=["']description["']/i.test(html);
      const hasContactAction = /(wa\.me|whatsapp|mailto:|tel:|contacto|contato|reservar|marcar)/i.test(html);
      const responseMs = Date.now() - started;
      const findings: string[] = [];
      let score = response.status >= 200 && response.status < 400 ? 100 : 25;
      if (!https) { score -= 20; findings.push('Sem HTTPS'); }
      if (!mobileReady) { score -= 25; findings.push('Sem configuração clara para telemóvel'); }
      if (!hasTitle) { score -= 10; findings.push('Título da página ausente ou fraco'); }
      if (!hasDescription) { score -= 10; findings.push('Descrição para motores de pesquisa ausente'); }
      if (!hasContactAction) { score -= 15; findings.push('Sem ação de contacto evidente'); }
      if (responseMs > 3000) { score -= 15; findings.push(`Resposta lenta (${(responseMs / 1000).toFixed(1)} s)`); }
      if (!findings.length) findings.push('Estrutura técnica essencial encontrada');
      return { status: response.status >= 200 && response.status < 400 ? 'REACHABLE' : 'UNREACHABLE', score: Math.max(0, score), statusCode: response.status, responseMs, https, mobileReady, hasTitle, hasDescription, hasContactAction, findings, checkedAt };
    } catch {
      return { status: 'UNREACHABLE', score: 0, responseMs: Date.now() - started, https: company.website.startsWith('https://'), mobileReady: false, hasTitle: false, hasDescription: false, hasContactAction: false, findings: ['Site indisponível durante a verificação'], checkedAt };
    }
  }

  async auditWebsites(userId: string, companyIds: string[]) {
    const companies = await this.prisma.company.findMany({ where: { id: { in: companyIds }, search: { userId } }, include: { enrichedData: true }, take: 50 });
    if (!companies.length) throw new BadRequestException('Selecione pelo menos uma empresa.');
    const data = await this.load(userId);
    const results: Array<{ companyId: string; companyName: string; audit: WebsiteAudit }> = [];
    for (let index = 0; index < companies.length; index += 5) {
      const group = companies.slice(index, index + 5);
      const audits = await Promise.all(group.map(async (company) => ({ company, audit: await this.auditCompanyWebsite(company) })));
      for (const { company, audit } of audits) {
        data.leads[company.id] = { ...this.state(company.id, data.leads[company.id]), websiteAudit: audit, updatedAt: new Date().toISOString() };
        results.push({ companyId: company.id, companyName: company.name, audit });
        if (company.enrichedData) await this.prisma.enrichedData.update({ where: { companyId: company.id }, data: { hasModernWebsite: audit.score >= 70, needsNewWebsite: audit.score < 65 } });
      }
      await this.save(userId, data);
    }
    return { total: results.length, results };
  }

  async commercialPack(userId: string, companyId: string) {
    const company = await this.ownedCompany(userId, companyId);
    const data = await this.load(userId);
    let crm = this.state(companyId, data.leads[companyId]);
    if (!crm.websiteAudit) {
      crm = { ...crm, websiteAudit: await this.auditCompanyWebsite(company), updatedAt: new Date().toISOString() };
      data.leads[companyId] = crm;
      await this.save(userId, data);
    }
    const opportunity = this.opportunity(company, crm);
    const generated = await this.generateMessages(userId, { companyIds: [companyId], offer: 'criação e melhoria de sites e presença digital', tone: 'profissional, breve e cordial' });
    let siteProject: any = null;
    if (this.siteStudio) {
      const projects = await this.siteStudio.list(userId);
      siteProject = projects.find((project: any) => project.companyId === companyId) || null;
      if (!siteProject) {
        const category = String(company.category || '').toLowerCase();
        const template = /(restaurante|cafe|pastelaria|padaria|comida)/.test(category) ? 'restaurant' : /(advog|contab|consult|clinica)/.test(category) ? 'professional' : 'local';
        siteProject = await this.siteStudio.create(userId, { companyId, objective: 'contacts', template, services: [], extraInfo: 'Demonstração comercial preparada pelo LeadHunter.' });
        const generatedSite = await this.siteStudio.generate(userId, siteProject.id);
        siteProject = generatedSite.project;
      }
    }
    return {
      company: { id: company.id, name: company.name, category: company.category, city: company.city, website: company.website, instagram: company.instagram, whatsapp: company.whatsapp, email: company.email },
      opportunity, audit: crm.websiteAudit, message: generated.messages[0]?.message || '', messageMode: generated.mode,
      siteProject,
      checklist: ['Rever a demonstração', 'Confirmar os dados públicos da empresa', 'Personalizar a mensagem', 'Enviar somente após aprovação'],
    };
  }

  async commercialPackPdf(userId: string, companyId: string) {
    const pack = await this.commercialPack(userId, companyId);
    const chunks: Buffer[] = [];
    const doc = new PDFDocument({ size: 'A4', margin: 50 });
    doc.on('data', (chunk: Buffer) => chunks.push(chunk));
    const done = new Promise<Buffer>((resolve) => doc.on('end', () => resolve(Buffer.concat(chunks))));
    doc.fillColor('#6d28d9').fontSize(22).text('LeadHunter · Proposta comercial');
    doc.moveDown().fillColor('#111827').fontSize(18).text(pack.company.name);
    doc.fontSize(10).fillColor('#4b5563').text(`${pack.company.category || 'Empresa'} · ${pack.company.city || 'Localização não informada'}`);
    doc.moveDown().fillColor('#111827').fontSize(14).text(`Oportunidade: ${pack.opportunity.score}/100`);
    doc.fontSize(10).text(pack.opportunity.reasons.join(' · ') || 'Sem sinais suficientes.');
    doc.moveDown().fontSize(14).text('Auditoria digital');
    doc.fontSize(10).text(`Site: ${pack.audit?.status || 'não verificado'} · Nota: ${pack.audit?.score ?? 0}/100`);
    for (const finding of pack.audit?.findings || []) doc.text(`• ${finding}`);
    doc.moveDown().fontSize(14).text('Mensagem sugerida');
    doc.fontSize(10).text(pack.message || 'Mensagem ainda não preparada.', { align: 'left' });
    doc.moveDown().fontSize(9).fillColor('#6b7280').text('Rascunho para revisão. Nenhuma mensagem foi enviada e nenhuma página foi publicada automaticamente.');
    doc.end();
    const buffer = await done;
    const safe = String(pack.company.name).normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9]+/gi, '-').replace(/^-|-$/g, '').toLowerCase();
    return { buffer, fileName: `proposta-${safe || 'cliente'}.pdf` };
  }

  async addEvent(userId: string, dto: CreateContactEventDto) {
    const company = await this.ownedCompany(userId, dto.companyId);
    const data = await this.load(userId);
    const lead = this.state(company.id, data.leads[company.id]);
    if (lead.doNotContact && dto.direction === 'outbound') throw new BadRequestException('Este lead está na lista de não contactar.');
    const event: ContactEvent = {
      id: randomUUID(), companyId: company.id, companyName: company.name,
      channel: dto.channel, direction: dto.direction, status: dto.status || (dto.direction === 'inbound' ? 'replied' : 'sent'),
      content: dto.content, createdAt: new Date().toISOString(),
    };
    data.events.unshift(event); data.events = data.events.slice(0, 5000);
    data.leads[company.id] = {
      ...lead,
      status: dto.direction === 'inbound' ? 'REPLIED' : (lead.status === 'NEW' ? 'CONTACTED' : lead.status),
      lastContactedAt: dto.direction === 'outbound' ? event.createdAt : lead.lastContactedAt,
      lastResponseAt: dto.direction === 'inbound' ? event.createdAt : lead.lastResponseAt,
      updatedAt: event.createdAt,
    };
    if (dto.direction === 'inbound' && /\b(parar|remover|stop|não contactar|nao contactar)\b/i.test(dto.content)) {
      data.leads[company.id] = { ...data.leads[company.id]!, doNotContact: true, doNotContactReason: 'Pedido recebido por mensagem', status: 'REJECTED' };
    }
    await this.save(userId, data);
    return event;
  }

  async recordCampaignEvent(userId: string, company: any, campaignId: string, channel: string, status: string, content: string, providerMessageId?: string) {
    const data = await this.load(userId);
    const lead = this.state(company.id, data.leads[company.id]);
    const event: ContactEvent = { id: randomUUID(), companyId: company.id, companyName: company.name, channel, direction: 'outbound', status, content, campaignId, providerMessageId, createdAt: new Date().toISOString() };
    data.events.unshift(event); data.events = data.events.slice(0, 5000);
    data.leads[company.id] = { ...lead, status: lead.status === 'NEW' ? 'CONTACTED' : lead.status, lastContactedAt: event.createdAt, updatedAt: event.createdAt };
    await this.save(userId, data);
  }

  async canContact(userId: string, companyIds: string[]) {
    const data = await this.load(userId);
    return new Set(companyIds.filter((id) => !data.leads[id]?.doNotContact));
  }

  async events(userId: string, channel?: string) {
    const data = await this.load(userId);
    return channel ? data.events.filter((event) => event.channel === channel) : data.events;
  }

  async dailyOutboundCount(userId: string) {
    const data = await this.load(userId);
    const since = Date.now() - 24 * 60 * 60 * 1000;
    return data.events.filter((event) => event.direction === 'outbound' && event.status === 'sent' && new Date(event.createdAt).getTime() >= since).length;
  }

  private fallbackMessage(company: any, offer?: string) {
    const opportunity = !company.website ? 'notei que ainda não têm um site próprio'
      : !company.instagram ? 'notei uma oportunidade de reforçar a presença no Instagram'
      : 'vi a presença digital do vosso negócio e identifiquei algumas oportunidades de crescimento';
    return `Olá, equipa da ${company.name}! ${opportunity}. Trabalho com ${offer || 'presença digital e captação de novos clientes'} e preparei uma ideia específica para vocês. Posso enviar um resumo sem compromisso? Se preferirem não receber novas mensagens, basta responder REMOVER.`;
  }

  async generateMessages(userId: string, dto: GenerateMessagesDto) {
    const companies = await this.prisma.company.findMany({
      where: { id: { in: dto.companyIds }, search: { userId } }, include: { enrichedData: true },
    });
    if (!companies.length) throw new BadRequestException('Nenhum lead selecionado.');
    const fallback = companies.map((company) => ({ companyId: company.id, companyName: company.name, message: this.fallbackMessage(company, dto.offer) }));
    if (!this.ai) return { mode: 'local', messages: fallback };
    try {
      const response = await this.ai.chat.completions.create({
        model: this.aiModel, temperature: 0.5, max_tokens: 1800,
        response_format: { type: 'json_object' },
        messages: [
          { role: 'system', content: 'Crie mensagens B2B breves em português de Portugal. Use apenas os dados fornecidos, não invente factos, evite pressão e inclua opção de remoção. Responda JSON: {"messages":[{"companyId":"...","message":"..."}]}.' },
          { role: 'user', content: JSON.stringify({ offer: dto.offer || 'serviços digitais', tone: dto.tone || 'profissional e cordial', companies: companies.map((c) => ({ id: c.id, name: c.name, category: c.category, city: c.city, hasWebsite: c.hasWebsite, hasInstagram: c.hasInstagram, analysis: c.enrichedData?.analysisText })) }) },
        ],
      });
      const parsed = JSON.parse(response.choices[0]?.message?.content || '{}');
      const mapped = new Map((parsed.messages || []).map((item: any) => [item.companyId, item.message]));
      return { mode: 'ai', messages: fallback.map((item) => ({ ...item, message: mapped.get(item.companyId) || item.message })) };
    } catch (error: any) {
      this.logger.warn(`Geração por IA falhou: ${error.message}`);
      return { mode: 'local', messages: fallback };
    }
  }

  async analytics(userId: string) {
    const [data, totalCompanies] = await Promise.all([
      this.load(userId), this.prisma.company.count({ where: { search: { userId } } }),
    ]);
    const states = Object.values(data.leads);
    const byStatus = states.reduce((acc: Record<string, number>, item) => { acc[item.status] = (acc[item.status] || 0) + 1; return acc; }, {});
    const validity = states.reduce((acc: Record<string, number>, item) => { acc[item.validity] = (acc[item.validity] || 0) + 1; return acc; }, {});
    const sent = data.events.filter((event) => event.status === 'sent').length;
    const replies = data.events.filter((event) => event.direction === 'inbound' || event.status === 'replied').length;
    const won = byStatus.WON || 0;
    return {
      totalCompanies, trackedLeads: states.length, byStatus, validity,
      sent, replies, replyRate: sent ? Math.round((replies / sent) * 1000) / 10 : 0,
      won, conversionRate: states.length ? Math.round((won / states.length) * 1000) / 10 : 0,
      followUpsDue: states.filter((item) => item.nextFollowUpAt && new Date(item.nextFollowUpAt) <= new Date() && !item.doNotContact).length,
      blocked: states.filter((item) => item.doNotContact).length,
    };
  }

  async automations(userId: string) { return (await this.load(userId)).automations; }

  async createAutomation(userId: string, dto: CreateAutomationDto) {
    const data = await this.load(userId);
    const automation: SearchAutomation = {
      id: randomUUID(), name: dto.name, category: dto.category, city: dto.city,
      country: dto.country || 'Portugal', radius: dto.radius || 5000,
      frequencyHours: dto.frequencyHours, enabled: dto.enabled ?? true,
      nextRunAt: new Date(Date.now() + dto.frequencyHours * 3600000).toISOString(),
      createdAt: new Date().toISOString(),
    };
    data.automations.unshift(automation); await this.save(userId, data); return automation;
  }

  async updateAutomation(userId: string, id: string, dto: UpdateAutomationDto) {
    const data = await this.load(userId); const index = data.automations.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('Automação não encontrada.');
    data.automations[index] = { ...data.automations[index]!, ...dto };
    if (dto.frequencyHours) data.automations[index]!.nextRunAt = new Date(Date.now() + dto.frequencyHours * 3600000).toISOString();
    await this.save(userId, data); return data.automations[index];
  }

  async deleteAutomation(userId: string, id: string) {
    const data = await this.load(userId); data.automations = data.automations.filter((item) => item.id !== id);
    await this.save(userId, data); return { deleted: true };
  }

  async runAutomation(userId: string, id: string) {
    const data = await this.load(userId); const automation = data.automations.find((item) => item.id === id);
    if (!automation) throw new NotFoundException('Automação não encontrada.');
    try {
      const search = await this.searches.create(userId, {
        category: automation.category, city: automation.city, country: automation.country,
        radius: automation.radius, sources: ['nominatim', 'overpass', 'google_places'],
      });
      automation.lastRunAt = new Date().toISOString(); automation.lastSearchId = search.id; automation.lastError = undefined;
      automation.nextRunAt = new Date(Date.now() + automation.frequencyHours * 3600000).toISOString();
      await this.save(userId, data);
      await this.notifications.create(userId, 'Pesquisa automática iniciada', automation.name, 'info', { searchId: search.id });
      return { automation, search };
    } catch (error: any) {
      automation.lastError = error.message; automation.nextRunAt = new Date(Date.now() + 3600000).toISOString();
      await this.save(userId, data); throw error;
    }
  }

  @Interval(60000)
  async runDueAutomations() {
    try {
      await mkdir(this.dataDir, { recursive: true });
      const files = await readdir(this.dataDir);
      for (const file of files.filter((name) => /^prospecting-.+\.json$/.test(name))) {
        const userId = file.slice('prospecting-'.length, -'.json'.length);
        const data = await this.load(userId);
        for (const item of data.automations.filter((automation) => automation.enabled && new Date(automation.nextRunAt) <= new Date())) {
          try { await this.runAutomation(userId, item.id); } catch (error: any) { this.logger.warn(`Automação ${item.name}: ${error.message}`); }
        }
      }
    } catch (error: any) { this.logger.warn(`Agendador: ${error.message}`); }
  }

  verifyWebhook(mode?: string, token?: string, challenge?: string) {
    const expected = process.env.WHATSAPP_VERIFY_TOKEN;
    if (mode === 'subscribe' && expected && token === expected) return challenge;
    throw new BadRequestException('Webhook não configurado ou token inválido.');
  }

  async receiveWebhook(payload: any) {
    const statuses = payload?.entry?.flatMap((entry: any) => entry.changes || [])
      .flatMap((change: any) => change.value?.statuses || []) || [];
    const messages = payload?.entry?.flatMap((entry: any) => entry.changes || [])
      .flatMap((change: any) => change.value?.messages || []) || [];
    for (const status of statuses) await this.applyProviderStatus(status.id, status.status);
    for (const message of messages) await this.receiveInbound(message.from, message.text?.body || `[${message.type}]`, message.id);
    return { received: true, statuses: statuses.length, messages: messages.length };
  }

  private async applyProviderStatus(providerMessageId: string, status: string) {
    const files = await readdir(this.dataDir).catch(() => []);
    for (const file of files.filter((name) => /^prospecting-.+\.json$/.test(name))) {
      const userId = file.slice('prospecting-'.length, -'.json'.length); const data = await this.load(userId);
      const event = data.events.find((item) => item.providerMessageId === providerMessageId);
      if (event) { event.status = status; await this.save(userId, data); return; }
    }
  }

  private async receiveInbound(from: string, content: string, providerMessageId?: string) {
    const normalized = this.normalizePhone(from);
    const companies = await this.prisma.company.findMany({ where: { OR: [{ phone: { not: null } }, { whatsapp: { not: null } }] }, include: { search: { select: { userId: true } } }, take: 10000 });
    const company = companies.find((item) => this.normalizePhone(item.whatsapp || item.phone) === normalized);
    if (!company) return;
    const userId = company.search.userId;
    const event = await this.addEvent(userId, { companyId: company.id, channel: 'whatsapp', direction: 'inbound', status: 'replied', content });
    if (providerMessageId) {
      const data = await this.load(userId); const stored = data.events.find((item) => item.id === event.id);
      if (stored) { stored.providerMessageId = providerMessageId; await this.save(userId, data); }
    }
    await this.notifications.create(userId, `Resposta de ${company.name}`, content.slice(0, 180), 'message', { companyId: company.id });
  }
}
