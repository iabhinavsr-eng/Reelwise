import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { ReactNode, useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/Button';
import { Text } from '@/components/ui/Text';
import { env } from '@/config/env';
import { friendlyMessage } from '@/lib/errors';
import { apiRequest } from '@/services/api/client';
import type { AnalysisDebugResponse, ServerAnalysisResult } from '@/services/api/types';
import { useOnboarding } from '@/state/OnboardingProvider';
import { colors, radius, spacing } from '@/theme';

/**
 * DEVELOPER-ONLY analysis inspector. Only reachable when debug tools are
 * enabled (__DEV__ or EXPO_PUBLIC_ENABLE_DEBUG_TOOLS=true); the API also
 * gates the endpoint (DEBUG_ENDPOINTS) and only serves the owner's analyses.
 */
export default function AnalysisDebugScreen() {
  const { id } = useLocalSearchParams<{ id?: string }>();
  const insets = useSafeAreaInsets();
  const { draft } = useOnboarding();
  const [data, setData] = useState<AnalysisDebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const isRemote = !!id && id !== 'local' && env.analysisProvider === 'api';

  const load = useCallback(() => {
    if (!isRemote) return;
    setError(null);
    apiRequest<AnalysisDebugResponse>(`/business/analysis/${id}/debug`)
      .then(setData)
      .catch((e) => setError(friendlyMessage(e)));
  }, [id, isRemote]);

  useEffect(load, [load]);

  if (!env.debugToolsEnabled) return <Redirect href="/" />;

  const result: ServerAnalysisResult | null = data?.job.result ?? draft.analysis?.details ?? null;

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <Text variant="headline">Analysis debug</Text>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button">
          <Text variant="callout" tone="accent">
            Close
          </Text>
        </Pressable>
      </View>
      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 40 }]}>
        {!isRemote ? (
          <>
            <Text variant="caption" tone="muted">
              This analysis came from the on-device mock (no EXPO_PUBLIC_API_URL). Showing the local suggestion.
            </Text>
            <Mono>{JSON.stringify(draft.analysis, null, 2)}</Mono>
          </>
        ) : error ? (
          <>
            <Text tone="danger">{error}</Text>
            <Button title="Retry" variant="secondary" compact onPress={load} />
          </>
        ) : !data ? (
          <ActivityIndicator color={colors.accent} style={{ marginTop: 40 }} />
        ) : (
          <>
            <Section title="Summary" initiallyOpen>
              <KV k="Status" v={`${data.job.status}${data.job.error ? ` — ${data.job.error.code}: ${data.job.error.message}` : ''}`} />
              <KV k="Version" v={String(data.job.version)} />
              <KV k="Mode" v={data.job.mode} />
              <KV k="URL" v={data.job.url} />
              <KV k="Model" v={data.model ?? '—'} />
              <KV k="Pipeline" v={data.pipelineVersion ?? '—'} />
              <KV k="Duration" v={data.job.durationMs ? `${(data.job.durationMs / 1000).toFixed(1)}s` : '—'} />
              <KV k="Timings" v={Object.entries(data.debug?.timings ?? {}).map(([k, v]) => `${k} ${v}ms`).join(' · ') || '—'} />
              <KV k="Tokens" v={data.debug?.usage ? `${data.debug.usage.inputTokens} in / ${data.debug.usage.outputTokens} out` : '—'} />
            </Section>

            {result ? (
              <>
                <Section title="Confidence" initiallyOpen>
                  {Object.entries(result.confidence).map(([k, v]) => (
                    <KV key={k} k={k} v={v} />
                  ))}
                </Section>
                <Section title={`Facts found on website (${result.evidence.length})`} initiallyOpen>
                  {result.evidence.map((f) => (
                    <View key={f.id} style={styles.item}>
                      <Text variant="label">
                        {f.id} · {f.category}
                      </Text>
                      <Text variant="callout">{f.statement}</Text>
                      <Text variant="caption" tone="muted">
                        “{f.quote}”
                      </Text>
                      {f.sources.map((s) => (
                        <Text key={s} variant="caption" tone="accent">
                          {s}
                        </Text>
                      ))}
                    </View>
                  ))}
                </Section>
                <Section title="Business profile (sourced)">
                  <KV k="Name" v={result.business.name ? `${result.business.name.value}  ← ${result.business.name.sources.join(', ')}` : 'null'} />
                  <KV k="Industry (inferred)" v={result.business.industry ?? 'null'} />
                  {(['services', 'products', 'locations', 'serviceAreas'] as const).map((key) => (
                    <KV key={key} k={key} v={result.business[key].map((s) => `${s.value}  ← ${s.sources.join(', ')}`).join('\n') || '[]'} />
                  ))}
                </Section>
                <Section title="AI inferences — ideal customer (ICP)">
                  <Mono>{JSON.stringify(result.audience, null, 2)}</Mono>
                </Section>
                <Section title="AI inferences — value proposition (UVP)">
                  <Mono>{JSON.stringify(result.valueProposition, null, 2)}</Mono>
                </Section>
                <Section title={`Inference trail (${result.inferences.length})`}>
                  {result.inferences.map((i) => (
                    <KV key={i.id} k={`${i.id} ${i.category}`} v={`${i.statement}\nbased on: ${i.basedOn.join(', ') || '—'}`} />
                  ))}
                </Section>
              </>
            ) : null}

            <Section title={`Rejected claims (${data.debug?.rejectedClaims.length ?? 0})`}>
              {(data.debug?.rejectedClaims ?? []).map((r, i) => (
                <KV key={i} k={r.kind} v={`${r.value} — ${r.reason}`} />
              ))}
            </Section>
            <Section title={`Warnings (${data.debug?.warnings.length ?? 0})`}>
              {(data.debug?.warnings ?? []).map((w, i) => (
                <Text key={i} variant="caption">
                  • {w}
                </Text>
              ))}
            </Section>
            <Section title={`Pages crawled (${data.pages.length})`}>
              {data.pages.map((p) => (
                <PageItem key={p.url} page={p} />
              ))}
            </Section>
            <Section title={`Crawl errors & skipped (${(data.debug?.crawl?.errors.length ?? 0) + (data.debug?.crawl?.skipped.length ?? 0)})`}>
              {data.debug?.crawl ? (
                <KV k="Crawl" v={`${data.debug.crawl.pagesCrawled} crawled · ${data.debug.crawl.discovered} discovered · robots ${data.debug.crawl.robotsFound ? 'yes' : 'no'} · sitemap ${data.debug.crawl.sitemapUrls} URLs · ${data.debug.crawl.durationMs}ms`} />
              ) : null}
              {(data.debug?.crawl?.errors ?? []).map((e, i) => (
                <KV key={`e${i}`} k="error" v={`${e.url}\n${e.reason}`} />
              ))}
              {(data.debug?.crawl?.skipped ?? []).slice(0, 60).map((e, i) => (
                <KV key={`s${i}`} k="skipped" v={`${e.url} — ${e.reason}`} />
              ))}
              {data.debug?.errorDetail ? <Mono>{JSON.stringify(data.debug.errorDetail, null, 2)}</Mono> : null}
            </Section>
          </>
        )}
      </ScrollView>
    </View>
  );
}

function Section({ title, children, initiallyOpen = false }: { title: string; children: ReactNode; initiallyOpen?: boolean }) {
  const [open, setOpen] = useState(initiallyOpen);
  return (
    <View style={styles.section}>
      <Pressable onPress={() => setOpen(!open)} style={styles.sectionHeader} accessibilityRole="button">
        <Text variant="label">{title}</Text>
        <Text variant="caption" tone="muted">
          {open ? '−' : '+'}
        </Text>
      </Pressable>
      {open ? <View style={styles.sectionBody}>{children}</View> : null}
    </View>
  );
}

function KV({ k, v }: { k: string; v: string }) {
  return (
    <View style={styles.kv}>
      <Text variant="caption" tone="muted">
        {k}
      </Text>
      <Text variant="caption" selectable>
        {v}
      </Text>
    </View>
  );
}

function Mono({ children }: { children: string | undefined }) {
  return (
    <Text selectable style={styles.mono}>
      {children ?? '—'}
    </Text>
  );
}

function PageItem({ page }: { page: AnalysisDebugResponse['pages'][number] }) {
  const [open, setOpen] = useState(false);
  return (
    <View style={styles.item}>
      <Pressable onPress={() => setOpen(!open)} accessibilityRole="button">
        <Text variant="label">
          [{page.pageType}] priority {page.priority} · depth {page.depth}
        </Text>
        <Text variant="caption" tone="accent">
          {page.url}
        </Text>
        <Text variant="caption" tone="muted">
          {page.title ?? '(no title)'} · {page.content.length} chars {open ? '▲' : '▼'}
        </Text>
      </Pressable>
      {open ? (
        <>
          <KV k="Meta" v={page.metaDescription ?? '—'} />
          <KV k="H1" v={page.h1 ?? '—'} />
          <KV k="H2" v={page.headings.join(' | ') || '—'} />
          {page.structuredData.length ? <Mono>{JSON.stringify(page.structuredData, null, 2)}</Mono> : null}
          <Mono>{page.content}</Mono>
        </>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.surface },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', padding: spacing.lg },
  content: { paddingHorizontal: spacing.lg, gap: spacing.md },
  section: { backgroundColor: colors.card, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', padding: spacing.md, minHeight: 44, alignItems: 'center' },
  sectionBody: { paddingHorizontal: spacing.md, paddingBottom: spacing.md, gap: spacing.sm },
  kv: { gap: 2 },
  item: { gap: 3, paddingVertical: 6, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
  mono: { fontFamily: 'Menlo', fontSize: 11, lineHeight: 15, color: colors.ink, backgroundColor: colors.surface, padding: spacing.sm, borderRadius: 8 },
});
