import React from 'react';
import { StyleSheet, View, ViewProps } from 'react-native';

import { Colors, Radius, Shadow, Spacing } from '@/lib/tokens';

type Variant = 'elevated' | 'outlined' | 'flat';

interface Props extends ViewProps {
  variant?: Variant;
  padding?: boolean;
}

export function Card({ variant = 'elevated', padding = true, style, children, ...props }: Props) {
  return (
    <View
      style={[styles.base, styles[variant], padding && styles.padding, style]}
      {...props}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  base: {
    borderRadius: Radius.xl,
    backgroundColor: Colors.bgElevated,
    overflow: 'hidden',
  },
  elevated: {
    ...Shadow.md,
  },
  outlined: {
    borderWidth: 1,
    borderColor: Colors.borderDefault,
  },
  flat: {
    backgroundColor: Colors.bgSecondary,
  },
  padding: {
    padding: Spacing.md,
  },
});
