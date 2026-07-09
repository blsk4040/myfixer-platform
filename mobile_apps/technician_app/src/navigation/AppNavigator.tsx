// src/navigation/AppNavigator.tsx
import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { NavigationContainer } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context'; 
import { 
  Home, 
  Briefcase, 
  Map, 
  TrendingUp, 
  User 
} from 'lucide-react-native';

// Import screen components
import { HomeScreen } from '../screens/home/HomeScreen'; // 👈 UPDATED: Linked new workstation screen
import { JobsScreen } from '../screens/jobs/JobsScreen';
import { MapScreen } from '../map/MapScreen';
import { EarningsScreen } from '../screens/earnings/EarningsScreen';
import { ProfileScreen } from '../screens/profile/ProfileScreen';
import { BankingInvoiceScreen } from '../screens/profile/BankingInvoiceScreen';
import { ProfilePictureUploadScreen } from '../screens/profile/ProfilePictureUploadScreen';

// Clean type casting for Lucide icons to eliminate SVGSVGElement type errors
const HomeIcon = Home as any;
const BriefcaseIcon = Briefcase as any;
const MapIcon = Map as any;
const TrendingUpIcon = TrendingUp as any;
const UserIcon = User as any;

const Tab = createBottomTabNavigator();
const ProfileStack = createNativeStackNavigator();

interface AppNavigatorProps {
  setIsAuthenticated: (auth: boolean) => void;
}

// Handles internal profile screen branching transitions cleanly
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
          headerStyle: { backgroundColor: '#090D14' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
      <ProfileStack.Screen
        name="ProfilePictureUpload"
        component={ProfilePictureUploadScreen}
        options={{
          headerShown: true,
          title: 'Profile Photo',
          headerStyle: { backgroundColor: '#090D14' },
          headerTintColor: '#FFFFFF',
          headerShadowVisible: false,
        }}
      />
    </ProfileStack.Navigator>
  );
}

export function AppNavigator({ setIsAuthenticated }: AppNavigatorProps) {
  const insets = useSafeAreaInsets(); 

  return (
    <NavigationContainer>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          headerShown: false,
          tabBarActiveTintColor: '#00FF87',      
          tabBarInactiveTintColor: '#64748B',    
          tabBarStyle: {
            backgroundColor: '#090D14',          
            borderTopWidth: 1,
            borderTopColor: '#1E293B',           
            height: 60 + insets.bottom, 
            paddingBottom: insets.bottom > 0 ? insets.bottom : 8,
            paddingTop: 8,
          },
          tabBarLabelStyle: {
            fontSize: 11,
            fontWeight: '600',
          },
          // ✅ ADDED: Complete layout visual sync with explicit Lucide icons
          tabBarIcon: ({ color, size }) => {
            switch (route.name) {
              case 'Home':
                return <HomeIcon color={color} size={size} />;
              case 'Jobs':
                return <BriefcaseIcon color={color} size={size} />;
              case 'Map':
                return <MapIcon color={color} size={size} />;
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
        {/* ✅ UPDATED: Points clean layout to the new technician workspace component */}
        <Tab.Screen name="Home" component={HomeScreen} />
        <Tab.Screen name="Jobs" component={JobsScreen} />
        <Tab.Screen name="Map" component={MapScreen} />
        <Tab.Screen name="Earnings" component={EarningsScreen} />
        
        <Tab.Screen name="Profile">
          {() => <ProfileStackScreen setIsAuthenticated={setIsAuthenticated} />}
        </Tab.Screen>
      </Tab.Navigator>
    </NavigationContainer>
  );
}
