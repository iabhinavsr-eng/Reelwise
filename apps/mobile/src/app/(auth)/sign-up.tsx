import { Link, router } from 'expo-router';
import { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';

import { StepScreen } from '@/components/onboarding/StepScreen';
import { Text } from '@/components/ui/Text';
import { TextField } from '@/components/ui/TextField';
import { MIN_PASSWORD_LENGTH, validateEmail, validateName, validatePassword } from '@/domain/validation';
import { friendlyMessage } from '@/lib/errors';
import { haptics } from '@/lib/haptics';
import { useAuth } from '@/state/AuthProvider';
import { colors, spacing } from '@/theme';

type Field = 'name' | 'email' | 'password';

export default function SignUpScreen() {
  const { signUp, mode } = useAuth();
  const [values, setValues] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState<Partial<Record<Field, string | null>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [loading, setLoading] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirmEmailFor, setConfirmEmailFor] = useState<string | null>(null);
  const emailRef = useRef<TextInput>(null);
  const passwordRef = useRef<TextInput>(null);

  const validate = (v = values) => ({
    name: validateName(v.name),
    email: validateEmail(v.email),
    password: validatePassword(v.password),
  });

  const set = (field: Field) => (text: string) => {
    const next = { ...values, [field]: text };
    setValues(next);
    setFormError(null);
    // Validate live only after the first submit attempt — no nagging while typing.
    if (submitted) setErrors(validate(next));
  };

  async function onSubmit() {
    setSubmitted(true);
    const nextErrors = validate();
    setErrors(nextErrors);
    if (Object.values(nextErrors).some(Boolean)) {
      haptics.error();
      return;
    }
    setLoading(true);
    setFormError(null);
    try {
      const result = await signUp(values);
      if (result.needsEmailConfirmation) setConfirmEmailFor(values.email.trim());
      // On success the (auth) gate redirects into onboarding automatically.
    } catch (e) {
      haptics.error();
      setFormError(friendlyMessage(e));
    } finally {
      setLoading(false);
    }
  }

  if (confirmEmailFor) {
    return (
      <StepScreen
        eyebrow="Almost there"
        title="Check your inbox."
        subtitle={`We sent a confirmation link to ${confirmEmailFor}. Tap it, then come back and sign in.`}
        ctaTitle="I’ve confirmed — sign in"
        onCta={() => router.replace({ pathname: '/sign-in', params: { email: confirmEmailFor } })}
      />
    );
  }

  return (
    <StepScreen
      eyebrow="Welcome"
      title="Let’s build content that actually sounds like you."
      subtitle="We’ll learn your business, audience and voice so your reel ideas are useful from day one."
      ctaTitle="Create account"
      onCta={onSubmit}
      ctaLoading={loading}
      error={formError}
      footer={
        <View style={styles.footer}>
          <Text variant="caption" tone="muted">
            Already have an account?{' '}
          </Text>
          <Link href="/sign-in" replace style={styles.link} accessibilityRole="link">
            <Text variant="caption" style={styles.linkText}>
              Sign in
            </Text>
          </Link>
        </View>
      }
    >
      <TextField
        label="Your name"
        placeholder="Alex Morgan"
        value={values.name}
        onChangeText={set('name')}
        error={errors.name}
        autoComplete="name"
        textContentType="name"
        autoCapitalize="words"
        returnKeyType="next"
        onSubmitEditing={() => emailRef.current?.focus()}
        submitBehavior="submit"
      />
      <TextField
        ref={emailRef}
        label="Work email"
        placeholder="alex@business.com"
        value={values.email}
        onChangeText={set('email')}
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
        placeholder={`At least ${MIN_PASSWORD_LENGTH} characters`}
        value={values.password}
        onChangeText={set('password')}
        error={errors.password}
        secureTextEntry
        autoComplete="new-password"
        textContentType="newPassword"
        returnKeyType="go"
        onSubmitEditing={onSubmit}
      />
      {mode === 'local' ? (
        <Text variant="caption" tone="muted" style={styles.demo}>
          Demo mode: your account and profile are stored on this device only.
        </Text>
      ) : null}
    </StepScreen>
  );
}

const styles = StyleSheet.create({
  footer: { flexDirection: 'row', justifyContent: 'center', alignItems: 'center', minHeight: 44, marginTop: spacing.xs },
  link: { paddingVertical: 10 },
  linkText: { color: colors.accent, fontWeight: '600' },
  demo: { marginTop: spacing.xs },
});
