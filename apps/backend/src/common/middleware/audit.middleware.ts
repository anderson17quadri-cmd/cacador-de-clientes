import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalEnd = res.end;

    res.end = function (...args: any[]) {
      const responseTime = Date.now() - startTime;
      const userId = (req as any).user?.id;

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        prisma.auditLog
          .create({
            data: {
              userId: userId || null,
              action: req.method,
              entity: req.baseUrl.split('/')[2] || 'unknown',
              entityId: (req as any).params?.id,
              details: { body: req.body, query: req.query, params: req.params },
              ip: req.ip,
              userAgent: req.get('user-agent') || '',
            },
          })
          .catch(() => {});
      }

      return originalEnd.apply(res, args);
    };

    next();
  }
}
