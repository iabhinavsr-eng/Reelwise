import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { playbookFromDraft } from '@/domain/onboarding';
import type { ContentIdea, ContentIdeaStatus } from '@/domain/types';
import { friendlyMessage } from '@/lib/errors';
import { profileRepository } from '@/services/profile';
import { recommendationService } from '@/services/recommendations';
import { useAuth } from './AuthProvider';
import { useOnboarding } from './OnboardingProvider';

type Status = 'loading' | 'ready' | 'error';

/**
 * The recommendation feed. Loads saved ideas; if there are none yet (first
 * launch after onboarding) asks the RecommendationService and stores them.
 */
function useIdeasState() {
  const { user } = useAuth();
  const { draft } = useOnboarding();
  const [ideas, setIdeas] = useState<ContentIdea[]>([]);
  const [status, setStatus] = useState<Status>('loading');
  const [error, setError] = useState<string | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [exhausted, setExhausted] = useState(false);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const userId = user?.id;
  const businessId = draft.businessId;

  const generate = useCallback(
    async (existing: ContentIdea[]) => {
      const playbook = playbookFromDraft(draftRef.current);
      if (!userId || !businessId || !playbook) return [];
      const fresh = await recommendationService.recommend({ businessId, playbook, existingIdeas: existing });
      return fresh.length ? profileRepository.saveIdeas(userId, fresh) : [];
    },
    [userId, businessId],
  );

  const load = useCallback(async () => {
    if (!userId || !businessId) return;
    setStatus('loading');
    setError(null);
    try {
      let list = await profileRepository.listIdeas(userId, businessId);
      if (list.length === 0) list = await generate([]);
      setIdeas(list);
      setStatus('ready');
    } catch (e) {
      setError(friendlyMessage(e, 'We couldn’t load your ideas.'));
      setStatus('error');
    }
  }, [userId, businessId, generate]);

  useEffect(() => {
    load();
  }, [load]);

  const loadMore = useCallback(async () => {
    setLoadingMore(true);
    setError(null);
    try {
      const more = await generate(ideas);
      if (more.length === 0) setExhausted(true);
      setIdeas((prev) => [...more, ...prev]);
    } catch (e) {
      setError(friendlyMessage(e, 'We couldn’t get more ideas right now.'));
    } finally {
      setLoadingMore(false);
    }
  }, [generate, ideas]);

  const setIdeaStatus = useCallback(
    async (ideaId: string, next: ContentIdeaStatus) => {
      if (!userId) return;
      setIdeas((prev) => prev.map((i) => (i.id === ideaId ? { ...i, status: next } : i)));
      await profileRepository.updateIdeaStatus(userId, ideaId, next).catch(() => {});
    },
    [userId],
  );

  return useMemo(
    () => ({ ideas, status, error, reload: load, loadMore, loadingMore, exhausted, setIdeaStatus }),
    [ideas, status, error, load, loadMore, loadingMore, exhausted, setIdeaStatus],
  );
}

const IdeasContext = createContext<ReturnType<typeof useIdeasState> | null>(null);

export function IdeasProvider({ children }: { children: ReactNode }) {
  return <IdeasContext.Provider value={useIdeasState()}>{children}</IdeasContext.Provider>;
}

export function useIdeas() {
  const ctx = useContext(IdeasContext);
  if (!ctx) throw new Error('useIdeas must be used inside IdeasProvider');
  return ctx;
}
