import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { PrismaClient } from '@prisma/client';

@Injectable()
export class PrismaService extends PrismaClient implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(PrismaService.name);

  constructor() {
    super({
      log:
        process.env.NODE_ENV === 'development'
          ? ['query', 'info', 'warn', 'error']
          : ['error'],
    });

    const encodedFields: Record<string, string[]> = {
      Search: ['sources'],
      SearchJob: ['metadata'],
      Company: ['openingHours', 'photos', 'rawData'],
      DataExport: ['filters'],
      AuditLog: ['details'],
      Notification: ['data'],
      CacheEntry: ['value'],
    };

    this.$use(async (params, next) => {
      const fields = params.model ? encodedFields[params.model] || [] : [];
      const encode = (record: any) => {
        if (!record || typeof record !== 'object') return;
        for (const field of fields) {
          if (field in record && record[field] !== null && typeof record[field] !== 'string') {
            record[field] = JSON.stringify(record[field]);
          }
        }
      };
      if (Array.isArray(params.args?.data)) params.args.data.forEach(encode);
      else encode(params.args?.data);

      const result = await next(params);
      const decode = (value: any): any => {
        if (Array.isArray(value)) return value.map(decode);
        if (!value || typeof value !== 'object' || value instanceof Date) return value;
        for (const [key, child] of Object.entries(value)) {
          if (['sources', 'metadata', 'openingHours', 'photos', 'rawData', 'filters', 'details', 'data', 'value'].includes(key) && typeof child === 'string') {
            try { value[key] = JSON.parse(child); } catch { /* mantém texto legado */ }
          } else {
            value[key] = decode(child);
          }
        }
        return value;
      };
      return decode(result);
    });
  }

  async onModuleInit() {
    await this.$connect();
    this.logger.log('Database connected');
  }

  async onModuleDestroy() {
    await this.$disconnect();
    this.logger.log('Database disconnected');
  }

  async cleanDatabase() {
    if (process.env.NODE_ENV !== 'test') return;
    const models = Reflect.ownKeys(this).filter(
      (key) => {
        const k = String(key);
        return k[0] !== '_' && k[0] !== '$' &&
          typeof (this as Record<string, any>)[k]?.deleteMany === 'function';
      },
    );
    return Promise.all(
      models.map((modelKey) => (this as Record<string, any>)[String(modelKey)].deleteMany()),
    );
  }
}
