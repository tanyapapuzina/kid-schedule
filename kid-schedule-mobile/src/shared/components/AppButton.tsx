import { Pressable, StyleSheet, Text } from 'react-native';

import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

type AppButtonProps = {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'accent';
  disabled?: boolean;
};

export function AppButton({ title, onPress, variant = 'primary', disabled = false }: AppButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        variant === 'secondary' && styles.secondaryButton,
        variant === 'accent' && styles.accentButton,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}>
      <Text
        style={[
          styles.text,
          variant === 'secondary' && styles.secondaryText,
          disabled && styles.disabledText,
        ]}>
        {title}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    backgroundColor: colors.brand,
    minHeight: 52,
    justifyContent: 'center',
    paddingHorizontal: spacing.lg,
  },
  secondaryButton: {
    borderColor: colors.line,
    borderWidth: 1,
    backgroundColor: colors.surface,
  },
  accentButton: {
    backgroundColor: colors.lavender,
  },
  pressed: {
    opacity: 0.78,
    transform: [{ scale: 0.99 }],
  },
  disabled: {
    opacity: 0.58,
  },
  text: {
    color: colors.text,
    fontSize: typography.md,
    fontWeight: '800',
  },
  secondaryText: {
    color: colors.brandDark,
  },
  disabledText: {
    opacity: 0.9,
  },
});
