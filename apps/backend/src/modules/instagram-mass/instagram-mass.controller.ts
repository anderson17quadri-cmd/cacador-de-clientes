import { Body, Controller, Get, Param, Post, Query, UseGuards } from '@nestjs/common';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { CreateInstagramMassDto, InstagramMassResultsDto } from './dto/instagram-mass.dto';
import { InstagramMassService } from './instagram-mass.service';

@UseGuards(JwtAuthGuard)
@Controller('instagram-mass')
export class InstagramMassController {
  constructor(private readonly service: InstagramMassService) {}
  @Get() list(@CurrentUser('id') userId: string) { return this.service.list(userId); }
  @Post() create(@CurrentUser('id') userId: string, @Body() dto: CreateInstagramMassDto) { return this.service.create(userId, dto); }
  @Get(':id') get(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.get(userId, id); }
  @Get(':id/results') results(@CurrentUser('id') userId: string, @Param('id') id: string, @Query() filters: InstagramMassResultsDto) { return this.service.results(userId, id, filters); }
  @Get(':id/selection') selection(@CurrentUser('id') userId: string, @Param('id') id: string, @Query() filters: InstagramMassResultsDto) { return this.service.selection(userId, id, filters); }
  @Post(':id/validate') validate(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.validate(userId, id); }
  @Post(':id/rediscover') rediscover(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.rediscover(userId, id); }
  @Post(':id/pause') pause(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.pause(userId, id); }
  @Post(':id/resume') resume(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.resume(userId, id); }
  @Post(':id/cancel') cancel(@CurrentUser('id') userId: string, @Param('id') id: string) { return this.service.cancel(userId, id); }
}
