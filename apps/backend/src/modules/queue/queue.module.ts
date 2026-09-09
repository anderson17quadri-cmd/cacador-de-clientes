import { Inject, Module, OnModuleInit } from '@nestjs/common';
import { getQueueToken } from '@nestjs/bullmq';
import { SearchProcessor } from './processors/search.processor';
import { EnrichmentProcessor } from './processors/enrichment.processor';
import { ExportProcessor } from './processors/export.processor';
import { SearchModule } from '../search/search.module';
import { CompaniesModule } from '../companies/companies.module';
import { EnrichmentModule } from '../enrichment/enrichment.module';
import { ExportsModule } from '../exports/exports.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { LocalQueue, LocalQueueModule } from './local-queue.module';

@Module({
  imports: [
    LocalQueueModule,
    SearchModule,
    CompaniesModule,
    EnrichmentModule,
    ExportsModule,
    NotificationsModule,
  ],
  providers: [SearchProcessor, EnrichmentProcessor, ExportProcessor],
  exports: [LocalQueueModule],
})
export class QueueModule implements OnModuleInit {
  constructor(
    @Inject(getQueueToken('search')) private readonly searchQueue: LocalQueue,
    @Inject(getQueueToken('enrichment')) private readonly enrichmentQueue: LocalQueue,
    @Inject(getQueueToken('exports')) private readonly exportsQueue: LocalQueue,
    private readonly searchProcessor: SearchProcessor,
    private readonly enrichmentProcessor: EnrichmentProcessor,
    private readonly exportProcessor: ExportProcessor,
  ) {}

  onModuleInit() {
    this.searchQueue.register((job) => this.searchProcessor.process(job as any));
    this.enrichmentQueue.register((job) => this.enrichmentProcessor.process(job as any));
    this.exportsQueue.register((job) => this.exportProcessor.process(job as any));
  }
}
