import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';
import * as cheerio from 'cheerio';

export interface WebsiteContacts {
  instagram: string | null;
  instagramHandle: string | null;
  facebook: string | null;
  linkedin: string | null;
  youtube: string | null;
  tiktok: string | null;
  email: string | null;
  phone: string | null;
  whatsapp: string | null;
  contactName: string | null;
}

@Injectable()
export class WebsiteEnricherService {
  private readonly logger = new Logger(WebsiteEnricherService.name);
  private readonly userAgent =
    'Mozilla/5.0 (compatible; LeadHunterAI/1.0; +https://github.com/anderson17quadri-cmd/cacador-de-clientes)';
  private readonly timeout = 6000;
  private readonly maxExtraPages = 3;
  private readonly concurrencyLimit = 5;
  private activeRequests = 0;

  async enrichFromWebsite(websiteUrl: string): Promise<WebsiteContacts> {
    const result: WebsiteContacts = {
      instagram: null,
      instagramHandle: null,
      facebook: null,
      linkedin: null,
      youtube: null,
      tiktok: null,
      email: null,
      phone: null,
      whatsapp: null,
      contactName: null,
    };

    if (!websiteUrl) return result;

    let normalizedUrl = websiteUrl.trim();
    if (!normalizedUrl.startsWith('http')) {
      normalizedUrl = 'https://' + normalizedUrl;
    }

    try {
      const homepageHtml = await this.fetchPage(normalizedUrl);
      if (!homepageHtml) return result;

      const allHtml = [homepageHtml];
      const followUrls = this.extractContactPageUrls(homepageHtml, normalizedUrl);

      for (const url of followUrls.slice(0, this.maxExtraPages)) {
        const html = await this.fetchPage(url);
        if (html) allHtml.push(html);
      }

      const combinedHtml = allHtml.join('\n');
      const $ = cheerio.load(combinedHtml);

      const instagramInfo = this.extractInstagram($, combinedHtml);
      result.instagram = instagramInfo.url;
      result.instagramHandle = instagramInfo.handle;

      const facebookInfo = this.extractFacebook($, combinedHtml);
      result.facebook = facebookInfo;

      const linkedinInfo = this.extractLinkedIn($, combinedHtml);
      result.linkedin = linkedinInfo;

      const youtubeInfo = this.extractYouTube($, combinedHtml);
      result.youtube = youtubeInfo;

      const tiktokInfo = this.extractTikTok($, combinedHtml);
      result.tiktok = tiktokInfo;

      const whatsappInfo = this.extractWhatsApp($, combinedHtml);
      result.whatsapp = whatsappInfo;

      const emailInfo = this.extractEmail($, combinedHtml);
      result.email = emailInfo;

      const phoneInfo = this.extractPhone($, combinedHtml);
      result.phone = phoneInfo;

      result.contactName = this.extractContactName($, combinedHtml);

      return result;
    } catch {
      return result;
    }
  }

  generateWhatsAppFromPhone(phone: string | null): string | null {
    if (!phone) return null;
    const digits = phone.replace(/\D/g, '');
    if (digits.length < 8) return null;
    return `https://wa.me/${digits}`;
  }

  private async fetchPage(url: string): Promise<string | null> {
    if (this.activeRequests >= this.concurrencyLimit) {
      return null;
    }
    this.activeRequests++;

    try {
      const response = await axios.get(url, {
        headers: { 'User-Agent': this.userAgent },
        timeout: this.timeout,
        maxRedirects: 3,
        maxContentLength: 1024 * 1024,
        responseType: 'text',
      });

      const html: string = typeof response.data === 'string' ? response.data : '';
      return html;
    } catch {
      return null;
    } finally {
      this.activeRequests--;
    }
  }

  private extractContactPageUrls(html: string, baseUrl: string): string[] {
    const $ = cheerio.load(html);
    const urls: string[] = [];
    const keywords = [
      'contact', 'contacto', 'contactos', 'fale-conosco', 'contato',
      'about', 'sobre', 'equipa', 'quem-somos', 'team',
    ];

    $('a[href]').each((_, el) => {
      const href = $(el).attr('href');
      const text = ($(el).text() || '').toLowerCase();

      if (!href) return;

      const hrefLower = href.toLowerCase();
      const matchesKeyword = keywords.some(
        (kw) => hrefLower.includes(kw) || text.includes(kw),
      );

      if (!matchesKeyword) return;

      try {
        const resolved = new URL(href, baseUrl).href;
        if (resolved.startsWith('http')) {
          urls.push(resolved);
        }
      } catch {}
    });

    return [...new Set(urls)];
  }

  private extractInstagram($: cheerio.CheerioAPI, html: string): { url: string | null; handle: string | null } {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?instagram\.com\/([a-zA-Z0-9_.]+)(?!\/p\/|\/reel\/|\/explore\/)/gi,
    ];

    const handles = new Set<string>();

    for (const pattern of patterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const handle = match[1];
        if (handle && !['p', 'reel', 'explore', 'stories', 'about', 'developer', 'rsrc.php', 'static', 'api', 'graphql', 'accounts', 'help'].includes(handle.toLowerCase())) {
          handles.add(handle);
        }
      }
    }

    $('a[href*="instagram.com"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const match = href.match(/instagram\.com\/([a-zA-Z0-9_.]+)/);
      if (match?.[1] && !['p', 'reel', 'explore', 'stories', 'rsrc.php', 'static', 'api'].includes(match[1].toLowerCase())) {
        handles.add(match[1]);
      }
    });

    const handle = handles.size > 0 ? [...handles][0]! : null;
    return {
      url: handle ? `https://instagram.com/${handle}` : null,
      handle,
    };
  }

  private extractFacebook($: cheerio.CheerioAPI, html: string): string | null {
    const pattern = /(?:https?:\/\/)?(?:www\.)?facebook\.com\/([a-zA-Z0-9.]+)/gi;
    const found = new Set<string>();

    let match;
    while ((match = pattern.exec(html)) !== null) {
      const page = match[1];
      if (
        page &&
        !['sharer', 'login', 'plugins', 'share', 'dialog', 'help', 'policies', 'privacy'].includes(page.toLowerCase())
      ) {
        found.add(`https://facebook.com/${page}`);
      }
    }

    return found.size > 0 ? [...found][0]! : null;
  }

  private extractLinkedIn($: cheerio.CheerioAPI, html: string): string | null {
    const pattern = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/(company|in)\/([a-zA-Z0-9-]+)/gi;
    const found = new Set<string>();

    let match;
    while ((match = pattern.exec(html)) !== null) {
      found.add(`https://linkedin.com/${match[1]}/${match[2]}`);
    }

    return found.size > 0 ? [...found][0]! : null;
  }

  private extractYouTube($: cheerio.CheerioAPI, html: string): string | null {
    const patterns = [
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/(@[a-zA-Z0-9_-]+)/gi,
      /(?:https?:\/\/)?(?:www\.)?youtube\.com\/channel\/([a-zA-Z0-9_-]+)/gi,
    ];

    for (const pattern of patterns) {
      const match = pattern.exec(html);
      if (match?.[1]) {
        return `https://youtube.com/${match[0]}`;
      }
    }

    return null;
  }

  private extractTikTok($: cheerio.CheerioAPI, html: string): string | null {
    const pattern = /(?:https?:\/\/)?(?:www\.)?tiktok\.com\/@([a-zA-Z0-9_.]+)/gi;
    const match = pattern.exec(html);
    if (match?.[1]) {
      return `https://tiktok.com/@${match[1]}`;
    }
    return null;
  }

  private extractWhatsApp($: cheerio.CheerioAPI, html: string): string | null {
    const waPatterns = [
      /wa\.me\/(\+?\d+)/gi,
      /api\.whatsapp\.com\/send\?phone=(\+?\d+)/gi,
    ];

    for (const pattern of waPatterns) {
      const match = pattern.exec(html);
      if (match?.[1]) {
        const digits = match[1].replace(/\D/g, '');
        if (digits.length >= 8) {
          return `https://wa.me/${digits}`;
        }
      }
    }

    const textPattern = /whatsapp[:\s]+(\+?[\d\s()-]{8,})/gi;
    const textMatch = textPattern.exec(html);
    if (textMatch?.[1]) {
      const digits = textMatch[1].replace(/\D/g, '');
      if (digits.length >= 8) {
        return `https://wa.me/${digits}`;
      }
    }

    return null;
  }

  private extractEmail($: cheerio.CheerioAPI, html: string): string | null {
    const emails = new Set<string>();
    const blacklist = new Set([
      'example.com', 'sentry.io', 'sentry', 'wixpress.com', 'wordpress.org',
      'yourdomain.com', 'domain.com', 'email.com', 'test.com', 'localhost',
      'noreply@github.com',
    ]);

    $('a[href^="mailto:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const email = href.replace('mailto:', '').split('?')[0]!.trim().toLowerCase();
      if (email && email.includes('@')) {
        const domain = email.split('@')[1];
        if (domain && !blacklist.has(domain) && !blacklist.has(email)) {
          emails.add(email);
        }
      }
    });

    const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
    let match;
    while ((match = emailRegex.exec(html)) !== null) {
      const email = match[0].toLowerCase();
      const domain = email.split('@')[1];
      if (
        domain &&
        !blacklist.has(domain) &&
        !email.includes('example') &&
        !email.includes('sentry') &&
        !email.includes('wixpress') &&
        !email.includes('@img') &&
        !email.includes('@2x') &&
        !email.includes('@3x') &&
        email.length < 100
      ) {
        emails.add(email);
      }
    }

    const priorityPrefixes = ['geral', 'info', 'contacto', 'contato', 'suporte', 'vendas', 'admin'];
    const sorted = [...emails].sort((a, b) => {
      const aPrefix = a.split('@')[0]!;
      const bPrefix = b.split('@')[0]!;
      const aPriority = priorityPrefixes.findIndex((p) => aPrefix.startsWith(p));
      const bPriority = priorityPrefixes.findIndex((p) => bPrefix.startsWith(p));
      if (aPriority !== -1 && bPriority === -1) return -1;
      if (bPriority !== -1 && aPriority === -1) return 1;
      if (aPriority !== -1 && bPriority !== -1) return aPriority - bPriority;
      return 0;
    });

    return sorted.length > 0 ? sorted[0]! : null;
  }

  private extractPhone($: cheerio.CheerioAPI, html: string): string | null {
    const phones = new Set<string>();

    $('a[href^="tel:"]').each((_, el) => {
      const href = $(el).attr('href');
      if (!href) return;
      const phone = href.replace('tel:', '').trim();
      if (phone.replace(/\D/g, '').length >= 8) {
        phones.add(phone);
      }
    });

    const phonePatterns = [
      /(?:\+351\s?)?9[1236]\d{7}/g,
      /(?:\+55\s?)?\(?\d{2}\)?\s?\d{4,5}-?\d{4}/g,
      /(?:\+\d{1,3}\s?)?\(?\d{2,4}\)?\s?\d{3,4}-?\d{3,4}/g,
    ];

    for (const pattern of phonePatterns) {
      let match;
      while ((match = pattern.exec(html)) !== null) {
        const phone = match[0].trim();
        if (phone.replace(/\D/g, '').length >= 8) {
          phones.add(phone);
        }
      }
    }

    const phonePriority = [
      /Telefone[:\s]+([+\d\s()-]{8,})/i,
      /Tel[.:\s]+([+\d\s()-]{8,})/i,
      /Fone[:\s]+([+\d\s()-]{8,})/i,
      /Contacto[:\s]+([+\d\s()-]{8,})/i,
    ];

    for (const pPattern of phonePriority) {
      const pMatch = pPattern.exec(html);
      if (pMatch?.[1]) {
        const phone = pMatch[1].trim();
        if (phone.replace(/\D/g, '').length >= 8) {
          return phone;
        }
      }
    }

    return phones.size > 0 ? [...phones][0]! : null;
  }

  private extractContactName($: cheerio.CheerioAPI, html: string): string | null {
    const jsonLdScripts = $('script[type="application/ld+json"]');
    const names: string[] = [];

    jsonLdScripts.each((_, el) => {
      try {
        const json = JSON.parse($(el).html() || '{}');
        const org =
          json?.['@graph']?.find(
            (g: any) =>
              g['@type'] === 'Organization' || g['@type'] === 'LocalBusiness',
          ) || (json['@type'] === 'Organization' || json['@type'] === 'LocalBusiness'
            ? json
            : null);

        if (org) {
          if (org.founder?.name) names.push(org.founder.name);
          if (org.employee?.name) names.push(org.employee.name);
          if (org.author?.name) names.push(org.author.name);
          if (typeof org.founder === 'string') names.push(org.founder);
        }
      } catch {}
    });

    if (names.length > 0) return names[0]!;

    const metaSelectors = [
      'meta[property="og:title"]',
      'meta[name="author"]',
    ];

    for (const selector of metaSelectors) {
      const content = $(selector).attr('content');
      if (content && content.length > 2 && content.length < 60) {
        return content;
      }
    }

    const textPatterns = [
      /Proprietário[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})/i,
      /Responsável[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})/i,
      /Falar com[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})/i,
      /Gerente[:\s]+([A-ZÀ-Ú][a-zà-ú]+(?:\s+[A-ZÀ-Ú][a-zà-ú]+){1,4})/i,
    ];

    for (const pattern of textPatterns) {
      const match = pattern.exec(html);
      if (match?.[1]) return match[1].trim();
    }

    return null;
  }
}
