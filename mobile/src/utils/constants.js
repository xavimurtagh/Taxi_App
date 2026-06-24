// API endpoints are configurable via Expo public env vars so production builds
// point at the deployed API instead of localhost. Set EXPO_PUBLIC_API_URL and
// EXPO_PUBLIC_SOCKET_URL in eas.json / app config for staging and production.
// The localhost defaults are for local development only (use your machine's LAN
// IP, e.g. http://192.168.x.x:3000, when testing on a physical device).
export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || 'http://localhost:3000';

export const API_URL =
  process.env.EXPO_PUBLIC_API_URL || `${SOCKET_URL}/api/v1`;

export const VEHICLE_TYPES = [
  {
    id: 'economy',
    label: 'Economy',
    icon: 'car-outline',
    multiplier: '1x',
  },
  {
    id: 'comfort',
    label: 'Comfort',
    icon: 'car-sport',
    multiplier: '1.3x',
  },
  {
    id: 'xl',
    label: 'XL',
    icon: 'car',
    multiplier: '1.5x',
  },
  {
    id: 'accessible',
    label: 'Accessible',
    icon: 'accessibility',
    multiplier: '1x',
  },
  {
    id: 'pool',
    label: 'Pool',
    icon: 'people',
    multiplier: '0.7x',
  },
];

export const RIDE_STATUSES = {
  REQUESTED: { key: 'requested', label: 'Requested', color: '#FF9800' },
  MATCHING: { key: 'matching', label: 'Finding Driver', color: '#2196F3' },
  ACCEPTED: { key: 'accepted', label: 'Driver Accepted', color: '#4CAF50' },
  ARRIVING: { key: 'arriving', label: 'Driver Arriving', color: '#2196F3' },
  ARRIVED: { key: 'arrived', label: 'Driver Arrived', color: '#673AB7' },
  IN_PROGRESS: { key: 'in_progress', label: 'In Progress', color: '#2E7D32' },
  COMPLETED: { key: 'completed', label: 'Completed', color: '#4CAF50' },
  CANCELLED: { key: 'cancelled', label: 'Cancelled', color: '#F44336' },
  NO_DRIVERS: { key: 'no_drivers', label: 'No Drivers Available', color: '#9E9E9E' },
};

export const COLORS = {
  primary: '#2E7D32',
  primaryLight: '#4CAF50',
  primaryDark: '#1B5E20',
  secondary: '#FF9800',
  secondaryLight: '#FFB74D',
  secondaryDark: '#F57C00',
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceVariant: '#F0F0F0',
  text: '#212121',
  textSecondary: '#757575',
  textLight: '#BDBDBD',
  textOnPrimary: '#FFFFFF',
  border: '#E0E0E0',
  error: '#F44336',
  errorLight: '#FFEBEE',
  success: '#4CAF50',
  successLight: '#E8F5E9',
  warning: '#FF9800',
  warningLight: '#FFF3E0',
  info: '#2196F3',
  infoLight: '#E3F2FD',
  star: '#FFC107',
  disabled: '#BDBDBD',
  overlay: 'rgba(0, 0, 0, 0.5)',
  mapRoute: '#2E7D32',
  online: '#4CAF50',
  offline: '#9E9E9E',
};

export const MAP_STYLE = [
  {
    featureType: 'poi',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
  {
    featureType: 'transit',
    elementType: 'labels',
    stylers: [{ visibility: 'off' }],
  },
];
