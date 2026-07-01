import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

@Injectable()
export class OverpassService {
  private readonly logger = new Logger(OverpassService.name);
  private readonly baseUrl = 'https://overpass-api.de/api/interpreter';
  private lastRequest = 0;

  private async rateLimit() {
    const now = Date.now();
    const elapsed = now - this.lastRequest;
    if (elapsed < 2000) {
      await new Promise((r) => setTimeout(r, 2000 - elapsed));
    }
    this.lastRequest = Date.now();
  }

  async searchPlaces(lat: number, lon: number, radius: number, category: string): Promise<any[]> {
    const query = this.buildQuery(lat, lon, radius, category);
    if (!query) return [];

    try {
      await this.rateLimit();

      const response = await axios.post(
        this.baseUrl,
        `[out:json][timeout:25];${query}`,
        {
          headers: {
            'Content-Type': 'text/plain',
            'User-Agent': 'LeadHunterAI/1.0 (https://github.com/anderson17quadri-cmd/cacador-de-clientes)',
          },
          timeout: 30000,
        },
      );

      const elements = response.data?.elements || [];

      return elements
        .filter((el: any) => el.tags?.name)
        .map((el: any) => ({
          name: el.tags.name || 'Sem nome',
          category,
          description: el.tags.description || el.tags.shop || el.tags.amenity || '',
          phone: el.tags.phone || el.tags['contact:phone'] || null,
          whatsapp: el.tags['contact:whatsapp'] || null,
          email: el.tags.email || el.tags['contact:email'] || null,
          website: el.tags.website || el.tags['contact:website'] || null,
          instagram: el.tags['contact:instagram'] || null,
          facebook: el.tags['contact:facebook'] || null,
          address: [
            el.tags['addr:street'],
            el.tags['addr:housenumber'],
          ].filter(Boolean).join(' ') || null,
          street: el.tags['addr:street'] || null,
          number: el.tags['addr:housenumber'] || null,
          city: el.tags['addr:city'] || null,
          state: el.tags['addr:state'] || null,
          postalCode: el.tags['addr:postcode'] || null,
          country: el.tags['addr:country'] || null,
          latitude: el.lat || null,
          longitude: el.lon || null,
          googleMapsLink:
            el.lat && el.lon
              ? `https://maps.google.com/?q=${el.lat},${el.lon}`
              : null,
          rating: el.tags?.rating ? parseFloat(el.tags.rating) : null,
          openingHours: el.tags?.opening_hours || null,
          source: 'overpass',
          sourceId: String(el.id),
        }));
    } catch (error: any) {
      this.logger.warn(`Overpass API error: ${error.message}`);
      return [];
    }
  }

  private buildQuery(lat: number, lon: number, radius: number, category: string): string | null {
    const lower = category.toLowerCase();
    const tags = this.getCategoryTags(lower);
    if (!tags) return null;

    const radiusDeg = radius / 111000;
    const bbox = `${lat - radiusDeg},${lon - radiusDeg},${lat + radiusDeg},${lon + radiusDeg}`;

    const parts = tags.map((tag) => {
      const [key, value] = tag.split('=');
      if (value === '*') {
        return `nwr["${key}"](${bbox});`;
      }
      return `nwr["${key}"="${value}"](${bbox});`;
    });

    return `(${parts.join('')});out center body 200;`;
  }

  private getCategoryTags(category: string): string[] | null {
    const mapping: Record<string, string[]> = {
      barbearia: ['shop=hairdresser', 'shop=barber'],
      cabeleireiro: ['shop=hairdresser'],
      estetica: ['shop=beauty', 'shop=cosmetics'],
      tatuador: ['shop=tattoo'],
      spa: ['leisure=spa', 'shop=massage', 'amenity=spa'],
      restaurante: ['amenity=restaurant', 'amenity=fast_food'],
      cafe: ['amenity=cafe'],
      bar: ['amenity=bar', 'amenity=pub'],
      padaria: ['shop=bakery'],
      pastelaria: ['shop=pastry', 'shop=confectionery'],
      talho: ['shop=butcher'],
      peixaria: ['shop=seafood'],
      supermercado: ['shop=supermarket'],
      minimercado: ['shop=convenience', 'shop=grocery'],
      hotel: ['tourism=hotel', 'tourism=motel'],
      alojamento: ['tourism=guest_house', 'tourism=apartment', 'tourism=hostel'],
      dentista: ['amenity=dentist'],
      clinica: ['amenity=clinic', 'healthcare=clinic'],
      medico: ['amenity=doctors', 'healthcare=doctor'],
      farmacia: ['amenity=pharmacy'],
      veterinario: ['amenity=veterinary'],
      academia: ['leisure=fitness_centre', 'leisure=sports_centre'],
      advogado: ['office=lawyer'],
      contabilidade: ['office=accountant', 'office=tax_advisor'],
      imobiliaria: ['office=estate_agent'],
      construtora: ['office=construction_company', 'craft=builder'],
      mecanica: ['shop=car_repair', 'craft=car_repair'],
      stand_auto: ['shop=car'],
      florista: ['shop=florist'],
      otica: ['shop=optician'],
      sapataria: ['shop=shoes'],
      loja_roupa: ['shop=clothes'],
      joalharia: ['shop=jewelry'],
      pet_shop: ['shop=pet'],
      escola: ['amenity=school'],
      infantario: ['amenity=kindergarten', 'amenity=childcare'],
      lavandaria: ['shop=laundry', 'shop=dry_cleaning'],
      papelaria: ['shop=stationery'],
      ferragens: ['shop=hardware', 'shop=doityourself'],
      loja: ['shop=general', 'shop=variety_store'],
    };

    return mapping[category] || null;
  }
}
