import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { GooglePlacesService } from '../../services/collectors/google-places.service';
import { NominatimService } from '../../services/collectors/nominatim.service';
import { OverpassService } from '../../services/collectors/overpass.service';
import { FoursquareService } from '../../services/collectors/foursquare.service';
import { YelpService } from '../../services/collectors/yelp.service';
import { WebsiteEnricherService } from '../../services/collectors/website-enricher.service';
import { CompaniesModule } from '../companies/companies.module';

@Module({
  imports: [
    BullModule.registerQueue({ name: 'search' }),
    BullModule.registerQueue({ name: 'enrichment' }),
    CompaniesModule,
  ],
  controllers: [SearchController],
  providers: [SearchService, GooglePlacesService, NominatimService, OverpassService, FoursquareService, YelpService, WebsiteEnricherService],
  exports: [SearchService],
})
export class SearchModule {}
