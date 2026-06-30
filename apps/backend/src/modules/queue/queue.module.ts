import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { SearchProcessor } from './processors/search.processor';
import { EnrichmentProcessor } from './processors/enrichment.processor';
import { ExportProcessor } from './processors/export.processor';
import { SearchModule } from '../search/search.module';
import { CompaniesModule } from '../companies/companies.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { ExportsModule } from '../exports/exports.module';
import { NotificationsModule } from '../notifications/notifications.module';

@Module({
  imports: [
    BullModule.registerQueue(
      { name: 'search' },
      { name: 'enrichment' },
      { name: 'exports' },
    ),
    SearchModule,
    CompaniesModule,
    EnrichmentModule,
    ExportsModule,
    NotificationsModule,
  ],
  providers: [SearchProcessor, EnrichmentProcessor, ExportProcessor],
  exports: [BullModule],
})
export class QueueModule {}
