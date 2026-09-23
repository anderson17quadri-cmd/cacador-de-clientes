import { Module } from '@nestjs/common';
import { SiteStudioController } from './site-studio.controller';
import { SiteStudioService } from './site-studio.service';

@Module({ controllers: [SiteStudioController], providers: [SiteStudioService], exports: [SiteStudioService] })
export class SiteStudioModule {}
