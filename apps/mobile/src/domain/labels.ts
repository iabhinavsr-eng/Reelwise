import type { ContentGoal, ContentType, VoiceTrait } from './types';

/** Customer-facing labels. Keep internal ids stable; change copy here. */

export const GOAL_LABELS: Record<ContentGoal, string> = {
  educate: 'Educate customers',
  build_trust: 'Build trust',
  get_leads: 'Get more leads',
  grow_followers: 'Grow followers',
  promote_services: 'Promote services',
  stay_top_of_mind: 'Stay top of mind',
};

export const VOICE_LABELS: Record<VoiceTrait, string> = {
  conversational: 'Conversational',
  warm: 'Warm & encouraging',
  straightforward: 'Straightforward',
  professional: 'Professional',
  playful: 'Playful',
  bold: 'Bold opinions',
  educational: 'Educational',
};

export const CONTENT_TYPE_LABELS: Record<ContentType, string> = {
  quick_tip: 'Quick tip',
  faq: 'FAQ',
  common_mistake: 'Common mistake',
  myth_vs_fact: 'Myth vs fact',
  did_you_know: 'Did you know?',
  industry_secret: 'Industry secret',
  warning_signs: 'Warning signs',
  seasonal_advice: 'Seasonal advice',
  problem_solution: 'Problem / solution',
  service_spotlight: 'Service spotlight',
  product_spotlight: 'Product spotlight',
  review_highlight: 'Customer review',
  local_community: 'Local community',
  day_in_the_life: 'Day in the life',
};
