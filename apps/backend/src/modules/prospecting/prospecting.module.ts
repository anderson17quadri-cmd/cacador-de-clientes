import { Module } from '@nestjs/common';
import { SearchModule } from '../search/search.module';
import { NotificationsModule } from '../notifications/notifications.module';
import { ProspectingController, WhatsappWebhookController } from './prospecting.controller';
import { ProspectingService } from './prospecting.service';
import { SiteStudioModule } from '../site-studio/site-studio.module';

@Module({
  imports: [SearchModule, NotificationsModule, SiteStudioModule],
  controllers: [ProspectingController, WhatsappWebhookController],
  providers: [ProspectingService],
  exports: [ProspectingService],
})
export class ProspectingModule {}
