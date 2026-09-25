import type { ContentIdea } from '@/domain/types';
import { delay, makeId } from '@/lib/storage';
import { fixtureFor } from '@/services/mock/industryFixtures';
import type { RecommendationRequest, RecommendationService } from './RecommendationService';

/** Returns hand-written example ideas that match the business's industry. */
export class MockRecommendationService implements RecommendationService {
  async recommend({ businessId, playbook, existingIdeas = [], limit = 3 }: RecommendationRequest): Promise<ContentIdea[]> {
    await delay(700);
    const { business } = playbook;
    const fixture = fixtureFor(`${business.industry} ${business.description}`);
    const seen = new Set(existingIdeas.map((i) => i.title));
    const now = new Date().toISOString();
    return fixture.ideas
      .filter((seed) => !seen.has(seed.title))
      .slice(0, limit)
      .map((seed) => ({
        id: makeId(),
        businessId,
        contentType: seed.contentType,
        title: seed.title,
        description: seed.description,
        objective: seed.objective,
        status: 'suggested',
        platform: 'instagram_reels',
        targetLengthSeconds: 30,
        createdAt: now,
      }));
  }
}
