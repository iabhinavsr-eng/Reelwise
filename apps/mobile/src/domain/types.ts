/**
 * Core domain model. These types mirror the Supabase schema in
 * `supabase/migrations` (snake_case there, camelCase here).
 *
 * Internal naming uses marketing terms (ICP, UVP). The UI never shows them:
 * ICP → "Ideal Customer" / "Your Audience", UVP → "Why customers choose you".
 */

// ---------------------------------------------------------------------------
// Business context
// ---------------------------------------------------------------------------

export interface BusinessProfile {
  name: string;
  websiteUrl: string;
  industry: string;
  primaryLocation: string;
  description: string;
  services: string[];
}

export interface Business extends BusinessProfile {
  id: string;
  userId: string;
  createdAt: string;
  updatedAt: string;
}

/**
 * Structured ideal-customer attributes. Not collected during onboarding, but
 * the analysis can fill them and the content engine will use them later.
 */
export interface AudienceAttributes {
  locations?: string[];
  ageRanges?: string[];
  customerTypes?: string[];
  needs?: string[];
  painPoints?: string[];
  motivations?: string[];
  behaviors?: string[];
  preferences?: string[];
}

/** ICP. */
export interface AudienceProfile {
  summary: string;
  structuredAttributes: AudienceAttributes;
}

/** UVP. */
export interface ValueProposition {
  summary: string;
}

// ---------------------------------------------------------------------------
// Content preferences
// ---------------------------------------------------------------------------

export const CONTENT_GOALS = [
  'educate',
  'build_trust',
  'get_leads',
  'grow_followers',
  'promote_services',
  'stay_top_of_mind',
] as const;
export type ContentGoal = (typeof CONTENT_GOALS)[number];

export const VOICE_TRAITS = [
  'conversational',
  'warm',
  'straightforward',
  'professional',
  'playful',
  'bold',
  'educational',
] as const;
export type VoiceTrait = (typeof VOICE_TRAITS)[number];

export interface ContentPreferences {
  goals: ContentGoal[];
  voiceTraits: VoiceTrait[];
}

// ---------------------------------------------------------------------------
// Content engine (prepared for, not built yet)
//
//   business context + ICP + UVP + content type + blueprint + objective
//   + platform + target length + CTA  =  teleprompter script
// ---------------------------------------------------------------------------

export const CONTENT_TYPES = [
  'quick_tip',
  'faq',
  'common_mistake',
  'myth_vs_fact',
  'did_you_know',
  'industry_secret',
  'warning_signs',
  'seasonal_advice',
  'problem_solution',
  'service_spotlight',
  'product_spotlight',
  'review_highlight',
  'local_community',
  'day_in_the_life',
] as const;
export type ContentType = (typeof CONTENT_TYPES)[number];

export type Platform = 'instagram_reels' | 'tiktok' | 'youtube_shorts' | 'facebook_reels';

export type ContentIdeaStatus = 'suggested' | 'selected' | 'scripted' | 'recorded' | 'published' | 'dismissed';

export interface ContentIdea {
  id: string;
  businessId: string;
  contentType: ContentType;
  title: string;
  /** One-line angle shown on the card. */
  description: string;
  status: ContentIdeaStatus;
  /** Which goal this idea mainly serves. */
  objective?: ContentGoal;
  platform?: Platform;
  targetLengthSeconds?: number;
  callToAction?: string;
  createdAt: string;
}

/** The full profile the content engine reads. */
export interface ContentPlaybook {
  business: BusinessProfile;
  audience: AudienceProfile;
  valueProposition: ValueProposition;
  preferences: ContentPreferences;
}
