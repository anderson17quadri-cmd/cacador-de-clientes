import { Injectable } from '@nestjs/common';
import { PrismaService } from '../../database/prisma.service';
import { getPaginationParams, createPaginationMeta } from '../../common/utils/pagination';

@Injectable()
export class NotificationsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: string, page: number, limit: number, unreadOnly?: boolean) {
    const { skip, take } = getPaginationParams({ page, limit });
    const where: any = { userId };
    if (unreadOnly) where.read = false;

    const [data, total] = await Promise.all([
      this.prisma.notification.findMany({
        where,
        skip,
        take,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.notification.count({ where }),
    ]);

    return { data, meta: createPaginationMeta(total, page, take) };
  }

  async markAsRead(id: string) {
    return this.prisma.notification.update({ where: { id }, data: { read: true } });
  }

  async markAllAsRead(userId: string) {
    await this.prisma.notification.updateMany({
      where: { userId, read: false },
      data: { read: true },
    });
    return { message: 'Todas notificações marcadas como lidas' };
  }

  async getUnreadCount(userId: string) {
    const count = await this.prisma.notification.count({ where: { userId, read: false } });
    return { count };
  }

  async create(userId: string, title: string, message: string, type = 'info', data?: any) {
    const preferences = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { searchNotifications: true },
    });
    if (preferences && !preferences.searchNotifications) return null;

    return this.prisma.notification.create({
      data: { userId, title, message, type, data },
    });
  }
}
