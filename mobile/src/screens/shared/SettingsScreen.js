import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Switch,
  Alert,
} from 'react-native';
import { COLORS } from '../../utils/constants';

const SettingsScreen = () => {
  const [notifyRideUpdates, setNotifyRideUpdates] = useState(true);
  const [notifyPromotions, setNotifyPromotions] = useState(false);
  const [notifyGovernance, setNotifyGovernance] = useState(true);
  const [shareLocation, setShareLocation] = useState(true);
  const [shareRideData, setShareRideData] = useState(false);

  const savedPlaces = [
    { id: '1', name: 'Home', address: '123 Main Street, City, ST 12345' },
    { id: '2', name: 'Work', address: '456 Office Avenue, City, ST 12345' },
  ];

  const handleAddPlace = () => {
    Alert.alert('Add Place', 'Custom place saving coming soon.');
  };

  const handleLanguage = () => {
    Alert.alert('Language', 'Language selection coming soon. Currently set to English.');
  };

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      {/* Notifications */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Notifications</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Ride Updates</Text>
              <Text style={styles.settingDescription}>
                Receive notifications about ride status changes
              </Text>
            </View>
            <Switch
              value={notifyRideUpdates}
              onValueChange={setNotifyRideUpdates}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={notifyRideUpdates ? COLORS.primary : COLORS.surfaceVariant}
            />
          </View>

          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Promotions</Text>
              <Text style={styles.settingDescription}>
                Community offers and discounts
              </Text>
            </View>
            <Switch
              value={notifyPromotions}
              onValueChange={setNotifyPromotions}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={notifyPromotions ? COLORS.primary : COLORS.surfaceVariant}
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Governance</Text>
              <Text style={styles.settingDescription}>
                New proposals and voting reminders
              </Text>
            </View>
            <Switch
              value={notifyGovernance}
              onValueChange={setNotifyGovernance}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={notifyGovernance ? COLORS.primary : COLORS.surfaceVariant}
            />
          </View>
        </View>
      </View>

      {/* Language */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Preferences</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={[styles.menuItem, styles.settingRowLast]}
            onPress={handleLanguage}
          >
            <Text style={styles.menuItemText}>Language</Text>
            <View style={styles.menuItemRight}>
              <Text style={styles.menuItemValue}>English</Text>
              <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>

      {/* Saved Places */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Saved Places</Text>
        <View style={styles.card}>
          {savedPlaces.map((place, index) => (
            <TouchableOpacity
              key={place.id}
              style={[
                styles.placeItem,
                index === savedPlaces.length - 1 && !true && styles.settingRowLast,
              ]}
              onPress={() =>
                Alert.alert(place.name, `Edit ${place.name} address?`)
              }
            >
              <View style={styles.placeIcon}>
                <Text style={styles.placeIconText}>
                  {place.name === 'Home' ? '\u2302' : '\u2616'}
                </Text>
              </View>
              <View style={styles.placeInfo}>
                <Text style={styles.placeName}>{place.name}</Text>
                <Text style={styles.placeAddress}>{place.address}</Text>
              </View>
              <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
            </TouchableOpacity>
          ))}
          <TouchableOpacity
            style={[styles.addPlaceButton, styles.settingRowLast]}
            onPress={handleAddPlace}
          >
            <Text style={styles.addPlaceText}>+ Add a Place</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Privacy */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>Privacy</Text>
        <View style={styles.card}>
          <View style={styles.settingRow}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Share Live Location</Text>
              <Text style={styles.settingDescription}>
                Allow emergency contacts to see your location during rides
              </Text>
            </View>
            <Switch
              value={shareLocation}
              onValueChange={setShareLocation}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={shareLocation ? COLORS.primary : COLORS.surfaceVariant}
            />
          </View>

          <View style={[styles.settingRow, styles.settingRowLast]}>
            <View style={styles.settingInfo}>
              <Text style={styles.settingLabel}>Anonymous Ride Data</Text>
              <Text style={styles.settingDescription}>
                Contribute anonymized data to improve routes
              </Text>
            </View>
            <Switch
              value={shareRideData}
              onValueChange={setShareRideData}
              trackColor={{ false: COLORS.border, true: COLORS.primaryLight }}
              thumbColor={shareRideData ? COLORS.primary : COLORS.surfaceVariant}
            />
          </View>
        </View>
      </View>

      {/* About */}
      <View style={styles.section}>
        <Text style={styles.sectionTitle}>About</Text>
        <View style={styles.card}>
          <TouchableOpacity
            style={styles.menuItem}
            onPress={() =>
              Alert.alert('About OpenRide', 'OpenRide is a non-profit, community-owned ride-sharing platform.')
            }
          >
            <Text style={styles.menuItemText}>About OpenRide</Text>
            <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Terms of Service', 'Terms of Service details.')}
          >
            <Text style={styles.menuItemText}>Terms of Service</Text>
            <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.menuItem}
            onPress={() => Alert.alert('Privacy Policy', 'Privacy Policy details.')}
          >
            <Text style={styles.menuItemText}>Privacy Policy</Text>
            <Text style={styles.menuItemArrow}>{'\u203A'}</Text>
          </TouchableOpacity>

          <View style={[styles.menuItem, styles.settingRowLast]}>
            <Text style={styles.menuItemText}>App Version</Text>
            <Text style={styles.versionText}>1.0.0 (Build 1)</Text>
          </View>
        </View>
      </View>
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
  settingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  settingRowLast: {
    borderBottomWidth: 0,
  },
  settingInfo: {
    flex: 1,
    marginRight: 12,
  },
  settingLabel: {
    fontSize: 16,
    color: COLORS.text,
    marginBottom: 2,
  },
  settingDescription: {
    fontSize: 12,
    color: COLORS.textSecondary,
    lineHeight: 16,
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
  menuItemText: {
    fontSize: 16,
    color: COLORS.text,
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  menuItemValue: {
    fontSize: 14,
    color: COLORS.textSecondary,
    marginRight: 8,
  },
  menuItemArrow: {
    fontSize: 22,
    color: COLORS.textLight,
  },
  versionText: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  placeItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.surfaceVariant,
  },
  placeIcon: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: COLORS.surfaceVariant,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  placeIconText: {
    fontSize: 16,
  },
  placeInfo: {
    flex: 1,
  },
  placeName: {
    fontSize: 15,
    fontWeight: '600',
    color: COLORS.text,
  },
  placeAddress: {
    fontSize: 12,
    color: COLORS.textSecondary,
    marginTop: 2,
  },
  addPlaceButton: {
    paddingHorizontal: 16,
    paddingVertical: 16,
    alignItems: 'center',
  },
  addPlaceText: {
    fontSize: 14,
    color: COLORS.primary,
    fontWeight: '600',
  },
});

export default SettingsScreen;
