import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from 'crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import OpenAI from 'openai';
import JSZip from 'jszip';
import sanitizeHtml from 'sanitize-html';
import { PrismaService } from '../../database/prisma.service';
import {
  CreateSiteProjectDto,
  UpdateAiConfigDto,
  UpdateSiteProjectDto,
} from './dto/site-studio.dto';

export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  aboutTitle: string;
  aboutText: string;
  servicesTitle: string;
  services: Array<{ title: string; description: string }>;
  ctaTitle: string;
  ctaText: string;
  ctaLabel: string;
  seoTitle: string;
  seoDescription: string;
  confirmationNeeded: string[];
}
export interface SiteVersion {
  id: string;
  label: string;
  content: SiteContent;
  createdAt: string;
}
export interface SiteProject {
  id: string;
  userId: string;
  companyId: string;
  company: any;
  name: string;
  objective: string;
  template: string;
  primaryColor: string;
  accentColor: string;
  demoBadge: boolean;
  status: string;
  content: SiteContent;
  versions: SiteVersion[];
  createdAt: string;
  updatedAt: string;
  exportedAt?: string;
  extraInfo?: string;
}
interface AiConfig {
  provider?: string;
  model?: string;
  apiKey?: string;
}

@Injectable()
export class SiteStudioService {
  private readonly dataDir = process.env.LEADHUNTER_DATA_DIR || join(process.cwd(), 'runtime-data');
  private readonly encryptionKey = createHash('sha256')
    .update(process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'leadhunter-local')
    .digest();
  constructor(private readonly prisma: PrismaService) {}

  private file(userId: string) {
    return join(this.dataDir, `site-studio-${userId}.json`);
  }
  private configFile(userId: string) {
    return join(this.dataDir, `site-studio-ai-${userId}.enc`);
  }
  private async load(userId: string): Promise<SiteProject[]> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      return JSON.parse(await readFile(this.file(userId), 'utf8'));
    } catch {
      return [];
    }
  }
  private async save(userId: string, projects: SiteProject[]) {
    await mkdir(this.dataDir, { recursive: true });
    const destination = this.file(userId);
    const temp = `${destination}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(projects, null, 2), 'utf8');
    await rm(destination, { force: true });
    await rename(temp, destination);
  }
  private encrypt(value: AiConfig) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }
  private decrypt(value: string): AiConfig {
    const payload = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    return JSON.parse(
      Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8'),
    );
  }
  private async rawConfig(userId: string): Promise<AiConfig> {
    try {
      return this.decrypt(await readFile(this.configFile(userId), 'utf8'));
    } catch {
      return {};
    }
  }
  async getConfig(userId: string) {
    const config = await this.rawConfig(userId);
    const provider = config.provider || 'openai';
    return {
      provider,
      model: config.model || (provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini'),
      apiKeyConfigured: Boolean(config.apiKey),
      ready: Boolean(config.apiKey),
    };
  }
  async updateConfig(userId: string, dto: UpdateAiConfigDto) {
    const current = await this.rawConfig(userId);
    const next = { ...current, ...dto };
    if (!dto.apiKey) next.apiKey = current.apiKey;
    await mkdir(this.dataDir, { recursive: true });
    await writeFile(this.configFile(userId), this.encrypt(next), 'utf8');
    return this.getConfig(userId);
  }
  async testConfig(userId: string) {
    const config = await this.rawConfig(userId);
    if (!config.apiKey) throw new BadRequestException('Configure uma chave de IA primeiro.');
    const client = this.client(config);
    const model =
      config.model || (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
    await client.chat.completions.create({
      model,
      max_tokens: 3,
      messages: [{ role: 'user', content: 'Responda apenas OK.' }],
    });
    return { ok: true, message: 'Ligação com a IA validada.' };
  }
  private client(config: AiConfig) {
    return new OpenAI({
      apiKey: config.apiKey,
      ...(config.provider === 'deepseek' ? { baseURL: 'https://api.deepseek.com' } : {}),
    });
  }

  private clean(value: unknown, fallback = '') {
    return sanitizeHtml(String(value ?? fallback), {
      allowedTags: [],
      allowedAttributes: {},
    }).trim();
  }
  private fallback(company: any, services: string[] = []): SiteContent {
    const location = [company.city, company.country].filter(Boolean).join(', ');
    return {
      heroTitle: this.clean(company.name),
      heroSubtitle: location
        ? `${this.clean(company.category || 'Negócio local')} em ${this.clean(location)}`
        : this.clean(company.category || 'Negócio local'),
      aboutTitle: `Conheça ${this.clean(company.name)}`,
      aboutText: this.clean(
        company.description ||
          `${company.name} é um negócio local${company.city ? ` em ${company.city}` : ''}. Entre em contacto para confirmar serviços, disponibilidade e condições.`,
      ),
      servicesTitle: 'Serviços',
      services: services.map((title) => ({
        title: this.clean(title),
        description: 'Entre em contacto para saber mais.',
      })),
      ctaTitle: 'Vamos conversar?',
      ctaText: 'Entre em contacto para obter mais informações.',
      ctaLabel: company.whatsapp || company.phone ? 'Contactar agora' : 'Pedir informações',
      seoTitle: `${this.clean(company.name)}${company.city ? ` | ${this.clean(company.city)}` : ''}`,
      seoDescription: `Conheça ${this.clean(company.name)} e entre em contacto para mais informações.`,
      confirmationNeeded: services.length
        ? []
        : ['Serviços oferecidos', ...(company.openingHours ? [] : ['Horário de funcionamento'])],
    };
  }
  private normalizeContent(raw: any, fallback: SiteContent): SiteContent {
    const services = Array.isArray(raw?.services)
      ? raw.services
          .slice(0, 8)
          .map((item: any) => ({
            title: this.clean(item?.title),
            description: this.clean(item?.description),
          }))
          .filter((item: any) => item.title)
      : fallback.services;
    return {
      heroTitle: this.clean(raw?.heroTitle, fallback.heroTitle),
      heroSubtitle: this.clean(raw?.heroSubtitle, fallback.heroSubtitle),
      aboutTitle: this.clean(raw?.aboutTitle, fallback.aboutTitle),
      aboutText: this.clean(raw?.aboutText, fallback.aboutText),
      servicesTitle: this.clean(raw?.servicesTitle, fallback.servicesTitle),
      services,
      ctaTitle: this.clean(raw?.ctaTitle, fallback.ctaTitle),
      ctaText: this.clean(raw?.ctaText, fallback.ctaText),
      ctaLabel: this.clean(raw?.ctaLabel, fallback.ctaLabel),
      seoTitle: this.clean(raw?.seoTitle, fallback.seoTitle),
      seoDescription: this.clean(raw?.seoDescription, fallback.seoDescription),
      confirmationNeeded: Array.isArray(raw?.confirmationNeeded)
        ? raw.confirmationNeeded.map((item: any) => this.clean(item)).filter(Boolean)
        : fallback.confirmationNeeded,
    };
  }

  async list(userId: string) {
    return (await this.load(userId)).map(({ versions, ...project }) => ({
      ...project,
      versionCount: versions.length,
    }));
  }
  async get(userId: string, id: string) {
    const project = (await this.load(userId)).find((item) => item.id === id);
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    return project;
  }
  async create(userId: string, dto: CreateSiteProjectDto) {
    const company = await this.prisma.company.findFirst({
      where: { id: dto.companyId, search: { userId } },
      include: { enrichedData: true },
    });
    if (!company) throw new NotFoundException('Lead não encontrado.');
    const now = new Date().toISOString();
    const content = this.fallback(company, dto.services || []);
    const project: SiteProject = {
      id: randomUUID(),
      userId,
      companyId: company.id,
      company,
      name: `${company.name} - Landing Page`,
      objective: dto.objective,
      template: dto.template,
      primaryColor: dto.primaryColor || '#7c3aed',
      accentColor: '#06b6d4',
      demoBadge: true,
      status: 'DRAFT',
      content,
      versions: [{ id: randomUUID(), label: 'Versão inicial', content, createdAt: now }],
      extraInfo: dto.extraInfo,
      createdAt: now,
      updatedAt: now,
    };
    const projects = await this.load(userId);
    projects.unshift(project);
    await this.save(userId, projects);
    return project;
  }
  async update(userId: string, id: string, dto: UpdateSiteProjectDto) {
    const projects = await this.load(userId);
    const index = projects.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('Projeto não encontrado.');
    const current = projects[index]!;
    const content = dto.content
      ? this.normalizeContent(dto.content, current.content)
      : current.content;
    const next = {
      ...current,
      ...dto,
      content,
      updatedAt: new Date().toISOString(),
      status: 'IN_REVIEW',
    } as SiteProject;
    if (dto.content)
      next.versions = [
        {
          id: randomUUID(),
          label: `Edição ${new Date().toLocaleString('pt-PT')}`,
          content,
          createdAt: next.updatedAt,
        },
        ...current.versions,
      ].slice(0, 30);
    projects[index] = next;
    await this.save(userId, projects);
    return next;
  }
  async generate(userId: string, id: string) {
    const projects = await this.load(userId);
    const index = projects.findIndex((item) => item.id === id);
    if (index < 0) throw new NotFoundException('Projeto não encontrado.');
    const project = projects[index]!;
    const fallback = project.content;
    const config = await this.rawConfig(userId);
    let content = fallback;
    let mode = 'local';
    if (config.apiKey) {
      const model =
        config.model || (config.provider === 'deepseek' ? 'deepseek-chat' : 'gpt-4o-mini');
      try {
        const response = await this.client(config).chat.completions.create({
          model,
          temperature: 0.5,
          max_tokens: 1800,
          response_format: { type: 'json_object' },
          messages: [
            {
              role: 'system',
              content:
                'Crie conteúdo curto para landing page em português de Portugal. Use apenas factos fornecidos. Nunca invente serviços, preços, avaliações, horários ou contactos. Responda JSON com heroTitle, heroSubtitle, aboutTitle, aboutText, servicesTitle, services[{title,description}], ctaTitle, ctaText, ctaLabel, seoTitle, seoDescription e confirmationNeeded[].',
            },
            {
              role: 'user',
              content: JSON.stringify({
                objective: project.objective,
                template: project.template,
                extraInfo: project.extraInfo,
                company: {
                  name: project.company.name,
                  category: project.company.category,
                  description: project.company.description,
                  city: project.company.city,
                  country: project.company.country,
                  phone: project.company.phone,
                  whatsapp: project.company.whatsapp,
                  website: project.company.website,
                  instagram: project.company.instagram,
                  openingHours: project.company.openingHours,
                  rating: project.company.rating,
                },
              }),
            },
          ],
        });
        content = this.normalizeContent(
          JSON.parse(response.choices[0]?.message?.content || '{}'),
          fallback,
        );
        mode = 'ai';
      } catch (error: any) {
        throw new BadRequestException(`A IA não conseguiu gerar o site: ${error.message}`);
      }
    }
    const now = new Date().toISOString();
    project.content = content;
    project.status = 'GENERATED';
    project.updatedAt = now;
    project.versions.unshift({
      id: randomUUID(),
      label: mode === 'ai' ? 'Gerado com IA' : 'Modelo inteligente local',
      content,
      createdAt: now,
    });
    project.versions = project.versions.slice(0, 30);
    await this.save(userId, projects);
    return { project, mode };
  }
  async restore(userId: string, id: string, versionId: string) {
    const projects = await this.load(userId);
    const project = projects.find((item) => item.id === id);
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    const version = project.versions.find((item) => item.id === versionId);
    if (!version) throw new NotFoundException('Versão não encontrada.');
    project.content = version.content;
    project.status = 'IN_REVIEW';
    project.updatedAt = new Date().toISOString();
    await this.save(userId, projects);
    return project;
  }

  private escape(value: unknown) {
    return String(value ?? '').replace(
      /[&<>"']/g,
      (character) =>
        ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!,
    );
  }
  private safeUrl(value?: string | null) {
    try {
      const url = new URL(value || '');
      return ['http:', 'https:'].includes(url.protocol) ? url.toString() : '';
    } catch {
      return '';
    }
  }
  render(project: SiteProject) {
    const c = project.content;
    const company = project.company;
    const whatsapp =
      this.safeUrl(company.whatsapp) ||
      (company.phone ? `https://wa.me/${String(company.phone).replace(/\D/g, '')}` : '');
    const instagram =
      this.safeUrl(company.instagram) ||
      (company.instagram
        ? `https://instagram.com/${String(company.instagram).replace(/^@/, '')}`
        : '');
    const photo = Array.isArray(company.photos) ? this.safeUrl(company.photos[0]) : '';
    let services = c.services.length
      ? c.services
          .map(
            (item) =>
              `<article class="card"><h3>${this.escape(item.title)}</h3><p>${this.escape(item.description)}</p></article>`,
          )
          .join('')
      : '<p class="empty">Serviços a confirmar com a empresa.</p>';
    const contact = whatsapp || instagram || this.safeUrl(company.website);
    const variantCss =
      project.template === 'restaurant'
        ? 'body{background:#170d0a}.hero{font-family:Georgia,serif}.hero h1{font-style:italic}.card{background:#27130e;border-color:#5b2b1e;border-radius:4px}.cta{border-radius:4px}.button{border-radius:999px}'
        : project.template === 'professional'
          ? 'body{background:#f8fafc;color:#142033}.hero{min-height:62vh;background:linear-gradient(135deg,#eef2ff,#fff)}.hero p,.muted{color:#526074}.card{background:#fff;border-color:#dbe2ea;border-radius:8px;box-shadow:0 12px 35px rgba(15,23,42,.07)}.cta{color:#fff;border-radius:10px}footer{color:#526074;border-color:#dbe2ea}'
        : '';
    services = `<style>${variantCss}</style>${services}`;
    return `<!doctype html><html lang="pt"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${this.escape(c.seoTitle)}</title><meta name="description" content="${this.escape(c.seoDescription)}"><style>:root{--primary:${this.escape(project.primaryColor)};--accent:${this.escape(project.accentColor)}}*{box-sizing:border-box}body{margin:0;font-family:Inter,Arial,sans-serif;background:#080b14;color:#f8fafc;line-height:1.6}a{color:inherit}.demo{position:fixed;right:18px;top:18px;z-index:5;background:#f59e0b;color:#111827;padding:7px 12px;border-radius:999px;font-size:12px;font-weight:800}.hero{min-height:72vh;display:grid;place-items:center;text-align:center;padding:80px 24px;background:linear-gradient(135deg,rgba(8,11,20,.72),rgba(8,11,20,.95)),${photo ? `url('${photo}') center/cover` : 'radial-gradient(circle at top,var(--primary),#080b14 58%)'}}.hero div{max-width:900px}.eyebrow{color:var(--accent);font-weight:800;text-transform:uppercase;letter-spacing:.14em}.hero h1{font-size:clamp(42px,8vw,88px);line-height:1;margin:.18em 0}.hero p{font-size:clamp(18px,2.5vw,25px);color:#cbd5e1}.button{display:inline-block;margin-top:24px;padding:14px 24px;border-radius:12px;background:var(--primary);text-decoration:none;font-weight:800}.section{max-width:1120px;margin:auto;padding:80px 24px}.section h2{font-size:clamp(30px,5vw,48px);margin:0 0 20px}.muted{color:#aab4c4;max-width:760px}.grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(230px,1fr));gap:18px}.card{padding:24px;border:1px solid #253047;border-radius:18px;background:#101624}.cta{text-align:center;border-radius:28px;background:linear-gradient(135deg,var(--primary),#111827)}footer{padding:32px 24px;text-align:center;color:#94a3b8;border-top:1px solid #1f2937}@media(max-width:640px){.section{padding:56px 20px}.hero{min-height:64vh}}</style></head><body>${project.demoBadge ? '<div class="demo">DEMONSTRAÇÃO NÃO OFICIAL</div>' : ''}<header class="hero"><div><span class="eyebrow">${this.escape(company.category || 'Negócio local')}</span><h1>${this.escape(c.heroTitle)}</h1><p>${this.escape(c.heroSubtitle)}</p>${contact ? `<a class="button" href="${this.escape(contact)}">${this.escape(c.ctaLabel)}</a>` : ''}</div></header><main><section class="section"><h2>${this.escape(c.aboutTitle)}</h2><p class="muted">${this.escape(c.aboutText)}</p></section><section class="section"><h2>${this.escape(c.servicesTitle)}</h2><div class="grid">${services}</div></section><section class="section cta"><h2>${this.escape(c.ctaTitle)}</h2><p>${this.escape(c.ctaText)}</p>${contact ? `<a class="button" href="${this.escape(contact)}">${this.escape(c.ctaLabel)}</a>` : ''}</section></main><footer><strong>${this.escape(company.name)}</strong>${company.city ? ` · ${this.escape(company.city)}` : ''}${instagram ? ` · <a href="${this.escape(instagram)}">Instagram</a>` : ''}</footer></body></html>`;
  }
  async preview(userId: string, id: string) {
    return { html: this.render(await this.get(userId, id)) };
  }
  async export(userId: string, id: string) {
    const projects = await this.load(userId);
    const project = projects.find((item) => item.id === id);
    if (!project) throw new NotFoundException('Projeto não encontrado.');
    const zip = new JSZip();
    zip.file('index.html', this.render(project));
    zip.file(
      'LEIA-ME.txt',
      'Site exportado pelo LeadHunter AI. Revise todos os dados e direitos de imagens antes de publicar.',
    );
    const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
    project.status = 'EXPORTED';
    project.exportedAt = new Date().toISOString();
    project.updatedAt = project.exportedAt;
    await this.save(userId, projects);
    return {
      buffer,
      fileName: `${
        project.company.name
          .replace(/[^a-z0-9]+/gi, '-')
          .replace(/^-|-$/g, '')
          .toLowerCase() || 'site'
      }.zip`,
    };
  }
}
