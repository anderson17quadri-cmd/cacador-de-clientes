import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ExportsController } from './exports.controller';
import { ExportsService } from './exports.service';

@Module({
  imports: [BullModule.registerQueue({ name: 'exports' })],
  controllers: [ExportsController],
  providers: [ExportsService],
  exports: [ExportsService],
})
export class ExportsModule {}
