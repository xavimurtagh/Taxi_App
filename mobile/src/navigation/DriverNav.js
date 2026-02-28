import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { Text } from 'react-native';
import { COLORS } from '../utils/constants';

import DashboardScreen from '../screens/driver/DashboardScreen';
import NavigationScreen from '../screens/driver/NavigationScreen';
import DriverRatingScreen from '../screens/driver/RatingScreen';
import EarningsScreen from '../screens/driver/EarningsScreen';
import ProposalsScreen from '../screens/governance/ProposalsScreen';
import VotingScreen from '../screens/governance/VotingScreen';
import DisputesScreen from '../screens/governance/DisputesScreen';
import ElectionScreen from '../screens/governance/ElectionScreen';
import TransparencyScreen from '../screens/shared/TransparencyScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';

const Tab = createBottomTabNavigator();
const DashboardStack = createNativeStackNavigator();
const EarningsStack = createNativeStackNavigator();
const GovernanceStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TabIcon = ({ name, color, size }) => {
  const icons = {
    car: '\u2708',
    cash: '\u2234',
    people: '\u2687',
    person: '\u2603',
  };
  return (
    <Text style={{ color, fontSize: size }}>{icons[name] || '\u25CF'}</Text>
  );
};

const DashboardStackScreen = () => (
  <DashboardStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textOnPrimary,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <DashboardStack.Screen
      name="DashboardMain"
      component={DashboardScreen}
      options={{ headerShown: false }}
    />
    <DashboardStack.Screen
      name="Navigation"
      component={NavigationScreen}
      options={{ title: 'Active Ride' }}
    />
    <DashboardStack.Screen
      name="DriverRating"
      component={DriverRatingScreen}
      options={{ title: 'Rate Passenger' }}
    />
  </DashboardStack.Navigator>
);

const EarningsStackScreen = () => (
  <EarningsStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textOnPrimary,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <EarningsStack.Screen
      name="EarningsMain"
      component={EarningsScreen}
      options={{ title: 'Earnings' }}
    />
  </EarningsStack.Navigator>
);

const GovernanceStackScreen = () => (
  <GovernanceStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textOnPrimary,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <GovernanceStack.Screen
      name="Proposals"
      component={ProposalsScreen}
      options={{ title: 'Governance' }}
    />
    <GovernanceStack.Screen
      name="Voting"
      component={VotingScreen}
      options={{ title: 'Proposal Details' }}
    />
    <GovernanceStack.Screen
      name="Transparency"
      component={TransparencyScreen}
      options={{ title: 'Platform Finances' }}
    />
    <GovernanceStack.Screen
      name="Disputes"
      component={DisputesScreen}
      options={{ title: 'Disputes' }}
    />
    <GovernanceStack.Screen
      name="Elections"
      component={ElectionScreen}
      options={{ title: 'Moderator Elections' }}
    />
  </GovernanceStack.Navigator>
);

const ProfileStackScreen = () => (
  <ProfileStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textOnPrimary,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <ProfileStack.Screen
      name="ProfileMain"
      component={ProfileScreen}
      options={{ title: 'Profile' }}
    />
    <ProfileStack.Screen
      name="Settings"
      component={SettingsScreen}
      options={{ title: 'Settings' }}
    />
  </ProfileStack.Navigator>
);

const DriverNav = () => {
  return (
    <Tab.Navigator
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: COLORS.primary,
        tabBarInactiveTintColor: COLORS.textSecondary,
        tabBarStyle: {
          backgroundColor: COLORS.surface,
          borderTopColor: COLORS.border,
          paddingBottom: 4,
          paddingTop: 4,
          height: 60,
        },
        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: '500',
        },
      }}
    >
      <Tab.Screen
        name="Dashboard"
        component={DashboardStackScreen}
        options={{
          tabBarLabel: 'Dashboard',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="car" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Earnings"
        component={EarningsStackScreen}
        options={{
          tabBarLabel: 'Earnings',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="cash" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Governance"
        component={GovernanceStackScreen}
        options={{
          tabBarLabel: 'Governance',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="people" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileStackScreen}
        options={{
          tabBarLabel: 'Profile',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="person" color={color} size={size} />
          ),
        }}
      />
    </Tab.Navigator>
  );
};

export default DriverNav;
