import React from 'react';
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TextInputProps,
  View,
  ViewProps,
} from 'react-native';
import { colors, shadow } from '../theme';

export const Card = ({ children, style, ...props }: ViewProps) => (
  <View style={[styles.card, style]} {...props}>
    {children}
  </View>
);

export const Label = ({ children }: { children: React.ReactNode }) => (
  <Text style={styles.label}>{children}</Text>
);

export const Input = (props: TextInputProps) => (
  <TextInput
    placeholderTextColor={colors.muted}
    style={[
      styles.input,
      props.multiline && styles.multiline,
      props.style,
    ]}
    {...props}
  />
);

export const Button = ({
  title,
  onPress,
  kind = 'primary',
  disabled = false,
}: {
  title: string;
  onPress: () => void;
  kind?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
}) => (
  <Pressable
    disabled={disabled}
    onPress={onPress}
    style={({ pressed }) => [
      styles.button,
      kind === 'secondary' && styles.secondary,
      kind === 'danger' && styles.danger,
      disabled && styles.disabled,
      pressed && !disabled && styles.pressed,
    ]}
  >
    <Text
      style={[
        styles.buttonText,
        kind === 'secondary' && styles.secondaryText,
      ]}
    >
      {title}
    </Text>
  </Pressable>
);

export const Money = ({ value }: { value: number }) => (
  <Text style={styles.money}>NPR {value.toLocaleString()}</Text>
);

export const Empty = ({ text }: { text: string }) => (
  <View style={styles.emptyWrap}>
    <Text style={styles.emptyIcon}>·</Text>
    <Text style={styles.empty}>{text}</Text>
  </View>
);

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.card,
    borderRadius: 16,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: colors.border,
    ...shadow,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 7,
  },
  input: {
    minHeight: 46,
    borderWidth: 1,
    borderColor: '#D5DFDB',
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 13,
    color: colors.text,
    backgroundColor: '#FFFFFF',
    marginBottom: 12,
  },
  multiline: {
    height: 92,
    paddingTop: 12,
    textAlignVertical: 'top',
  },
  button: {
    minHeight: 44,
    borderRadius: 12,
    backgroundColor: colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: colors.primary,
  },
  secondary: {
    backgroundColor: colors.accent,
    borderColor: '#BDE5D7',
  },
  danger: {
    backgroundColor: colors.danger,
    borderColor: colors.danger,
  },
  disabled: {
    opacity: 0.45,
  },
  pressed: {
    opacity: 0.82,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '900',
    fontSize: 13,
  },
  secondaryText: {
    color: colors.primaryDark,
  },
  money: {
    fontSize: 13,
    fontWeight: '900',
    color: colors.primaryDark,
  },
  emptyWrap: {
    alignItems: 'center',
    paddingVertical: 24,
  },
  emptyIcon: {
    color: colors.primary,
    fontSize: 32,
    lineHeight: 24,
  },
  empty: {
    textAlign: 'center',
    color: colors.muted,
    marginTop: 4,
  },
});
