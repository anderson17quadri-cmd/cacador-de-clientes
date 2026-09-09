import { Body, Controller, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CampaignsService } from './campaigns.service';
import {
  CampaignPreviewDto,
  CreateCampaignDto,
  TestCampaignConfigDto,
  UpdateCampaignConfigDto,
} from './dto/campaign.dto';

@ApiTags('Campaigns')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('campaigns')
export class CampaignsController {
  constructor(private readonly campaigns: CampaignsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar campanhas do usuário' })
  list(@CurrentUser('id') userId: string) { return this.campaigns.list(userId); }

  @Post('preview')
  @ApiOperation({ summary: 'Contar destinatários elegíveis' })
  preview(@CurrentUser('id') userId: string, @Body() dto: CampaignPreviewDto) {
    return this.campaigns.preview(userId, dto);
  }

  @Post()
  @ApiOperation({ summary: 'Criar campanha em rascunho' })
  create(@CurrentUser('id') userId: string, @Body() dto: CreateCampaignDto) {
    return this.campaigns.create(userId, dto);
  }

  @Post(':id/start')
  @ApiOperation({ summary: 'Iniciar campanha' })
  start(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.campaigns.start(userId, id);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar campanha' })
  cancel(@CurrentUser('id') userId: string, @Param('id') id: string) {
    return this.campaigns.cancel(userId, id);
  }

  @Get('config')
  getConfig(@CurrentUser('id') userId: string) { return this.campaigns.getConfig(userId); }

  @Patch('config')
  updateConfig(@CurrentUser('id') userId: string, @Body() dto: UpdateCampaignConfigDto) {
    return this.campaigns.updateConfig(userId, dto);
  }

  @Post('config/test')
  testConfig(@CurrentUser('id') userId: string, @Body() dto: TestCampaignConfigDto) {
    return this.campaigns.testConfig(userId, dto.channel);
  }
}
