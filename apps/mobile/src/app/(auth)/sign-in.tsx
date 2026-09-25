import { Link, useLocalSearchParams } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/StepScreen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { validateEmail } from '@/domain/validation';
import { friendlyMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/state/AuthProvider';
import { colors, spacing } from '@/theme';

export default function SignInScreen() {
  const { signIn } = useAuth();
  const params = useLocalSearchParams<{ email?: string }>();
  const [email, setEmail] = useState(params.email ?? '');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string | null; password?: string | null }>({});
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const passwordRef = useRef<TextInput>(null);

  async function onSubmit() {
    const next = { email: validateEmail(email), password: password ? null : 'Enter your password.' };
    setErrors(next);
    if (next.email || next.password) {
      haptics.error();
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      await signIn(email, password);
    } catch (e) {
      haptics.error();
      setFormError(friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  }

  return (
    <StepScreen
      eyebrow="Welcome back"
      title="Sign in to Reelwise."
      subtitle="Pick up right where you left off."
      ctaTitle="Sign in"
      onCta={onSubmit}
      ctaLoading={loading}
      error={formError}
      footer={
        <View style={styles.footer}>
          <Text variant="caption" tone="muted">
            New here?{' '}
          </Text>
          <Link href="/sign-up" replace style={styles.link} accessibilityRole="link">
            <Text variant="caption" style={styles.linkText}>
              Create an account
            </Text>
          </Link>
        </View>
      }
    >
      <TextField
        label="Email"
        placeholder="alex@business.com"
        value={email}
        onChangeText={(t) => {
          setEmail(t);
          setFormError(null);
        }}
        error={errors.email}
        autoComplete="email"
        textContentType="emailAddress"
        keyboardType="email-address"
        autoCapitalize="none"
        autoCorrect={false}
        returnKeyType="next"
        onSubmitEditing={() => passwordRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={passwordRef}
        label="Password"
        value={password}
        onChangeText={(t) => {
          setPassword(t);
          setFormError(null);
        }}
        error={errors.password}
        secureTextEntry
        autoComplete="current-password"
        textContentType="password"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 44, marginTop: spacing.xs },
  link: { paddingVertical: 10 },
  linkText: { color: colors.accent, fontWeight: '600' },
});
