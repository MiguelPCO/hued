import { Tabs } from 'expo-router';

import { Icon } from '@/components/ui/Icon';
import { Colors, FontFamily, FontSize, FontWeight } from '@/lib/tokens';

export default function TabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: Colors.accent,
        tabBarInactiveTintColor: Colors.textTertiary,
        tabBarStyle: {
          backgroundColor: Colors.bgElevated,
          borderTopColor: Colors.borderDefault,
          borderTopWidth: 1,
          height: 64,
          paddingBottom: 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontFamily: FontFamily.sans,
          fontSize: FontSize.xs,
          fontWeight: FontWeight.medium,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Paletas',
          tabBarIcon: ({ color }) => <Icon name="palette" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="capture"
        options={{
          title: 'Capturar',
          tabBarIcon: ({ color }) => <Icon name="camera-alt" color={color} size={22} />,
        }}
      />
      <Tabs.Screen
        name="settings"
        options={{
          title: 'Ajustes',
          tabBarIcon: ({ color }) => <Icon name="settings" color={color} size={22} />,
        }}
      />
    </Tabs>
  );
}
