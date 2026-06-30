import { Controller, Get, Post, Delete, Param, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { FavoritesService } from './favorites.service';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { ParseUUIDPipe } from '../../common/pipes/parse-objectid.pipe';

@ApiTags('Favorites')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('favorites')
export class FavoritesController {
  constructor(private readonly favoritesService: FavoritesService) {}

  @Get()
  @ApiOperation({ summary: 'Listar favoritos do usuário' })
  async findAll(
    @CurrentUser('id') userId: string,
    @Query('page') page = 1,
    @Query('limit') limit = 20,
  ) {
    return this.favoritesService.findAll(userId, +page, +limit);
  }

  @Post(':companyId')
  @ApiOperation({ summary: 'Adicionar empresa aos favoritos' })
  async addFavorite(
    @CurrentUser('id') userId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.favoritesService.add(userId, companyId);
  }

  @Delete(':companyId')
  @ApiOperation({ summary: 'Remover empresa dos favoritos' })
  async removeFavorite(
    @CurrentUser('id') userId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.favoritesService.remove(userId, companyId);
  }

  @Get('check/:companyId')
  @ApiOperation({ summary: 'Verificar se empresa está nos favoritos' })
  async check(
    @CurrentUser('id') userId: string,
    @Param('companyId', ParseUUIDPipe) companyId: string,
  ) {
    return this.favoritesService.isFavorited(userId, companyId);
  }
}
