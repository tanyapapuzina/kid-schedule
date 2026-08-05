import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { confirmPasswordReset, requestPasswordReset, resendPasswordResetPin } from '@/shared/api/auth';
import { AppButton } from '@/shared/components/AppButton';
import { AppTextInput } from '@/shared/components/AppTextInput';
import { Screen } from '@/shared/components/Screen';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

type ResetStep = 'email' | 'confirm';

export default function PasswordResetScreen() {
  const [step, setStep] = useState<ResetStep>('email');
  const [email, setEmail] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleRequestPin() {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await requestPasswordReset({ email: email.trim() });
      setMessage(response.message);
      setStep('confirm');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось запросить PIN.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmReset() {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      await confirmPasswordReset({
        email: email.trim(),
        pin_code: pinCode.trim(),
        new_password: newPassword,
      });
      router.replace('/auth');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось сменить пароль.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendResetPin() {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      const response = await resendPasswordResetPin({ email: email.trim() });
      setMessage(response.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось запросить новый PIN.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen autoScrollOnKeyboard keyboardScrollOffset={150} scroll>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')}>
          <Text style={styles.backLink}>‹ Войти</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.logo}>Пароль</Text>
          <Text style={styles.title}>{step === 'email' ? 'Восстановить' : 'Новый пароль'}</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>?</Text>
          </View>
          <Text style={styles.infoText}>
            {step === 'email' ? 'Отправим PIN для сброса.' : 'Введите PIN и новый пароль.'}
          </Text>
        </View>

        <View style={styles.form}>
          <AppTextInput
            autoCapitalize="none"
            editable={step === 'email'}
            inputMode="email"
            label="Email"
            onChangeText={setEmail}
            placeholder="Email"
            value={email}
          />

          {step === 'confirm' ? (
            <>
              <AppTextInput
                autoCapitalize="characters"
                inputMode="numeric"
                label="PIN-код"
                onChangeText={setPinCode}
                placeholder="Код подтверждения"
                value={pinCode}
              />
              <AppTextInput
                label="Новый пароль"
                onChangeText={setNewPassword}
                placeholder="Введите новый пароль"
                secureTextEntry
                value={newPassword}
              />
            </>
          ) : null}

          {error ? <Text style={styles.error}>{error}</Text> : null}
          {message ? <Text style={styles.success}>{message}</Text> : null}

          <AppButton
            disabled={isLoading}
            variant="accent"
            title={
              step === 'email'
                ? isLoading
                  ? 'Отправляем...'
                  : 'Получить PIN'
                : isLoading
                  ? 'Сохраняем...'
                  : 'Сменить пароль'
            }
            onPress={step === 'email' ? handleRequestPin : handleConfirmReset}
          />

          {step === 'confirm' ? (
            <AppButton
              disabled={isLoading}
              title="Отправить PIN еще раз"
              variant="secondary"
              onPress={handleResendResetPin}
            />
          ) : null}
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
  logo: {
    color: colors.plum,
    fontSize: typography.sm,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 44,
    fontWeight: '900',
    lineHeight: 46,
  },
  form: {
    gap: spacing.md,
  },
  infoCard: {
    alignItems: 'center',
    backgroundColor: colors.sageSoft,
    borderRadius: 28,
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
  },
  infoIcon: {
    alignItems: 'center',
    backgroundColor: colors.brandDark,
    borderRadius: 18,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  infoIconText: {
    color: colors.surface,
    fontSize: typography.xl,
    fontWeight: '900',
  },
  infoText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.md,
    fontWeight: '800',
    lineHeight: 22,
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
