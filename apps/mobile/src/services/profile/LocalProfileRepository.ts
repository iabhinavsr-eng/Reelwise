import type { OnboardingDraft } from '@/domain/onboarding';
import type { ContentIdea, ContentIdeaStatus } from '@/domain/types';
import { makeId, readJson, writeJson } from '@/lib/storage';
import type { ProfileRepository } from './ProfileRepository';

/** Demo-mode storage: everything lives in AsyncStorage on this device. */
const draftKey = (userId: string) => `reelwise.local.profile.${userId}`;
const ideasKey = (userId: string) => `reelwise.local.ideas.${userId}`;

export class LocalProfileRepository implements ProfileRepository {
  loadDraft(userId: string) {
    return readJson<OnboardingDraft>(draftKey(userId));
  }

  async saveDraft(userId: string, draft: OnboardingDraft) {
    const saved = draft.business && !draft.businessId ? { ...draft, businessId: makeId() } : draft;
    await writeJson(draftKey(userId), saved);
    return saved;
  }

  async listIdeas(userId: string, businessId: string) {
    const ideas = (await readJson<ContentIdea[]>(ideasKey(userId))) ?? [];
    return ideas.filter((i) => i.businessId === businessId && i.status !== 'dismissed');
  }

  async saveIdeas(userId: string, ideas: ContentIdea[]) {
    const existing = (await readJson<ContentIdea[]>(ideasKey(userId))) ?? [];
    await writeJson(ideasKey(userId), [...ideas, ...existing]);
    return ideas;
  }

  async updateIdeaStatus(userId: string, ideaId: string, status: ContentIdeaStatus) {
    const ideas = (await readJson<ContentIdea[]>(ideasKey(userId))) ?? [];
    await writeJson(
      ideasKey(userId),
      ideas.map((i) => (i.id === ideaId ? { ...i, status } : i)),
    );
  }
}
