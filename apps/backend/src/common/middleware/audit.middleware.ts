import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { PrismaService } from '../../database/prisma.service';

@Injectable()
export class AuditMiddleware implements NestMiddleware {
  constructor(private readonly prisma: PrismaService) {}

  async use(req: Request, res: Response, next: NextFunction) {
    const startTime = Date.now();
    const originalEnd = res.end;
    const prismaService = this.prisma;

    res.end = function (this: Response, chunk?: any, encoding?: any, cb?: any): any {
      const responseTime = Date.now() - startTime;
      const userId = (req as any).user?.id;

      if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
        let details: string | null = null;
        try {
          details = JSON.stringify({ body: req.body, query: req.query, params: req.params });
        } catch {
          // ignore unstringifiable payloads (e.g. circular refs)
        }

        prismaService.auditLog
          .create({
            data: {
              userId: userId || null,
              action: req.method,
              entity: req.baseUrl.split('/')[2] || 'unknown',
              entityId: (req as any).params?.id,
              details,
              ip: req.ip || '',
              userAgent: req.get('user-agent') || '',
            },
          })
          .catch(() => {});
      }

      return originalEnd.call(res, chunk, encoding, cb);
    };

    next();
  }
}
