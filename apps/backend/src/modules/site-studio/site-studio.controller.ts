import { Body, Controller, Get, Param, Patch, Post, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateSiteProjectDto, UpdateAiConfigDto, UpdateSiteProjectDto } from './dto/site-studio.dto';
import { SiteStudioService } from './site-studio.service';

@UseGuards(JwtAuthGuard)
@Controller('site-studio')
export class SiteStudioController {
  constructor(private readonly service: SiteStudioService) {}
  @Get('config') config(@CurrentUser('id') userId: string) { return this.service.getConfig(userId); }
  @Patch('config') updateConfig(@CurrentUser('id') userId: string, @Body() dto: UpdateAiConfigDto) { return this.service.updateConfig(userId, dto); }
  @Post('config/test') testConfig(@CurrentUser('id') userId: string) { return this.service.testConfig(userId); }
  @Get() list(@CurrentUser('id') userId: string) { return this.service.list(userId); }
  @Post() create(@CurrentUser('id') userId: string, @Body() dto: CreateSiteProjectDto) { return this.service.create(userId, dto); }
  @Get(':id') get(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.get(userId, id); }
  @Patch(':id') update(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateSiteProjectDto) { return this.service.update(userId, id, dto); }
  @Post(':id/generate') generate(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.generate(userId, id); }
  @Post(':id/versions/:versionId/restore') restore(@CurrentUser('id') userId: string, @Param('id') id: string, @Param('versionId') versionId: string) { return this.service.restore(userId, id, versionId); }
  @Get(':id/preview') preview(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.preview(userId, id); }
  @Get(':id/export') async export(@CurrentUser('id') userId: string, @Param('id') id: string, @Res() response: Response) {
    const result = await this.service.export(userId, id);
    response.setHeader('Content-Type', 'application/zip'); response.setHeader('Content-Disposition', `attachment; filename="${result.fileName}"`); return response.send(result.buffer);
  }
}
