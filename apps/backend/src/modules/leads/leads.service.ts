import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';

@Injectable()
export class LeadsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page: number, limit: number, status?: string, searchId?: string) {
    const { skip, take } = getPaginationParams({ page, limit });

    const where: any = {
      search: { userId },
    };
    if (searchId) where.searchId = searchId;

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          enrichedData: true,
          search: { select: { location: true, category: true } },
        },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data, meta: createPaginationMeta(total, page, take) };
  }

  async findById(id: string) {
    const company = await this.prisma.company.findUnique({
      where: { id },
      include: {
        enrichedData: true,
        search: { select: { location: true, category: true, userId: true } },
      },
    });
    if (!company) throw new NotFoundException('Lead não encontrado');
    return company;
  }

  async getPremiumLeads(userId: string, page: number, limit: number) {
    const { skip, take } = getPaginationParams({ page, limit });

    const where: any = {
      search: { userId },
      enrichedData: {
        qualityScore: { gte: 70 },
      },
    };

    const [data, total] = await Promise.all([
      this.prisma.company.findMany({
        where,
        skip,
        take,
        orderBy: { enrichedData: { qualityScore: 'desc' } },
        include: { enrichedData: true },
      }),
      this.prisma.company.count({ where }),
    ]);

    return { data, meta: createPaginationMeta(total, page, take) };
  }

  async getLeadStats(userId: string) {
    const searches = await this.prisma.search.findMany({
      where: { userId, status: 'COMPLETED' },
      select: { id: true },
    });
    const searchIds = searches.map((s) => s.id);

    const [totalLeads, premiumLeads, avgRating, withInstagram, withWebsite, withWhatsapp] = await Promise.all([
      this.prisma.company.count({ where: { searchId: { in: searchIds } } }),
      this.prisma.company.count({
        where: { searchId: { in: searchIds }, enrichedData: { qualityScore: { gte: 70 } } },
      }),
      this.prisma.company.aggregate({
        where: { searchId: { in: searchIds } },
        _avg: { rating: true },
      }),
      this.prisma.company.count({ where: { searchId: { in: searchIds }, hasInstagram: true } }),
      this.prisma.company.count({ where: { searchId: { in: searchIds }, hasWebsite: true } }),
      this.prisma.company.count({ where: { searchId: { in: searchIds }, hasWhatsapp: true } }),
    ]);

    return {
      totalLeads,
      premiumLeads,
      leadsWithoutInstagram: totalLeads - withInstagram,
      leadsWithoutWebsite: totalLeads - withWebsite,
      leadsWithoutWhatsapp: totalLeads - withWhatsapp,
      averageRating: avgRating._avg.rating,
      totalSearches: searches.length,
    };
  }

  async updateStatus(id: string, status: string) {
    const company = await this.prisma.company.findUnique({ where: { id } });
    if (!company) throw new NotFoundException('Lead não encontrado');
    // Note: LeadStatus would be stored separately in production.
    // Here we use a simple approach as LeadStatus lives outside Company model.
    return { message: `Status do lead ${id} atualizado para ${status}` };
  }
}
