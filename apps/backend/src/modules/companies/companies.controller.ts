import { Controller, Get, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { CompaniesService } from './companies.service';
import { CompanyFilterDto } from './dto/company-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { ParseUUIDPipe } from '../../common/pipes/parse-objectid.pipe';

@ApiTags('Companies')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('companies')
export class CompaniesController {
  constructor(private readonly companiesService: CompaniesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar todas as empresas com filtros' })
  async findAll(@Query() filters: CompanyFilterDto) {
    return this.companiesService.findAll(filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes da empresa' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.findById(id);
  }

  @Get(':id/analysis')
  @ApiOperation({ summary: 'Obter análise da empresa' })
  async getAnalysis(@Param('id', ParseUUIDPipe) id: string) {
    return this.companiesService.getAnalysis(id);
  }

  @Get('stats/overview')
  @ApiOperation({ summary: 'Visão geral estatística das empresas' })
  async getOverview() {
    return this.companiesService.getOverview();
  }
}
