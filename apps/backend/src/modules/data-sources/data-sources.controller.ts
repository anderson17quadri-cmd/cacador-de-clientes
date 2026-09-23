import { Body, Controller, Get, Patch, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../../common/decorators/current-user.decorator';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { DataSourcesService } from './data-sources.service';
import { TestDataSourceDto, UpdateDataSourcesDto } from './dto/data-sources.dto';

@UseGuards(JwtAuthGuard)
@Controller('data-sources')
export class DataSourcesController {
  constructor(private readonly service: DataSourcesService) {}

  @Get() config(@CurrentUser('id') userId: string) { return this.service.getConfig(userId); }
  @Patch() update(@CurrentUser('id') userId: string, @Body() dto: UpdateDataSourcesDto) {
    return this.service.updateConfig(userId, dto);
  }
  @Post('test') test(@CurrentUser('id') userId: string, @Body() dto: TestDataSourceDto) {
    return this.service.test(userId, dto.provider);
  }
}
