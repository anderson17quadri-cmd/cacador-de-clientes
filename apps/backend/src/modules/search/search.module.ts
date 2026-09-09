import { Module } from '@nestjs/common';
import { SearchController } from './search.controller';
import { SearchService } from './search.service';
import { GooglePlacesService } from '../../services/collectors/google-places.service';
import { NominatimService } from '../../services/collectors/nominatim.service';
import { OverpassService } from '../../services/collectors/overpass.service';
import { FoursquareService } from '../../services/collectors/foursquare.service';
import { YelpService } from '../../services/collectors/yelp.service';
import { WebsiteEnricherService } from '../../services/collectors/website-enricher.service';
import { CompaniesModule } from '../companies/companies.module';
import { LocalQueueModule } from '../queue/local-queue.module';

@Module({
  imports: [
    LocalQueueModule,
    CompaniesModule,
  ],
  controllers: [SearchController],
  providers: [SearchService, GooglePlacesService, NominatimService, OverpassService, FoursquareService, YelpService, WebsiteEnricherService],
  exports: [SearchService, GooglePlacesService, NominatimService, OverpassService, FoursquareService, YelpService, WebsiteEnricherService],
})
export class SearchModule {}
