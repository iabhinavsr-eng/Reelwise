/**
 * Reelwise design tokens for native.
 *
 * Values mirror the design-system source of truth in
 * `artifacts/reelwise/tokens.json` (light theme). Keep them in sync when that
 * file changes. Typography deliberately uses the platform system font
 * (SF Pro on iOS, Roboto on Android) — no custom font loading needed.
 */
import { Platform, TextStyle } from 'react-native';

export const colors = {
  background: '#ffffff',
  surface: '#f6f7f5', // quiet page background behind cards
  card: '#ffffff',
  ink: '#171b19', // primary text + primary action
  inkPressed: '#2b312e',
  muted: '#747a77',
  subtle: '#a3a9a6',
  border: '#e5e8e6',
  input: '#d9ddda',
  inputFill: '#fafbfa',
  accent: '#2f7d62', // Reelwise green: progress, selection, emphasis
  accentSoft: '#eaf4ef', // mint: suggestions & helpful context
  accentSoftBorder: '#a8cdbd',
  accentInk: '#22694f',
  accentMutedInk: '#3c6555',
  track: '#edf0ee',
  danger: '#b42318',
  dangerSoft: '#fdf0ee',
  white: '#ffffff',
} as const;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 22, // screen gutter
  xxl: 28,
  xxxl: 40,
} as const;

export const radius = {
  sm: 10,
  md: 13, // fields
  lg: 15, // buttons & cards
  xl: 20,
  pill: 999,
} as const;

/** Minimum comfortable touch target (Apple HIG: 44pt). */
export const touchTarget = 48;

export const type = {
  display: { fontSize: 30, lineHeight: 34, fontWeight: '700', letterSpacing: -0.8 },
  title: { fontSize: 22, lineHeight: 27, fontWeight: '700', letterSpacing: -0.4 },
  headline: { fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.2 },
  body: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  supporting: { fontSize: 16, lineHeight: 23, fontWeight: '400' },
  callout: { fontSize: 15, lineHeight: 21, fontWeight: '400' },
  label: { fontSize: 13, lineHeight: 17, fontWeight: '600' },
  caption: { fontSize: 13, lineHeight: 18, fontWeight: '400' },
  eyebrow: { fontSize: 12, lineHeight: 15, fontWeight: '700', letterSpacing: 0.6 },
} satisfies Record<string, TextStyle>;

export const shadow = Platform.select({
  ios: { shadowColor: '#0f1a14', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
  android: { elevation: 1 },
  default: { shadowColor: '#0f1a14', shadowOpacity: 0.05, shadowRadius: 12, shadowOffset: { width: 0, height: 4 } },
});
