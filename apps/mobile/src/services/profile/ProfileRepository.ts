import type { OnboardingDraft } from '@/domain/onboarding';
import type { ContentIdea, ContentIdeaStatus } from '@/domain/types';

/**
 * Durable storage for the business profile / Content Playbook and ideas.
 *
 * The OnboardingProvider also keeps an on-device cache of the draft, so
 * progress survives app restarts even when a save to the server fails.
 */
export interface ProfileRepository {
  /** The user's saved onboarding state, or null if they haven't started. */
  loadDraft(userId: string): Promise<OnboardingDraft | null>;
  /** Persists the draft. Returns it with server ids (e.g. businessId) filled in. */
  saveDraft(userId: string, draft: OnboardingDraft): Promise<OnboardingDraft>;
  listIdeas(userId: string, businessId: string): Promise<ContentIdea[]>;
  saveIdeas(userId: string, ideas: ContentIdea[]): Promise<ContentIdea[]>;
  updateIdeaStatus(userId: string, ideaId: string, status: ContentIdeaStatus): Promise<void>;
}
