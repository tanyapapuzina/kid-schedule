import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmParentRegistration, registerParent } from '@/shared/api/auth';
import { AppButton } from '@/shared/components/AppButton';
import { AppTextInput } from '@/shared/components/AppTextInput';
import { Screen } from '@/shared/components/Screen';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

type RegisterStep = 'form' | 'pin';

export default function RegisterScreen() {
  const [step, setStep] = useState<RegisterStep>('form');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRegister() {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await registerParent({
        email: email.trim(),
        password,
        name: name.trim() || undefined,
      });

      setMessage(response.message);
      setStep('pin');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось отправить регистрацию.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirm() {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      await confirmParentRegistration({
        email: email.trim(),
        pin_code: pinCode.trim(),
      });

      router.replace('/auth');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось подтвердить PIN.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen scroll>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')}>
          <Text style={styles.backLink}>‹ Все способы входа</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>{step === 'form' ? 'Новый аккаунт' : 'PIN-код'}</Text>
          <Text style={styles.title}>{step === 'form' ? 'Регистрация' : 'Подтвердите PIN'}</Text>
        </View>

        <View style={styles.heroCard}>
          <View style={styles.heroDot}>
            <Text style={styles.heroDotText}>{step === 'form' ? '+' : '✓'}</Text>
          </View>
          <Text style={styles.heroText}>
            {step === 'form' ? 'Создайте родительский доступ.' : 'Проверьте PIN из письма.'}
          </Text>
        </View>

        <View style={styles.panel}>
          {step === 'form' ? (
            <View style={styles.form}>
              <AppTextInput
                label="Имя"
                onChangeText={setName}
                placeholder="Ваше имя"
                value={name}
              />
              <AppTextInput
                autoCapitalize="none"
                inputMode="email"
                label="Email"
                onChangeText={setEmail}
                placeholder="Email"
                value={email}
              />
              <AppTextInput
                label="Пароль"
                onChangeText={setPassword}
                placeholder="Придумайте пароль"
                secureTextEntry
                value={password}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <AppButton
                disabled={isLoading}
                variant="accent"
                title={isLoading ? 'Отправляем...' : 'Запросить PIN'}
                onPress={handleRegister}
              />
            </View>
          ) : (
            <View style={styles.form}>
              <Text style={styles.emailText}>{email.trim()}</Text>
              <AppTextInput
                autoCapitalize="characters"
                inputMode="numeric"
                label="PIN-код"
                onChangeText={setPinCode}
                placeholder="Код подтверждения"
                value={pinCode}
              />
              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}
              <AppButton
                disabled={isLoading}
                variant="accent"
                title={isLoading ? 'Проверяем...' : 'Подтвердить регистрацию'}
                onPress={handleConfirm}
              />
              <AppButton
                disabled={isLoading}
                title="Изменить email"
                variant="secondary"
                onPress={() => setStep('form')}
              />
            </View>
          )}

          <View style={styles.footer}>
            <Text style={styles.footerText}>Уже есть аккаунт?</Text>
            <Link href="/auth" style={styles.link}>
              Войти
            </Link>
          </View>
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.xl,
  },
  backLink: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  header: {
    gap: spacing.xs,
  },
  eyebrow: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 42,
  },
  panel: {
    gap: spacing.lg,
  },
  heroCard: {
    alignItems: 'center',
    backgroundColor: colors.cream,
    borderRadius: 28,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  heroDot: {
    alignItems: 'center',
    backgroundColor: colors.brandDark,
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  heroDotText: {
    color: colors.surface,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  heroText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.md,
    fontWeight: '800',
    lineHeight: 22,
  },
  form: {
    gap: spacing.md,
  },
  emailText: {
    color: colors.muted,
    fontSize: typography.md,
    fontWeight: '800',
  },
  footer: {
    alignItems: 'center',
    gap: spacing.xs,
  },
  footerText: {
    color: colors.muted,
    fontSize: typography.sm,
  },
  link: {
    color: colors.plum,
    fontSize: typography.md,
    fontWeight: '900',
  },
  error: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  success: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
  },
});
