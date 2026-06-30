import { Controller, Get, Patch, Param, Query, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { LeadsService } from './leads.service';
import { UpdateLeadStatusDto } from './dto/lead.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-objectid.pipe';

@ApiTags('Leads')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('leads')
export class LeadsController {
  constructor(private readonly leadsService: LeadsService) {}

  @Get()
  @ApiOperation({ summary: 'Listar leads do usuário com filtros' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
    @Query('status') status?: string,
    @Query('searchId') searchId?: string,
  ) {
    return this.leadsService.findAll(userId, +page, +limit, status, searchId);
  }

  @Get('premium')
  @ApiOperation({ summary: 'Listar leads premium (alta qualidade)' })
  async getPremium(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.leadsService.getPremiumLeads(userId, +page, +limit);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas dos leads' })
  async getStats(@CurrentUser('id') userId: string) {
    return this.leadsService.getLeadStats(userId);
  }

  @Patch(':id/status')
  @ApiOperation({ summary: 'Atualizar status do lead' })
  async updateStatus(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateLeadStatusDto,
  ) {
    return this.leadsService.updateStatus(id, dto.status);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes do lead' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.leadsService.findById(id);
  }
}
