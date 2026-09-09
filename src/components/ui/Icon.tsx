import MaterialIcons from '@expo/vector-icons/MaterialIcons';
import React from 'react';
import { ColorValue } from 'react-native';

import { Colors } from '@/lib/tokens';

// Subset of MaterialIcons used in Hued
export type IconName =
  | 'home'
  | 'camera-alt'
  | 'settings'
  | 'add'
  | 'favorite'
  | 'favorite-border'
  | 'share'
  | 'delete'
  | 'close'
  | 'check'
  | 'chevron-right'
  | 'chevron-left'
  | 'arrow-back'
  | 'image'
  | 'folder'
  | 'palette'
  | 'star'
  | 'star-border'
  | 'more-vert'
  | 'download'
  | 'content-copy'
  | 'lock';

interface Props {
  name: IconName;
  size?: number;
  color?: ColorValue;
}

export function Icon({ name, size = 24, color = Colors.textPrimary }: Props) {
  return <MaterialIcons name={name as any} size={size} color={color} />;
}
