import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { ExportsService } from '../../exports/exports.service';

@Processor('exports')
export class ExportProcessor extends WorkerHost {
  private readonly logger = new Logger(ExportProcessor.name);

  constructor(private readonly exportsService: ExportsService) {
    super();
  }

  async process(job: Job<{ exportId: string; userId: string }>) {
    const { exportId, userId } = job.data;

    try {
      this.logger.log(`Processando exportação ${exportId}`);
      await this.exportsService.processExport(exportId, userId);
      this.logger.log(`Exportação ${exportId} concluída`);
    } catch (error: any) {
      this.logger.error(`Exportação ${exportId} falhou: ${error.message}`);
      await this.exportsService.failExport(exportId, error.message);
    }
  }
}
