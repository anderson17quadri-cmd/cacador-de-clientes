import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class FoursquareService {
  private readonly logger = new Logger(FoursquareService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.foursquare.com/v3';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get('FOURSQUARE_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('FOURSQUARE_API_KEY not configured — Foursquare collector disabled');
    }
  }

  async searchPlaces(lat: number, lon: number, radius: number, category: string): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const categories = this.mapCategoryToFoursquareCategory(category);

      const allResults: any[] = [];

      for (const catId of categories) {
        const response = await axios.get(`${this.baseUrl}/places/search`, {
          params: {
            ll: `${lat},${lon}`,
            radius: Math.min(radius, 100000),
            categories: catId,
            limit: 50,
            fields: 'name,location,contact,tel,email,website,social_media,rating,stats,photos,hours,description,geocodes',
            language: 'pt',
          },
          headers: {
            Authorization: this.apiKey,
            Accept: 'application/json',
          },
          timeout: 10000,
        });

        const places = response.data?.results || [];
        allResults.push(...places);
      }

      const unique = new Map<string, any>();
      for (const place of allResults) {
        if (!unique.has(place.fsq_id)) {
          unique.set(place.fsq_id, place);
        }
      }

      return Array.from(unique.values()).map((place: any) => ({
        name: place.name || 'Sem nome',
        category,
        description: place.description || '',
        phone: place.tel || place.contact?.phone || null,
        whatsapp: null,
        email: place.email || place.contact?.email || null,
        website: place.website || null,
        instagram: place.social_media?.instagram_id || null,
        facebook: place.social_media?.facebook_id
          ? `https://facebook.com/${place.social_media.facebook_id}`
          : null,
        linkedin: null,
        tiktok: null,
        youtube: null,
        address: place.location?.formatted_address || null,
        street: place.location?.address || null,
        number: null,
        neighborhood: place.location?.neighborhood?.[0] || null,
        city: place.location?.locality || place.location?.region || null,
        state: place.location?.region || null,
        postalCode: place.location?.postcode || null,
        country: place.location?.country || null,
        latitude: place.geocodes?.main?.latitude || null,
        longitude: place.geocodes?.main?.longitude || null,
        googleMapsLink:
          place.geocodes?.main
            ? `https://maps.google.com/?q=${place.geocodes.main.latitude},${place.geocodes.main.longitude}`
            : null,
        rating: (place.rating || null) as number | null,
        totalRatings: (place.stats?.total_ratings || null) as number | null,
        source: 'foursquare',
        sourceId: place.fsq_id || null,
        photos: place.photos?.map((p: any) => `${p.prefix}original${p.suffix}`) || [],
        isOpen: place.hours?.open_now ?? null,
      }));
    } catch (error: any) {
      this.logger.warn(`Foursquare API error: ${error.message}`);
      return [];
    }
  }

  private mapCategoryToFoursquareCategory(category: string): string[] {
    const lower = category.toLowerCase();
    const mapping: Record<string, string[]> = {
      barbearia: ['13034', '13033'],
      dentista: ['15027'],
      restaurante: ['13065', '13072', '13032'],
      padaria: ['13002'],
      hotel: ['19010', '19014', '19036'],
      advogado: ['14003'],
      academia: ['18010', '18009'],
      veterinario: ['15041'],
      clinica: ['15014', '15015', '15024'],
      farmacia: ['15043', '15044'],
      loja: ['17000'],
      construtora: ['12071'],
      imobiliaria: ['12063'],
      mecanica: ['13062'],
      supermercado: ['17069', '17071'],
    };

    return mapping[lower] || ['13065'];
  }
}
