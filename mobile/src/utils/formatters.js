/**
 * Format a numeric amount as USD currency.
 * @param {number} amount
 * @returns {string} e.g. "$12.50"
 */
export const formatCurrency = (amount) => {
  if (amount == null || isNaN(amount)) return '$0.00';
  return `$${Number(amount).toFixed(2)}`;
};

/**
 * Format a distance in kilometres into a human-readable string.
 * Distances under 1 km are shown in metres.
 * @param {number} km
 * @returns {string} e.g. "2.3 km" or "450 m"
 */
export const formatDistance = (km) => {
  if (km == null || isNaN(km)) return '0 m';
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  return `${km.toFixed(1)} km`;
};

/**
 * Format a duration given in minutes.
 * @param {number} minutes
 * @returns {string} e.g. "5 min" or "1 hr 23 min"
 */
export const formatDuration = (minutes) => {
  if (minutes == null || isNaN(minutes)) return '0 min';
  const mins = Math.round(minutes);
  if (mins < 60) {
    return `${mins} min`;
  }
  const hours = Math.floor(mins / 60);
  const remaining = mins % 60;
  if (remaining === 0) {
    return `${hours} hr`;
  }
  return `${hours} hr ${remaining} min`;
};

/**
 * Format a date as a relative string (e.g. "2 min ago") when recent,
 * or as an absolute date string when older.
 * @param {string|Date} date
 * @returns {string}
 */
export const formatDate = (date) => {
  if (!date) return '';
  const now = new Date();
  const then = new Date(date);
  const diffMs = now - then;
  const diffSec = Math.floor(diffMs / 1000);
  const diffMin = Math.floor(diffSec / 60);
  const diffHr = Math.floor(diffMin / 60);
  const diffDays = Math.floor(diffHr / 24);

  if (diffSec < 60) return 'Just now';
  if (diffMin < 60) return `${diffMin} min ago`;
  if (diffHr < 24) return `${diffHr} hr ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;

  return then.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: then.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

/**
 * Format a numeric rating with a star character.
 * @param {number} rating
 * @returns {string} e.g. "4.8 ★"
 */
export const formatRating = (rating) => {
  if (rating == null || isNaN(rating)) return '0.0 ★';
  return `${Number(rating).toFixed(1)} ★`;
};

/**
 * Mask a phone number for privacy display.
 * @param {string} phone
 * @returns {string} e.g. "***-***-4567"
 */
export const formatPhone = (phone) => {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 4) return phone;
  const last4 = digits.slice(-4);
  return `***-***-${last4}`;
};
