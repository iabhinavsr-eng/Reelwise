import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

import { emptyDraft, furthestStep, OnboardingDraft, OnboardingStep } from '@/domain/onboarding';
import { AppError, friendlyMessage } from '@/lib/errors';
import { readJson, writeJson } from '@/lib/storage';
import { profileRepository } from '@/services/profile';
import { useAuth } from './AuthProvider';

/**
 * Owns the onboarding draft / Content Playbook for the signed-in user.
 *
 * Persistence is local-first: every change is written to an on-device cache
 * immediately (so closing the app never loses work), and confirmed steps are
 * then saved to the ProfileRepository (Supabase, or device storage in demo mode).
 */
type DraftPatch = Partial<Omit<OnboardingDraft, 'version' | 'updatedAt'>>;

interface OnboardingContextValue {
  draft: OnboardingDraft;
  ready: boolean;
  loadError: string | null;
  retryLoad(): void;
  /** Local-only save for in-progress edits (autosave). */
  saveLocal(patch: DraftPatch): void;
  /**
   * Confirms a step: saves locally, then to the server. Throws an AppError
   * with a friendly message if the server save fails (local copy is kept).
   */
  confirm(patch: DraftPatch, advanceTo: OnboardingStep | 'complete'): Promise<void>;
}

const OnboardingContext = createContext<OnboardingContextValue | null>(null);
const cacheKey = (userId: string) => `reelwise.draft.${userId}`;

function newer(a: OnboardingDraft | null, b: OnboardingDraft | null) {
  if (!a) return b;
  if (!b) return a;
  return a.updatedAt >= b.updatedAt ? a : b;
}

export function OnboardingProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [draft, setDraft] = useState<OnboardingDraft>(emptyDraft);
  const [ready, setReady] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  useEffect(() => {
    if (!userId) {
      setDraft(emptyDraft());
      setReady(false);
      return;
    }
    let active = true;
    setReady(false);
    setLoadError(null);
    (async () => {
      const cached = await readJson<OnboardingDraft>(cacheKey(userId));
      let remote: OnboardingDraft | null = null;
      try {
        remote = await profileRepository.loadDraft(userId);
      } catch (e) {
        // Offline with a local copy: carry on. Offline with nothing: show retry.
        if (!cached) throw e;
      }
      return newer(cached, remote) ?? emptyDraft();
    })()
      .then((loaded) => {
        if (!active) return;
        setDraft(loaded);
        setReady(true);
      })
      .catch((e) => active && setLoadError(friendlyMessage(e, 'We couldn’t load your profile.')));
    return () => {
      active = false;
    };
  }, [userId, attempt]);

  const persistLocal = useCallback(
    (next: OnboardingDraft) => {
      if (userId) writeJson(cacheKey(userId), next).catch(() => {});
    },
    [userId],
  );

  const saveLocal = useCallback(
    (patch: DraftPatch) => {
      const next = { ...draftRef.current, ...patch, updatedAt: new Date().toISOString() };
      draftRef.current = next;
      setDraft(next);
      persistLocal(next);
    },
    [persistLocal],
  );

  const confirm = useCallback(
    async (patch: DraftPatch, advanceTo: OnboardingStep | 'complete') => {
      if (!userId) throw new AppError('Your session expired. Please sign in again.', 'auth');
      const current = draftRef.current;
      const completed = advanceTo === 'complete' || current.completed;
      const next: OnboardingDraft = {
        ...current,
        ...patch,
        step: advanceTo === 'complete' ? 'playbook' : furthestStep(current.step, advanceTo),
        completed: current.completed, // only flip to true after the server has it
        updatedAt: new Date().toISOString(),
      };
      draftRef.current = next;
      setDraft(next);
      persistLocal(next);

      try {
        const saved = await profileRepository.saveDraft(userId, { ...next, completed });
        const merged = { ...draftRef.current, businessId: saved.businessId, completed };
        draftRef.current = merged;
        setDraft(merged);
        persistLocal(merged);
      } catch (e) {
        throw new AppError(friendlyMessage(e, 'We couldn’t save that. Please try again.'), 'network', e);
      }
    },
    [userId, persistLocal],
  );

  const value = useMemo(
    () => ({ draft, ready, loadError, retryLoad: () => setAttempt((n) => n + 1), saveLocal, confirm }),
    [draft, ready, loadError, saveLocal, confirm],
  );
  return <OnboardingContext.Provider value={value}>{children}</OnboardingContext.Provider>;
}

export function useOnboarding() {
  const ctx = useContext(OnboardingContext);
  if (!ctx) throw new Error('useOnboarding must be used inside OnboardingProvider');
  return ctx;
}
