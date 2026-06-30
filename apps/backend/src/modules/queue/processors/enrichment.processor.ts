import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { PrismaService } from '../../../database/prisma.service';
import { EnrichmentService } from '../../enrichment/enrichment.service';
import { SearchService } from '../../search/search.service';
import { NotificationsService } from '../../notifications/notifications.service';
import { AI_ENRICHMENT_BATCH_SIZE, AI_ENRICHMENT_CONCURRENCY } from '../../../common/constants';

@Processor('enrichment')
export class EnrichmentProcessor extends WorkerHost {
  private readonly logger = new Logger(EnrichmentProcessor.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly enrichmentService: EnrichmentService,
    private readonly searchService: SearchService,
    private readonly notifications: NotificationsService,
  ) {
    super();
  }

  async process(job: Job<{ searchId: string; userId: string; companyIds: string[] }>) {
    const { searchId, userId, companyIds } = job.data;

    try {
      await this.searchService.addLog(searchId, 'Iniciando análise de IA para cada empresa...', 'info', 'ai');

      let enriched = 0;
      const total = companyIds.length;
      const batches = [];

      for (let i = 0; i < companyIds.length; i += AI_ENRICHMENT_BATCH_SIZE) {
        batches.push(companyIds.slice(i, i + AI_ENRICHMENT_BATCH_SIZE));
      }

      for (const batch of batches) {
        const companies = await this.prisma.company.findMany({
          where: { id: { in: batch } },
        });

        await Promise.all(
          companies.map(async (company) => {
            try {
              await this.enrichmentService.enrichCompany(company);
              enriched++;
              const progress = Math.round(55 + (enriched / total) * 40);
              await this.searchService.updateProgress(searchId, {
                progress,
                totalEnriched: enriched,
              });
            } catch (error: any) {
              this.logger.warn(`Enriquecimento falhou para ${company.name}: ${error.message}`);
            }
          }),
        );
      }

      await this.prisma.search.update({
        where: { id: searchId },
        data: {
          status: 'COMPLETED',
          progress: 100,
          totalEnriched: enriched,
          completedAt: new Date(),
        },
      });

      await this.searchService.addLog(searchId, `${enriched}/${total} empresas analisadas com sucesso!`, 'success', 'ai');

      await this.notifications.create(
        userId,
        'Pesquisa concluída!',
        `${enriched} empresas encontradas e analisadas.`,
        'success',
        { searchId },
      );

    } catch (error: any) {
      this.logger.error(`Enriquecimento falhou: ${error.message}`, error.stack);
      await this.prisma.search.update({
        where: { id: searchId },
        data: { status: 'FAILED', error: error.message, completedAt: new Date() },
      });
      await this.notifications.create(
        userId,
        'Erro na pesquisa',
        `Ocorreu um erro: ${error.message}`,
        'error',
        { searchId },
      );
    }
  }
}
