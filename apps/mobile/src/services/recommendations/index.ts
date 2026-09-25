import { MockRecommendationService } from './MockRecommendationService';
import type { RecommendationService } from './RecommendationService';

export type { RecommendationRequest, RecommendationService } from './RecommendationService';

export const recommendationService: RecommendationService = new MockRecommendationService();
