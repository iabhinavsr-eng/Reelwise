import type { AudienceAttributes, ContentGoal, ContentType, VoiceTrait } from '@/domain/types';

/**
 * Development fixtures used by the mock analysis + recommendation services.
 * Picked by keywords in the website URL (analysis) or industry (ideas).
 * Delete this file once real AI services are wired in.
 */
export interface IdeaSeed {
  contentType: ContentType;
  title: string;
  description: string;
  objective: ContentGoal;
}

export interface IndustryFixture {
  key: string;
  keywords: string[];
  industry: string;
  primaryLocation: string;
  description: (name: string) => string;
  services: string[];
  audienceSummary: string;
  audienceAttributes: AudienceAttributes;
  valueProposition: (name: string) => string;
  goals: ContentGoal[];
  voice: VoiceTrait[];
  ideas: IdeaSeed[];
}

export const FIXTURES: IndustryFixture[] = [
  {
    key: 'wellness',
    keywords: ['iv', 'wellness', 'hydrat', 'drip', 'lyte', 'vital', 'med', 'spa', 'health'],
    industry: 'Wellness & IV Therapy',
    primaryLocation: 'Wilmington, Delaware',
    description: (name) =>
      `${name} is a wellness studio offering IV hydration, vitamin injections and health coaching, helping busy people feel more energized and recover faster.`,
    services: ['IV hydration therapy', 'Vitamin & B12 injections', 'Health coaching', 'Recovery & immunity drips'],
    audienceSummary:
      'Busy professionals and active adults, 35–60, who invest in preventative wellness. They want more energy and less stress, and value convenient, personalized care they can fit around work and family.',
    audienceAttributes: {
      locations: ['Wilmington, DE', 'Northern Delaware'],
      ageRanges: ['35–60'],
      customerTypes: ['Busy professionals', 'Active adults', 'Parents'],
      needs: ['More energy', 'Faster recovery', 'Convenient care'],
      painPoints: ['Constant fatigue', 'No time for self-care', 'Generic advice that doesn’t fit them'],
      motivations: ['Feeling their best', 'Preventing burnout'],
    },
    valueProposition: (name) =>
      `${name} combines IV therapy with real health coaching, so clients don’t just get a quick boost — they leave with a personalized plan to feel better inside and out.`,
    goals: ['educate', 'build_trust'],
    voice: ['conversational', 'warm'],
    ideas: [
      {
        contentType: 'seasonal_advice',
        title: 'The fall schedule reset',
        description: 'Why taking care of yourself is often the first thing to disappear when life gets busy.',
        objective: 'stay_top_of_mind',
      },
      {
        contentType: 'faq',
        title: 'Which IV do I actually need?',
        description: 'Answer a question a prospective customer may ask before booking.',
        objective: 'educate',
      },
      {
        contentType: 'quick_tip',
        title: 'Don’t wait to feel thirsty',
        description: 'A useful hydration thought that doesn’t start as a sales pitch.',
        objective: 'build_trust',
      },
    ],
  },
  {
    key: 'dental',
    keywords: ['dent', 'smile', 'ortho', 'teeth', 'tooth'],
    industry: 'Family Dentistry',
    primaryLocation: 'Austin, Texas',
    description: (name) =>
      `${name} is a family dental practice providing check-ups, cleanings, whitening and Invisalign in a calm, judgment-free setting.`,
    services: ['Check-ups & cleanings', 'Teeth whitening', 'Invisalign', 'Emergency dental care'],
    audienceSummary:
      'Local families and working adults who have put off the dentist because of cost worries, anxiety or a bad past experience, and want a practice that explains things plainly.',
    audienceAttributes: {
      locations: ['Austin, TX'],
      ageRanges: ['28–55'],
      customerTypes: ['Families', 'Working adults'],
      painPoints: ['Dental anxiety', 'Surprise costs', 'Feeling lectured'],
      motivations: ['A healthy, confident smile', 'Avoiding bigger problems later'],
    },
    valueProposition: (name) =>
      `${name} makes the dentist feel easy: clear prices up front, gentle care for nervous patients, and same-week appointments for the whole family.`,
    goals: ['educate', 'build_trust', 'get_leads'],
    voice: ['warm', 'straightforward'],
    ideas: [
      {
        contentType: 'myth_vs_fact',
        title: 'Does whitening ruin your enamel?',
        description: 'Clear up the worry that stops people from asking about whitening.',
        objective: 'educate',
      },
      {
        contentType: 'warning_signs',
        title: '3 signs you shouldn’t wait',
        description: 'Small symptoms that are worth a quick check before they get expensive.',
        objective: 'get_leads',
      },
      {
        contentType: 'day_in_the_life',
        title: 'What a first visit really looks like',
        description: 'Walk a nervous patient through the first 10 minutes so nothing is a surprise.',
        objective: 'build_trust',
      },
    ],
  },
  {
    key: 'home',
    keywords: ['plumb', 'hvac', 'roof', 'electric', 'heating', 'air', 'cool', 'repair', 'handyman'],
    industry: 'Home Services — Heating & Cooling',
    primaryLocation: 'Columbus, Ohio',
    description: (name) =>
      `${name} installs, repairs and maintains heating and cooling systems for homeowners, with upfront pricing and same-day service.`,
    services: ['AC repair & installation', 'Furnace repair', 'Seasonal maintenance plans', 'Indoor air quality'],
    audienceSummary:
      'Homeowners, 30–65, who want a contractor they can trust — someone who shows up on time, explains the problem honestly and doesn’t upsell what they don’t need.',
    audienceAttributes: {
      locations: ['Columbus, OH'],
      ageRanges: ['30–65'],
      customerTypes: ['Homeowners', 'Landlords'],
      painPoints: ['Being overcharged', 'No-show contractors', 'Emergency breakdowns'],
      motivations: ['Peace of mind', 'Lower energy bills'],
    },
    valueProposition: (name) =>
      `${name} tells you exactly what’s wrong and what it costs before any work starts — no surprise invoices, and a technician at your door the same day.`,
    goals: ['build_trust', 'get_leads', 'stay_top_of_mind'],
    voice: ['straightforward', 'conversational'],
    ideas: [
      {
        contentType: 'seasonal_advice',
        title: 'Do this before the first cold night',
        description: 'A 2-minute furnace check every homeowner can do themselves.',
        objective: 'stay_top_of_mind',
      },
      {
        contentType: 'common_mistake',
        title: 'The filter mistake almost everyone makes',
        description: 'A simple fix that saves money and doesn’t start with a sales pitch.',
        objective: 'educate',
      },
      {
        contentType: 'industry_secret',
        title: 'What a fair repair quote looks like',
        description: 'Show homeowners how to spot an inflated quote — builds instant trust.',
        objective: 'build_trust',
      },
    ],
  },
  {
    key: 'fitness',
    keywords: ['fit', 'gym', 'yoga', 'pilates', 'train', 'strength', 'crossfit', 'barre'],
    industry: 'Fitness Studio',
    primaryLocation: 'Denver, Colorado',
    description: (name) =>
      `${name} is a small-group fitness studio offering strength, mobility and personal training for people who want coaching without the big-box gym feel.`,
    services: ['Small-group strength classes', 'Personal training', 'Mobility sessions', 'Nutrition coaching'],
    audienceSummary:
      'Adults, 30–55, who have started and stopped gym memberships before and want a coach who keeps them consistent, with workouts that fit a busy week.',
    audienceAttributes: {
      locations: ['Denver, CO'],
      ageRanges: ['30–55'],
      customerTypes: ['Busy professionals', 'Returning exercisers'],
      painPoints: ['Losing motivation', 'Intimidating gyms', 'Nagging injuries'],
      motivations: ['Feeling strong', 'Accountability', 'Community'],
    },
    valueProposition: (name) =>
      `At ${name}, every class is coached in small groups, so you get personal attention and a community that notices when you don’t show up.`,
    goals: ['grow_followers', 'build_trust', 'get_leads'],
    voice: ['warm', 'playful'],
    ideas: [
      {
        contentType: 'myth_vs_fact',
        title: 'You don’t need an hour to make progress',
        description: 'Bust the myth that keeps busy people from starting at all.',
        objective: 'educate',
      },
      {
        contentType: 'quick_tip',
        title: 'The warm-up you’re probably skipping',
        description: 'One simple move that makes every workout feel better.',
        objective: 'grow_followers',
      },
      {
        contentType: 'review_highlight',
        title: 'From “I hate gyms” to 3x a week',
        description: 'Share a member’s story in their own words.',
        objective: 'build_trust',
      },
    ],
  },
];

export const GENERIC_FIXTURE: IndustryFixture = {
  key: 'generic',
  keywords: [],
  industry: 'Local Services',
  primaryLocation: 'Your city',
  description: (name) =>
    `${name} is a locally owned business that helps customers with personal, reliable service and advice they can trust.`,
  services: ['Consultations', 'Core services', 'Ongoing support'],
  audienceSummary:
    'Local customers who prefer to buy from a business they know and trust, and who want clear advice before they make a decision.',
  audienceAttributes: {
    customerTypes: ['Local customers'],
    painPoints: ['Not knowing who to trust', 'Confusing options'],
    motivations: ['Good value', 'Personal service'],
  },
  valueProposition: (name) =>
    `${name} gives every customer personal attention and honest advice — you’ll always talk to someone who knows your situation.`,
  goals: ['educate', 'build_trust'],
  voice: ['conversational', 'straightforward'],
  ideas: [
    {
      contentType: 'faq',
      title: 'The question we hear every week',
      description: 'Answer the most common question customers ask before they buy.',
      objective: 'educate',
    },
    {
      contentType: 'common_mistake',
      title: 'The mistake that costs customers the most',
      description: 'A helpful warning that shows you know your stuff.',
      objective: 'build_trust',
    },
    {
      contentType: 'day_in_the_life',
      title: 'Behind the counter',
      description: 'Show the people and care behind the business in 30 seconds.',
      objective: 'stay_top_of_mind',
    },
  ],
};

export function fixtureFor(text: string): IndustryFixture {
  const haystack = text.toLowerCase();
  return FIXTURES.find((f) => f.keywords.some((k) => haystack.includes(k))) ?? GENERIC_FIXTURE;
}

/** "https://www.bright-smile-dental.com" → "Bright Smile Dental" */
export function nameFromUrl(url: string): string {
  let host = url;
  try {
    host = new URL(url).hostname;
  } catch {}
  const base = host.replace(/^www\./, '').split('.')[0] ?? host;
  return base
    .split(/[-_\d]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
