import { Body, Controller, Delete, Get, Param, Patch, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ProspectingService } from './prospecting.service';
import {
  CreateAutomationDto, CreateContactEventDto, GenerateMessagesDto, UpdateAutomationDto,
  UpdateLeadCrmDto, ValidateContactsDto,
} from './dto/prospecting.dto';

@UseGuards(JwtAuthGuard)
@Controller('prospecting')
export class ProspectingController {
  constructor(private readonly service: ProspectingService) {}

  @Get('pipeline') pipeline(@CurrentUser('id') userId: string) { return this.service.pipeline(userId); }
  @Get('states') states(@CurrentUser('id') userId: string, @Query('companyIds') ids = '') { return this.service.states(userId, ids.split(',').filter(Boolean)); }
  @Patch('leads/:id') updateLead(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateLeadCrmDto) { return this.service.updateLead(userId, id, dto); }
  @Post('validate') validate(@CurrentUser('id') userId: string, @Body() dto: ValidateContactsDto) { return this.service.validateContacts(userId, dto); }
  @Get('events') events(@CurrentUser('id') userId: string, @Query('channel') channel?: string) { return this.service.events(userId, channel); }
  @Post('events') event(@CurrentUser('id') userId: string, @Body() dto: CreateContactEventDto) { return this.service.addEvent(userId, dto); }
  @Post('generate-messages') generate(@CurrentUser('id') userId: string, @Body() dto: GenerateMessagesDto) { return this.service.generateMessages(userId, dto); }
  @Get('analytics') analytics(@CurrentUser('id') userId: string) { return this.service.analytics(userId); }
  @Get('automations') automations(@CurrentUser('id') userId: string) { return this.service.automations(userId); }
  @Post('automations') createAutomation(@CurrentUser('id') userId: string, @Body() dto: CreateAutomationDto) { return this.service.createAutomation(userId, dto); }
  @Patch('automations/:id') updateAutomation(@CurrentUser('id') userId: string, @Param('id') id: string, @Body() dto: UpdateAutomationDto) { return this.service.updateAutomation(userId, id, dto); }
  @Delete('automations/:id') deleteAutomation(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.deleteAutomation(userId, id); }
  @Post('automations/:id/run') runAutomation(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.runAutomation(userId, id); }
}

@Controller('webhooks/whatsapp')
export class WhatsappWebhookController {
  constructor(private readonly service: ProspectingService) {}
  @Get() verify(
    @Query('hub.mode') mode: string | undefined,
    @Query('hub.verify_token') token: string | undefined,
    @Query('hub.challenge') challenge: string | undefined,
    @Res() response: Response,
  ) {
    return response.status(200).send(this.service.verifyWebhook(mode, token, challenge));
  }
  @Post() receive(@Body() payload: any) { return this.service.receiveWebhook(payload); }
}
