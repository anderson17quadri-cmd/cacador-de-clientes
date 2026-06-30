import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class NominatimService {
  private readonly logger = new Logger(NominatimService.name);
  private readonly baseUrl = 'https://nominatim.openstreetmap.org';
  private lastRequest = 0;

  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < 1100) {
      await new Promise((r) => setTimeout(r, 1100 - elapsed));
    }
    this.lastRequest = Date.now();
  }

  async geocode(placeName: string): Promise<{ lat: number; lon: number } | null> {
    try {
      await this.rateLimit();
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: { q: placeName, format: 'json', limit: 1 },
        headers: { 'User-Agent': 'LeadHunterAI/1.0' },
      });

      if (response.data?.length > 0) {
        return {
          lat: parseFloat(response.data[0].lat),
          lon: parseFloat(response.data[0].lon),
        };
      }
    } catch (error: any) {
      this.logger.warn(`Geocoding error: ${error.message}`);
    }
    return null;
  }

  async geocodeByPostalCode(postalCode: string, country?: string): Promise<{ lat: number; lon: number } | null> {
    const query = country ? `${postalCode}, ${country}` : postalCode;
    return this.geocode(query);
  }

  async searchPlaces(lat: number, lon: number, radius: number, category: string): Promise<any[]> {
    try {
      await this.rateLimit();
      const response = await axios.get(`${this.baseUrl}/search`, {
        params: {
          q: category,
          format: 'json',
          limit: 50,
          bounded: 1,
          viewbox: `${lon - 0.1},${lat - 0.1},${lon + 0.1},${lat + 0.1}`,
          addressdetails: 1,
          extratags: 1,
        },
        headers: { 'User-Agent': 'LeadHunterAI/1.0' },
      });

      return (response.data || []).map((item: any) => ({
        name: item.display_name?.split(',')[0] || item.name || 'Sem nome',
        category,
        description: item.type || '',
        address: item.display_name || '',
        street: item.address?.road || null,
        neighborhood: item.address?.suburb || item.address?.neighbourhood || null,
        city: item.address?.city || item.address?.town || item.address?.village || null,
        state: item.address?.state || null,
        postalCode: item.address?.postcode || null,
        country: item.address?.country || null,
        latitude: item.lat ? parseFloat(item.lat) : null,
        longitude: item.lon ? parseFloat(item.lon) : null,
        googleMapsLink: item.lat && item.lon ? `https://maps.google.com/?q=${item.lat},${item.lon}` : null,
        source: 'nominatim',
        sourceId: String(item.place_id || item.osm_id || ''),
        website: item.extratags?.website || null,
        phone: item.extratags?.phone || null,
        email: item.extratags?.email || null,
      }));
    } catch (error: any) {
      this.logger.warn(`Nominatim search error: ${error.message}`);
      return [];
    }
  }
}
