import { COUNTRY_SEO } from './countrySeo';

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[char] || char));
}

export function renderCountrySeoPage(countryCode: string): string | null {
  const code = countryCode.toUpperCase();
  const profile = COUNTRY_SEO[code];
  if (!profile) return null;

  const slug = code.toLowerCase();
  const url = `https://groundsurf.net/country/${slug}/`;
  const hazards = profile.hazards.map(hazard => `<section><h2>${escapeHtml(hazard)}</h2><p>${escapeHtml(profile.intro)}</p></section>`).join('');
  const keywords = profile.keywords.map(escapeHtml).join(', ');

  return `<!doctype html>
<html lang="${escapeHtml(profile.language)}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${escapeHtml(profile.title)} | GroundSurf</title>
<meta name="description" content="${escapeHtml(profile.description)}">
<meta name="robots" content="index,follow,max-image-preview:large">
<link rel="canonical" href="${url}">
<link rel="alternate" hreflang="${escapeHtml(profile.language)}" href="${url}">
<link rel="alternate" hreflang="x-default" href="${url}">
<meta property="og:site_name" content="GroundSurf">
<meta property="og:title" content="${escapeHtml(profile.title)} | GroundSurf">
<meta property="og:description" content="${escapeHtml(profile.description)}">
<meta property="og:type" content="website">
<meta property="og:url" content="${url}">
<script type="application/ld+json">${JSON.stringify({
    '@context':'https://schema.org',
    '@type':'WebPage',
    name: profile.title,
    description: profile.description,
    url,
    inLanguage: profile.language,
    keywords: profile.keywords,
    isPartOf: {'@type':'WebSite', name:'GroundSurf', url:'https://groundsurf.net/'}
  })}</script>
<style>body{font-family:system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;max-width:820px;margin:0 auto;padding:48px 24px;line-height:1.65;color:#18202a;background:#fff}a{color:inherit}header{margin-bottom:42px}h1{font-size:clamp(2rem,5vw,3.2rem);line-height:1.1}h2{font-size:1.3rem;margin-top:32px}p{max-width:720px;color:#46515e}.keywords{font-size:.95rem}</style>
</head>
<body>
<p><a href="/">GroundSurf</a></p>
<header><h1>${escapeHtml(profile.title)}</h1><p>${escapeHtml(profile.description)}</p><p class="keywords">${keywords}</p></header>
${hazards}
<p><a href="/">${escapeHtml(profile.cta)} →</a></p>
</body>
</html>`;
}
