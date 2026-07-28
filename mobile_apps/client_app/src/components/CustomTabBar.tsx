import React, { useCallback, useEffect, useState } from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Radius } from '../theme';
import apiService from '../services/api.service';
import { getUnreadNotificationCounts } from '../utils/notificationFeed';

export function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();
  const [inboxUnreadCount, setInboxUnreadCount] = useState(0);

  const loadInboxUnreadCount = useCallback(async () => {
    try {
      const result = await apiService.getNotifications();
      setInboxUnreadCount(getUnreadNotificationCounts(result.notifications || []).inbox);
    } catch {
      setInboxUnreadCount(0);
    }
  }, []);

  useEffect(() => {
    void loadInboxUnreadCount();
    const unsubscribe = navigation.addListener?.('state', loadInboxUnreadCount);
    const timer = setInterval(loadInboxUnreadCount, 30000);

    return () => {
      unsubscribe?.();
      clearInterval(timer);
    };
  }, [loadInboxUnreadCount, navigation]);

  return (
    <View
      style={[
        styles.container,
        {
          bottom: Math.max(insets.bottom, 12),
        },
      ]}
    >
      <View style={styles.tabBar}>
        {state.routes.map((route: any, index: number) => {
          const { options } = descriptors[route.key];

          const label =
            options.tabBarLabel ??
            options.title ??
            route.name;

          const isFocused = state.index === index;

          const tintColor = isFocused ? Colors.primary : Colors.textSubtle;
          const badgeCount = route.name === 'Notifications' ? inboxUnreadCount : 0;

          const onPress = () => {
            const event = navigation.emit({
              type: 'tabPress',
              target: route.key,
              canPreventDefault: true,
            });

            if (isFocused || event.defaultPrevented) {
              return;
            }

            // ✅ React Navigation 7 syntax
            navigation.navigate(route.name);
          };

          const onLongPress = () => {
            navigation.emit({
              type: 'tabLongPress',
              target: route.key,
            });
          };

          return (
            <TouchableOpacity
              key={route.key}
              accessibilityRole="button"
              accessibilityState={isFocused ? { selected: true } : {}}
              accessibilityLabel={options.tabBarAccessibilityLabel}
              testID={options.tabBarTestID}
              activeOpacity={0.8}
              onPress={onPress}
              onLongPress={onLongPress}
              style={styles.tabButton}
            >
              <View style={[styles.iconShell, isFocused && styles.iconShellActive]}>
                {options.tabBarIcon?.({
                  focused: isFocused,
                  color: tintColor,
                  size: 22,
                })}
                {badgeCount > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{badgeCount > 99 ? '99+' : badgeCount}</Text>
                  </View>
                ) : null}
              </View>

              <Text
                style={[
                  styles.label,
                  {
                    color: tintColor,
                    fontWeight: isFocused ? '700' : '500',
                  },
                ]}
              >
                {label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },

  tabBar: {
    width: '92%',
    maxWidth: 520,

    height: 78,

    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'space-around',

    backgroundColor: 'rgba(17, 17, 20, 0.96)',

    borderRadius: 32,

    borderWidth: 1,
    borderColor: 'rgba(247, 247, 245, 0.11)',

    paddingHorizontal: 7,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.36,
    shadowRadius: 26,

    elevation: 16,
  },

  tabButton: {
    flex: 1,

    height: '100%',

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
    borderRadius: 24,
  },

  label: {
    fontSize: 10,
    marginTop: 4,
  },

  iconShell: {
    width: 38,
    height: 30,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },

  iconShellActive: {
    backgroundColor: 'rgba(184, 255, 61, 0.13)',
    borderWidth: 1,
    borderColor: 'rgba(184, 255, 61, 0.32)',
  },
  badge: {
    position: 'absolute',
    top: -6,
    right: -8,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 5,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#EF4444',
    borderWidth: 1,
    borderColor: Colors.background,
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 9,
    fontWeight: '900',
  },
});

export default CustomTabBar;
