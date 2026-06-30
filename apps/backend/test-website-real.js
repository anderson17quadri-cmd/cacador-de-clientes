const cheerio = require('cheerio');
const axios = require('axios');

async function enrichFromWebsite(websiteUrl) {
  const result = { instagram: null, instagramHandle: null, facebook: null, linkedin: null, youtube: null, tiktok: null, email: null, phone: null, whatsapp: null, contactName: null };
  if (!websiteUrl) return result;
  let u = websiteUrl.trim();
  if (!u.startsWith('http')) u = 'https://' + u;
  try {
    const resp = await axios.get(u, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadHunterAI/1.0; +https://github.com/anderson17quadri-cmd/cacador-de-clientes)' },
      timeout: 8000, maxRedirects: 3, maxContentLength: 1024*1024, responseType: 'text'
    });
    const html = typeof resp.data === 'string' ? resp.data : '';
    if (!html) return result;
    const $ = cheerio.load(html);

    // Instagram
    const instaMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]+)(?!\/p\/|\/reel\/)/);
    if (instaMatch && !['p','reel','explore','stories','rsrc.php','static','api','graphql','accounts','help','about','developer'].includes(instaMatch[1].toLowerCase())) {
      result.instagram = 'https://instagram.com/' + instaMatch[1];
      result.instagramHandle = instaMatch[1];
    }

    // Facebook
    const fbMatch = html.match(/facebook\.com\/([a-zA-Z0-9.]+)/);
    if (fbMatch && !['sharer','login','plugins','share','dialog','help','policies','privacy'].includes(fbMatch[1].toLowerCase())) {
      result.facebook = 'https://facebook.com/' + fbMatch[1];
    }

    // LinkedIn
    const liMatch = html.match(/linkedin\.com\/(company|in)\/([a-zA-Z0-9-]+)/);
    if (liMatch) result.linkedin = 'https://linkedin.com/' + liMatch[1] + '/' + liMatch[2];

    // YouTube
    const ytMatch = html.match(/youtube\.com\/(@[a-zA-Z0-9_-]+)/);
    if (ytMatch) result.youtube = 'https://youtube.com/' + ytMatch[1];

    // TikTok
    const tkMatch = html.match(/tiktok\.com\/@([a-zA-Z0-9_.]+)/);
    if (tkMatch) result.tiktok = 'https://tiktok.com/@' + tkMatch[1];

    // Email via mailto:
    const mailtoEl = $('a[href^="mailto:"]').first();
    if (mailtoEl.length) {
      const email = mailtoEl.attr('href').replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email.includes('@') && !email.includes('example')) result.email = email;
    }

    // Email via regex
    if (!result.email) {
      const emailRegex = /[\w.+-]+@[\w-]+\.[\w.-]+/gi;
      let match;
      while ((match = emailRegex.exec(html)) !== null) {
        const e = match[0].toLowerCase();
        if (!e.includes('example') && !e.includes('sentry') && !e.includes('wixpress') && !e.includes('@img') && !e.includes('@2x') && !e.includes('@3x') && e.length < 80) {
          const domain = e.split('@')[1];
          if (domain && !domain.includes('example') && !domain.includes('sentry')) {
            result.email = e;
            break;
          }
        }
      }
    }

    // Phone via tel:
    const telEl = $('a[href^="tel:"]').first();
    if (telEl.length) result.phone = telEl.attr('href').replace('tel:', '').trim();

    // WhatsApp
    const waMatch = html.match(/wa\.me\/(\+?\d+)/);
    if (waMatch) {
      result.whatsapp = 'https://wa.me/' + waMatch[1];
    }

    // Schema.org name
    const jsonLdScripts = $('script[type="application/ld+json"]');
    jsonLdScripts.each((_, el) => {
      try { const json = JSON.parse($(el).html() || '{}');
        if (json['@type'] === 'Organization' || json['@type'] === 'LocalBusiness') {
          if (json.name && !result.contactName) result.contactName = json.name;
        }
      } catch {}
    });

    return result;
  } catch(e) {
    return { error: e.message };
  }
}

async function main() {
  const sites = [
    'https://www.nike.com.br',
    'https://www.magazineluiza.com.br',
    'https://www.ifood.com.br',
  ];
  for (const site of sites) {
    console.log(`\n========== ${site} ==========`);
    try {
      const r = await enrichFromWebsite(site);
      console.log(JSON.stringify(r, null, 2));
      const hasData = r.email || r.instagram || r.facebook || r.phone || r.youtube;
      console.log('HAS CONTACT DATA: ' + (hasData ? 'YES' : 'NO (js-heavy SPA or blocked)'));
    } catch(e) {
      console.log('FATAL: ' + e.message);
    }
  }
}
main();
