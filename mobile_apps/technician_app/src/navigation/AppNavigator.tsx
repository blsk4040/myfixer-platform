import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
  Briefcase,
  Home,
  Inbox,
  TrendingUp,
  User,
} from 'lucide-react-native';

import { HomeScreen } from '../screens/home/HomeScreen';
import { JobsScreen } from '../screens/jobs/JobsScreen';
import { EarningsScreen } from '../screens/earnings/EarningsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { BankingInvoiceScreen } from '../screens/profile/BankingInvoiceScreen';
import { ProfilePictureUploadScreen } from '../screens/profile/ProfilePictureUploadScreen';
import { SecurityScreen } from '../screens/profile/SecurityScreen';
import { SupportScreen } from '../screens/profile/SupportScreen';
import TechnicianInboxScreen, { TechnicianAlertsScreen } from '../screens/notifications/NotificationFeedScreen';
import { MapScreen } from '../map/MapScreen';

const HomeIcon = Home as any;
const BriefcaseIcon = Briefcase as any;
const InboxIcon = Inbox as any;
const TrendingUpIcon = TrendingUp as any;
const UserIcon = User as any;

const Colors = {
  background: '#0B0B0D',
  surface: '#17171A',
  border: '#303036',
  primary: '#B8FF3D',
  text: '#F7F7F5',
  textSubtle: '#74747C',
};

const Tab = createBottomTabNavigator();
const RootStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

interface AppNavigatorProps {
  setIsAuthenticated: (auth: boolean) => void;
}

function ProfileStackScreen({ setIsAuthenticated }: AppNavigatorProps) {
  return (
    <ProfileStack.Navigator screenOptions={{ headerShown: false }}>
      <ProfileStack.Screen name="ProfileMain">
        {() => <ProfileScreen setIsAuthenticated={setIsAuthenticated} />}
      </ProfileStack.Screen>
      <ProfileStack.Screen
        name="BankingInvoice"
        component={BankingInvoiceScreen}
        options={{
          headerShown: true,
          title: 'Banking & Invoices',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="ProfilePictureUpload"
        component={ProfilePictureUploadScreen}
        options={{
          headerShown: true,
          title: 'Profile Photo',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="Security"
        component={SecurityScreen}
        options={{
          headerShown: true,
          title: 'Security',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="Support"
        component={SupportScreen}
        options={{
          headerShown: true,
          title: 'Help & Support',
          headerStyle: { backgroundColor: Colors.background },
          headerTintColor: Colors.text,
          headerShadowVisible: false,
        }}
      />
    </ProfileStack.Navigator>
  );
}

function MainTabs({ setIsAuthenticated }: AppNavigatorProps): React.JSX.Element {
  const insets = useSafeAreaInsets();

  return (
    <Tab.Navigator
      screenOptions={({ route }) => ({
        headerShown: false,
        tabBarActiveTintColor: Colors.primary,
        tabBarInactiveTintColor: Colors.textSubtle,
        tabBarStyle: {
          backgroundColor: Colors.surface,
          borderTopWidth: 1,
          borderTopColor: Colors.border,
          height: 60 + insets.bottom,
          paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
          paddingTop: 8,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '600',
        },
        tabBarIcon: ({ color, size }) => {
          switch (route.name) {
            case 'Home':
              return <HomeIcon color={color} size={size} />;
            case 'Jobs':
              return <BriefcaseIcon color={color} size={size} />;
            case 'Inbox':
              return <InboxIcon color={color} size={size} />;
            case 'Earnings':
              return <TrendingUpIcon color={color} size={size} />;
            case 'Profile':
              return <UserIcon color={color} size={size} />;
            default:
              return null;
          }
        },
      })}
    >
      <Tab.Screen name="Home" component={HomeScreen} />
      <Tab.Screen name="Jobs" component={JobsScreen} />
      <Tab.Screen name="Inbox" component={TechnicianInboxScreen} />
      <Tab.Screen name="Earnings" component={EarningsScreen} />
      <Tab.Screen name="Profile">
        {() => <ProfileStackScreen setIsAuthenticated={setIsAuthenticated} />}
      </Tab.Screen>
    </Tab.Navigator>
  );
}

export function AppNavigator({ setIsAuthenticated }: AppNavigatorProps) {
  return (
    <NavigationContainer>
      <RootStack.Navigator screenOptions={{ headerShown: false }}>
        <RootStack.Screen name="MainTabs">
          {() => <MainTabs setIsAuthenticated={setIsAuthenticated} />}
        </RootStack.Screen>
        <RootStack.Screen name="Alerts" component={TechnicianAlertsScreen} />
        <RootStack.Screen name="JobMap" component={MapScreen} />
      </RootStack.Navigator>
    </NavigationContainer>
  );
}
