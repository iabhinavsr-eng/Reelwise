import { Redirect, router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AnalysisChecklist } from '@/components/onboarding/AnalysisChecklist';
import { Button } from '@/components/ui/Button';
import { ErrorNotice } from '@/components/ui/Notice';
import { PulseMark } from '@/components/ui/PulseMark';
import { Text } from '@/components/ui/Text';
import { displayHost } from '@/domain/validation';
import { friendlyMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { stepHref } from '@/lib/onboardingNav';
import { delay, isAbortError } from '@/lib/storage';
import { AnalysisStage, BusinessAnalysis, businessAnalysisService } from '@/services/analysis';
import { useOnboarding } from '@/state/OnboardingProvider';
import { colors, spacing } from '@/theme';

type Phase = 'running' | 'saving' | 'done' | 'error';

export default function AnalyzingScreen() {
  const { draft, confirm } = useOnboarding();
  const insets = useSafeAreaInsets();
  const url = draft.websiteUrl;
  const [completed, setCompleted] = useState<AnalysisStage[]>([]);
  const [phase, setPhase] = useState<Phase>('running');
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  const draftRef = useRef(draft);
  draftRef.current = draft;

  const save = useCallback(
    async (analysis: BusinessAnalysis) => {
      const current = draftRef.current;
      setPhase('saving');
      await confirm(
        {
          analysis,
          business: analysis.business,
          audience: analysis.audience,
          valueProposition: analysis.valueProposition,
          // Pre-select AI suggestions so the user confirms rather than creates.
          goals: current.goals.length ? current.goals : analysis.suggestedGoals,
          voiceTraits: current.voiceTraits.length ? current.voiceTraits : analysis.suggestedVoiceTraits,
        },
        'business',
      );
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
    setError(null);
    setCompleted([]);
    setPhase('running');

    (async () => {
      // Analysis finished but saving failed last time: just retry the save.
      const existing = draftRef.current.analysis;
      if (existing && existing.business.websiteUrl === url) {
        setCompleted(['reading', 'services', 'positioning', 'audience', 'value']);
        return save(existing);
      }
      const analysis = await businessAnalysisService.analyzeWebsite(url, {
        signal: controller.signal,
        onStageComplete: (stage) => setCompleted((prev) => [...prev, stage]),
      });
      if (!controller.signal.aborted) await save(analysis);
    })().catch((e) => {
      if (isAbortError(e) || controller.signal.aborted) return;
      haptics.error();
      setPhase('error');
      setError(friendlyMessage(e, 'We couldn’t read that website. Check the address and try again.'));
    });

    return () => controller.abort();
  }, [url, attempt, save]);

  if (!url) return <Redirect href={stepHref('website')} />;

  const title = phase === 'error' ? 'We hit a snag.' : phase === 'done' ? 'Your profile is ready.' : 'Learning your business…';

  return (
    <View style={styles.container}>
      <ScrollView contentContainerStyle={styles.content}>
        <PulseMark done={phase === 'done'} />
        <Text variant="display" center accessibilityRole="header" style={styles.title} accessibilityLiveRegion="polite">
          {title}
        </Text>
        <Text variant="supporting" center style={styles.subtitle}>
          {phase === 'error'
            ? 'Nothing you entered is lost.'
            : `Give us a moment. We’re reading ${displayHost(url)} and preparing your starting profile.`}
        </Text>
        <AnalysisChecklist completed={completed} running={phase === 'running'} />
      </ScrollView>
      {phase === 'error' ? (
        <View style={[styles.bottom, { paddingBottom: Math.max(insets.bottom, spacing.lg) + 4 }]}>
          <ErrorNotice message={error ?? 'Something went wrong.'} />
          <Button title="Try again" onPress={() => setAttempt((n) => n + 1)} />
          <Button title="Use a different website" variant="ghost" onPress={() => router.replace(stepHref('website'))} />
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
