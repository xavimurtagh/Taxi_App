import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import useAuthStore from '../../store/authStore';

const RoleSelectScreen = ({ navigation }) => {
  const { setActiveRole, user } = useAuthStore();

  const handleRoleSelect = async (role) => {
    await setActiveRole(role);
    // Navigation will happen automatically via AppNavigator reacting to activeRole change
  };

  return (
    <View style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.greeting}>
          Welcome, {user?.firstName || 'there'}!
        </Text>
        <Text style={styles.title}>How would you like to use OpenRide?</Text>
        <Text style={styles.subtitle}>You can switch modes anytime from your profile.</Text>
      </View>

      <View style={styles.cardsContainer}>
        {/* Passenger Card */}
        <TouchableOpacity
          style={styles.card}
          onPress={() => handleRoleSelect('passenger')}
          activeOpacity={0.8}
        >
          <View style={styles.cardIconContainer}>
            <Text style={styles.cardIcon}>
              {'\u{1F464}'}
            </Text>
          </View>
          <Text style={styles.cardTitle}>Ride as Passenger</Text>
          <Text style={styles.cardDescription}>
            Request rides, track your driver, and get where you need to go.
          </Text>
          <View style={styles.cardArrow}>
            <Text style={styles.cardArrowText}>Get Started  &#8594;</Text>
          </View>
        </TouchableOpacity>

        {/* Driver Card */}
        <TouchableOpacity
          style={[styles.card, styles.cardDriver]}
          onPress={() => handleRoleSelect('driver')}
          activeOpacity={0.8}
        >
          <View style={[styles.cardIconContainer, styles.cardIconContainerDriver]}>
            <Text style={styles.cardIcon}>
              {'\u{1F697}'}
            </Text>
          </View>
          <Text style={styles.cardTitle}>Drive</Text>
          <Text style={styles.cardDescription}>
            Go online, accept rides, earn money, and help your community.
          </Text>
          <View style={styles.cardArrow}>
            <Text style={styles.cardArrowText}>Get Started  &#8594;</Text>
          </View>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
    paddingHorizontal: 24,
    justifyContent: 'center',
  },
  header: {
    marginBottom: 40,
  },
  greeting: {
    fontSize: 16,
    color: COLORS.textSecondary,
    marginBottom: 8,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  cardsContainer: {
    gap: 16,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 16,
    padding: 24,
    borderWidth: 2,
    borderColor: COLORS.border,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  cardDriver: {
    borderColor: COLORS.border,
  },
  cardIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: COLORS.successLight,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  cardIconContainerDriver: {
    backgroundColor: COLORS.infoLight,
  },
  cardIcon: {
    fontSize: 28,
  },
  cardTitle: {
    fontSize: 22,
    fontWeight: 'bold',
    color: COLORS.text,
    marginBottom: 8,
  },
  cardDescription: {
    fontSize: 14,
    color: COLORS.textSecondary,
    lineHeight: 20,
    marginBottom: 16,
  },
  cardArrow: {
    alignItems: 'flex-end',
  },
  cardArrowText: {
    color: COLORS.primary,
    fontSize: 14,
    fontWeight: '600',
  },
});

export default RoleSelectScreen;
