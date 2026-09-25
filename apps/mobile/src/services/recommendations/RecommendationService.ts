import type { ContentIdea, ContentPlaybook } from '@/domain/types';

export interface RecommendationRequest {
  businessId: string;
  playbook: ContentPlaybook;
  /** Ideas the user already has, so new ones don't repeat them. */
  existingIdeas?: ContentIdea[];
  limit?: number;
}

/**
 * Produces "what should we talk about today?" reel ideas from the Content
 * Playbook. Today: fixtures. Later: an Edge Function that combines business
 * context, audience, value proposition, goals, season and past ideas.
 */
export interface RecommendationService {
  recommend(request: RecommendationRequest): Promise<ContentIdea[]>;
}
