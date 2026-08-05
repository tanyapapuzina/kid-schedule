import { Link, router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import {
  confirmParentRegistration,
  loginFamilyMemberByCode,
  loginParent,
  registerParent,
  resendRegistrationPin,
} from '@/shared/api/auth';
import { AppButton } from '@/shared/components/AppButton';
import { AppTextInput } from '@/shared/components/AppTextInput';
import { Screen } from '@/shared/components/Screen';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

type AuthMode = 'login' | 'register' | 'code';
type RegisterStep = 'form' | 'pin';

export default function AuthScreen() {
  const [mode, setMode] = useState<AuthMode>('login');
  const [registerStep, setRegisterStep] = useState<RegisterStep>('form');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [pinCode, setPinCode] = useState('');
  const [familyCode, setFamilyCode] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);

  function changeMode(nextMode: AuthMode) {
    setMode(nextMode);
    setError(null);
    setMessage(null);

    if (nextMode !== 'register') {
      setRegisterStep('form');
      setPinCode('');
    }
  }

  function openRegistrationPinStep() {
    setMode('register');
    setRegisterStep('pin');
    setError(null);
    setMessage(null);
  }

  async function handleLogin() {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      await loginParent({
        email: email.trim(),
        password,
      });
      router.replace('/(tabs)/home');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось войти.');
    } finally {
      setIsLoading(false);
    }
  }

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
      setRegisterStep('pin');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось отправить регистрацию.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleConfirmRegistration() {
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError('Введите email.');
      return;
    }

    if (!pinCode.trim()) {
      setError('Введите PIN-код.');
      return;
    }

    setIsLoading(true);

    try {
      await confirmParentRegistration({
        email: email.trim(),
        pin_code: pinCode.trim(),
      });

      setMessage('Регистрация подтверждена. Теперь можно войти.');
      setMode('login');
      setRegisterStep('form');
      setPinCode('');
      setPassword('');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось подтвердить PIN.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleResendRegistrationPin() {
    setError(null);
    setMessage(null);

    if (!email.trim()) {
      setError('Введите email.');
      return;
    }

    setIsLoading(true);

    try {
      const response = await resendRegistrationPin({ email: email.trim() });
      setMessage(response.message);
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось запросить новый PIN.');
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCodeLogin() {
    setError(null);
    setMessage(null);
    setIsLoading(true);

    try {
      await loginFamilyMemberByCode({
        code: familyCode.trim(),
      });
      router.replace('/(tabs)/home');
    } catch (caughtError) {
      setError(caughtError instanceof Error ? caughtError.message : 'Не удалось войти по коду.');
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <Screen autoScrollOnKeyboard keyboardScrollOffset={170} scroll>
      <View style={styles.container}>
        <View style={styles.heroCard}>
          <Text style={styles.logo}>Kid Schedule</Text>
          <Text style={styles.heroTitle}>Семейное расписание</Text>
          <View style={styles.orbit}>
            <View style={styles.orbitRing} />
            <View style={[styles.orbitDot, styles.orbitDotOne]} />
            <View style={[styles.orbitDot, styles.orbitDotTwo]} />
            <View style={[styles.orbitDot, styles.orbitDotThree]} />
          </View>
        </View>

        <Text style={styles.title}>Добро пожаловать</Text>

        <View style={styles.authTabs}>
          <AuthTab title="Войти" isActive={mode === 'login'} onPress={() => changeMode('login')} />
          <AuthTab
            title="Регистрация"
            isActive={mode === 'register'}
            onPress={() => changeMode('register')}
          />
          <AuthTab
            title="Войти по коду"
            isActive={mode === 'code'}
            onPress={() => changeMode('code')}
          />
        </View>

        <View style={styles.form}>
          {mode === 'login' ? (
            <>
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
                placeholder="Введите пароль"
                secureTextEntry
                value={password}
              />

              <View style={styles.forgotRow}>
                <Link href="/auth/password-reset" style={styles.smallLink}>
                  Забыли пароль?
                </Link>
              </View>

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}

              <AppButton
                disabled={isLoading}
                variant="accent"
                title={isLoading ? 'Входим...' : 'Войти'}
                onPress={handleLogin}
              />
            </>
          ) : null}

          {mode === 'register' && registerStep === 'form' ? (
            <>
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

              <View style={styles.pinHelpBlock}>
                <Text style={styles.hintText}>Если код уже пришел на почту, его можно ввести сразу.</Text>
                <Pressable
                  accessibilityRole="button"
                  disabled={isLoading}
                  onPress={openRegistrationPinStep}
                  style={({ pressed }) => [styles.pinLinkButton, pressed && styles.pinLinkButtonPressed]}>
                  <Text style={styles.pinLinkText}>Уже есть PIN?</Text>
                </Pressable>
              </View>
            </>
          ) : null}

          {mode === 'register' && registerStep === 'pin' ? (
            <>
              <Text style={styles.hintText}>
                Введите email и PIN из письма. Если письмо не пришло, можно запросить код заново.
              </Text>
              <AppTextInput
                autoCapitalize="none"
                inputMode="email"
                label="Email"
                onChangeText={setEmail}
                placeholder="Email"
                value={email}
              />
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
                onPress={handleConfirmRegistration}
              />
              <AppButton
                disabled={isLoading}
                title="Отправить PIN еще раз"
                variant="secondary"
                onPress={handleResendRegistrationPin}
              />
              <AppButton
                disabled={isLoading}
                title="Назад к регистрации"
                variant="secondary"
                onPress={() => {
                  setRegisterStep('form');
                  setError(null);
                  setMessage(null);
                }}
              />
            </>
          ) : null}

          {mode === 'code' ? (
            <>
              <Text style={styles.hintText}>Введите одноразовый код, который выдал родитель.</Text>
              <AppTextInput
                autoCapitalize="characters"
                label="Код входа"
                onChangeText={setFamilyCode}
                placeholder="Код входа"
                value={familyCode}
              />

              {error ? <Text style={styles.error}>{error}</Text> : null}
              {message ? <Text style={styles.success}>{message}</Text> : null}

              <AppButton
                disabled={isLoading}
                variant="accent"
                title={isLoading ? 'Проверяем код...' : 'Войти в семью'}
                onPress={handleCodeLogin}
              />
            </>
          ) : null}
        </View>
      </View>
    </Screen>
  );
}

type AuthTabProps = {
  title: string;
  isActive?: boolean;
  onPress?: () => void;
};

function AuthTab({ title, isActive = false, onPress }: AuthTabProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={isActive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.authTab,
        isActive && styles.authTabActive,
        pressed && !isActive && styles.authTabPressed,
      ]}>
      <Text style={[styles.authTabText, isActive && styles.authTabTextActive]}>{title}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.lg,
  },
  heroCard: {
    backgroundColor: colors.sageSoft,
    borderRadius: 30,
    minHeight: 184,
    overflow: 'hidden',
    padding: spacing.lg,
  },
  logo: {
    color: colors.brandDark,
    fontSize: typography.sm,
    fontWeight: '900',
    letterSpacing: 0.4,
    textTransform: 'uppercase',
  },
  heroTitle: {
    color: colors.text,
    fontSize: 34,
    fontWeight: '900',
    lineHeight: 37,
    marginTop: 'auto',
    maxWidth: 230,
  },
  orbit: {
    bottom: -16,
    height: 138,
    position: 'absolute',
    right: -8,
    width: 138,
  },
  orbitRing: {
    borderColor: 'rgba(150, 167, 168, 0.22)',
    borderRadius: 999,
    borderWidth: 22,
    height: 132,
    position: 'absolute',
    width: 132,
  },
  orbitDot: {
    position: 'absolute',
    borderRadius: 999,
  },
  orbitDotOne: {
    backgroundColor: colors.sage,
    height: 48,
    right: 44,
    top: 0,
    width: 48,
  },
  orbitDotTwo: {
    backgroundColor: colors.creamSoft,
    height: 34,
    right: 8,
    top: 62,
    width: 34,
  },
  orbitDotThree: {
    backgroundColor: colors.olive,
    height: 28,
    right: 90,
    top: 82,
    width: 28,
  },
  title: {
    color: colors.text,
    fontSize: 38,
    fontWeight: '900',
    lineHeight: 40,
  },
  form: {
    gap: spacing.md,
  },
  forgotRow: {
    alignItems: 'flex-end',
    marginTop: -spacing.xs,
  },
  hintText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  smallLink: {
    color: colors.brandDark,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  pinHelpBlock: {
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: -spacing.xs,
  },
  pinLinkButton: {
    borderColor: colors.line,
    borderRadius: 999,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  pinLinkButtonPressed: {
    backgroundColor: colors.sageSoft,
  },
  pinLinkText: {
    color: colors.brandDark,
    fontSize: typography.sm,
    fontWeight: '900',
  },
  authTabs: {
    borderBottomColor: 'rgba(150, 167, 168, 0.22)',
    borderBottomWidth: 1,
    flexDirection: 'row',
    marginTop: -spacing.sm,
  },
  authTab: {
    alignItems: 'center',
    borderBottomColor: 'transparent',
    borderBottomWidth: 3,
    flex: 1,
    justifyContent: 'center',
    minHeight: 54,
    paddingHorizontal: 4,
  },
  authTabActive: {
    borderBottomColor: colors.brand,
  },
  authTabPressed: {
    backgroundColor: colors.sageSoft,
  },
  authTabText: {
    color: colors.muted,
    fontSize: typography.sm,
    fontWeight: '900',
    textAlign: 'center',
  },
  authTabTextActive: {
    color: colors.brandDark,
  },
  error: {
    color: colors.danger,
    fontSize: typography.sm,
    fontWeight: '700',
    lineHeight: 20,
  },
  success: {
    color: colors.brandDark,
    fontSize: typography.sm,
    fontWeight: '800',
    lineHeight: 20,
  },
});
