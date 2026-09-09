import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { ThrottlerModule, ThrottlerGuard } from '@nestjs/throttler';
import { APP_GUARD } from '@nestjs/core';
import { ScheduleModule } from '@nestjs/schedule';
import { AuthModule } from './modules/auth/auth.module';
import { UsersModule } from './modules/users/users.module';
import { CompaniesModule } from './modules/companies/companies.module';
import { SearchModule } from './modules/search/search.module';
import { LeadsModule } from './modules/leads/leads.module';
import { ExportsModule } from './modules/exports/exports.module';
import { FavoritesModule } from './modules/favorites/favorites.module';
import { EnrichmentModule } from './modules/enrichment/enrichment.module';
import { QueueModule } from './modules/queue/queue.module';
import { NotificationsModule } from './modules/notifications/notifications.module';
import { PrismaModule } from './database/prisma.module';
import configuration from './config/configuration';
import { validationSchema } from './config/validation';
import { HealthController } from './health.controller';
import { LocalQueueModule } from './modules/queue/local-queue.module';
import { CampaignsModule } from './modules/campaigns/campaigns.module';
import { ProspectingModule } from './modules/prospecting/prospecting.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      load: [configuration],
      validationSchema,
      envFilePath: ['.env', '.env.local'],
    }),
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        throttlers: [
          {
            ttl: config.get<number>('THROTTLE_TTL', 60000),
            limit: config.get<number>('THROTTLE_LIMIT', 60),
          },
        ],
      }),
    }),
    LocalQueueModule,
    ScheduleModule.forRoot(),
    PrismaModule,
    AuthModule,
    UsersModule,
    CompaniesModule,
    SearchModule,
    LeadsModule,
    ExportsModule,
    FavoritesModule,
    EnrichmentModule,
    QueueModule,
    NotificationsModule,
    CampaignsModule,
    ProspectingModule,
  ],
  controllers: [HealthController],
  providers: [
    { provide: APP_GUARD, useClass: ThrottlerGuard },
  ],
})
export class AppModule {}
