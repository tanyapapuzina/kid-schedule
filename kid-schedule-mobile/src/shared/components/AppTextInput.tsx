import { StyleSheet, Text, TextInput, type TextInputProps, View } from 'react-native';

import { colors } from '@/shared/theme/colors';
import { spacing } from '@/shared/theme/spacing';
import { typography } from '@/shared/theme/typography';

type AppTextInputProps = TextInputProps & {
  label: string;
};

export function AppTextInput({ label, style, ...inputProps }: AppTextInputProps) {
  return (
    <View style={styles.wrapper}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        placeholderTextColor={colors.muted}
        style={[styles.input, style]}
        {...inputProps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    gap: spacing.xs,
  },
  label: {
    color: colors.text,
    fontSize: typography.sm,
    fontWeight: '800',
  },
  input: {
    borderColor: colors.line,
    borderRadius: 14,
    borderWidth: 1,
    backgroundColor: colors.surface,
    color: colors.text,
    fontSize: typography.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
  },
});
