import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { Observable, Subject } from 'rxjs';
import { PrismaService } from '../../database/prisma.service';
import { CreateSearchDto } from './dto/search.dto';
import { SearchFilterDto } from './dto/search-filter.dto';
import { GooglePlacesService } from '../../services/collectors/google-places.service';
import { NominatimService } from '../../services/collectors/nominatim.service';
import { SearchStatus } from '@prisma/client';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';
import { MAX_SEARCH_RADIUS, MAX_CONCURRENT_SEARCHES } from '../../common/constants';

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name);
  private progressStreams = new Map<string, Subject<any>>();

  constructor(
    private readonly prisma: PrismaService,
    @InjectQueue('search') private readonly searchQueue: Queue,
    private readonly googlePlaces: GooglePlacesService,
    private readonly nominatim: NominatimService,
  ) {}

  async create(userId: string, dto: CreateSearchDto) {
    if (dto.radius && dto.radius > MAX_SEARCH_RADIUS) {
      throw new BadRequestException(`Raio máximo é ${MAX_SEARCH_RADIUS}m`);
    }

    const runningCount = await this.prisma.search.count({
      where: { userId, status: 'RUNNING' },
    });
    if (runningCount >= MAX_CONCURRENT_SEARCHES) {
      throw new BadRequestException(`Máximo de ${MAX_CONCURRENT_SEARCHES} pesquisas simultâneas`);
    }

    let lat = dto.latitude;
    let lon = dto.longitude;

    if (!lat || !lon) {
      const locationStr = [dto.city, dto.state, dto.country].filter(Boolean).join(', ');
      if (dto.postalCode) {
        const geoData = await this.nominatim.geocodeByPostalCode(dto.postalCode, dto.country);
        if (geoData) { lat = geoData.lat; lon = geoData.lon; }
      } else if (locationStr) {
        const geoData = await this.nominatim.geocode(locationStr);
        if (geoData) { lat = geoData.lat; lon = geoData.lon; }
      }
    }

    if (!lat || !lon) {
      throw new BadRequestException('Não foi possível determinar as coordenadas da localização');
    }

    const search = await this.prisma.search.create({
      data: {
        userId,
        query: dto.query ?? '',
        location: dto.location || [dto.city, dto.state, dto.country].filter(Boolean).join(', '),
        category: dto.category,
        city: dto.city,
        state: dto.state,
        country: dto.country,
        postalCode: dto.postalCode,
        latitude: lat,
        longitude: lon,
        radius: dto.radius || 5000,
        sources: dto.sources || ['google_places', 'nominatim'],
        status: SearchStatus.RUNNING,
        startedAt: new Date(),
      },
    });

    this.progressStreams.set(search.id, new Subject());

    await this.searchQueue.add('execute-search', {
      searchId: search.id,
      userId,
      latitude: lat,
      longitude: lon,
      category: dto.category,
      radius: dto.radius || 5000,
      sources: dto.sources || ['google_places', 'nominatim'],
    });

    return search;
  }

  async findAll(userId: string, filters: SearchFilterDto) {
    const { page, limit, skip } = getPaginationParams({
      page: filters.page,
      limit: filters.limit,
    });

    const where: any = { userId };
    if (filters.status) where.status = filters.status;
    if (filters.category) where.category = { contains: filters.category, mode: 'insensitive' };
    if (filters.city) where.city = { contains: filters.city, mode: 'insensitive' };
    if (filters.country) where.country = filters.country;

    const [data, total] = await Promise.all([
      this.prisma.search.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: { _count: { select: { companies: true } } },
      }),
      this.prisma.search.count({ where }),
    ]);

    return { data, meta: createPaginationMeta(total, page, limit) };
  }

  async findById(id: string) {
    const search = await this.prisma.search.findUnique({
      where: { id },
      include: {
        _count: { select: { companies: true, jobs: true } },
        jobs: { orderBy: { createdAt: 'asc' } },
      },
    });
    if (!search) throw new NotFoundException('Pesquisa não encontrada');
    return search;
  }

  async getProgress(id: string) {
    const search = await this.prisma.search.findUnique({
      where: { id },
      select: {
        id: true, status: true, progress: true, totalFound: true,
        totalEnriched: true, estimatedTime: true, startedAt: true,
        _count: { select: { companies: true } },
      },
    });
    if (!search) throw new NotFoundException('Pesquisa não encontrada');
    return search;
  }

  async getLogs(id: string, limit: number) {
    return this.prisma.searchLog.findMany({
      where: { searchId: id },
      orderBy: { createdAt: 'desc' },
      take: limit,
    });
  }

  async cancel(id: string) {
    const search = await this.prisma.search.findUnique({ where: { id } });
    if (!search) throw new NotFoundException('Pesquisa não encontrada');
    if (search.status !== 'RUNNING' && search.status !== 'PENDING') {
      throw new BadRequestException('Apenas pesquisas em andamento podem ser canceladas');
    }
    return this.prisma.search.update({
      where: { id },
      data: { status: 'CANCELLED', completedAt: new Date() },
    });
  }

  async getResults(id: string, page: number, limit: number) {
    const search = await this.prisma.search.findUnique({ where: { id } });
    if (!search) throw new NotFoundException('Pesquisa não encontrada');

    const { skip, take } = getPaginationParams({ page, limit });
    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where: { searchId: id },
        skip,
        take,
        orderBy: { rating: 'desc' },
        include: { enrichedData: true },
      }),
      this.prisma.company.count({ where: { searchId: id } }),
    ]);

    return { data, meta: createPaginationMeta(total, page, take) };
  }

  streamProgress(id: string): Observable<any> {
    const subject = this.progressStreams.get(id);
    if (!subject) {
      const newSubject = new Subject<any>();
      this.progressStreams.set(id, newSubject);
      return newSubject.asObservable();
    }
    return subject.asObservable();
  }

  async updateProgress(searchId: string, data: Partial<{ progress: number; totalFound: number; totalEnriched: number; status: SearchStatus }>) {
    await this.prisma.search.update({ where: { id: searchId }, data });
    const subject = this.progressStreams.get(searchId);
    if (subject) {
      subject.next({ type: 'progress', ...data });
    }
  }

  async addLog(searchId: string, message: string, level = 'info', source?: string) {
    await this.prisma.searchLog.create({
      data: { searchId, message, level, source },
    });
    const subject = this.progressStreams.get(searchId);
    if (subject) {
      subject.next({ type: 'log', message, level, source, timestamp: new Date().toISOString() });
    }
  }
}
