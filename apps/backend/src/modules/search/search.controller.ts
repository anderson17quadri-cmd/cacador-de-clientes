import { Controller, Get, Post, Param, Query, Body, UseGuards, Sse, MessageEvent, Logger } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Observable } from 'rxjs';
import { SearchService } from './search.service';
import { SearchProcessor } from './search.processor';
import { CreateSearchDto } from './dto/search.dto';
import { SearchFilterDto } from './dto/search-filter.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-objectid.pipe';

@ApiTags('Search')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('search')
export class SearchController {
  private readonly logger = new Logger(SearchController.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly searchProcessor: SearchProcessor,
  ) {}

  @Post()
  @ApiOperation({ summary: 'Iniciar nova pesquisa' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateSearchDto) {
    const search = await this.searchService.create(userId, dto);

    this.searchProcessor
      .run({
        searchId: search.id,
        userId,
        latitude: search.latitude!,
        longitude: search.longitude!,
        category: search.category,
        radius: search.radius,
        sources: search.sources,
      })
      .catch((error: any) => this.logger.error(`Pesquisa ${search.id} falhou: ${error.message}`, error.stack));

    return search;
  }

  @Get()
  @ApiOperation({ summary: 'Listar pesquisas do usuário' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query() filters: SearchFilterDto,
  ) {
    return this.searchService.findAll(userId, filters);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter detalhes da pesquisa' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchService.findById(id);
  }

  @Get(':id/progress')
  @ApiOperation({ summary: 'Obter progresso da pesquisa' })
  async getProgress(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchService.getProgress(id);
  }

  @Get(':id/logs')
  @ApiOperation({ summary: 'Obter logs da pesquisa' })
  async getLogs(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('limit') limit = 50,
  ) {
    return this.searchService.getLogs(id, +limit);
  }

  @Post(':id/cancel')
  @ApiOperation({ summary: 'Cancelar pesquisa em andamento' })
  async cancel(@Param('id', ParseUUIDPipe) id: string) {
    return this.searchService.cancel(id);
  }

  @Get(':id/results')
  @ApiOperation({ summary: 'Obter resultados da pesquisa' })
  async getResults(
    @Param('id', ParseUUIDPipe) id: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.searchService.getResults(id, +page, +limit);
  }

  @Sse(':id/stream')
  @ApiOperation({ summary: 'Stream de progresso em tempo real (SSE)' })
  streamProgress(@Param('id') id: string): Observable<MessageEvent> {
    return this.searchService.streamProgress(id);
  }
}
