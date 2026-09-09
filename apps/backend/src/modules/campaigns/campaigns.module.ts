import { Module } from '@nestjs/common';
import { CampaignsController } from './campaigns.controller';
import { CampaignsService } from './campaigns.service';
import { ProspectingModule } from '../prospecting/prospecting.module';

@Module({ imports: [ProspectingModule], controllers: [CampaignsController], providers: [CampaignsService] })
export class CampaignsModule {}
