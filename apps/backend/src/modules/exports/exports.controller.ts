import { Controller, Get, Post, Param, Query, Body, UseGuards, Res } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { ExportsService } from './exports.service';
import { CreateExportDto } from './dto/export.dto';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-objectid.pipe';

@ApiTags('Exports')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('exports')
export class ExportsController {
  constructor(private readonly exportsService: ExportsService) {}

  @Post()
  @ApiOperation({ summary: 'Criar nova exportação' })
  async create(@CurrentUser('id') userId: string, @Body() dto: CreateExportDto) {
    return this.exportsService.create(userId, dto);
  }

  @Get()
  @ApiOperation({ summary: 'Listar exportações do usuário' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.exportsService.findAll(userId, +page, +limit);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Obter status da exportação' })
  async findOne(@Param('id', ParseUUIDPipe) id: string) {
    return this.exportsService.findById(id);
  }

  @Get(':id/download')
  @ApiOperation({ summary: 'Fazer download da exportação' })
  async download(
    @Param('id', ParseUUIDPipe) id: string,
    @Res() res: Response,
  ) {
    return this.exportsService.download(id, res);
  }
}
