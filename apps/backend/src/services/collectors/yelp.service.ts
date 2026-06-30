import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class YelpService {
  private readonly logger = new Logger(YelpService.name);
  private readonly apiKey: string;
  private readonly baseUrl = 'https://api.yelp.com/v3';

  constructor(private readonly config: ConfigService) {
    this.apiKey = this.config.get('YELP_API_KEY') || '';
    if (!this.apiKey) {
      this.logger.warn('YELP_API_KEY not configured — Yelp collector disabled');
    }
  }

  async searchPlaces(lat: number, lon: number, radius: number, category: string): Promise<any[]> {
    if (!this.apiKey) return [];

    try {
      const yelpCategories = this.mapCategoryToYelpAlias(category);

      const allResults: any[] = [];

      for (const alias of yelpCategories) {
        const response = await axios.get(`${this.baseUrl}/businesses/search`, {
          params: {
            latitude: lat,
            longitude: lon,
            radius: Math.min(radius, 40000),
            categories: alias,
            limit: 50,
            locale: 'pt_BR',
          },
          headers: {
            Authorization: `Bearer ${this.apiKey}`,
            Accept: 'application/json',
          },
          timeout: 10000,
        });

        const businesses = response.data?.businesses || [];
        allResults.push(...businesses);
      }

      const unique = new Map<string, any>();
      for (const biz of allResults) {
        if (!unique.has(biz.id)) {
          unique.set(biz.id, biz);
        }
      }

      return Array.from(unique.values()).map((biz: any) => ({
        name: biz.name || 'Sem nome',
        category,
        description: biz.categories?.map((c: any) => c.title).join(', ') || '',
        phone: biz.phone || biz.display_phone || null,
        whatsapp: null,
        email: null,
        website: biz.url || null,
        instagram: null,
        facebook: null,
        linkedin: null,
        tiktok: null,
        youtube: null,
        address: biz.location?.display_address?.join(', ') || null,
        street: biz.location?.address1 || null,
        number: null,
        neighborhood: biz.location?.address2 || null,
        city: biz.location?.city || null,
        state: biz.location?.state || null,
        postalCode: biz.location?.zip_code || null,
        country: biz.location?.country || null,
        latitude: biz.coordinates?.latitude || null,
        longitude: biz.coordinates?.longitude || null,
        googleMapsLink:
          biz.coordinates
            ? `https://maps.google.com/?q=${biz.coordinates.latitude},${biz.coordinates.longitude}`
            : null,
        rating: (biz.rating || null) as number | null,
        totalRatings: (biz.review_count || null) as number | null,
        source: 'yelp',
        sourceId: biz.id || null,
        sourceUrl: biz.url || null,
        photos: biz.image_url ? [biz.image_url] : [],
        isOpen: !biz.is_closed,
      }));
    } catch (error: any) {
      this.logger.warn(`Yelp API error: ${error.message}`);
      return [];
    }
  }

  private mapCategoryToYelpAlias(category: string): string[] {
    const lower = category.toLowerCase();
    const mapping: Record<string, string[]> = {
      barbearia: ['barbers', 'hair'],
      dentista: ['dentists', 'generaldentistry'],
      restaurante: ['restaurants', 'food'],
      padaria: ['bakeries', 'bakers'],
      hotel: ['hotels'],
      advogado: ['lawyers'],
      academia: ['gyms', 'fitness'],
      veterinario: ['vet'],
      clinica: ['health', 'medicalcenters'],
      farmacia: ['pharmacy'],
      loja: ['shopping'],
      construtora: ['generalcontractors'],
      imobiliaria: ['realestateagents', 'realestate'],
      mecanica: ['autorepair', 'auto'],
      supermercado: ['grocery'],
    };

    return mapping[lower] || ['restaurants'];
  }
}
