import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

import { Colors, FontFamily, FontSize, FontWeight } from '@/lib/tokens';

type Variant = 'display' | 'h1' | 'h2' | 'h3' | 'body' | 'small' | 'caption' | 'label';
type Weight = keyof typeof FontWeight;

interface Props extends TextProps {
  variant?: Variant;
  weight?: Weight;
  color?: string;
}

export function Text({ variant = 'body', weight, color, style, ...props }: Props) {
  return (
    <RNText
      style={[styles.base, styles[variant], weight && { fontWeight: FontWeight[weight] }, color && { color }, style]}
      {...props}
    />
  );
}

const styles = StyleSheet.create({
  base: {
    color: Colors.textPrimary,
    fontFamily: FontFamily.sans,
  },
  display: {
    fontSize: FontSize['4xl'],
    lineHeight: FontSize['4xl'] * 1.2,
    fontWeight: FontWeight.bold,
    fontFamily: FontFamily.display,
  },
  h1: {
    fontSize: FontSize['2xl'],
    lineHeight: FontSize['2xl'] * 1.25,
    fontFamily: FontFamily.display,
  },
  h2: {
    fontSize: FontSize.xl,
    lineHeight: FontSize.xl * 1.3,
    fontWeight: FontWeight.semibold,
  },
  h3: {
    fontSize: FontSize.lg,
    lineHeight: FontSize.lg * 1.4,
    fontWeight: FontWeight.semibold,
  },
  body: {
    fontSize: FontSize.md,
    lineHeight: FontSize.md * 1.5,
    fontWeight: FontWeight.regular,
  },
  small: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.5,
    fontWeight: FontWeight.regular,
  },
  caption: {
    fontSize: FontSize.xs,
    lineHeight: FontSize.xs * 1.5,
    fontWeight: FontWeight.regular,
    color: Colors.textSecondary,
  },
  label: {
    fontSize: FontSize.sm,
    lineHeight: FontSize.sm * 1.2,
    fontWeight: FontWeight.medium,
    letterSpacing: 0.4,
  },
});
