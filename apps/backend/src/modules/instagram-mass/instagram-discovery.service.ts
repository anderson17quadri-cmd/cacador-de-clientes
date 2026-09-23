import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

interface DiscoveryCompany {
  name: string;
  city?: string | null;
  category?: string | null;
}

@Injectable()
export class InstagramDiscoveryService {
  private readonly logger = new Logger(InstagramDiscoveryService.name);
  private lastRequest = 0;
  private lastProfileRequest = 0;
  private searchBlockedUntil = 0;
  private readonly ignoredHandles = new Set([
    'p', 'reel', 'reels', 'explore', 'stories', 'accounts', 'about', 'developer',
    'help', 'privacy', 'terms', 'direct', 'static', 'api', 'graphql',
  ]);
  private readonly ignoredWords = new Set([
    'barbearia', 'barber', 'barbershop', 'cabeleireiro', 'cabeleireiros', 'hair',
    'studio', 'estudio', 'salao', 'salon', 'lisboa', 'portugal', 'lda', 'unissexo',
    'de', 'da', 'do', 'das', 'dos', 'e', 'the', 'by',
  ]);

  async discover(company: DiscoveryCompany): Promise<string | null> {
    const guessed = await this.discoverByHandle(company);
    if (guessed) return guessed;
    if (Date.now() < this.searchBlockedUntil) return null;
    const query = `site:instagram.com "${company.name}" "${company.city || 'Portugal'}"`;
    try {
      await this.rateLimit();
      const response = await axios.get('https://search.brave.com/search', {
        params: { q: query, source: 'web' },
        headers: {
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
          'Accept-Language': 'pt-PT,pt;q=0.9,en;q=0.5',
        },
        timeout: 12000,
        maxContentLength: 2 * 1024 * 1024,
        responseType: 'text',
      });
      return this.bestCandidate(String(response.data || ''), company);
    } catch (error: any) {
      if (error?.response?.status === 429) {
        this.searchBlockedUntil = Date.now() + 30 * 60 * 1000;
        this.logger.warn('Pesquisa pública de Instagram atingiu o limite; fonte suspensa por 30 minutos.');
        return null;
      }
      this.logger.debug(`Instagram discovery failed for ${company.name}: ${error.message}`);
    }
    return null;
  }

  private async discoverByHandle(company: DiscoveryCompany): Promise<string | null> {
    const words = this.normalize(company.name).split(' ').filter(Boolean);
    const distinct = words.filter((word) => word.length >= 3 && !this.ignoredWords.has(word));
    const generic = words.filter((word) => this.ignoredWords.has(word) && word.length >= 4);
    const handles = [...new Set([
      words.join(''),
      [...distinct, ...generic].join(''),
      [...generic, ...distinct].join(''),
      distinct.join(''),
    ].filter((value) => value.length >= 4))].slice(0, 4);

    for (const handle of handles) {
      try {
        const elapsed = Date.now() - this.lastProfileRequest;
        if (elapsed < 900) await new Promise((resolve) => setTimeout(resolve, 900 - elapsed));
        this.lastProfileRequest = Date.now();
        const response = await axios.get(`https://www.instagram.com/${handle}/`, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
          timeout: 10000,
          maxContentLength: 1024 * 1024,
          responseType: 'text',
        });
        const html = String(response.data || '');
        const title = html.match(/<meta property="og:title" content="([^"]+)"/i)?.[1] || '';
        const description = html.match(/<meta property="og:description" content="([^"]+)"/i)?.[1] || '';
        if (!title) continue;
        const context = this.normalize(`${title} ${description}`);
        if (!distinct.some((word) => context.includes(word))) continue;
        if (company.city && !context.includes(this.normalize(company.city))) continue;
        return `https://instagram.com/${handle}`;
      } catch {
        // A handle inexistente ou temporariamente indisponível é apenas ignorada.
      }
    }
    return null;
  }

  private async rateLimit() {
    const elapsed = Date.now() - this.lastRequest;
    if (elapsed < 5000) await new Promise((resolve) => setTimeout(resolve, 5000 - elapsed));
    this.lastRequest = Date.now();
  }

  private bestCandidate(html: string, company: DiscoveryCompany): string | null {
    const $ = cheerio.load(html);
    const candidates = new Map<string, string>();
    $('.snippet').each((_, result) => {
      const link = $(result).find('a[href*="instagram.com"]').first();
      const profile = this.profileUrl(link.attr('href') || '');
      if (profile) candidates.set(profile, $(result).text());
    });
    $('.result').each((_, result) => {
      const link = $(result).find('a.result__a').first();
      const profile = this.profileUrl(link.attr('href') || '');
      if (profile) candidates.set(profile, $(result).text());
    });
    const encoded = html.match(/https?%3A%2F%2F(?:www\.)?instagram\.com%2F[a-zA-Z0-9_.%-]+/gi) || [];
    for (const value of encoded) {
      const profile = this.profileUrl(decodeURIComponent(value));
      if (profile && !candidates.has(profile)) candidates.set(profile, '');
    }
    const direct = html.match(/https?:\/\/(?:www\.)?instagram\.com\/[a-zA-Z0-9_.]+/gi) || [];
    for (const value of direct) {
      const profile = this.profileUrl(value);
      if (profile && !candidates.has(profile)) candidates.set(profile, '');
    }
    let best: { url: string; score: number } | null = null;
    for (const [url, context] of candidates) {
      const score = this.score(url, context, company);
      if (!best || score > best.score) best = { url, score };
    }
    if (!best || best.score < 3) return null;
    const bestContext = this.normalize(candidates.get(best.url) || '');
    if (company.city && !bestContext.includes(this.normalize(company.city))) return null;
    return best.url;
  }

  private profileUrl(raw: string): string | null {
    try {
      let value = raw;
      if (value.includes('uddg=')) value = new URL(value, 'https://duckduckgo.com').searchParams.get('uddg') || value;
      value = decodeURIComponent(value);
      if (!/^https?:\/\//i.test(value)) value = `https://${value.replace(/^\/+/, '')}`;
      const url = new URL(value);
      if (!/(^|\.)instagram\.com$/i.test(url.hostname)) return null;
      const handle = url.pathname.split('/').filter(Boolean)[0]?.replace(/^@/, '');
      if (!handle || this.ignoredHandles.has(handle.toLowerCase()) || !/^[a-zA-Z0-9_.]+$/.test(handle)) return null;
      return `https://instagram.com/${handle}`;
    } catch {
      return null;
    }
  }

  private normalize(value: string) {
    return value.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }

  private score(url: string, context: string, company: DiscoveryCompany) {
    const handle = this.normalize(new URL(url).pathname).replace(/\s/g, '');
    const normalizedName = this.normalize(company.name);
    const compactName = normalizedName.replace(/\s/g, '');
    const tokens = normalizedName.split(' ').filter((token) => token.length >= 3 && !this.ignoredWords.has(token));
    const normalizedContext = this.normalize(context).replace(/\s/g, '');
    let score = 0;
    if (compactName.length >= 5 && (handle.includes(compactName) || compactName.includes(handle))) score += 5;
    score += tokens.filter((token) => handle.includes(token)).length * 3;
    if (compactName.length >= 5 && normalizedContext.includes(compactName)) score += 3;
    if (company.city && this.normalize(context).includes(this.normalize(company.city))) score += 1;
    return score;
  }
}
