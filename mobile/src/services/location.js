import * as Location from 'expo-location';

let locationSubscription = null;

/**
 * Request foreground and background location permissions.
 * @returns {Promise<boolean>} true if permissions are granted
 */
export const requestLocationPermissions = async () => {
  const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

  if (foregroundStatus !== 'granted') {
    console.warn('[Location] Foreground permission not granted');
    return false;
  }

  const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();

  if (backgroundStatus !== 'granted') {
    console.warn('[Location] Background permission not granted (foreground OK)');
    // Foreground is enough for basic functionality
  }

  return true;
};

/**
 * Get the current device location (one-time, high accuracy).
 * @returns {Promise<{latitude: number, longitude: number}>}
 */
export const getCurrentLocation = async () => {
  const location = await Location.getCurrentPositionAsync({
    accuracy: Location.Accuracy.High,
  });

  return {
    latitude: location.coords.latitude,
    longitude: location.coords.longitude,
  };
};

/**
 * Start continuous location tracking.
 * Uses balanced accuracy for battery efficiency.
 * @param {function} callback - Called with { latitude, longitude, heading } on each update
 * @param {number} intervalMs - Minimum interval between updates in ms (default 5000)
 * @returns {Promise<void>}
 */
export const startLocationTracking = async (callback, intervalMs = 5000) => {
  // Stop any existing subscription first
  if (locationSubscription) {
    await stopLocationTracking();
  }

  locationSubscription = await Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.Balanced,
      timeInterval: intervalMs,
      distanceInterval: 10, // minimum distance in metres between updates
    },
    (location) => {
      callback({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        heading: location.coords.heading,
      });
    }
  );
};

/**
 * Stop continuous location tracking.
 */
export const stopLocationTracking = async () => {
  if (locationSubscription) {
    locationSubscription.remove();
    locationSubscription = null;
  }
};
