// mobile_apps/client_app/src/navigation/AppNavigator.tsx

import React, { useEffect, useState } from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { Home, Activity, Clock, User, Bell, CreditCard } from 'lucide-react-native';

// Custom Components
import CustomTabBar from '../components/CustomTabBar';

// Screens
import BookingWizardScreen from '../screens/booking/BookingWizardScreen';
import TrackingScreen from '../screens/map_tracking/TrackingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen';
import { CompleteClientProfileScreen } from '../screens/auth/CompleteClientProfileScreen';
import { VerifyEmailNoticeScreen } from '../screens/auth/VerifyEmailNoticeScreen';
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { LiveTrackScreen } from '../screens/tracking/LiveTrackScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { BookingHistoryScreen } from '../screens/history/BookingHistoryScreen';
import { ActivityScreen } from '../screens/activity/ActivityScreen';
import { ChatScreen } from '../chat/ChatScreen';
import ManagedCollectionScreen from '../screens/managed_collection/ManagedCollectionScreen';
import NotificationInboxScreen from '../screens/notifications/NotificationInboxScreen';
import SubscriptionDashboardScreen from '../screens/subscriptions/SubscriptionDashboardScreen';
import { AddressesScreen } from '../screens/profile/AddressesScreen';
import apiService from '../services/api.service';
import authService from '../services/auth.service';

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  CompleteClientProfile: {
    idToken: string;
    googleProfile?: {
      email?: string;
      name?: string;
      googleSubject?: string;
    };
  };
  VerifyEmailNotice: { autoCheck?: boolean } | undefined;
  MainTabs: undefined;
  BookingWizard: {
    category: string;
    serviceKey?: string;
    subCategory?: string;
    basePrice?: number;
    preferredTechnicianId?: string;
    preferredTechnicianName?: string;
    rebookFromBookingId?: string;
  };
  ManagedCollection: undefined;
  TrackingMain: {
    bookingId: string;
  };
  LiveTrack: {
    bookingId: string;
    techName: string;
    techPhone?: string;
  };
  Chat: {
    bookingId: string;
    techName: string;
  };
  Addresses: undefined;
};

export type TabParamList = {
  Home: undefined;
  Activity: undefined;
  Notifications: undefined;
  Subscriptions: undefined;
  History: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const linking = {
  prefixes: ['myfixerclient://'],
  config: {
    screens: {
      VerifyEmailNotice: {
        path: 'email-verified',
        parse: {
          autoCheck: () => true,
        },
      },
    },
  },
};

function MainTabNavigator() {
  const [managedCollectionEnabled, setManagedCollectionEnabled] = useState(false);

  useEffect(() => {
    const session = authService.getSession();
    const countryCode = session?.user.countryCode;
    if (!countryCode) {
      setManagedCollectionEnabled(false);
      return;
    }

    apiService.getMarketAvailability({
      countryCode,
      city: session.user.location?.city,
      area: session.user.location?.area,
    })
      .then((result) => {
        const managedCollection = result.availability.services.find((service) => service.serviceKey === 'managed_collection');
        setManagedCollectionEnabled(Boolean(managedCollection?.canBook));
      })
      .catch(() => setManagedCollectionEnabled(false));
  }, []);

  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}
    >
      <Tab.Screen
        name="Home"
        component={DashboardScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <Home color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Activity"
        component={ActivityScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <Activity color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Notifications"
        component={NotificationInboxScreen}
        options={{
          tabBarLabel: 'Inbox',
          tabBarIcon: ({ color, size }) => (
            <Bell color={color} size={size} />
          ),
        }}
      />

      {managedCollectionEnabled && (
        <Tab.Screen
          name="Subscriptions"
          component={SubscriptionDashboardScreen}
          options={{
            tabBarLabel: 'Plans',
            tabBarIcon: ({ color, size }) => (
              <CreditCard color={color} size={size} />
            ),
          }}
        />
      )}

      <Tab.Screen
        name="History"
        component={BookingHistoryScreen}
        options={{
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => (
            <Clock color={color} size={size} />
          ),
        }}
      />

      <Tab.Screen
        name="Account"
        component={ProfileScreen}
        options={{
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
}

export function AppNavigator(): React.JSX.Element {
  return (
    <SafeAreaProvider>
      <NavigationContainer linking={linking}>
        <Stack.Navigator
          initialRouteName="Login"
          screenOptions={{
            headerStyle: {
              backgroundColor: '#090D14',
            },
            headerTintColor: '#FFFFFF',
            headerTitleStyle: {
              fontWeight: '700',
              fontSize: 16,
            },
            headerShadowVisible: false,
            contentStyle: {
              backgroundColor: '#090D14',
            },
          }}
        >
          {/* Authentication */}
          <Stack.Screen
            name="Login"
            component={LoginScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="Register"
            component={RegisterScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="ForgotPassword"
            component={ForgotPasswordScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="CompleteClientProfile"
            component={CompleteClientProfileScreen}
            options={{ headerShown: false }}
          />

          <Stack.Screen
            name="VerifyEmailNotice"
            component={VerifyEmailNoticeScreen}
            options={{ headerShown: false }}
          />

          {/* Main App */}
          <Stack.Screen
            name="MainTabs"
            component={MainTabNavigator}
            options={{ headerShown: false }}
          />

          {/* Booking */}
          <Stack.Screen
            name="BookingWizard"
            component={BookingWizardScreen}
            options={({ route }) => ({
              title: route.params?.subCategory ?? 'Service Dispatch',
            })}
          />

          <Stack.Screen
            name="ManagedCollection"
            component={ManagedCollectionScreen}
            options={{
              title: 'Managed Collection',
            }}
          />

          <Stack.Screen
            name="TrackingMain"
            component={TrackingScreen}
            options={{
              title: 'Job Lifecycle',
            }}
          />

          <Stack.Screen
            name="LiveTrack"
            component={LiveTrackScreen}
            options={{
              title: 'Dispatch Radar',
            }}
          />

          <Stack.Screen
            name="Chat"
            component={ChatScreen}
            options={{
              title: 'Direct Specialist Comms',
            }}
          />

          <Stack.Screen
            name="Addresses"
            component={AddressesScreen}
            options={{
              title: 'Saved Address',
            }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

export default AppNavigator;
