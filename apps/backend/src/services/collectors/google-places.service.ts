import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client, Place, PlaceType2 } from '@googlemaps/google-maps-services-js';

@Injectable()
export class GooglePlacesService {
  private readonly logger = new Logger(GooglePlacesService.name);
  private readonly client: Client;
  private readonly apiKey: string;

  constructor(private readonly config: ConfigService) {
    this.client = new Client({});
    this.apiKey = this.config.get('google.placesApiKey') || '';
  }

  async searchPlaces(lat: number, lon: number, radius: number, category: string): Promise<any[]> {
    if (!this.apiKey) {
      this.logger.warn('Google Places API key not configured');
      return [];
    }

    const results: any[] = [];

    try {
      const types = this.mapCategoryToType(category);

      for (const type of types) {
        let pageToken: string | undefined;

        do {
          const response = await this.client.placesNearby({
            params: {
              location: { lat, lng: lon },
              radius,
              type: type as any,
              key: this.apiKey,
              pagetoken: pageToken,
              language: 'pt-BR',
            },
          });

          const places = response.data.results || [];

          for (const place of places) {
            results.push(this.mapPlaceToCompany(place, category));
          }

          pageToken = response.data.next_page_token;
          if (pageToken) {
            await new Promise((r) => setTimeout(r, 2000));
          }
        } while (pageToken);
      }
    } catch (error: any) {
      this.logger.error(`Google Places search error: ${error.message}`);
    }

    return results;
  }

  async getPlaceDetails(placeId: string): Promise<any | null> {
    if (!this.apiKey) return null;

    try {
      const response = await this.client.placeDetails({
        params: {
          place_id: placeId,
          key: this.apiKey,
          fields: [
            'name', 'formatted_address', 'formatted_phone_number',
            'website', 'opening_hours', 'rating', 'user_ratings_total',
            'photos', 'geometry', 'types', 'business_status',
          ],
          language: 'pt-BR',
        },
      });

      return response.data.result || null;
    } catch (error: any) {
      this.logger.warn(`Place details error for ${placeId}: ${error.message}`);
      return null;
    }
  }

  private mapPlaceToCompany(place: Partial<Place>, category: string): any {
    const address = place.formatted_address || place.vicinity || '';
    const addressParts = address.split(',').map((p: string) => p.trim());

    return {
      name: place.name || 'Sem nome',
      category,
      description: place.types?.join(', ') || '',
      phone: null,
      whatsapp: null,
      email: null,
      website: null,
      instagram: null,
      facebook: null,
      linkedin: null,
      tiktok: null,
      youtube: null,
      address,
      street: addressParts[0] || null,
      neighborhood: addressParts[1] || null,
      city: addressParts[2] || null,
      state: addressParts[3] || null,
      country: addressParts[4] || null,
      latitude: place.geometry?.location?.lat || null,
      longitude: place.geometry?.location?.lng || null,
      googleMapsLink: place.place_id ? `https://maps.google.com/?q=place_id:${place.place_id}` : null,
      rating: place.rating || null,
      totalRatings: place.user_ratings_total || null,
      photos: place.photos?.map((p) => `https://maps.googleapis.com/maps/api/place/photo?maxwidth=400&photo_reference=${p.photo_reference}&key=${this.apiKey}`) || [],
      isOpen: place.business_status === 'OPERATIONAL' ? true : place.opening_hours?.open_now ?? null,
      source: 'google_places',
      sourceId: place.place_id || null,
    };
  }

  private mapCategoryToType(category: string): string[] {
    const lower = category.toLowerCase();
    const mapping: Record<string, string[]> = {
      barbearia: ['hair_care', 'beauty_salon'],
      dentista: ['dentist'],
      restaurante: ['restaurant', 'food'],
      padaria: ['bakery'],
      hotel: ['lodging'],
      advogado: ['lawyer'],
      academia: ['gym'],
      veterinario: ['veterinary_care'],
      clinica: ['hospital', 'doctor', 'health'],
      farmacia: ['pharmacy'],
      loja: ['store', 'shopping_mall'],
      construtora: ['general_contractor'],
      imobiliaria: ['real_estate_agency'],
      mecanica: ['car_repair'],
    };

    return mapping[lower] || ['establishment'];
  }
}
