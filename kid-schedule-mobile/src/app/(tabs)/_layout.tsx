import { Tabs } from 'expo-router';
import { SymbolView, type SFSymbol } from 'expo-symbols';
import { StyleSheet, Text, View } from 'react-native';

import { colors } from '@/shared/theme/colors';

function TabIcon({ focused, name }: { focused: boolean; name: SFSymbol }) {
  return (
    <View style={[styles.iconWrap, focused && styles.iconWrapActive]}>
      <SymbolView
        fallback={<Text style={[styles.iconFallback, focused && styles.iconFallbackActive]}>•</Text>}
        name={name}
        size={20}
        tintColor={focused ? colors.plum : colors.muted}
        weight={focused ? 'semibold' : 'regular'}
      />
    </View>
  );
}

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.brand,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: 'transparent',
          borderTopWidth: 0,
          elevation: 0,
          height: 86,
          paddingBottom: 24,
          paddingTop: 10,
          shadowOpacity: 0,
        },
        tabBarLabelStyle: {
          fontSize: 12,
          fontWeight: '900',
        },
        tabBarItemStyle: {
          paddingTop: 2,
        },
      }}>
      <Tabs.Screen
        name="home"
        options={{
          title: 'Главная',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="house.fill" />,
        }}
      />
      <Tabs.Screen
        name="family"
        options={{
          title: 'Семья',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="person.3.fill" />,
        }}
      />
      <Tabs.Screen
        name="calendar"
        options={{
          title: 'Календарь',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="calendar" />,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Профиль',
          tabBarIcon: ({ focused }) => <TabIcon focused={focused} name="person.crop.circle.fill" />,
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconWrap: {
    alignItems: 'center',
    backgroundColor: 'transparent',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  iconWrapActive: {
    backgroundColor: colors.lavenderSoft,
    borderColor: 'rgba(221, 166, 252, 0.42)',
    borderWidth: 1,
  },
  iconFallback: {
    color: colors.muted,
    fontSize: 18,
    fontWeight: '900',
  },
  iconFallbackActive: {
    color: colors.brandDark,
  },
});
