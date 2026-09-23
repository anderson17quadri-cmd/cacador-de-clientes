import { BadRequestException, Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import { createCipheriv, createDecipheriv, createHash, randomBytes } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import { join } from 'path';
import { UpdateDataSourcesDto } from './dto/data-sources.dto';

type Provider = 'nominatim' | 'overpass' | 'google_places' | 'locationiq' | 'mapbox' | 'opencage';
interface StoredConfig {
  googlePlacesKey?: string;
  locationIqKey?: string;
  mapboxToken?: string;
  openCageKey?: string;
  googlePlacesEnabled?: boolean;
  locationIqEnabled?: boolean;
  mapboxEnabled?: boolean;
  openCageEnabled?: boolean;
}

@Injectable()
export class DataSourcesService {
  private readonly logger = new Logger(DataSourcesService.name);
  private readonly dataDir = process.env.LEADHUNTER_DATA_DIR || join(process.cwd(), 'runtime-data');
  private readonly encryptionKey = createHash('sha256')
    .update(process.env.APP_ENCRYPTION_KEY || process.env.JWT_SECRET || 'leadhunter-local')
    .digest();
  private lastNominatimRequest = 0;

  private file(userId: string) { return join(this.dataDir, `data-sources-${userId}.enc`); }
  private validSecret(value?: string) {
    const clean = value?.trim() || '';
    return clean.length >= 20 && !/^(your|change|replace|example|test|placeholder)[-_ ]/i.test(clean);
  }
  private encrypt(value: StoredConfig) {
    const iv = randomBytes(12);
    const cipher = createCipheriv('aes-256-gcm', this.encryptionKey, iv);
    const encrypted = Buffer.concat([cipher.update(JSON.stringify(value), 'utf8'), cipher.final()]);
    return Buffer.concat([iv, cipher.getAuthTag(), encrypted]).toString('base64');
  }
  private decrypt(value: string): StoredConfig {
    const payload = Buffer.from(value, 'base64');
    const decipher = createDecipheriv('aes-256-gcm', this.encryptionKey, payload.subarray(0, 12));
    decipher.setAuthTag(payload.subarray(12, 28));
    return JSON.parse(Buffer.concat([decipher.update(payload.subarray(28)), decipher.final()]).toString('utf8'));
  }
  private async stored(userId: string): Promise<StoredConfig> {
    try { return this.decrypt(await readFile(this.file(userId), 'utf8')); } catch { return {}; }
  }
  private async raw(userId: string) {
    const saved = await this.stored(userId);
    return {
      ...saved,
      googlePlacesKey: this.validSecret(saved.googlePlacesKey) ? saved.googlePlacesKey
        : this.validSecret(process.env.GOOGLE_PLACES_API_KEY) ? process.env.GOOGLE_PLACES_API_KEY : undefined,
      locationIqKey: this.validSecret(saved.locationIqKey) ? saved.locationIqKey
        : this.validSecret(process.env.LOCATIONIQ_API_KEY) ? process.env.LOCATIONIQ_API_KEY : undefined,
      mapboxToken: this.validSecret(saved.mapboxToken) ? saved.mapboxToken
        : this.validSecret(process.env.MAPBOX_ACCESS_TOKEN) ? process.env.MAPBOX_ACCESS_TOKEN : undefined,
      openCageKey: this.validSecret(saved.openCageKey) ? saved.openCageKey
        : this.validSecret(process.env.OPENCAGE_API_KEY) ? process.env.OPENCAGE_API_KEY : undefined,
    };
  }

  async getConfig(userId: string) {
    const config = await this.raw(userId);
    return {
      providers: [
        { id: 'nominatim', name: 'OpenStreetMap / Nominatim', purpose: 'Localização e geocoding', keyRequired: false, configured: true, enabled: true, recommended: true, note: 'Grátis; máximo de 1 pedido por segundo no servidor público.' },
        { id: 'overpass', name: 'OpenStreetMap / Overpass', purpose: 'Encontrar estabelecimentos em massa', keyRequired: false, configured: true, enabled: true, recommended: true, note: 'Fonte principal gratuita de empresas.' },
        { id: 'locationiq', name: 'LocationIQ', purpose: 'Geocoding e reforço de lugares', keyRequired: true, configured: Boolean(config.locationIqKey), enabled: Boolean(config.locationIqEnabled && config.locationIqKey), recommended: true, note: 'Plano grátis: 5.000 pedidos/dia e 2 por segundo, com atribuição.' },
        { id: 'mapbox', name: 'Mapbox', purpose: 'Pesquisa de locais e pontos de interesse', keyRequired: true, configured: Boolean(config.mapboxToken), enabled: Boolean(config.mapboxEnabled && config.mapboxToken), recommended: false, note: 'Boa cobertura; atenção às regras de armazenamento dos resultados.' },
        { id: 'opencage', name: 'OpenCage', purpose: 'Geocoding de endereços', keyRequired: true, configured: Boolean(config.openCageKey), enabled: Boolean(config.openCageEnabled && config.openCageKey), recommended: false, note: '2.500 pedidos/dia somente para testes no plano gratuito.' },
        { id: 'google_places', name: 'Google Places', purpose: 'Empresas, avaliações e fotos', keyRequired: true, configured: Boolean(config.googlePlacesKey), enabled: Boolean(config.googlePlacesEnabled && config.googlePlacesKey), recommended: false, note: 'Opcional e sujeito a cobrança da Google.' },
      ],
    };
  }

  async updateConfig(userId: string, dto: UpdateDataSourcesDto) {
    const current = await this.stored(userId);
    const next: StoredConfig = { ...current };
    for (const key of ['googlePlacesKey', 'locationIqKey', 'mapboxToken', 'openCageKey'] as const) {
      if (dto[key]?.trim()) next[key] = dto[key]!.trim();
    }
    for (const key of ['googlePlacesEnabled', 'locationIqEnabled', 'mapboxEnabled', 'openCageEnabled'] as const) {
      if (dto[key] !== undefined) next[key] = dto[key];
    }
    await mkdir(this.dataDir, { recursive: true });
    const destination = this.file(userId);
    const temp = `${destination}.${process.pid}.tmp`;
    await writeFile(temp, this.encrypt(next), 'utf8');
    await rename(temp, destination);
    return this.getConfig(userId);
  }

  async resolveSources(userId: string, requested?: string[]) {
    const config = await this.raw(userId);
    const available = new Set<string>(['nominatim', 'overpass']);
    if (config.locationIqEnabled && config.locationIqKey) available.add('locationiq');
    if (config.mapboxEnabled && config.mapboxToken) available.add('mapbox');
    if (config.googlePlacesEnabled && config.googlePlacesKey) available.add('google_places');
    const wanted = requested?.length ? requested : [...available];
    const resolved = wanted.filter((source) => available.has(source));
    return resolved.length ? resolved : ['nominatim', 'overpass'];
  }

  async geocode(userId: string, query: string): Promise<{ lat: number; lon: number; provider: Provider } | null> {
    const config = await this.raw(userId);
    const attempts: Array<() => Promise<{ lat: number; lon: number; provider: Provider } | null>> = [];
    if (config.locationIqEnabled && config.locationIqKey) attempts.push(() => this.locationIqGeocode(config.locationIqKey!, query));
    if (config.mapboxEnabled && config.mapboxToken) attempts.push(() => this.mapboxGeocode(config.mapboxToken!, query));
    if (config.openCageEnabled && config.openCageKey) attempts.push(() => this.openCageGeocode(config.openCageKey!, query));
    attempts.push(() => this.nominatimGeocode(query));
    for (const attempt of attempts) {
      try { const result = await attempt(); if (result) return result; }
      catch (error: any) { this.logger.warn(`Geocoding alternativo falhou: ${error.message}`); }
    }
    return null;
  }

  async searchPlaces(userId: string, provider: 'locationiq' | 'mapbox', lat: number, lon: number, radius: number, category: string) {
    const config = await this.raw(userId);
    if (provider === 'locationiq') {
      if (!config.locationIqKey) return [];
      const delta = Math.min(0.8, radius / 85000);
      const response = await axios.get('https://eu1.locationiq.com/v1/search', {
        params: { key: config.locationIqKey, q: category, format: 'json', limit: 50, bounded: 1, viewbox: `${lon - delta},${lat + delta},${lon + delta},${lat - delta}`, addressdetails: 1, extratags: 1, normalizeaddress: 1 },
        timeout: 15000,
      });
      return (response.data || []).map((item: any) => this.osmCompany(item, category, 'locationiq'));
    }
    if (!config.mapboxToken) return [];
    const response = await axios.get('https://api.mapbox.com/search/searchbox/v1/forward', {
      params: { q: category, access_token: config.mapboxToken, proximity: `${lon},${lat}`, limit: 10, language: 'pt', types: 'poi' },
      timeout: 15000,
    });
    return (response.data?.features || []).map((item: any) => this.mapboxCompany(item, category));
  }

  async test(userId: string, provider: Provider) {
    const config = await this.raw(userId);
    const started = Date.now();
    let result: any = null;
    if (provider === 'nominatim') result = await this.nominatimGeocode('Lisboa, Portugal');
    else if (provider === 'overpass') {
      const response = await axios.get('https://overpass-api.de/api/status', { timeout: 12000 });
      result = response.status === 200 ? { provider } : null;
    } else if (provider === 'locationiq') {
      if (!config.locationIqKey) throw new BadRequestException('Configure a chave do LocationIQ primeiro.');
      result = await this.locationIqGeocode(config.locationIqKey, 'Lisboa, Portugal');
    } else if (provider === 'mapbox') {
      if (!config.mapboxToken) throw new BadRequestException('Configure o token do Mapbox primeiro.');
      result = await this.mapboxGeocode(config.mapboxToken, 'Lisboa, Portugal');
    } else if (provider === 'opencage') {
      if (!config.openCageKey) throw new BadRequestException('Configure a chave do OpenCage primeiro.');
      result = await this.openCageGeocode(config.openCageKey, 'Lisboa, Portugal');
    } else {
      if (!config.googlePlacesKey) throw new BadRequestException('Configure a chave do Google Places primeiro.');
      const response = await axios.get('https://maps.googleapis.com/maps/api/place/textsearch/json', { params: { query: 'barbearia Lisboa', key: config.googlePlacesKey }, timeout: 15000 });
      if (response.data?.status !== 'OK' && response.data?.status !== 'ZERO_RESULTS') throw new Error(response.data?.error_message || response.data?.status);
      result = { provider };
    }
    if (!result) throw new BadRequestException('A fonte respondeu, mas não localizou Lisboa.');
    return { provider, ok: true, latencyMs: Date.now() - started };
  }

  private async nominatimRateLimit() {
    const wait = 1100 - (Date.now() - this.lastNominatimRequest);
    if (wait > 0) await new Promise((resolve) => setTimeout(resolve, wait));
    this.lastNominatimRequest = Date.now();
  }
  private async nominatimGeocode(query: string) {
    await this.nominatimRateLimit();
    const response = await axios.get('https://nominatim.openstreetmap.org/search', { params: { q: query, format: 'json', limit: 1 }, headers: { 'User-Agent': 'LeadHunterAI/1.0 (personal local app)' }, timeout: 12000 });
    const item = response.data?.[0];
    return item ? { lat: Number(item.lat), lon: Number(item.lon), provider: 'nominatim' as const } : null;
  }
  private async locationIqGeocode(key: string, query: string) {
    const response = await axios.get('https://eu1.locationiq.com/v1/search', { params: { key, q: query, format: 'json', limit: 1 }, timeout: 12000 });
    const item = response.data?.[0];
    return item ? { lat: Number(item.lat), lon: Number(item.lon), provider: 'locationiq' as const } : null;
  }
  private async mapboxGeocode(token: string, query: string) {
    const response = await axios.get('https://api.mapbox.com/search/geocode/v6/forward', { params: { q: query, access_token: token, limit: 1, language: 'pt' }, timeout: 12000 });
    const coordinates = response.data?.features?.[0]?.geometry?.coordinates;
    return coordinates ? { lat: Number(coordinates[1]), lon: Number(coordinates[0]), provider: 'mapbox' as const } : null;
  }
  private async openCageGeocode(key: string, query: string) {
    const response = await axios.get('https://api.opencagedata.com/geocode/v1/json', { params: { key, q: query, limit: 1, language: 'pt', no_annotations: 1 }, timeout: 12000 });
    const geometry = response.data?.results?.[0]?.geometry;
    return geometry ? { lat: Number(geometry.lat), lon: Number(geometry.lng), provider: 'opencage' as const } : null;
  }
  private osmCompany(item: any, category: string, source: string) {
    return {
      name: item.display_name?.split(',')[0] || item.name || 'Sem nome', category,
      address: item.display_name || '', street: item.address?.road || null,
      neighborhood: item.address?.suburb || item.address?.neighbourhood || null,
      city: item.address?.city || item.address?.town || item.address?.village || null,
      state: item.address?.state || null, postalCode: item.address?.postcode || null,
      country: item.address?.country || null, latitude: Number(item.lat) || null,
      longitude: Number(item.lon) || null,
      googleMapsLink: item.lat && item.lon ? `https://maps.google.com/?q=${item.lat},${item.lon}` : null,
      source, sourceId: String(item.place_id || item.osm_id || ''),
      website: item.extratags?.website || item.extratags?.['contact:website'] || null,
      phone: item.extratags?.phone || item.extratags?.['contact:phone'] || null,
      email: item.extratags?.email || item.extratags?.['contact:email'] || null,
      instagram: item.extratags?.instagram || item.extratags?.['contact:instagram'] || null,
    };
  }
  private mapboxCompany(item: any, category: string) {
    const props = item.properties || {};
    const context = props.context || {};
    const coordinates = item.geometry?.coordinates || props.coordinates?.coordinates || [];
    return {
      name: props.name || item.text || 'Sem nome', category,
      address: props.full_address || props.place_formatted || '',
      city: context.place?.name || context.locality?.name || null,
      state: context.region?.name || null, postalCode: context.postcode?.name || null,
      country: context.country?.name || null, latitude: Number(coordinates[1]) || null,
      longitude: Number(coordinates[0]) || null,
      googleMapsLink: coordinates.length ? `https://maps.google.com/?q=${coordinates[1]},${coordinates[0]}` : null,
      source: 'mapbox', sourceId: String(props.mapbox_id || item.id || ''),
      phone: props.metadata?.phone || null, website: props.metadata?.website || null,
    };
  }
}
