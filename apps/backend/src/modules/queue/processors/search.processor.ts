import { Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { Logger } from '@nestjs/common';
import { SearchService } from '../../search/search.service';
import { CompaniesService } from '../../companies/companies.service';
import { GooglePlacesService } from '../../../services/collectors/google-places.service';
import { NominatimService } from '../../../services/collectors/nominatim.service';
import { OverpassService } from '../../../services/collectors/overpass.service';
import { FoursquareService } from '../../../services/collectors/foursquare.service';
import { YelpService } from '../../../services/collectors/yelp.service';
import { WebsiteEnricherService } from '../../../services/collectors/website-enricher.service';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { PrismaService } from '../../../database/prisma.service';

@Processor('search')
export class SearchProcessor extends WorkerHost {
  private readonly logger = new Logger(SearchProcessor.name);

  constructor(
    private readonly searchService: SearchService,
    private readonly companiesService: CompaniesService,
    private readonly googlePlaces: GooglePlacesService,
    private readonly nominatim: NominatimService,
    private readonly overpass: OverpassService,
    private readonly foursquare: FoursquareService,
    private readonly yelp: YelpService,
    private readonly websiteEnricher: WebsiteEnricherService,
    private readonly prisma: PrismaService,
    @InjectQueue('enrichment') private readonly enrichmentQueue: Queue,
  ) {
    super();
  }

  async process(job: Job<{ searchId: string; userId: string; latitude: number; longitude: number; category: string; radius: number; sources: string[] }>) {
    const { searchId, userId, latitude, longitude, category, radius, sources } = job.data;

    try {
      await this.searchService.addLog(searchId, 'Iniciando coleta de dados...', 'info', 'system');
      await this.searchService.updateProgress(searchId, { progress: 5, status: 'RUNNING' });

      const allCompanies: any[] = [];
      const totalSources = sources.length;
      let completedSources = 0;

      for (const source of sources) {
        await this.searchService.addLog(searchId, `Consultando fonte: ${source}`, 'info', source);

        try {
          let results: any[] = [];
          switch (source) {
            case 'google_places':
              results = await this.googlePlaces.searchPlaces(latitude, longitude, radius, category);
              break;
            case 'nominatim':
              results = await this.nominatim.searchPlaces(latitude, longitude, radius, category);
              break;
            case 'overpass':
              results = await this.overpass.searchPlaces(latitude, longitude, radius, category);
              break;
            case 'foursquare':
              results = await this.foursquare.searchPlaces(latitude, longitude, radius, category);
              break;
            case 'yelp':
              results = await this.yelp.searchPlaces(latitude, longitude, radius, category);
              break;
          }

          await this.searchService.addLog(searchId, `${results.length} resultados de ${source}`, 'info', source);

          const deduped = await this.companiesService.deduplicateAndSave(searchId, results, source);
          allCompanies.push(...deduped);

          completedSources++;
          const progress = Math.round(5 + (completedSources / totalSources) * 45);
          await this.searchService.updateProgress(searchId, { progress, totalFound: allCompanies.length });
        } catch (error: any) {
          this.logger.error(`Erro na fonte ${source}: ${error.message}`);
          await this.searchService.addLog(searchId, `Erro em ${source}: ${error.message}`, 'error', source);
        }
      }

      await this.searchService.updateProgress(searchId, { progress: 50 });
      await this.searchService.addLog(searchId, `${allCompanies.length} empresas encontradas. Enriquecendo contactos via websites...`, 'info', 'system');

      await this.enrichContactsFromWebsites(searchId, allCompanies);

      await this.searchService.addLog(searchId, 'Contactos enriquecidos. Iniciando análise IA...', 'info', 'system');

      if (allCompanies.length > 0) {
        await this.enrichmentQueue.add('enrich-companies', {
          searchId,
          userId,
          companyIds: allCompanies.map((c: any) => c.id),
        });
      }

      await this.searchService.updateProgress(searchId, { progress: 55 });
      await this.searchService.addLog(searchId, 'Pesquisa concluída. Enriquecimento em progresso.', 'success', 'system');

    } catch (error: any) {
      this.logger.error(`Pesquisa falhou: ${error.message}`, error.stack);
      await this.searchService.addLog(searchId, `Falha crítica: ${error.message}`, 'error', 'system');
      await this.prisma.search.update({
        where: { id: searchId },
        data: { status: 'FAILED', error: error.message, completedAt: new Date() },
      });
    }
  }

  private async enrichContactsFromWebsites(searchId: string, companies: any[]) {
    let enriched = 0;

    for (const company of companies) {
      try {
        const updateData: any = {};

        if (company.website) {
          const contacts = await this.websiteEnricher.enrichFromWebsite(company.website);

          if (contacts.instagram && !company.instagram) {
            updateData.instagram = contacts.instagram;
            updateData.hasInstagram = true;
          }
          if (contacts.facebook && !company.facebook) {
            updateData.facebook = contacts.facebook;
            updateData.hasFacebook = true;
          }
          if (contacts.linkedin && !company.linkedin) {
            updateData.linkedin = contacts.linkedin;
          }
          if (contacts.youtube && !company.youtube) {
            updateData.youtube = contacts.youtube;
          }
          if (contacts.tiktok && !company.tiktok) {
            updateData.tiktok = contacts.tiktok;
          }
          if (contacts.email && !company.email) {
            updateData.email = contacts.email;
            updateData.hasEmail = true;
          }
          if (contacts.phone && !company.phone) {
            updateData.phone = contacts.phone;
          }
          if (contacts.whatsapp && !company.whatsapp) {
            updateData.whatsapp = contacts.whatsapp;
            updateData.hasWhatsapp = true;
          }
        }

        if ((!company.whatsapp || !company.hasWhatsapp) && company.phone) {
          const waLink = this.websiteEnricher.generateWhatsAppFromPhone(company.phone);
          if (waLink && !updateData.whatsapp) {
            updateData.whatsapp = waLink;
            updateData.hasWhatsapp = true;
          }
        }

        if (Object.keys(updateData).length > 0) {
          await this.prisma.company.update({
            where: { id: company.id },
            data: updateData,
          });
          enriched++;
        }
      } catch (error: any) {
        this.logger.warn(`Website enricher failed for ${company.name}: ${error.message}`);
      }
    }

    await this.searchService.addLog(searchId, `${enriched} empresas enriquecidas com contactos de websites`, 'info', 'website-enricher');
  }
}
