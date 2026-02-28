import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
  ActivityIndicator,
} from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { COLORS } from '../../utils/constants';
import { formatRating } from '../../utils/formatters';
import useAuthStore from '../../store/authStore';
import { upload } from '../../services/api';

const ProfileScreen = ({ navigation }) => {
  const { user, activeRole, setActiveRole, logout, isLoading } = useAuthStore();
  const [isUploading, setIsUploading] = useState(false);

  const handleChangeAvatar = async () => {
    try {
      const { status } = await ImagePicker.requestCameraPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission Required', 'Camera access is needed to update your photo.');
        return;
      }

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsEditing: true,
        aspect: [1, 1],
        quality: 0.8,
      });

      if (!result.canceled && result.assets?.[0]) {
        setIsUploading(true);
        const formData = new FormData();
        formData.append('avatar', {
          uri: result.assets[0].uri,
          type: 'image/jpeg',
          name: 'avatar.jpg',
        });
        try {
          await upload('/users/avatar', formData);
          Alert.alert('Success', 'Profile photo updated.');
        } catch (error) {
          Alert.alert('Error', 'Failed to upload photo.');
        } finally {
          setIsUploading(false);
        }
      }
    } catch (error) {
      console.warn('Image picker error:', error);
    }
  };

  const handleSwitchRole = async () => {
    const newRole = activeRole === 'driver' ? 'passenger' : 'driver';
    if (user?.role === 'both') {
      await setActiveRole(newRole);
    } else {
      Alert.alert(
        'Role Restricted',
        `Your account is registered as ${user?.role || 'passenger'} only. Contact support to enable both roles.`
      );
    }
  };

  const handleLogout = () => {
    Alert.alert('Log Out', 'Are you sure you want to log out?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Log Out',
        style: 'destructive',
        onPress: () => logout(),
      },
    ]);
  };

  const initials = `${(user?.firstName || 'O')[0]}${(user?.lastName || 'R')[0]}`;

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Avatar */}
      <View style={styles.avatarSection}>
        <TouchableOpacity
          style={styles.avatarContainer}
          onPress={handleChangeAvatar}
          disabled={isUploading}
        >
          <View style={styles.avatar}>
            {isUploading ? (
              <ActivityIndicator color={COLORS.textOnPrimary} />
            ) : (
              <Text style={styles.avatarText}>{initials}</Text>
            )}
          </View>
          <View style={styles.cameraIcon}>
            <Text style={styles.cameraIconText}>{'\u{1F4F7}'}</Text>
          </View>
        </TouchableOpacity>

        <Text style={styles.userName}>
          {user?.firstName} {user?.lastName}
        </Text>
        <Text style={styles.userEmail}>{user?.email}</Text>

        {/* Rating */}
        <View style={styles.ratingContainer}>
          <Text style={styles.ratingText}>
            {formatRating(user?.rating || 0)}
          </Text>
          <Text style={styles.ratingCount}>
            ({user?.totalRatings || 0} ratings)
          </Text>
        </View>
      </View>

      {/* Vehicle Info (Driver) */}
      {(activeRole === 'driver' || user?.role === 'both') && user?.vehicle && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Vehicle Information</Text>
          <View style={styles.card}>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Vehicle</Text>
              <Text style={styles.infoValue}>
                {user.vehicle.make} {user.vehicle.model} ({user.vehicle.year})
              </Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Color</Text>
              <Text style={styles.infoValue}>{user.vehicle.color}</Text>
            </View>
            <View style={styles.infoRow}>
              <Text style={styles.infoLabel}>Plate</Text>
              <Text style={styles.infoValue}>{user.vehicle.plateNumber}</Text>
            </View>
          </View>
        </View>
      )}

      {/* Role Switcher */}
      {user?.role === 'both' && (
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Current Mode</Text>
          <TouchableOpacity style={styles.roleSwitcher} onPress={handleSwitchRole}>
            <View style={styles.roleSwitcherInfo}>
              <Text style={styles.roleSwitcherCurrent}>
                {activeRole === 'driver' ? 'Driver Mode' : 'Passenger Mode'}
              </Text>
              <Text style={styles.roleSwitcherHint}>
                Tap to switch to {activeRole === 'driver' ? 'passenger' : 'driver'} mode
              </Text>
            </View>
            <Text style={styles.roleSwitcherArrow}>{'\u2192'}</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Menu Items */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Account</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Edit Profile', 'Profile editing coming soon.')}
          >
            <Text style={styles.menuItemText}>Edit Profile</Text>
            <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Payment Methods', 'Payment management coming soon.')}
          >
            <Text style={styles.menuItemText}>Payment Methods</Text>
            <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Emergency Contacts', 'Emergency contacts coming soon.')}
          >
            <Text style={styles.menuItemText}>Emergency Contacts</Text>
            <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.menuItem, styles.menuItemLast]}
            onPress={() => navigation.navigate('Settings')}
          >
            <Text style={styles.menuItemText}>Settings</Text>
            <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Logout */}
      <TouchableOpacity
        style={styles.logoutButton}
        onPress={handleLogout}
        disabled={isLoading}
      >
        <Text style={styles.logoutButtonText}>
          {isLoading ? 'Logging out...' : 'Log Out'}
        </Text>
      </TouchableOpacity>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  content: {
    paddingBottom: 40,
  },
  avatarSection: {
    alignItems: 'center',
    paddingVertical: 28,
    backgroundColor: COLORS.surface,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.border,
  },
  avatarContainer: {
    position: 'relative',
    marginBottom: 12,
  },
  avatar: {
    width: 88,
    height: 88,
    borderRadius: 44,
    backgroundColor: COLORS.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 32,
    fontWeight: '700',
  },
  cameraIcon: {
    position: 'absolute',
    bottom: 0,
    right: 0,
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: COLORS.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: COLORS.border,
  },
  cameraIconText: {
    fontSize: 14,
  },
  userName: {
    fontSize: 22,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginBottom: 12,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  ratingText: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.star,
    marginRight: 4,
  },
  ratingCount: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  section: {
    paddingHorizontal: 16,
    paddingTop: 24,
  },
  sectionTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: COLORS.textSecondary,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 8,
  },
  card: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    overflow: 'hidden',
  },
  infoRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  infoLabel: {
    fontSize: 15,
    color: COLORS.textSecondary,
  },
  infoValue: {
    fontSize: 15,
    fontWeight: '500',
    color: COLORS.text,
  },
  roleSwitcher: {
    backgroundColor: COLORS.surface,
    borderRadius: 12,
    padding: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  roleSwitcherInfo: {
    flex: 1,
  },
  roleSwitcherCurrent: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.primary,
    marginBottom: 2,
  },
  roleSwitcherHint: {
    fontSize: 13,
    color: COLORS.textSecondary,
  },
  roleSwitcherArrow: {
    fontSize: 20,
    color: COLORS.primary,
    fontWeight: '600',
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  menuItemLast: {
    borderBottomWidth: 0,
  },
  menuItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  menuItemArrow: {
    fontSize: 22,
    color: COLORS.textLight,
  },
  logoutButton: {
    marginHorizontal: 16,
    marginTop: 32,
    backgroundColor: COLORS.errorLight,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  logoutButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default ProfileScreen;
