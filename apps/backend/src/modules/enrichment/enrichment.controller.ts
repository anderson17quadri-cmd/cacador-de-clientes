import { Controller, Post, Param, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { EnrichmentService } from './enrichment.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { RolesGuard } from '../../common/guards/roles.guard';
import { Roles } from '../../common/decorators/roles.decorator';
import { UserRole } from '@prisma/client';
import { ParseUUIDPipe } from '../../common/pipes/parse-objectid.pipe';

@ApiTags('Enrichment')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('enrichment')
export class EnrichmentController {
  constructor(private readonly enrichmentService: EnrichmentService) {}

  @Post(':companyId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Executar enriquecimento manual (Admin)' })
  async enrichOne(@Param('companyId', ParseUUIDPipe) companyId: string) {
    return this.enrichmentService.enrichById(companyId);
  }

  @Post('search/:searchId')
  @Roles(UserRole.ADMIN, UserRole.SUPER_ADMIN)
  @ApiOperation({ summary: 'Reenriquecer todas as empresas de uma pesquisa (Admin)' })
  async enrichSearch(@Param('searchId', ParseUUIDPipe) searchId: string) {
    return this.enrichmentService.enrichBySearchId(searchId);
  }

  @Get('stats')
  @ApiOperation({ summary: 'Estatísticas de enriquecimento' })
  async getStats() {
    return this.enrichmentService.getStats();
  }
}
