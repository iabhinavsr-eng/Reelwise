/**
 * Fixture websites for crawler/pipeline tests. Each site shares a header nav
 * and footer across pages (so boilerplate removal is exercised) and includes
 * junk links (privacy, cart, login, tags, pagination) that must be skipped.
 */
export interface FixtureResponse {
  status?: number;
  body?: string;
  contentType?: string;
  location?: string;
}

export interface FixtureSite {
  name: string;
  origin: string; // canonical origin, e.g. https://www.example.com
  responses: Record<string, FixtureResponse>; // absolute URL → response
}

interface PageSpec {
  title: string;
  meta?: string;
  h1?: string;
  body: string;
  jsonLd?: unknown;
  canonical?: string;
  extraHead?: string;
}

function layout(site: { name: string; nav: [string, string][]; footer: string }, page: PageSpec): string {
  return `<!doctype html><html><head>
<title>${page.title}</title>
${page.meta ? `<meta name="description" content="${page.meta}">` : ''}
<meta property="og:site_name" content="${site.name}">
${page.canonical ? `<link rel="canonical" href="${page.canonical}">` : ''}
${page.jsonLd ? `<script type="application/ld+json">${JSON.stringify(page.jsonLd)}</script>` : ''}
${page.extraHead ?? ''}
<style>.x{color:red}</style><script>window.analytics = "track everything";</script>
</head><body>
<div class="cookie-banner">We use cookies to improve your experience. Accept all cookies?</div>
<header><a href="/">${site.name}</a><nav>${site.nav.map(([href, text]) => `<a href="${href}">${text}</a>`).join(' ')}</nav></header>
<main>${page.h1 ? `<h1>${page.h1}</h1>` : ''}${page.body}</main>
<footer><p>${site.footer}</p><a href="/privacy-policy">Privacy Policy</a> <a href="/terms">Terms</a> <a href="https://facebook.com/somebiz">Facebook</a></footer>
</body></html>`;
}

function build(name: string, origin: string, nav: [string, string][], footer: string, pages: Record<string, PageSpec>, extra: Record<string, FixtureResponse> = {}): FixtureSite {
  const responses: Record<string, FixtureResponse> = {};
  for (const [path, spec] of Object.entries(pages)) {
    responses[origin + path] = { body: layout({ name, nav, footer }, spec) };
  }
  for (const [url, res] of Object.entries(extra)) responses[url.startsWith('http') ? url : origin + url] = res;
  return { name, origin, responses };
}

const junkPages = (): Record<string, PageSpec> => ({
  '/privacy-policy': { title: 'Privacy Policy', h1: 'Privacy Policy', body: '<p>We respect your privacy. This policy explains cookies and data retention in detail.</p>' },
  '/terms': { title: 'Terms', h1: 'Terms of Service', body: '<p>By using this site you agree to these terms.</p>' },
});

// ---------------------------------------------------------------------------
// 1. Local plumber
// ---------------------------------------------------------------------------
export const plumber = build(
  'Rapid Flow Plumbing',
  'https://www.rapidflowplumbing.com',
  [['/about-us', 'About'], ['/services', 'Services'], ['/service-areas', 'Areas We Serve'], ['/contact', 'Contact'], ['/blog', 'Blog'], ['/cart', 'Cart'], ['/login', 'Log in']],
  'Rapid Flow Plumbing · 1420 Parsons Ave, Columbus, OH 43206 · Licensed & insured · (614) 555-0142',
  {
    '/': {
      title: 'Rapid Flow Plumbing | 24/7 Emergency Plumber in Columbus, OH',
      meta: 'Licensed Columbus plumbers offering 24/7 emergency repairs, drain cleaning and water heater service with upfront flat-rate pricing.',
      h1: 'Columbus plumbers who show up when you need them',
      body: `<h2>24/7 emergency plumbing</h2><p>Burst pipe at 2am? Our licensed plumbers answer the phone around the clock and arrive within 90 minutes anywhere in Franklin County.</p>
<h2>Upfront flat-rate pricing</h2><p>You get the price before we start. No overtime charges for nights or weekends.</p>
<p><a href="/services/drain-cleaning">Drain cleaning</a> · <a href="/services/water-heater-repair">Water heater repair</a> · <a href="/services/drain-cleaning?utm_source=home">Drains</a></p>`,
      jsonLd: {
        '@context': 'https://schema.org',
        '@type': 'Plumber',
        name: 'Rapid Flow Plumbing',
        telephone: '(614) 555-0142',
        address: { '@type': 'PostalAddress', streetAddress: '1420 Parsons Ave', addressLocality: 'Columbus', addressRegion: 'OH' },
        areaServed: ['Columbus', 'Bexley', 'Grandview Heights', 'Upper Arlington'],
      },
    },
    '/about-us': {
      title: 'About Rapid Flow Plumbing',
      h1: 'Family-owned since 1998',
      body: '<p>Rapid Flow Plumbing was started by Dave Kowalski in 1998. Today our team of 12 licensed plumbers serves homeowners across central Ohio.</p><p>Every job comes with a 2-year labor warranty.</p>',
    },
    '/services': {
      title: 'Plumbing Services',
      h1: 'Our plumbing services',
      body: `<ul><li><a href="/services/drain-cleaning">Drain cleaning</a></li><li><a href="/services/water-heater-repair">Water heater repair &amp; installation</a></li><li>Sewer line camera inspection</li><li>Leak detection</li><li>Sump pump installation</li></ul>`,
    },
    '/services/drain-cleaning': {
      title: 'Drain Cleaning in Columbus',
      h1: 'Drain cleaning',
      body: '<p>We clear clogged kitchen, bathroom and main sewer drains using hydro-jetting and camera inspection.</p>',
    },
    '/services/water-heater-repair': {
      title: 'Water Heater Repair',
      h1: 'Water heater repair & installation',
      body: '<p>Same-day repair and replacement of tank and tankless water heaters from all major brands.</p>',
    },
    '/service-areas': {
      title: 'Areas We Serve',
      h1: 'Areas we serve',
      body: '<p>We serve Columbus, Bexley, Grandview Heights, Upper Arlington and Worthington.</p>',
    },
    '/contact': { title: 'Contact', h1: 'Contact us', body: '<p>Call (614) 555-0142 any time, day or night.</p>' },
    '/blog': { title: 'Blog', h1: 'Plumbing tips', body: '<p><a href="/blog/page/2">Older posts</a> <a href="/tag/tips">Tips</a> <a href="/author/dave">Dave</a></p><p>Seasonal plumbing advice for homeowners.</p>' },
    '/blog/page/2': { title: 'Blog page 2', body: '<p>Older posts.</p>' },
    '/tag/tips': { title: 'Tips', body: '<p>Tag archive.</p>' },
    '/author/dave': { title: 'Dave', body: '<p>Author archive.</p>' },
    '/cart': { title: 'Cart', body: '<p>Your cart is empty.</p>' },
    '/login': { title: 'Login', body: '<p>Log in to your account.</p>' },
    ...junkPages(),
  },
  {
    // non-www and http both redirect to the canonical origin
    'https://rapidflowplumbing.com/': { status: 301, location: 'https://www.rapidflowplumbing.com/' },
    'http://rapidflowplumbing.com/': { status: 301, location: 'https://www.rapidflowplumbing.com/' },
    '/robots.txt': { body: 'User-agent: *\nDisallow: /login\nSitemap: https://www.rapidflowplumbing.com/sitemap.xml', contentType: 'text/plain' },
    '/sitemap.xml': {
      contentType: 'application/xml',
      body: `<?xml version="1.0"?><urlset>${['/', '/about-us', '/services', '/services/drain-cleaning', '/services/water-heater-repair', '/services/leak-detection', '/service-areas', '/contact', '/privacy-policy']
        .map((p) => `<url><loc>https://www.rapidflowplumbing.com${p}</loc></url>`)
        .join('')}</urlset>`,
    },
    '/services/leak-detection': { status: 404, body: 'Not found' },
  },
);

// ---------------------------------------------------------------------------
// 2. Law firm
// ---------------------------------------------------------------------------
export const lawFirm = build(
  'Hart & Mercer Family Law',
  'https://hartmercerlaw.com',
  [['/practice-areas', 'Practice Areas'], ['/attorneys', 'Our Attorneys'], ['/about', 'About'], ['/faq', 'FAQ'], ['/contact', 'Free Consultation']],
  'Hart & Mercer Family Law · 800 SW Broadway, Suite 400, Portland, OR 97205',
  {
    '/': {
      title: 'Hart & Mercer | Portland Divorce & Family Law Attorneys',
      meta: 'Portland family law firm focused on divorce, custody and mediation. Flat-fee uncontested divorce.',
      h1: 'Calm, practical family law guidance in Portland',
      body: '<p>We help Oregon families through divorce, child custody and support with a mediation-first approach that keeps costs down.</p><h2>Flat-fee uncontested divorce</h2><p>Know your cost up front.</p>',
      jsonLd: { '@context': 'https://schema.org', '@type': 'LegalService', name: 'Hart & Mercer Family Law', areaServed: 'Oregon' },
    },
    '/practice-areas': {
      title: 'Practice Areas',
      h1: 'Practice areas',
      body: '<ul><li><a href="/practice-areas/divorce">Divorce</a></li><li><a href="/practice-areas/child-custody">Child custody</a></li><li>Spousal support</li><li>Mediation</li></ul>',
    },
    '/practice-areas/divorce': { title: 'Divorce', h1: 'Divorce', body: '<p>Contested and uncontested divorce, including our flat-fee uncontested package.</p>' },
    '/practice-areas/child-custody': { title: 'Child Custody', h1: 'Child custody', body: '<p>Parenting plans and custody modifications focused on the children’s stability.</p>' },
    '/attorneys': { title: 'Attorneys', h1: 'Our attorneys', body: '<p>Laura Hart is a certified family law mediator with 20 years of experience. Sam Mercer is a former family court clerk.</p>' },
    '/about': { title: 'About', h1: 'About the firm', body: '<p>Founded in 2009, we only practice family law.</p>' },
    '/faq': { title: 'FAQ', h1: 'Frequently asked questions', body: '<h2>How long does a divorce take in Oregon?</h2><p>Uncontested cases often finish in 90 days.</p>' },
    '/contact': { title: 'Contact', h1: 'Book a free 20-minute consultation', body: '<p>Call (503) 555-0199.</p>' },
    '/author/laura': { title: 'Laura', body: '<p>Author.</p>' },
    ...junkPages(),
  },
);

// ---------------------------------------------------------------------------
// 3. Wellness clinic (mobile IV)
// ---------------------------------------------------------------------------
export const wellness = build(
  'Lyte Guards Mobile IV',
  'https://www.lyteguards.com',
  [['/mobile-iv', 'Mobile IV'], ['/services', 'Treatments'], ['/pricing', 'Pricing'], ['/faq', 'FAQ'], ['/about', 'About'], ['/book', 'Book Now'], ['/login', 'Member login']],
  'Lyte Guards Mobile IV · Serving Wilmington, Newark and Middletown, Delaware',
  {
    '/': {
      title: 'Lyte Guards | Mobile IV Therapy in Wilmington, DE',
      meta: 'Mobile IV hydration delivered to your home, office or hotel by registered nurses in northern Delaware.',
      h1: 'IV hydration that comes to you',
      body: '<p>Our registered nurses bring IV hydration and vitamin therapy to your home, office or hotel — usually within two hours.</p><h2>Group events</h2><p>We host IV parties for teams and bridal groups.</p>',
      jsonLd: { '@context': 'https://schema.org', '@type': 'MedicalBusiness', name: 'Lyte Guards Mobile IV', address: { addressLocality: 'Wilmington', addressRegion: 'DE' } },
    },
    '/mobile-iv': { title: 'Mobile IV Therapy', h1: 'Mobile IV therapy', body: '<p>We offer mobile IV therapy anywhere in New Castle County. Every visit starts with a nurse health screening.</p>' },
    '/services': { title: 'Treatments', h1: 'Treatments', body: '<ul><li>Hydration drip</li><li>Myers’ Cocktail</li><li>Immunity boost</li><li>Hangover recovery</li><li>NAD+ therapy</li></ul>' },
    '/pricing': { title: 'Pricing', h1: 'Pricing', body: '<p>Drips start at $149. Memberships from $129/month.</p>' },
    '/faq': { title: 'FAQ', h1: 'FAQ', body: '<h2>Who administers the IV?</h2><p>Every IV is administered by a Delaware-licensed registered nurse.</p>' },
    '/about': { title: 'About', h1: 'About Lyte Guards', body: '<p>Founded by ER nurse Maya Brooks after years of seeing preventable dehydration.</p>' },
    '/book': { title: 'Book', h1: 'Book a visit', body: '<p>Choose a time and location.</p>' },
    '/login': { title: 'Login', body: '<p>Member login.</p>' },
    ...junkPages(),
  },
  { 'https://lyteguards.com/': { status: 301, location: 'https://www.lyteguards.com/' } },
);

// ---------------------------------------------------------------------------
// 4. Ecommerce store (Shopify-like)
// ---------------------------------------------------------------------------
const candles = ['cedar-smoke', 'sea-salt', 'fig-leaf', 'amber-noir', 'wild-rose', 'orange-clove'];
export const ecommerce = build(
  'Fernhill Candle Co.',
  'https://fernhillcandles.com',
  [['/collections/all', 'Shop'], ['/pages/about', 'Our Story'], ['/pages/faq', 'FAQ'], ['/cart', 'Cart'], ['/account/login', 'Account']],
  'Fernhill Candle Co. · Hand-poured in Asheville, North Carolina · Free shipping over $50',
  {
    '/': {
      title: 'Fernhill Candle Co. — Hand-poured soy candles',
      meta: 'Small-batch soy candles hand-poured in Asheville, NC with cotton wicks and phthalate-free fragrance.',
      h1: 'Small-batch candles, hand-poured in Asheville',
      body: `<p>Clean-burning soy wax, cotton wicks and phthalate-free fragrance oils.</p>${candles.map((c) => `<a href="/products/${c}">${c}</a>`).join(' ')}`,
    },
    '/collections/all': {
      title: 'Shop all candles',
      h1: 'All candles',
      body: `${candles.map((c) => `<a href="/products/${c}">${c.replace('-', ' ')} candle</a>`).join(' ')} <a href="/collections/all?page=2">Next page</a>`,
    },
    ...Object.fromEntries(
      candles.map((c) => [
        `/products/${c}`,
        { title: `${c} candle`, h1: `${c.replace('-', ' ')} candle`, body: `<p>An 8 oz soy candle with notes of ${c.replace('-', ' ')}. Burns for 50 hours.</p>`, jsonLd: { '@type': 'Product', name: `${c} candle`, offers: { price: '28.00', priceCurrency: 'USD' } } } as PageSpec,
      ]),
    ),
    '/pages/about': { title: 'Our story', h1: 'Our story', body: '<p>Fernhill started in a garage in 2017. Every candle is still poured by hand in small batches of 40.</p>' },
    '/pages/faq': { title: 'FAQ', h1: 'FAQ', body: '<p>We ship across the US within 2 business days.</p>' },
    '/cart': { title: 'Cart', body: '<p>Your cart.</p>' },
    '/account/login': { title: 'Login', body: '<p>Sign in.</p>' },
    ...junkPages(),
  },
  { '/collections/all?page=2': { body: '<html><body>page 2</body></html>' } },
);

// ---------------------------------------------------------------------------
// 5. Restaurant
// ---------------------------------------------------------------------------
export const restaurant = build(
  'Nonna Lucia Trattoria',
  'https://www.nonnalucia.com',
  [['/menu', 'Menu'], ['/about', 'Our Story'], ['/reservations', 'Reservations'], ['/private-events', 'Private Events']],
  'Nonna Lucia Trattoria · 2210 W Taylor St, Chicago, IL · Tue–Sun 5–10pm',
  {
    '/': {
      title: 'Nonna Lucia Trattoria | Handmade Pasta in Little Italy, Chicago',
      meta: 'Family-run trattoria serving handmade pasta and wood-fired dishes on Taylor Street since 1986.',
      h1: 'Handmade pasta on Taylor Street since 1986',
      body: '<p>Three generations of the Moretti family make every pasta by hand each morning.</p>',
      jsonLd: { '@type': 'Restaurant', name: 'Nonna Lucia Trattoria', servesCuisine: 'Italian', priceRange: '$$' },
    },
    '/menu': { title: 'Menu', h1: 'Menu', body: '<h2>Pasta</h2><ul><li>Cacio e pepe</li><li>Wild boar pappardelle</li></ul><h2>Wood-fired</h2><ul><li>Branzino</li></ul>' },
    '/about': { title: 'Our story', h1: 'Our story', body: '<p>Lucia Moretti opened the trattoria in 1986 with recipes from Abruzzo.</p>' },
    '/reservations': { title: 'Reservations', h1: 'Reserve a table', body: '<p>Walk-ins welcome at the bar.</p>' },
    '/private-events': { title: 'Private events', h1: 'Private events', body: '<p>Our upstairs room seats 40 for rehearsal dinners and parties.</p>' },
    ...junkPages(),
  },
);

// ---------------------------------------------------------------------------
// Edge cases
// ---------------------------------------------------------------------------
export const parked: FixtureSite = {
  name: 'parked',
  origin: 'https://coming-soon-biz.com',
  responses: { 'https://coming-soon-biz.com/': { body: '<html><head><title>Coming soon</title></head><body><h1>Coming soon</h1></body></html>' } },
};

export const robotsBlocked: FixtureSite = {
  name: 'robots',
  origin: 'https://private-biz.com',
  responses: {
    'https://private-biz.com/': { body: '<html><body><h1>Hi</h1></body></html>' },
    'https://private-biz.com/robots.txt': { body: 'User-agent: *\nDisallow: /', contentType: 'text/plain' },
  },
};

export const forbidden: FixtureSite = {
  name: 'forbidden',
  origin: 'https://cloudwalled.com',
  responses: { 'https://cloudwalled.com/': { status: 403, body: 'Access denied' } },
};

export const pdfOnly: FixtureSite = {
  name: 'pdf',
  origin: 'https://brochure-biz.com',
  responses: { 'https://brochure-biz.com/': { body: '%PDF-1.4', contentType: 'application/pdf' } },
};

/** Duplicate URL shapes: canonical tags, index.html, trailing slashes, tracking params. */
export const duplicates = build(
  'Dupe Co',
  'https://dupe.example.com',
  [['/about', 'About'], ['/about/', 'About again'], ['/about?utm_source=nav', 'About utm'], ['/index.html', 'Home'], ['/services', 'Services'], ['/our-services', 'Services (old)']],
  'Dupe Co footer',
  {
    '/': { title: 'Dupe Co', h1: 'Dupe Co', body: '<p>We fix bikes and sell parts in Boulder, Colorado. Walk-in tune-ups every day.</p>' },
    '/about': { title: 'About', h1: 'About', body: '<p>Founded 2012 by two bike mechanics.</p>' },
    '/services': { title: 'Services', h1: 'Services', body: '<p>Tune-ups, wheel truing, fittings.</p>' },
    '/our-services': { title: 'Services', h1: 'Services', body: '<p>Tune-ups, wheel truing, fittings.</p>', canonical: 'https://dupe.example.com/services' },
  },
);
