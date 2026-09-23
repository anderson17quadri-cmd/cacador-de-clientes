import { BadRequestException, Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { mkdir, readFile, readdir, rename, rm, writeFile } from 'fs/promises';
import { join } from 'path';
import { randomUUID } from 'crypto';
import { PrismaService } from '../../database/prisma.service';
import { SearchService } from '../search/search.service';
import { NotificationsService } from '../notifications/notifications.service';
import { ProspectingService } from '../prospecting/prospecting.service';
import { CreateInstagramMassDto, InstagramMassResultsDto } from './dto/instagram-mass.dto';
import { InstagramDiscoveryService } from './instagram-discovery.service';

type BatchStatus = 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';
type JobStatus = 'PENDING' | 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface MassJob {
  id: string;
  category: string;
  city: string;
  status: JobStatus;
  searchId?: string;
  error?: string;
  candidatesTotal?: number;
  candidatesChecked?: number;
  instagramFound?: number;
}
export interface InstagramMassBatch {
  id: string;
  name: string;
  country: string;
  radius: number;
  sources: string[];
  status: BatchStatus;
  jobs: MassJob[];
  companyIds: string[];
  createdAt: string;
  updatedAt: string;
}

@Injectable()
export class InstagramMassService {
  private readonly logger = new Logger(InstagramMassService.name);
  private readonly dataDir = process.env.LEADHUNTER_DATA_DIR || join(process.cwd(), 'runtime-data');
  private readonly activeUsers = new Set<string>();

  constructor(
    private readonly prisma: PrismaService,
    private readonly searches: SearchService,
    private readonly notifications: NotificationsService,
    private readonly prospecting: ProspectingService,
    private readonly discovery: InstagramDiscoveryService,
  ) {}

  private file(userId: string) {
    return join(this.dataDir, `instagram-mass-${userId}.json`);
  }
  private async load(userId: string): Promise<InstagramMassBatch[]> {
    await mkdir(this.dataDir, { recursive: true });
    try {
      return JSON.parse(await readFile(this.file(userId), 'utf8'));
    } catch {
      return [];
    }
  }
  private async save(userId: string, batches: InstagramMassBatch[]) {
    await mkdir(this.dataDir, { recursive: true });
    const destination = this.file(userId);
    const temp = `${destination}.${process.pid}.tmp`;
    await writeFile(temp, JSON.stringify(batches, null, 2), 'utf8');
    await rm(destination, { force: true });
    await rename(temp, destination);
  }

  async list(userId: string) {
    return (await this.load(userId)).map((batch) => this.summary(batch));
  }

  async get(userId: string, id: string) {
    const batch = (await this.load(userId)).find((item) => item.id === id);
    if (!batch) throw new NotFoundException('Pesquisa Instagram não encontrada.');
    return { ...batch, ...this.summary(batch) };
  }

  async create(userId: string, dto: CreateInstagramMassDto) {
    const jobs = dto.categories.flatMap((category) =>
      dto.cities.map((city) => ({
        id: randomUUID(),
        category,
        city,
        status: 'PENDING' as JobStatus,
      })),
    );
    if (jobs.length > 100) throw new BadRequestException('Máximo de 100 combinações por pesquisa.');
    const now = new Date().toISOString();
    const batch: InstagramMassBatch = {
      id: randomUUID(),
      name: dto.name.trim(),
      country: dto.country || 'Portugal',
      radius: dto.radius || 5000,
      sources: dto.sources?.length ? dto.sources : ['nominatim', 'overpass', 'google_places'],
      status: 'RUNNING',
      jobs,
      companyIds: [],
      createdAt: now,
      updatedAt: now,
    };
    const batches = await this.load(userId);
    batches.unshift(batch);
    await this.save(userId, batches);
    setImmediate(() => this.pumpUser(userId));
    return this.summary(batch);
  }

  async pause(userId: string, id: string) {
    return this.setStatus(userId, id, 'PAUSED');
  }
  async resume(userId: string, id: string) {
    const result = await this.setStatus(userId, id, 'RUNNING');
    setImmediate(() => this.pumpUser(userId));
    return result;
  }
  async cancel(userId: string, id: string) {
    const batches = await this.load(userId);
    const batch = batches.find((item) => item.id === id);
    if (!batch) throw new NotFoundException('Pesquisa Instagram não encontrada.');
    batch.status = 'CANCELLED';
    batch.updatedAt = new Date().toISOString();
    for (const job of batch.jobs.filter((item) => item.status === 'PENDING'))
      job.status = 'CANCELLED';
    await this.save(userId, batches);
    return this.summary(batch);
  }
  async rediscover(userId: string, id: string) {
    const batches = await this.load(userId);
    const batch = batches.find((item) => item.id === id);
    if (!batch) throw new NotFoundException('Pesquisa Instagram não encontrada.');
    batch.status = 'RUNNING';
    batch.updatedAt = new Date().toISOString();
    for (const job of batch.jobs.filter((item) => item.searchId && item.status !== 'CANCELLED')) {
      job.status = 'RUNNING';
      job.error = undefined;
    }
    await this.save(userId, batches);
    setImmediate(() => this.pumpUser(userId));
    return this.summary(batch);
  }
  private async setStatus(userId: string, id: string, status: BatchStatus) {
    const batches = await this.load(userId);
    const batch = batches.find((item) => item.id === id);
    if (!batch) throw new NotFoundException('Pesquisa Instagram não encontrada.');
    if (['COMPLETED', 'CANCELLED'].includes(batch.status))
      throw new BadRequestException('Esta pesquisa já foi encerrada.');
    batch.status = status;
    batch.updatedAt = new Date().toISOString();
    await this.save(userId, batches);
    return this.summary(batch);
  }

  async results(userId: string, id: string, filters: InstagramMassResultsDto) {
    const batch = (await this.load(userId)).find((item) => item.id === id);
    if (!batch) throw new NotFoundException('Pesquisa Instagram não encontrada.');
    const where: any = {
      id: { in: batch.companyIds },
      instagram: { not: null },
      search: { userId },
    };
    if (filters.category) where.category = { contains: filters.category };
    if (filters.city) where.city = { contains: filters.city };
    if (filters.hasWhatsapp !== undefined) where.hasWhatsapp = filters.hasWhatsapp;
    if (filters.hasWebsite !== undefined) where.hasWebsite = filters.hasWebsite;
    if (filters.search)
      where.OR = [
        { name: { contains: filters.search } },
        { instagram: { contains: filters.search } },
      ];
    const page = filters.page || 1;
    const take = filters.limit || 50;
    const skip = (page - 1) * take;
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        include: { enrichedData: true },
        orderBy: { createdAt: 'desc' },
        skip,
        take,
      }),
      this.prisma.company.count({ where }),
    ]);
    return {
      data,
      meta: { page, limit: take, total, totalPages: Math.max(1, Math.ceil(total / take)) },
    };
  }

  async selection(userId: string, id: string, filters: InstagramMassResultsDto) {
    const result = await this.results(userId, id, { ...filters, page: 1, limit: 500 });
    return { ids: result.data.map((company: any) => company.id), total: result.meta.total };
  }

  async validate(userId: string, id: string) {
    const batch = (await this.load(userId)).find((item) => item.id === id);
    if (!batch) throw new NotFoundException('Pesquisa Instagram não encontrada.');
    return this.prospecting.validateContacts(userId, {
      companyIds: batch.companyIds.slice(0, 500),
      limit: 500,
    });
  }

  private summary(batch: InstagramMassBatch) {
    const completed = batch.jobs.filter((job) =>
      ['COMPLETED', 'FAILED', 'CANCELLED'].includes(job.status),
    ).length;
    return {
      ...batch,
      totalJobs: batch.jobs.length,
      completedJobs: completed,
      progress: batch.jobs.length ? Math.round((completed / batch.jobs.length) * 100) : 0,
      totalInstagram: batch.companyIds.length,
      activeJob: batch.jobs.find((job) => job.status === 'RUNNING') || null,
    };
  }

  private async collect(
    userId: string,
    batches: InstagramMassBatch[],
    batch: InstagramMassBatch,
    job: MassJob,
  ) {
    const existing = await this.prisma.company.findMany({
      where: {
        search: { userId },
        category: { contains: job.category },
        city: { contains: job.city },
        instagram: { not: null },
      },
      select: { id: true },
      take: 10000,
    });
    batch.companyIds = [...new Set([...batch.companyIds, ...existing.map((lead) => lead.id)])];
    const missing = await this.prisma.company.findMany({
      where: {
        search: { userId },
        category: { contains: job.category },
        city: { contains: job.city },
        instagram: null,
      },
      select: { id: true, name: true, city: true, category: true },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    job.candidatesTotal = missing.length;
    job.candidatesChecked = 0;
    job.instagramFound = existing.length;
    batch.updatedAt = new Date().toISOString();
    await this.save(userId, batches);
    for (const [index, company] of missing.entries()) {
      const instagram = await this.discovery.discover(company);
      if (instagram) {
        await this.prisma.company.update({
          where: { id: company.id },
          data: { instagram, hasInstagram: true },
        });
        batch.companyIds = [...new Set([...batch.companyIds, company.id])];
        job.instagramFound = (job.instagramFound || 0) + 1;
      }
      job.candidatesChecked = index + 1;
      batch.updatedAt = new Date().toISOString();
      if (instagram || index === missing.length - 1 || (index + 1) % 5 === 0)
        await this.save(userId, batches);
    }
    const leads = await this.prisma.company.findMany({
      where: {
        search: { userId },
        category: { contains: job.category },
        city: { contains: job.city },
        instagram: { not: null },
      },
      select: { id: true },
      take: 10000,
    });
    batch.companyIds = [...new Set([...batch.companyIds, ...leads.map((lead) => lead.id)])];
  }

  async pumpUser(userId: string) {
    if (this.activeUsers.has(userId)) return;
    this.activeUsers.add(userId);
    try {
      const batches = await this.load(userId);
      let changed = false;
      for (const batch of batches.filter((item) => item.status === 'RUNNING')) {
        for (const job of batch.jobs.filter((item) => item.status === 'RUNNING' && item.searchId)) {
          const search = await this.prisma.search.findUnique({
            where: { id: job.searchId! },
            select: { status: true, error: true },
          });
          if (search && ['COMPLETED', 'FAILED', 'CANCELLED'].includes(search.status)) {
            job.error = search.error || undefined;
            if (search.status === 'COMPLETED') await this.collect(userId, batches, batch, job);
            job.status = search.status as JobStatus;
            changed = true;
          }
        }
        if (!batch.jobs.some((job) => job.status === 'RUNNING')) {
          const next = batch.jobs.find((job) => job.status === 'PENDING');
          if (next) {
            try {
              const search = await this.searches.create(userId, {
                query: '__INSTAGRAM_MASS__',
                category: next.category,
                city: next.city,
                country: batch.country,
                radius: batch.radius,
                sources: batch.sources,
              });
              next.searchId = search.id;
              next.status = 'RUNNING';
            } catch (error: any) {
              next.status = 'FAILED';
              next.error = error.message;
            }
            changed = true;
          } else {
            batch.status = batch.jobs.every((job) => job.status === 'FAILED')
              ? 'FAILED'
              : 'COMPLETED';
            await this.notifications.create(
              userId,
              'Pesquisa Instagram concluída',
              `${batch.companyIds.length} empresas com Instagram em ${batch.name}.`,
              'success',
              { batchId: batch.id },
            );
            changed = true;
          }
        }
        batch.updatedAt = new Date().toISOString();
      }
      if (changed) await this.save(userId, batches);
    } catch (error: any) {
      this.logger.warn(`Fila Instagram: ${error.message}`);
    } finally {
      this.activeUsers.delete(userId);
    }
  }

  @Interval(5000)
  async pump() {
    try {
      await mkdir(this.dataDir, { recursive: true });
      for (const file of (await readdir(this.dataDir)).filter((name) =>
        /^instagram-mass-.+\.json$/.test(name),
      )) {
        await this.pumpUser(file.slice('instagram-mass-'.length, -'.json'.length));
      }
    } catch (error: any) {
      this.logger.warn(`Agendador Instagram: ${error.message}`);
    }
  }
}
