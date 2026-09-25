import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalysisChecklist } from '@/components/onboarding/AnalysisChecklist';
import { Button } from '@/components/ui/Button';
import { ErrorNotice } from '@/components/ui/Notice';
import { PulseMark } from '@/components/ui/PulseMark';
import { Text } from '@/components/ui/Text';
import { applyAnalysis } from '@/domain/onboarding';
import { displayHost } from '@/domain/validation';
import { friendlyMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { stepHref } from '@/lib/onboardingNav';
import { delay, isAbortError } from '@/lib/storage';
import { ANALYSIS_STAGES, AnalysisFailure, AnalysisStage, BusinessAnalysis, businessAnalysisService } from '@/services/analysis';
import { useOnboarding } from '@/state/OnboardingProvider';
import { colors, spacing } from '@/theme';

type Phase = 'running' | 'saving' | 'done' | 'error';

interface Failure {
  message: string;
  offerManual: boolean;
  offerDifferentUrl: boolean;
  couldNotLearn: boolean;
}

function describeFailure(e: unknown): Failure {
  if (e instanceof AnalysisFailure) {
    return {
      message: e.message,
      offerManual: e.offerManualFallback,
      offerDifferentUrl: e.offerDifferentUrl,
      couldNotLearn: e.offerManualFallback,
    };
  }
  return { message: friendlyMessage(e, 'Something went wrong while learning about your business.'), offerManual: false, offerDifferentUrl: true, couldNotLearn: false };
}

export default function AnalyzingScreen() {
  const { draft, confirm, saveLocal } = useOnboarding();
  const insets = useSafeAreaInsets();
  const url = draft.websiteUrl;
  const manual = draft.manualInput;
  const [completed, setCompleted] = useState<AnalysisStage[]>([]);
  const [phase, setPhase] = useState<Phase>('running');
  const [failure, setFailure] = useState<Failure | null>(null);
  const [attempt, setAttempt] = useState(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const save = useCallback(
    async (analysis: BusinessAnalysis) => {
      setPhase('saving');
      // New analysis = new SUGGESTIONS. Anything the user already approved is kept.
      await confirm(applyAnalysis(draftRef.current, analysis), 'business');
      setPhase('done');
      haptics.success();
      await delay(650); // let the final check land before moving on
      router.replace(stepHref('business'));
    },
    [confirm],
  );

  useEffect(() => {
    if (!url) return;
    const controller = new AbortController();
    setFailure(null);
    setCompleted([]);
    setPhase('running');

    (async () => {
      // Analysis finished but saving failed last time: just retry the save.
      const existing = draftRef.current.analysis;
      const sameRequest = existing && existing.business.websiteUrl === url && !draftRef.current.manualInput;
      if (sameRequest && attempt > 0) {
        setCompleted([...ANALYSIS_STAGES]);
        return save(existing);
      }
      const analysis = await businessAnalysisService.analyzeWebsite(url, {
        signal: controller.signal,
        manual: draftRef.current.manualInput,
        resumeJobId: attempt === 0 ? draftRef.current.pendingAnalysisId : undefined,
        onJobCreated: (jobId) => saveLocal({ pendingAnalysisId: jobId }),
        onStageComplete: (stage) => setCompleted((prev) => (prev.includes(stage) ? prev : [...prev, stage])),
      });
      if (!controller.signal.aborted) await save(analysis);
    })().catch((e) => {
      if (isAbortError(e) || controller.signal.aborted) return;
      haptics.error();
      saveLocal({ pendingAnalysisId: undefined });
      setPhase('error');
      setFailure(describeFailure(e));
    });

    return () => controller.abort();
  }, [url, attempt, save, saveLocal]);

  if (!url) return <Redirect href={stepHref('website')} />;

  const title =
    phase === 'error'
      ? failure?.couldNotLearn
        ? 'We couldn’t learn enough from your website.'
        : 'We hit a snag.'
      : phase === 'done'
        ? 'Your profile is ready.'
        : 'Learning your business…';

  const subtitle =
    phase === 'error'
      ? failure?.couldNotLearn
        ? 'Answer four quick questions and we’ll build your profile from those instead.'
        : 'Nothing you entered is lost.'
      : manual
        ? 'Give us a moment. We’re turning your answers into a starting profile.'
        : `Give us a moment. We’re reading ${displayHost(url)} and preparing your starting profile.`;

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <PulseMark done={phase === 'done'} />
        <Text variant="display" center accessibilityRole="header" style={styles.title} accessibilityLiveRegion="polite">
          {title}
        </Text>
        <Text variant="supporting" center style={styles.subtitle}>
          {subtitle}
        </Text>
        {phase === 'error' ? null : <AnalysisChecklist completed={completed} running={phase === 'running'} />}
      </ScrollView>
      {phase === 'error' && failure ? (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.lg) + 4 }]}>
          <ErrorNotice message={failure.message} />
          {failure.offerManual ? (
            <>
              <Button title="Tell us about your business" onPress={() => router.replace('/onboarding/manual')} />
              <Button title="Try again" variant="ghost" onPress={() => setAttempt((n) => n + 1)} />
            </>
          ) : (
            <Button title="Try again" onPress={() => setAttempt((n) => n + 1)} />
          )}
          {failure.offerDifferentUrl ? (
            <Button title="Use a different website" variant="ghost" onPress={() => router.replace(stepHref('website'))} />
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.xl, paddingTop: 72, paddingBottom: spacing.xxxl },
  title: { marginTop: spacing.xxl, marginBottom: 11 },
  subtitle: { marginBottom: spacing.xxl + 4, paddingHorizontal: spacing.sm },
  bottom: { paddingHorizontal: spacing.xl - 2, paddingTop: spacing.md, gap: spacing.xs },
});
