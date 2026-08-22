import { Injectable, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';
import { deserializeCompany } from '../../common/utils/json-fields';

@Injectable()
export class FavoritesService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page: number, limit: number) {
    const { skip, take } = getPaginationParams({ page, limit });

    const [data, total] = await Promise.all([
      this.prisma.favorite.findMany({
        where: { userId },
        skip,
        take,
        orderBy: { createdAt: 'desc' },
        include: {
          company: { include: { enrichedData: true } },
        },
      }),
      this.prisma.favorite.count({ where: { userId } }),
    ]);

    return {
      data: data.map((f) => ({ ...f, company: deserializeCompany(f.company) })),
      meta: createPaginationMeta(total, page, take),
    };
  }

  async add(userId: string, companyId: string) {
    const company = await this.prisma.company.findUnique({ where: { id: companyId } });
    if (!company) throw new NotFoundException('Empresa não encontrada');

    const existing = await this.prisma.favorite.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (existing) throw new ConflictException('Empresa já está nos favoritos');

    const favorite = await this.prisma.favorite.create({
      data: { userId, companyId },
      include: { company: true },
    });
    return { ...favorite, company: deserializeCompany(favorite.company) };
  }

  async remove(userId: string, companyId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    if (!favorite) throw new NotFoundException('Favorito não encontrado');

    await this.prisma.favorite.delete({
      where: { userId_companyId: { userId, companyId } },
    });
    return { message: 'Removido dos favoritos' };
  }

  async isFavorited(userId: string, companyId: string) {
    const favorite = await this.prisma.favorite.findUnique({
      where: { userId_companyId: { userId, companyId } },
    });
    return { isFavorited: !!favorite };
  }
}
