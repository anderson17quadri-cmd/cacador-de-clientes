import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { InstagramMassController } from './instagram-mass.controller';
import { InstagramMassService } from './instagram-mass.service';
import { ProspectingModule } from '../prospecting/prospecting.module';
import { InstagramDiscoveryService } from './instagram-discovery.service';

@Module({
  imports: [SearchModule, NotificationsModule, ProspectingModule],
  controllers: [InstagramMassController],
  providers: [InstagramMassService, InstagramDiscoveryService],
  exports: [InstagramMassService],
})
export class InstagramMassModule {}
