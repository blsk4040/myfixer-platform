import React from 'react';
import {
  StyleSheet,
  View,
  TouchableOpacity,
  Text,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export function CustomTabBar({ state, descriptors, navigation }: any) {
  const insets = useSafeAreaInsets();

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

          const tintColor = isFocused ? '#00FF87' : '#64748B';

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
              {options.tabBarIcon?.({
                focused: isFocused,
                color: tintColor,
                size: 24,
              })}

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

              {isFocused && <View style={styles.activeIndicator} />}
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

    height: 70,

    flexDirection: 'row',

    alignItems: 'center',
    justifyContent: 'space-around',

    backgroundColor: '#0F172A',

    borderRadius: 24,

    borderWidth: 1,
    borderColor: '#1E293B',

    paddingHorizontal: 10,

    shadowColor: '#000',
    shadowOffset: {
      width: 0,
      height: 8,
    },
    shadowOpacity: 0.22,
    shadowRadius: 12,

    elevation: 12,
  },

  tabButton: {
    flex: 1,

    height: '100%',

    alignItems: 'center',
    justifyContent: 'center',

    position: 'relative',
  },

  label: {
    fontSize: 11,
    marginTop: 4,
  },

  activeIndicator: {
    position: 'absolute',

    bottom: 6,

    width: 24,
    height: 3,

    borderRadius: 10,

    backgroundColor: '#00FF87',
  },
});

export default CustomTabBar;