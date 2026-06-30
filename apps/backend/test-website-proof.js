const cheerio = require('cheerio');
const axios = require('axios');

async function enrichFromWebsite(websiteUrl) {
  const result = { instagram: null, instagramHandle: null, facebook: null, email: null, phone: null, whatsapp: null };
  if (!websiteUrl) return result;
  let normalizedUrl = websiteUrl.trim();
  if (!normalizedUrl.startsWith('http')) normalizedUrl = 'https://' + normalizedUrl;
  try {
    const resp = await axios.get(normalizedUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; LeadHunterAI/1.0)' },
      timeout: 8000, maxRedirects: 3, maxContentLength: 1024*1024, responseType: 'text'
    });
    const html = typeof resp.data === 'string' ? resp.data : '';
    if (!html) return result;

    const $ = cheerio.load(html);
    const instaMatch = html.match(/instagram\.com\/([a-zA-Z0-9_.]+)(?!\/p\/|\/reel\/)/);
    if (instaMatch && !['p','reel','explore','stories'].includes(instaMatch[1].toLowerCase())) {
      result.instagram = 'https://instagram.com/' + instaMatch[1];
      result.instagramHandle = instaMatch[1];
    }
    const fbMatch = html.match(/facebook\.com\/([a-zA-Z0-9.]+)/);
    if (fbMatch && !['sharer','login','plugins','share'].includes(fbMatch[1].toLowerCase())) {
      result.facebook = 'https://facebook.com/' + fbMatch[1];
    }
    const mailtoEl = $('a[href^="mailto:"]').first();
    if (mailtoEl.length) {
      const email = mailtoEl.attr('href').replace('mailto:', '').split('?')[0].trim().toLowerCase();
      if (email.includes('@')) result.email = email;
    }
    if (!result.email) {
      const emailMatch = html.match(/([\w.+-]+@[\w-]+\.[\w.-]+)/);
      if (emailMatch && !emailMatch[0].includes('example') && !emailMatch[0].includes('sentry')) {
        result.email = emailMatch[0].toLowerCase();
      }
    }
    const telEl = $('a[href^="tel:"]').first();
    if (telEl.length) result.phone = telEl.attr('href').replace('tel:', '').trim();
    const waMatch = html.match(/wa\.me\/(\+?\d+)/);
    if (waMatch) result.whatsapp = 'https://wa.me/' + waMatch[1];
    return result;
  } catch(e) {
    return { error: e.message };
  }
}

async function main() {
  const sites = [
    'https://www.instagram.com',
    'https://github.com',
  ];
  for (const site of sites) {
    console.log(`\n=== ${site} ===`);
    const result = await enrichFromWebsite(site);
    console.log(JSON.stringify(result, null, 2));
  }
}
main();
