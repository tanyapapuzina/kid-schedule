import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { loginFamilyMemberByCode } from '@/shared/api/auth';
import { AppButton } from '@/shared/components/AppButton';
import { AppTextInput } from '@/shared/components/AppTextInput';
import { Screen } from '@/shared/components/Screen';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

export default function CodeLoginScreen() {
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  async function handleCodeLogin() {
    setError(null);
    setIsLoading(true);

    try {
      await loginFamilyMemberByCode({
        code: code.trim(),
      });
      router.replace('/(tabs)/home');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось войти по коду.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen>
      <View style={styles.container}>
        <Pressable accessibilityRole="button" onPress={() => router.replace('/auth')}>
          <Text style={styles.backLink}>‹ Все способы входа</Text>
        </Pressable>

        <View style={styles.header}>
          <Text style={styles.eyebrow}>Участник семьи</Text>
          <Text style={styles.title}>Войти по коду</Text>
        </View>

        <View style={styles.infoCard}>
          <View style={styles.infoIcon}>
            <Text style={styles.infoIconText}>KS</Text>
          </View>
          <Text style={styles.infoText}>Введите код, который выдал родитель.</Text>
        </View>

        <View style={styles.panel}>
          <View style={styles.form}>
            <AppTextInput
              autoCapitalize="characters"
              label="Код входа"
              onChangeText={setCode}
              placeholder="Код входа"
              value={code}
            />
            {error ? <Text style={styles.error}>{error}</Text> : null}
            <AppButton
              disabled={isLoading}
              variant="accent"
              title={isLoading ? 'Проверяем код...' : 'Войти в семью'}
              onPress={handleCodeLogin}
            />
          </View>

          <View style={styles.footer}>
            <Text style={styles.footerText}>Есть родительский аккаунт?</Text>
            <Link href="/auth" style={styles.link}>
              Войти по email
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
    fontWeight: '800',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  title: {
    color: colors.text,
    fontSize: 42,
    fontWeight: '900',
    lineHeight: 42,
  },
  form: {
    gap: spacing.md,
  },
  panel: {
    gap: spacing.lg,
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
    fontSize: typography.sm,
    fontWeight: '900',
  },
  infoText: {
    color: colors.text,
    flex: 1,
    fontSize: typography.md,
    fontWeight: '800',
    lineHeight: 22,
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
    fontWeight: '800',
  },
  error: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
});
