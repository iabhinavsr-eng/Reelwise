/**
 * Decides which internal pages are worth reading. We want pages that explain
 * WHAT the business does, WHO it serves, WHERE it operates and WHY customers
 * choose it — not legal pages, carts, archives or pagination.
 */
export type PageType =
  | 'home'
  | 'about'
  | 'services'
  | 'service_detail'
  | 'products'
  | 'product_detail'
  | 'pricing'
  | 'locations'
  | 'contact'
  | 'faq'
  | 'team'
  | 'reviews'
  | 'menu'
  | 'blog'
  | 'careers'
  /** In the main menu but not recognised by URL — often a core offering (e.g. /mobile-iv). */
  | 'primary'
  | 'other';

export interface PageClassification {
  type: PageType;
  score: number;
  excluded: boolean;
  reason?: string;
}

const EXCLUDE: [RegExp, string][] = [
  [/(^|\/)(privacy|privacy-policy|terms|terms-of-service|terms-and-conditions|tos|legal|disclaimer|cookies?|cookie-policy|gdpr|ccpa|accessibility-statement|do-not-sell)(\/|$|\.)/, 'legal'],
  [/(^|\/)(login|log-in|signin|sign-in|signup|sign-up|register|account|my-account|password|reset-password|logout|auth|admin|wp-admin|wp-login\.php)(\/|$)/, 'auth'],
  [/(^|\/)(cart|basket|checkout|wishlist|compare)(\/|$)/, 'commerce-flow'],
  [/(^|\/)(tag|tags|author|authors|category|categories|archive|archives|feed|rss|comments|attachment|search)(\/|$)/, 'archive'],
  [/(^|\/)page\/\d+(\/|$)/, 'pagination'],
  [/(^|\/)(wp-json|wp-content|wp-includes|xmlrpc\.php|cdn-cgi|_next|static|assets)(\/|$)/, 'technical'],
  [/(^|\/)(sitemap|sitemap\.xml|robots\.txt)(\/|$)/, 'technical'],
];

const EXCLUDE_QUERY = /(^|&)(s|q|query|search|page|paged|p|sort|orderby|filter|add-to-cart|replytocom|share|print|lang)=/i;

interface TypeRule {
  type: PageType;
  score: number;
  path: RegExp;
  anchor?: RegExp;
}

const TYPE_RULES: TypeRule[] = [
  { type: 'about', score: 50, path: /(^|\/)(about|about-us|our-story|who-we-are|company|our-company|mission|history)(\/|$)/, anchor: /\b(about|our story|who we are)\b/ },
  { type: 'services', score: 48, path: /(^|\/)(services|our-services|what-we-do|treatments|practice-areas|solutions|offerings|capabilities|specialties|procedures)(\/|$)/, anchor: /\b(services|what we do|treatments|practice areas|solutions)\b/ },
  { type: 'menu', score: 46, path: /(^|\/)(menu|menus|food|drinks|our-menu)(\/|$)/, anchor: /\b(menu|food|drinks)\b/ },
  { type: 'locations', score: 42, path: /(^|\/)(locations?|areas?-we-serve|service-areas?|find-us|directions|visit|visit-us|where-we-work|coverage)(\/|$)/, anchor: /\b(locations?|areas we serve|service areas?|find us|visit us)\b/ },
  { type: 'products', score: 40, path: /(^|\/)(products|shop|store|collections|catalog|catalogue|all-products)(\/|$)|^\/collections\/[^/]+$/, anchor: /\b(shop|products|store|collections)\b/ },
  { type: 'pricing', score: 38, path: /(^|\/)(pricing|prices|rates|plans|packages|membership|memberships|fees|cost)(\/|$)/, anchor: /\b(pricing|prices|rates|plans|packages|membership)\b/ },
  { type: 'faq', score: 34, path: /(^|\/)(faq|faqs|questions|frequently-asked-questions|help)(\/|$)/, anchor: /\b(faqs?|questions)\b/ },
  { type: 'team', score: 30, path: /(^|\/)(team|our-team|staff|people|attorneys|lawyers|doctors|providers|meet-the-team|leadership|practitioners|stylists|trainers|coaches)(\/|$)/, anchor: /\b(team|staff|attorneys|doctors|providers|meet)\b/ },
  { type: 'contact', score: 30, path: /(^|\/)(contact|contact-us|get-in-touch|book|booking|book-now|appointments?|reservations?|schedule|quote|get-a-quote|estimate)(\/|$)/, anchor: /\b(contact|book|appointment|reserve|reservation|quote|estimate)\b/ },
  { type: 'reviews', score: 24, path: /(^|\/)(reviews|testimonials|case-studies|results|success-stories)(\/|$)/, anchor: /\b(reviews|testimonials|case studies)\b/ },
  { type: 'careers', score: -12, path: /(^|\/)(careers|jobs|join-us|join-our-team|employment|hiring)(\/|$)/ },
  { type: 'blog', score: -6, path: /(^|\/)(blog|news|articles|insights|resources|press|media|stories|posts?)(\/|$)|\/\d{4}\/\d{2}\// },
];

const SERVICE_PARENT = /^\/(services|our-services|treatments|practice-areas|solutions|procedures|specialties|what-we-do)\/[^/]+/;
const PRODUCT_PARENT = /^\/(products?|shop|store)\/[^/]+/;
const LOCATION_PARENT = /^\/(locations?|service-areas?|areas-we-serve)\/[^/]+/;

export function classifyUrl(url: URL, anchorText = '', depth = 1): PageClassification {
  const path = decodeURIComponent(url.pathname).toLowerCase().replace(/\/+$/, '') || '/';
  if (path === '/' || /^\/(index|home)(\.html?|\.php)?$/.test(path)) return { type: 'home', score: 100, excluded: false };

  for (const [re, reason] of EXCLUDE) if (re.test(path)) return { type: 'other', score: -100, excluded: true, reason };
  if (url.search && EXCLUDE_QUERY.test(url.search.slice(1))) {
    return { type: 'other', score: -100, excluded: true, reason: 'query' };
  }

  const anchor = anchorText.toLowerCase().replace(/\s+/g, ' ').trim();
  const segments = path.split('/').filter(Boolean);
  let type: PageType = 'other';
  let score = 8;

  if (SERVICE_PARENT.test(path) && segments.length >= 2) {
    type = 'service_detail';
    score = 36;
  } else if (LOCATION_PARENT.test(path) && segments.length >= 2) {
    type = 'locations';
    score = 30;
  } else if (PRODUCT_PARENT.test(path) && segments.length >= 2) {
    type = 'product_detail';
    score = 20;
  } else {
    for (const rule of TYPE_RULES) {
      if (rule.path.test(path) || (rule.anchor && anchor && rule.anchor.test(anchor))) {
        type = rule.type;
        score = rule.score;
        break;
      }
    }
  }

  // Blog posts (deeper than the index) are rarely about the business itself.
  if (type === 'blog' && segments.length > 1) score -= 8;
  // Deep, long or query-string URLs are usually less central.
  score -= Math.max(0, depth - 1) * 4;
  score -= Math.max(0, segments.length - 2) * 3;
  if (url.search) score -= 6;
  // Anchor text that sounds like a service still helps unknown pages.
  if (type === 'other' && /\b(service|repair|install|treatment|therapy|consult|lesson|class|program|package)s?\b/.test(anchor + ' ' + path)) {
    type = 'service_detail';
    score = Math.max(score, 26);
  }
  return { type, score, excluded: false };
}

/** Caps per page type so, say, 40 product pages can't crowd out "About". */
export const TYPE_LIMITS: Partial<Record<PageType, number>> = {
  product_detail: 3,
  service_detail: 6,
  blog: 1,
  careers: 0,
  team: 2,
  locations: 3,
  reviews: 1,
  primary: 6,
  other: 3,
};
