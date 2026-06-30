import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { UpdateUserDto } from './dto/user.dto';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(page: number, limit: number) {
    const { skip, limit: take, sortBy, sortOrder } = getPaginationParams({ page, limit });
    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        skip,
        take,
        orderBy: { [sortBy]: sortOrder },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          plan: true,
          avatarUrl: true,
          createdAt: true,
          lastLoginAt: true,
          _count: { select: { searches: true, favorites: true } },
        },
      }),
      this.prisma.user.count(),
    ]);
    return { data: users, meta: createPaginationMeta(total, page, take) };
  }

  async findById(id: string) {
    const user = await this.prisma.user.findUnique({
      where: { id },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        avatarUrl: true,
        emailVerified: true,
        createdAt: true,
        lastLoginAt: true,
        _count: { select: { searches: true, favorites: true, exports: true } },
      },
    });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    return user;
  }

  async update(id: string, dto: UpdateUserDto) {
    const existing = await this.prisma.user.findUnique({ where: { id } });
    if (!existing) throw new NotFoundException('Usuário não encontrado');

    if (dto.email && dto.email !== existing.email) {
      const emailTaken = await this.prisma.user.findUnique({ where: { email: dto.email } });
      if (emailTaken) throw new ConflictException('Email já está em uso');
    }

    return this.prisma.user.update({
      where: { id },
      data: dto,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        plan: true,
        avatarUrl: true,
        createdAt: true,
        updatedAt: true,
      },
    });
  }

  async remove(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new NotFoundException('Usuário não encontrado');
    await this.prisma.user.delete({ where: { id } });
    return { message: 'Usuário removido com sucesso' };
  }

  async getStats(userId: string) {
    const [searches, favorites, exports, totalCompanies] = await Promise.all([
      this.prisma.search.count({ where: { userId } }),
      this.prisma.favorite.count({ where: { userId } }),
      this.prisma.dataExport.count({ where: { userId } }),
      this.prisma.company.count({ where: { search: { userId } } }),
    ]);
    return { searches, favorites, exports, totalCompanies };
  }
}
