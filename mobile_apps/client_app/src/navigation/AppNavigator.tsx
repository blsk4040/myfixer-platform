// mobile_apps/client_app/src/navigation/AppNavigator.tsx
import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Home, Activity, Clock, User } from 'lucide-react-native';

// Screens imports
import BookingWizardScreen from '../screens/booking/BookingWizardScreen';
import TrackingScreen from '../screens/map_tracking/TrackingScreen';
import { LoginScreen } from '../screens/auth/LoginScreen';
import { RegisterScreen } from '../screens/auth/RegisterScreen';
import { ForgotPasswordScreen } from '../screens/auth/ForgotPasswordScreen'; 
import { DashboardScreen } from '../screens/dashboard/DashboardScreen';
import { LiveTrackScreen } from '../screens/tracking/LiveTrackScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { BookingHistoryScreen } from '../screens/history/BookingHistoryScreen';
import { ActivityScreen } from '../screens/activity/ActivityScreen';
import { ChatScreen } from '../chat/ChatScreen'; 

export type RootStackParamList = {
  Login: undefined;
  Register: undefined;
  ForgotPassword: undefined;
  MainTabs: undefined; // The entry target wrapping the 4 tabs together safely
  BookingWizard: { category: string; subCategory?: string; basePrice?: number }; 
  TrackingMain: { bookingId: string };
  LiveTrack: { bookingId: string; techName: string; techPhone?: string };
  Chat: { bookingId: string; techName: string };
};

export type TabParamList = {
  Home: undefined;
  Activity: undefined;
  History: undefined;
  Account: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

// ==========================================
// 💡 THE 4-TAB CLIENT LAYOUT HUB DEFINE
// ==========================================
function MainTabNavigator() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: '#090D14' },
        headerTintColor: '#FFFFFF',
        headerTitleStyle: { fontWeight: '800', fontSize: 18, letterSpacing: -0.5 },
        headerShadowVisible: false,
        tabBarStyle: { 
          backgroundColor: '#0F172A', 
          borderTopColor: '#1E293B',
          paddingBottom: 8,
          paddingTop: 8,
          height: 64
        },
        tabBarActiveTintColor: '#00FF87',
        tabBarInactiveTintColor: '#64748B',
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginTop: 2 },
      }}
    >
      <Tab.Screen 
        name="Home" 
        component={DashboardScreen} 
        options={{
          headerShown: false, // Dashboard handles its own custom top hero branding
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Activity" 
        component={ActivityScreen} 
        options={{
          title: 'Live Tracking',
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, size }) => <Activity color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="History" 
        component={BookingHistoryScreen} 
        options={{
          title: 'Service Ledger',
          tabBarLabel: 'History',
          tabBarIcon: ({ color, size }) => <Clock color={color} size={size} />
        }}
      />
      <Tab.Screen 
        name="Account" 
        component={ProfileScreen} 
        options={{
          title: 'Account Settings',
          tabBarLabel: 'Account',
          tabBarIcon: ({ color, size }) => <User color={color} size={size} />
        }}
      />
    </Tab.Navigator>
  );
}

// ==========================================
// 🛣️ ROOT NAVIGATION MANAGEMENT STACK
// ==========================================
export function AppNavigator(): React.JSX.Element {
  return (
    <NavigationContainer>
      <Stack.Navigator
        initialRouteName="Login"
        screenOptions={{
          headerStyle: { backgroundColor: '#090D14' },
          headerTintColor: '#FFFFFF',
          headerTitleStyle: { fontWeight: '700', fontSize: 16 },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: '#090D14' },
        }}
      >
        {/* Auth Layers */}
        <Stack.Screen name="Login" component={LoginScreen} options={{ headerShown: false }} />
        <Stack.Screen name="Register" component={RegisterScreen} options={{ headerShown: false }} />
        <Stack.Screen name="ForgotPassword" component={ForgotPasswordScreen} options={{ headerShown: false }} />

        {/* Core App Tab Navigator Frame Integration */}
        <Stack.Screen name="MainTabs" component={MainTabNavigator} options={{ headerShown: false }} />

        {/* Deep sub-screens launched out from inside the active tab contexts */}
        <Stack.Screen 
          name="BookingWizard" 
          component={BookingWizardScreen} 
          options={({ route }) => ({ 
            title: route.params?.subCategory || 'Service Dispatch',
            headerShown: true 
          })} 
        />
        <Stack.Screen name="TrackingMain" component={TrackingScreen} options={{ title: 'Job Lifecycle' }} />
        <Stack.Screen name="LiveTrack" component={LiveTrackScreen} options={{ title: 'Dispatch Radar' }} />
        <Stack.Screen name="Chat" component={ChatScreen} options={{ title: 'Direct Specialist Comms' }} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

export default AppNavigator;