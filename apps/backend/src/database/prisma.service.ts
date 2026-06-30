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
