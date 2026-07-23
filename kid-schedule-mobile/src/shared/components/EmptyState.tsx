import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

type EmptyStateProps = {
  title: string;
  text: string;
};

export function EmptyState({ title, text }: EmptyStateProps) {
  return (
    <View style={styles.container}>
      <Text style={styles.mark}>+</Text>
      <Text style={styles.title}>{title}</Text>
      <Text style={styles.text}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    borderColor: 'rgba(150, 167, 168, 0.24)',
    borderRadius: 26,
    borderStyle: 'dashed',
    borderWidth: 1,
    backgroundColor: colors.surface,
    gap: spacing.sm,
    padding: spacing.xl,
  },
  mark: {
    color: colors.brandDark,
    fontSize: typography.xxl,
    fontWeight: '900',
  },
  title: {
    color: colors.text,
    fontSize: typography.lg,
    fontWeight: '900',
    textAlign: 'center',
  },
  text: {
    color: colors.muted,
    fontSize: typography.md,
    lineHeight: 22,
    textAlign: 'center',
  },
});
