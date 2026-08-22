import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { CompanyFilterDto } from './dto/company-filter.dto';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';
import { deserializeCompany, stringifyJson } from '../../common/utils/json-fields';

@Injectable()
export class CompaniesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(filters: CompanyFilterDto) {
    const { page, limit, skip } = getPaginationParams({
      page: filters.page,
      limit: filters.limit,
    });

    const where: any = {};

    if (filters.search) {
      where.OR = [
        { name: { contains: filters.search } },
        { description: { contains: filters.search } },
        { category: { contains: filters.search } },
      ];
    }
    if (filters.category) where.category = filters.category;
    if (filters.city) where.city = { contains: filters.city };
    if (filters.state) where.state = filters.state;
    if (filters.country) where.country = filters.country;
    if (filters.minRating !== undefined) where.rating = { gte: filters.minRating };
    if (filters.maxRating !== undefined) where.rating = { ...where.rating, lte: filters.maxRating };
    if (filters.minTotalRatings !== undefined) where.totalRatings = { gte: filters.minTotalRatings };
    if (filters.hasWebsite !== undefined) where.hasWebsite = filters.hasWebsite;
    if (filters.hasInstagram !== undefined) where.hasInstagram = filters.hasInstagram;
    if (filters.hasWhatsapp !== undefined) where.hasWhatsapp = filters.hasWhatsapp;
    if (filters.hasEmail !== undefined) where.hasEmail = filters.hasEmail;
    if (filters.hasFacebook !== undefined) where.hasFacebook = filters.hasFacebook;
    if (filters.searchId) where.searchId = filters.searchId;
    if (filters.minQualityScore !== undefined) {
      where.enrichedData = { qualityScore: { gte: filters.minQualityScore } };
    }

    const sortBy = filters.sortBy || 'rating';
    const sortOrder = filters.sortOrder || 'desc';
    const orderBy: any = {};

    if (['qualityScore', 'presenceLevel'].includes(sortBy)) {
      orderBy.enrichedData = { [sortBy]: sortOrder };
    } else {
      orderBy[sortBy] = sortOrder;
    }

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: { enrichedData: true },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data: data.map(deserializeCompany), meta: createPaginationMeta(total, page, limit) };
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { enrichedData: true, search: { select: { location: true, category: true } } },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    return deserializeCompany(company);
  }

  async getAnalysis(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: { enrichedData: true },
    });
    if (!company) throw new NotFoundException('Empresa não encontrada');
    if (!company.enrichedData) throw new NotFoundException('Análise não disponível');
    return company.enrichedData;
  }

  async deduplicateAndSave(searchId: string, companies: any[], source: string) {
    const results: any[] = [];

    for (const company of companies) {
      const sourceId = company.sourceId || company.id || company.place_id;
      const name = company.name || company.title || 'Sem nome';

      let existing = null;
      if (sourceId) {
        existing = await this.prisma.company.findUnique({
          where: { source_sourceId: { source, sourceId } },
        });
      }

      if (!existing && company.latitude && company.longitude) {
        existing = await this.prisma.company.findFirst({
          where: {
            name,
            latitude: { gte: company.latitude - 0.001, lte: company.latitude + 0.001 },
            longitude: { gte: company.longitude - 0.001, lte: company.longitude + 0.001 },
          },
        });
      }

      if (!existing) {
        const created = await this.prisma.company.create({
          data: {
            name,
            category: company.category || '',
            description: company.description || null,
            phone: company.phone || null,
            whatsapp: company.whatsapp || null,
            email: company.email || null,
            website: company.website || null,
            instagram: company.instagram || null,
            facebook: company.facebook || null,
            linkedin: company.linkedin || null,
            tiktok: company.tiktok || null,
            youtube: company.youtube || null,
            address: company.address || null,
            street: company.street || null,
            number: company.number || null,
            neighborhood: company.neighborhood || null,
            city: company.city || null,
            state: company.state || null,
            postalCode: company.postalCode || null,
            country: company.country || null,
            latitude: company.latitude || null,
            longitude: company.longitude || null,
            googleMapsLink: company.googleMapsLink || null,
            openingHours: stringifyJson(company.openingHours),
            rating: company.rating || null,
            totalRatings: company.totalRatings || null,
            photos: stringifyJson(company.photos || []) as string,
            isOpen: company.isOpen || null,
            hasWebsite: !!company.website,
            hasInstagram: !!company.instagram,
            hasFacebook: !!company.facebook,
            hasWhatsapp: !!company.whatsapp || !!company.phone,
            hasEmail: !!company.email,
            source,
            sourceId: sourceId || null,
            sourceUrl: company.sourceUrl || null,
            rawData: stringifyJson(company.rawData),
            searchId,
          },
        });
        results.push(deserializeCompany(created));
      } else {
        results.push(deserializeCompany(existing));
      }
    }

    return results;
  }

  async getOverview() {
    const [total, withInstagram, withWebsite, withWhatsapp, withEmail, ratingStats] = await Promise.all([
      this.prisma.company.count(),
      this.prisma.company.count({ where: { hasInstagram: true } }),
      this.prisma.company.count({ where: { hasWebsite: true } }),
      this.prisma.company.count({ where: { hasWhatsapp: true } }),
      this.prisma.company.count({ where: { hasEmail: true } }),
      this.prisma.company.aggregate({
        _avg: { rating: true },
        _count: { rating: true },
      }),
    ]);

    return {
      totalCompanies: total,
      withInstagram,
      withoutInstagram: total - withInstagram,
      withWebsite,
      withoutWebsite: total - withWebsite,
      withWhatsapp,
      withoutWhatsapp: total - withWhatsapp,
      withEmail,
      withoutEmail: total - withEmail,
      averageRating: ratingStats._avg.rating,
      totalRated: ratingStats._count.rating,
    };
  }

  async getRecentBySearchId(searchId: string, limit = 50) {
    const companies = await this.prisma.company.findMany({
      where: { searchId },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: { enrichedData: true },
    });
    return companies.map(deserializeCompany);
  }
}
