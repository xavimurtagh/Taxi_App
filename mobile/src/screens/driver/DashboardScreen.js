import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  Animated,
} from 'react-native';
import { COLORS } from '../../utils/constants';
import { formatCurrency, formatRating, formatDistance } from '../../utils/formatters';
import useLocationStore from '../../store/locationStore';
import { getSocket } from '../../services/socket';
import { post } from '../../services/api';
import MapComponent from '../../components/Map';

const DashboardScreen = ({ navigation }) => {
  const [isOnline, setIsOnline] = useState(false);
  const [incomingRequest, setIncomingRequest] = useState(null);
  const [countdown, setCountdown] = useState(15);
  const [todayStats, setTodayStats] = useState({
    rides: 0,
    hours: 0,
    earnings: 0,
  });

  const countdownRef = useRef(null);
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const { currentLocation, startTracking, stopTracking } = useLocationStore();

  useEffect(() => {
    return () => {
      if (countdownRef.current) clearInterval(countdownRef.current);
    };
  }, []);

  useEffect(() => {
    const socket = getSocket();
    if (socket && isOnline) {
      socket.on('ride:new_request', (request) => {
        setIncomingRequest(request);
        setCountdown(15);
        startCountdown();
        startPulse();
      });

      return () => {
        socket.off('ride:new_request');
      };
    }
  }, [isOnline]);

  const startCountdown = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    countdownRef.current = setInterval(() => {
      setCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          setIncomingRequest(null);
          return 15;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const startPulse = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.05,
          duration: 500,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  };

  const toggleOnline = async () => {
    const newStatus = !isOnline;
    setIsOnline(newStatus);

    const socket = getSocket();
    if (newStatus) {
      await startTracking();
      if (socket) {
        socket.emit('driver:go_online', { location: currentLocation });
      }
    } else {
      await stopTracking();
      if (socket) {
        socket.emit('driver:go_offline');
      }
      setIncomingRequest(null);
      if (countdownRef.current) clearInterval(countdownRef.current);
    }
  };

  const handleAcceptRide = async () => {
    if (!incomingRequest) return;
    if (countdownRef.current) clearInterval(countdownRef.current);

    try {
      const rideId = incomingRequest.rideId || incomingRequest.id || incomingRequest._id;
      await post(`/rides/${rideId}/accept`);

      const socket = getSocket();
      if (socket) {
        socket.emit('ride:accept', { rideId });
      }

      const rideData = {
        ...incomingRequest,
        id: rideId,
        status: 'accepted',
      };

      setIncomingRequest(null);
      navigation.navigate('Navigation', { ride: rideData });
    } catch (error) {
      Alert.alert('Error', 'Failed to accept ride. It may have been taken by another driver.');
      setIncomingRequest(null);
    }
  };

  const handleDeclineRide = () => {
    if (countdownRef.current) clearInterval(countdownRef.current);
    const socket = getSocket();
    if (socket && incomingRequest) {
      const rideId = incomingRequest.rideId || incomingRequest.id || incomingRequest._id;
      socket.emit('ride:decline', { rideId });
    }
    setIncomingRequest(null);
    setCountdown(15);
  };

  const markers = [];
  if (currentLocation) {
    markers.push({
      id: 'me',
      coordinate: currentLocation,
      title: 'You',
      type: 'driver',
    });
  }

  return (
    <View style={styles.container}>
      {/* Map */}
      {isOnline && (
        <View style={styles.mapContainer}>
          <MapComponent
            markers={markers}
            showUserLocation
            initialRegion={
              currentLocation
                ? {
                    ...currentLocation,
                    latitudeDelta: 0.02,
                    longitudeDelta: 0.02,
                  }
                : undefined
            }
          />
        </View>
      )}

      {/* Offline State */}
      {!isOnline && (
        <View style={styles.offlineContainer}>
          <Text style={styles.offlineIcon}>{'\u{1F697}'}</Text>
          <Text style={styles.offlineTitle}>You are offline</Text>
          <Text style={styles.offlineSubtitle}>
            Go online to start receiving ride requests
          </Text>
        </View>
      )}

      {/* Online Toggle */}
      <View style={styles.toggleContainer}>
        <TouchableOpacity
          style={[
            styles.toggleButton,
            isOnline ? styles.toggleOnline : styles.toggleOffline,
          ]}
          onPress={toggleOnline}
          activeOpacity={0.8}
        >
          <View
            style={[
              styles.toggleIndicator,
              isOnline ? styles.indicatorOnline : styles.indicatorOffline,
            ]}
          />
          <Text
            style={[
              styles.toggleText,
              isOnline ? styles.toggleTextOnline : styles.toggleTextOffline,
            ]}
          >
            {isOnline ? 'GO OFFLINE' : 'GO ONLINE'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Status */}
      {isOnline && !incomingRequest && (
        <View style={styles.statusBanner}>
          <View style={styles.statusPulse} />
          <Text style={styles.statusText}>Waiting for rides...</Text>
        </View>
      )}

      {/* Today's Summary */}
      <View style={styles.summaryContainer}>
        <Text style={styles.summaryTitle}>Today</Text>
        <View style={styles.summaryGrid}>
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>{todayStats.rides}</Text>
            <Text style={styles.summaryLabel}>Rides</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {todayStats.hours.toFixed(1)}h
            </Text>
            <Text style={styles.summaryLabel}>Online</Text>
          </View>
          <View style={styles.summaryDivider} />
          <View style={styles.summaryItem}>
            <Text style={styles.summaryValue}>
              {formatCurrency(todayStats.earnings)}
            </Text>
            <Text style={styles.summaryLabel}>Earned</Text>
          </View>
        </View>
      </View>

      {/* Incoming Request Overlay */}
      {incomingRequest && (
        <Animated.View
          style={[
            styles.requestOverlay,
            { transform: [{ scale: pulseAnim }] },
          ]}
        >
          <View style={styles.requestCard}>
            <View style={styles.requestHeader}>
              <Text style={styles.requestTitle}>New Ride Request</Text>
              <View style={styles.countdownCircle}>
                <Text style={styles.countdownText}>{countdown}</Text>
              </View>
            </View>

            {/* Passenger Info */}
            <View style={styles.requestPassenger}>
              <View style={styles.passengerAvatar}>
                <Text style={styles.passengerAvatarText}>
                  {(incomingRequest.passenger?.firstName || 'P')[0]}
                </Text>
              </View>
              <View style={styles.passengerInfo}>
                <Text style={styles.passengerName}>
                  {incomingRequest.passenger?.firstName || 'Passenger'}{' '}
                  {incomingRequest.passenger?.lastName?.[0] || ''}.
                </Text>
                <Text style={styles.passengerRating}>
                  {formatRating(incomingRequest.passenger?.rating || 4.5)}
                </Text>
              </View>
            </View>

            {/* Ride Details */}
            <View style={styles.requestDetails}>
              <View style={styles.requestDetailRow}>
                <Text style={styles.requestDetailLabel}>Pickup distance</Text>
                <Text style={styles.requestDetailValue}>
                  {formatDistance(incomingRequest.pickupDistance || 1.2)}
                </Text>
              </View>
              <View style={styles.requestDetailRow}>
                <Text style={styles.requestDetailLabel}>Estimated fare</Text>
                <Text style={styles.requestDetailValue}>
                  {formatCurrency(incomingRequest.estimatedFare || 12.5)}
                </Text>
              </View>
            </View>

            {/* Actions */}
            <View style={styles.requestActions}>
              <TouchableOpacity
                style={styles.declineButton}
                onPress={handleDeclineRide}
              >
                <Text style={styles.declineButtonText}>Decline</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.acceptButton}
                onPress={handleAcceptRide}
              >
                <Text style={styles.acceptButtonText}>Accept</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Animated.View>
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: COLORS.background,
  },
  mapContainer: {
    flex: 1,
  },
  offlineContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  offlineIcon: {
    fontSize: 64,
    marginBottom: 16,
  },
  offlineTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 8,
  },
  offlineSubtitle: {
    fontSize: 14,
    color: COLORS.textSecondary,
    textAlign: 'center',
  },
  toggleContainer: {
    position: 'absolute',
    top: 60,
    alignSelf: 'center',
    zIndex: 10,
  },
  toggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: 28,
    borderRadius: 30,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 6,
  },
  toggleOnline: {
    backgroundColor: COLORS.primary,
  },
  toggleOffline: {
    backgroundColor: COLORS.surface,
    borderWidth: 2,
    borderColor: COLORS.primary,
  },
  toggleIndicator: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 10,
  },
  indicatorOnline: {
    backgroundColor: COLORS.textOnPrimary,
  },
  indicatorOffline: {
    backgroundColor: COLORS.offline,
  },
  toggleText: {
    fontSize: 16,
    fontWeight: '800',
    letterSpacing: 1,
  },
  toggleTextOnline: {
    color: COLORS.textOnPrimary,
  },
  toggleTextOffline: {
    color: COLORS.primary,
  },
  statusBanner: {
    position: 'absolute',
    top: 120,
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.surface,
    paddingVertical: 10,
    paddingHorizontal: 20,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  statusPulse: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: COLORS.online,
    marginRight: 8,
  },
  statusText: {
    fontSize: 14,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  summaryContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: COLORS.surface,
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    padding: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 4,
  },
  summaryTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.text,
    marginBottom: 16,
  },
  summaryGrid: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  summaryItem: {
    flex: 1,
    alignItems: 'center',
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
    color: COLORS.primary,
    marginBottom: 4,
  },
  summaryLabel: {
    fontSize: 12,
    color: COLORS.textSecondary,
    fontWeight: '500',
  },
  summaryDivider: {
    width: 1,
    height: 36,
    backgroundColor: COLORS.border,
  },
  // Request Overlay
  requestOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: COLORS.overlay,
    justifyContent: 'center',
    paddingHorizontal: 20,
    zIndex: 20,
  },
  requestCard: {
    backgroundColor: COLORS.surface,
    borderRadius: 20,
    padding: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 12,
  },
  requestHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  requestTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: COLORS.text,
  },
  countdownCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.warningLight,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: COLORS.warning,
  },
  countdownText: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.secondaryDark,
  },
  requestPassenger: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  passengerAvatar: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: COLORS.info,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 12,
  },
  passengerAvatarText: {
    color: COLORS.textOnPrimary,
    fontSize: 20,
    fontWeight: '700',
  },
  passengerInfo: {
    flex: 1,
  },
  passengerName: {
    fontSize: 16,
    fontWeight: '600',
    color: COLORS.text,
  },
  passengerRating: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  requestDetails: {
    backgroundColor: COLORS.surfaceVariant,
    borderRadius: 12,
    padding: 16,
    marginBottom: 20,
  },
  requestDetailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 4,
  },
  requestDetailLabel: {
    fontSize: 14,
    color: COLORS.textSecondary,
  },
  requestDetailValue: {
    fontSize: 14,
    fontWeight: '600',
    color: COLORS.text,
  },
  requestActions: {
    flexDirection: 'row',
    gap: 12,
  },
  declineButton: {
    flex: 1,
    backgroundColor: COLORS.errorLight,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  declineButtonText: {
    color: COLORS.error,
    fontSize: 16,
    fontWeight: '700',
  },
  acceptButton: {
    flex: 2,
    backgroundColor: COLORS.primary,
    borderRadius: 12,
    paddingVertical: 16,
    alignItems: 'center',
  },
  acceptButtonText: {
    color: COLORS.textOnPrimary,
    fontSize: 16,
    fontWeight: '700',
  },
});

export default DashboardScreen;
