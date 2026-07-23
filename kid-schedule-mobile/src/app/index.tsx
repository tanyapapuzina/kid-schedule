import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getCurrentSession } from '@/shared/api/auth';
import { clearAccessToken, getAccessToken } from '@/shared/storage/tokenStorage';
import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

export default function IndexScreen() {
  const [targetRoute, setTargetRoute] = useState<'/auth' | '/(tabs)/home' | null>(null);

  useEffect(() => {
    let isMounted = true;

    async function checkSession() {
      const token = await getAccessToken();

      if (!token) {
        if (isMounted) {
          setTargetRoute('/auth');
        }
        return;
      }

      try {
        await getCurrentSession();

        if (isMounted) {
          setTargetRoute('/(tabs)/home');
        }
      } catch {
        await clearAccessToken();

        if (isMounted) {
          setTargetRoute('/auth');
        }
      }
    }

    void checkSession();

    return () => {
      isMounted = false;
    };
  }, []);

  if (targetRoute) {
    return <Redirect href={targetRoute} />;
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator color={colors.brand} />
      <Text style={styles.text}>Проверяем сессию...</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    backgroundColor: colors.background,
    flex: 1,
    gap: spacing.md,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  text: {
    color: colors.muted,
    fontSize: typography.md,
    fontWeight: '700',
  },
});
