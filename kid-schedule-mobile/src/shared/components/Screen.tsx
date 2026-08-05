import { PropsWithChildren, useEffect, useRef } from 'react';
import { Keyboard, KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';

type ScreenProps = PropsWithChildren<{
  autoScrollOnKeyboard?: boolean;
  keyboardScrollOffset?: number;
  scroll?: boolean;
}>;

export function Screen({
  autoScrollOnKeyboard = false,
  children,
  keyboardScrollOffset = 120,
  scroll = false,
}: ScreenProps) {
  const scrollViewRef = useRef<ScrollView | null>(null);

  useEffect(() => {
    if (!scroll || !autoScrollOnKeyboard || Platform.OS !== 'ios') {
      return undefined;
    }

    const keyboardWillShowSubscription = Keyboard.addListener('keyboardWillShow', () => {
      window.setTimeout(() => {
        scrollViewRef.current?.scrollTo({
          animated: true,
          y: keyboardScrollOffset,
        });
      }, 80);
    });

    return () => {
      keyboardWillShowSubscription.remove();
    };
  }, [autoScrollOnKeyboard, keyboardScrollOffset, scroll]);

  if (scroll) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          style={styles.keyboardAware}>
          <ScrollView
            contentContainerStyle={styles.scrollContent}
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'none'}
            keyboardShouldPersistTaps="handled"
            ref={scrollViewRef}
            showsVerticalScrollIndicator={false}
            style={styles.container}>
            {children}
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.content}>{children}</View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: colors.background,
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  keyboardAware: {
    flex: 1,
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    padding: spacing.lg,
  },
  scrollContent: {
    gap: spacing.md,
    padding: spacing.lg,
    paddingBottom: spacing.md,
  },
});
