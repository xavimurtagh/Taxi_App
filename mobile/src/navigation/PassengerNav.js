import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { View, Text, StyleSheet } from 'react-native';
import { COLORS } from '../utils/constants';

import HomeScreen from '../screens/passenger/HomeScreen';
import RideTrackingScreen from '../screens/passenger/RideTrackingScreen';
import RideHistoryScreen from '../screens/passenger/RideHistoryScreen';
import RatingScreen from '../screens/passenger/RatingScreen';
import ProposalsScreen from '../screens/governance/ProposalsScreen';
import VotingScreen from '../screens/governance/VotingScreen';
import DisputesScreen from '../screens/governance/DisputesScreen';
import ElectionScreen from '../screens/governance/ElectionScreen';
import ProfileScreen from '../screens/shared/ProfileScreen';
import SettingsScreen from '../screens/shared/SettingsScreen';
import TransparencyScreen from '../screens/shared/TransparencyScreen';

const Tab = createBottomTabNavigator();
const HomeStack = createNativeStackNavigator();
const ActivityStack = createNativeStackNavigator();
const GovernanceStack = createNativeStackNavigator();
const ProfileStack = createNativeStackNavigator();

const TabIcon = ({ name, color, size }) => {
  const icons = {
    'map-marker': '\u25C9',
    clock: '\u25F7',
    people: '\u2687',
    person: '\u2603',
  };
  return (
    <Text style={{ color, fontSize: size }}>{icons[name] || '\u25CF'}</Text>
  );
};

const HomeStackScreen = () => (
  <HomeStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textOnPrimary,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <HomeStack.Screen
      name="HomeMain"
      component={HomeScreen}
      options={{ headerShown: false }}
    />
    <HomeStack.Screen
      name="RideTracking"
      component={RideTrackingScreen}
      options={{ title: 'Your Ride' }}
    />
    <HomeStack.Screen
      name="PassengerRating"
      component={RatingScreen}
      options={{ title: 'Rate Your Ride' }}
    />
  </HomeStack.Navigator>
);

const ActivityStackScreen = () => (
  <ActivityStack.Navigator
    screenOptions={{
      headerStyle: { backgroundColor: COLORS.primary },
      headerTintColor: COLORS.textOnPrimary,
      headerTitleStyle: { fontWeight: '600' },
    }}
  >
    <ActivityStack.Screen
      name="RideHistory"
      component={RideHistoryScreen}
      options={{ title: 'My Rides' }}
    />
  </ActivityStack.Navigator>
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

const PassengerNav = () => {
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
        name="Home"
        component={HomeStackScreen}
        options={{
          tabBarLabel: 'Home',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="map-marker" color={color} size={size} />
          ),
        }}
      />
      <Tab.Screen
        name="Activity"
        component={ActivityStackScreen}
        options={{
          tabBarLabel: 'Activity',
          tabBarIcon: ({ color, size }) => (
            <TabIcon name="clock" color={color} size={size} />
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

export default PassengerNav;
