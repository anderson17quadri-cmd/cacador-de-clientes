import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import axios from 'axios';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';
import nodemailer from 'nodemailer';
import { PrismaService } from '../../database/prisma.service';
import { CampaignPreviewDto, CreateCampaignDto, UpdateCampaignConfigDto } from './dto/campaign.dto';
import { ProspectingService } from '../prospecting/prospecting.service';

type Channel = 'email' | 'whatsapp';
type CampaignStatus = 'DRAFT' | 'RUNNING' | 'COMPLETED' | 'CANCELED' | 'FAILED';

export interface CampaignLog {
  at: string;
  company: string;
  channel: Channel;
  status: 'sent' | 'simulated' | 'failed' | 'skipped';
  detail: string;
}

export interface Campaign {
  id: string;
  userId: string;
  name: string;
  channels: Channel[];
  subject?: string;
  message: string;
  whatsappTemplate?: string;
  whatsappLanguage: string;
  intervalSeconds: number;
  dryRun: boolean;
  consentConfirmed: boolean;
  searchId?: string;
  category?: string;
  city?: string;
  maxRecipients?: number;
  companyIds: string[];
  personalizedMessages?: Record<string, string>;
  status: CampaignStatus;
  totalRecipients: number;
  totalDeliveries: number;
  processed: number;
  sent: number;
  simulated: number;
  failed: number;
  skipped: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  error?: string;
  logs: CampaignLog[];
}

interface ChannelConfig {
  smtpHost?: string;
  smtpPort?: number;
  smtpSecure?: boolean;
  smtpUser?: string;
  smtpPass?: string;
  smtpFromEmail?: string;
  smtpFromName?: string;
  whatsappPhoneNumberId?: string;
  whatsappToken?: string;
  whatsappApiVersion?: string;
  maxDailyMessages?: number;
}

@Injectable()
export class CampaignsService {
  private readonly active = new Set<string>();
  private readonly dataDir = process.env.LEADHUNTER_DATA_DIR || join(process.cwd(), 'runtime-data');
  private readonly encryptionKey = createHash('sha256')
    .update(process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'leadhunter-local')
    .digest();

  constructor(private readonly prisma: PrismaService, private readonly prospecting: ProspectingService) {}

  private campaignFile(userId: string) { return join(this.dataDir, `campaigns-${userId}.json`); }
  private configFile(userId: string) { return join(this.dataDir, `channels-${userId}.enc`); }

  private async loadCampaigns(userId: string): Promise<Campaign[]> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      return JSON.parse(await readFile(this.campaignFile(userId), 'utf8')) as Campaign[];
    } catch { return []; }
  }

  private async saveCampaigns(userId: string, campaigns: Campaign[]) {
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.campaignFile(userId), JSON.stringify(campaigns, null, 2), 'utf8');
  }

  private encrypt(value: ChannelConfig) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }

  private decrypt(value: string): ChannelConfig {
    const payload = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8'));
  }

  private async rawConfig(userId: string): Promise<ChannelConfig> {
    try { return this.decrypt(await readFile(this.configFile(userId), 'utf8')); } catch { return {}; }
  }

  async getConfig(userId: string) {
    const config = await this.rawConfig(userId);
    return {
      smtpHost: config.smtpHost || '', smtpPort: config.smtpPort || 587,
      smtpSecure: config.smtpSecure || false, smtpUser: config.smtpUser || '',
      smtpPassConfigured: Boolean(config.smtpPass), smtpFromEmail: config.smtpFromEmail || '',
      smtpFromName: config.smtpFromName || '',
      whatsappPhoneNumberId: config.whatsappPhoneNumberId || '',
      whatsappTokenConfigured: Boolean(config.whatsappToken),
      whatsappApiVersion: config.whatsappApiVersion || 'v22.0',
      maxDailyMessages: config.maxDailyMessages || 50,
      emailReady: Boolean(config.smtpHost && config.smtpUser && config.smtpPass && config.smtpFromEmail),
      whatsappReady: Boolean(config.whatsappPhoneNumberId && config.whatsappToken),
    };
  }

  async updateConfig(userId: string, dto: UpdateCampaignConfigDto) {
    const current = await this.rawConfig(userId);
    const next = { ...current, ...dto };
    if (!dto.smtpPass) next.smtpPass = current.smtpPass;
    if (!dto.whatsappToken) next.whatsappToken = current.whatsappToken;
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.configFile(userId), this.encrypt(next), 'utf8');
    return this.getConfig(userId);
  }

  async testConfig(userId: string, channel: Channel) {
    const config = await this.rawConfig(userId);
    if (channel === 'email') {
      if (!config.smtpHost || !config.smtpUser || !config.smtpPass || !config.smtpFromEmail) {
        throw new BadRequestException('Preencha servidor, usuário, senha e remetente SMTP.');
      }
      await this.mailer(config).verify();
      return { channel, ok: true, message: 'Conexão SMTP validada.' };
    }
    if (!config.whatsappPhoneNumberId || !config.whatsappToken) {
      throw new BadRequestException('Preencha o ID do número e o token da WhatsApp Cloud API.');
    }
    const version = config.whatsappApiVersion || 'v22.0';
    const response = await axios.get(`https://graph.facebook.com/${version}/${config.whatsappPhoneNumberId}`, {
      headers: { Authorization: `Bearer ${config.whatsappToken}` },
      params: { fields: 'display_phone_number,verified_name' }, timeout: 15000,
    });
    return { channel, ok: true, message: `WhatsApp validado: ${response.data.display_phone_number || response.data.verified_name || 'número conectado'}.` };
  }

  private where(userId: string, dto: CampaignPreviewDto) {
    const contactFilters: any[] = [];
    if (dto.channels.includes('email')) contactFilters.push({ email: { not: null } });
    if (dto.channels.includes('whatsapp')) contactFilters.push({ OR: [{ whatsapp: { not: null } }, { phone: { not: null } }] });
    return {
      search: { userId },
      ...(dto.searchId ? { searchId: dto.searchId } : {}),
      ...(dto.companyIds?.length ? { id: { in: dto.companyIds } } : {}),
      ...(dto.category ? { category: { contains: dto.category } } : {}),
      ...(dto.city ? { city: { contains: dto.city } } : {}),
      OR: contactFilters,
    } as any;
  }

  async preview(userId: string, dto: CampaignPreviewDto) {
    const where = this.where(userId, dto);
    const take = dto.maxRecipients || 10000;
    let leads = await this.prisma.company.findMany({ where, take, select: { id: true, email: true, whatsapp: true, phone: true } });
    const allowed = await this.prospecting.canContact(userId, leads.map((lead) => lead.id));
    leads = leads.filter((lead) => allowed.has(lead.id));
    const email = dto.channels.includes('email') ? leads.filter((lead) => lead.email).length : 0;
    const whatsapp = dto.channels.includes('whatsapp') ? leads.filter((lead) => lead.whatsapp || lead.phone).length : 0;
    return { leads: leads.length, email, whatsapp, deliveries: email + whatsapp };
  }

  async create(userId: string, dto: CreateCampaignDto) {
    if (!dto.dryRun && !dto.consentConfirmed) throw new BadRequestException('Confirme que os destinatários podem receber esta comunicação.');
    if (dto.channels.includes('email') && !dto.subject?.trim()) throw new BadRequestException('Informe o assunto do e-mail.');
    if (!dto.dryRun && dto.channels.includes('whatsapp') && !dto.whatsappTemplate?.trim()) {
      throw new BadRequestException('Informe o modelo aprovado do WhatsApp.');
    }
    const where = this.where(userId, dto);
    let leads = await this.prisma.company.findMany({ where, take: dto.maxRecipients || 10000, select: { id: true, email: true, whatsapp: true, phone: true } });
    const allowed = await this.prospecting.canContact(userId, leads.map((lead) => lead.id));
    leads = leads.filter((lead) => allowed.has(lead.id));
    if (!leads.length) throw new BadRequestException('Nenhum lead com os canais escolhidos foi encontrado.');
    const preview = {
      email: dto.channels.includes('email') ? leads.filter((lead) => lead.email).length : 0,
      whatsapp: dto.channels.includes('whatsapp') ? leads.filter((lead) => lead.whatsapp || lead.phone).length : 0,
    };
    const campaign: Campaign = {
      id: randomUUID(), userId, name: dto.name.trim(), channels: dto.channels,
      subject: dto.subject?.trim(), message: dto.message.trim(), whatsappTemplate: dto.whatsappTemplate?.trim(),
      whatsappLanguage: dto.whatsappLanguage || 'pt_PT', intervalSeconds: dto.intervalSeconds,
      dryRun: dto.dryRun, consentConfirmed: dto.consentConfirmed, searchId: dto.searchId,
      category: dto.category, city: dto.city, maxRecipients: dto.maxRecipients,
      personalizedMessages: dto.personalizedMessages,
      companyIds: leads.map((lead) => lead.id), status: 'DRAFT', totalRecipients: leads.length,
      totalDeliveries: preview.email + preview.whatsapp, processed: 0, sent: 0, simulated: 0,
      failed: 0, skipped: 0, createdAt: new Date().toISOString(), logs: [],
    };
    const campaigns = await this.loadCampaigns(userId);
    campaigns.unshift(campaign);
    await this.saveCampaigns(userId, campaigns);
    return campaign;
  }

  async list(userId: string) { return this.loadCampaigns(userId); }

  async start(userId: string, id: string) {
    const campaigns = await this.loadCampaigns(userId);
    const campaign = campaigns.find((item) => item.id === id);
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.status === 'RUNNING' || this.active.has(id)) throw new BadRequestException('A campanha já está em andamento.');
    if (campaign.status === 'COMPLETED') throw new BadRequestException('A campanha já foi concluída.');
    if (!campaign.dryRun) {
      const ready = await this.getConfig(userId);
      if (campaign.channels.includes('email') && !ready.emailReady) throw new BadRequestException('Configure o SMTP antes de iniciar.');
      if (campaign.channels.includes('whatsapp') && !ready.whatsappReady) throw new BadRequestException('Configure a WhatsApp Cloud API antes de iniciar.');
    }
    campaign.status = 'RUNNING'; campaign.startedAt = new Date().toISOString(); campaign.error = undefined;
    await this.saveCampaigns(userId, campaigns);
    void this.runCampaign(userId, id);
    return campaign;
  }

  async cancel(userId: string, id: string) {
    const campaigns = await this.loadCampaigns(userId);
    const campaign = campaigns.find((item) => item.id === id);
    if (!campaign) throw new NotFoundException('Campanha não encontrada.');
    if (campaign.status !== 'RUNNING') throw new BadRequestException('A campanha não está em andamento.');
    campaign.status = 'CANCELED'; campaign.completedAt = new Date().toISOString();
    await this.saveCampaigns(userId, campaigns);
    return campaign;
  }

  private render(template: string, company: any) {
    return template
      .replace(/\{nome\}/gi, company.name || '')
      .replace(/\{empresa\}/gi, company.name || '')
      .replace(/\{cidade\}/gi, company.city || '')
      .replace(/\{categoria\}/gi, company.category || '');
  }

  private messageFor(campaign: Campaign, company: any) {
    return this.render(campaign.personalizedMessages?.[company.id] || campaign.message, company);
  }

  private mailer(config: ChannelConfig) {
    return nodemailer.createTransport({
      host: config.smtpHost, port: config.smtpPort || 587, secure: Boolean(config.smtpSecure),
      auth: { user: config.smtpUser, pass: config.smtpPass },
    });
  }

  private async sendEmail(config: ChannelConfig, campaign: Campaign, company: any) {
    const text = `${this.messageFor(campaign, company)}\n\nSe não quiser receber novos contatos, responda REMOVER.`;
    await this.mailer(config).sendMail({
      from: { name: config.smtpFromName || 'LeadHunter', address: config.smtpFromEmail! },
      to: company.email, subject: this.render(campaign.subject || '', company), text,
    });
  }

  private async sendWhatsapp(config: ChannelConfig, campaign: Campaign, company: any) {
    const phone = String(company.whatsapp || company.phone || '').replace(/\D/g, '');
    const version = config.whatsappApiVersion || 'v22.0';
    const response = await axios.post(`https://graph.facebook.com/${version}/${config.whatsappPhoneNumberId}/messages`, {
      messaging_product: 'whatsapp', to: phone, type: 'template',
      template: {
        name: campaign.whatsappTemplate, language: { code: campaign.whatsappLanguage },
        components: [{ type: 'body', parameters: [{ type: 'text', text: this.messageFor(campaign, company).slice(0, 1024) }] }],
      },
    }, { headers: { Authorization: `Bearer ${config.whatsappToken}`, 'Content-Type': 'application/json' }, timeout: 20000 });
    return response.data?.messages?.[0]?.id as string | undefined;
  }

  private async runCampaign(userId: string, id: string) {
    this.active.add(id);
    try {
      const config = await this.rawConfig(userId);
      const campaigns = await this.loadCampaigns(userId);
      const campaign = campaigns.find((item) => item.id === id);
      if (!campaign) return;
      const companies = await this.prisma.company.findMany({ where: { id: { in: campaign.companyIds }, search: { userId } } });
      for (const company of companies) {
        for (const channel of campaign.channels) {
          const latest = (await this.loadCampaigns(userId)).find((item) => item.id === id);
          if (!latest || latest.status === 'CANCELED') return;
          const allowed = await this.prospecting.canContact(userId, [company.id]);
          if (!allowed.has(company.id)) {
            campaign.skipped++; campaign.processed++;
            this.log(campaign, company.name, channel, 'skipped', 'Lead na lista de não contactar');
            await this.replaceCampaign(userId, campaign); continue;
          }
          const address = channel === 'email' ? company.email : (company.whatsapp || company.phone);
          if (!address) continue;
          try {
            if (campaign.dryRun) {
              campaign.simulated++;
              this.log(campaign, company.name, channel, 'simulated', String(address));
              await this.prospecting.recordCampaignEvent(userId, company, campaign.id, channel, 'simulated', this.messageFor(campaign, company));
            } else {
              if (channel === 'whatsapp' && await this.prospecting.dailyOutboundCount(userId) >= (config.maxDailyMessages || 50)) {
                campaign.skipped++;
                this.log(campaign, company.name, channel, 'skipped', 'Limite diário de WhatsApp atingido');
                campaign.processed++; await this.replaceCampaign(userId, campaign); continue;
              }
              let providerMessageId: string | undefined;
              if (channel === 'email') await this.sendEmail(config, campaign, company);
              else providerMessageId = await this.sendWhatsapp(config, campaign, company);
              campaign.sent++;
              this.log(campaign, company.name, channel, 'sent', String(address));
              await this.prospecting.recordCampaignEvent(userId, company, campaign.id, channel, 'sent', this.messageFor(campaign, company), providerMessageId);
            }
          } catch (error: any) {
            campaign.failed++;
            this.log(campaign, company.name, channel, 'failed', error?.response?.data?.error?.message || error.message || 'Falha no envio');
          }
          campaign.processed++;
          await this.replaceCampaign(userId, campaign);
          if (!campaign.dryRun && campaign.processed < campaign.totalDeliveries) {
            await new Promise((resolve) => setTimeout(resolve, campaign.intervalSeconds * 1000));
          }
        }
      }
      campaign.status = 'COMPLETED'; campaign.completedAt = new Date().toISOString();
      await this.replaceCampaign(userId, campaign);
    } catch (error: any) {
      const campaigns = await this.loadCampaigns(userId);
      const campaign = campaigns.find((item) => item.id === id);
      if (campaign) { campaign.status = 'FAILED'; campaign.error = error.message; await this.saveCampaigns(userId, campaigns); }
    } finally { this.active.delete(id); }
  }

  private log(campaign: Campaign, company: string, channel: Channel, status: CampaignLog['status'], detail: string) {
    campaign.logs.unshift({ at: new Date().toISOString(), company, channel, status, detail });
    campaign.logs = campaign.logs.slice(0, 100);
  }

  private async replaceCampaign(userId: string, campaign: Campaign) {
    const campaigns = await this.loadCampaigns(userId);
    const index = campaigns.findIndex((item) => item.id === campaign.id);
    if (index >= 0) {
      if (campaigns[index]!.status === 'CANCELED' && campaign.status === 'RUNNING') return;
      campaigns[index] = campaign;
    }
    await this.saveCampaigns(userId, campaigns);
  }
}
