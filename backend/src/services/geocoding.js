import { env } from '../config/env.js';

const GEOCODING_URL = env.GEOCODING_URL || 'https://nominatim.openstreetmap.org';

/**
 * Search for addresses (autocomplete)
 * Uses Nominatim/Photon API for geocoding
 */
export async function searchAddress(queryText, lat = null, lng = null, limit = 5) {
  try {
    const params = new URLSearchParams({
      q: queryText,
      format: 'json',
      addressdetails: '1',
      limit: limit.toString(),
    });

    // Bias results towards user's location if available
    if (lat && lng) {
      params.append('viewbox', `${lng - 0.5},${lat + 0.5},${lng + 0.5},${lat - 0.5}`);
      params.append('bounded', '0');
    }

    const response = await fetch(`${GEOCODING_URL}/search?${params}`, {
      headers: {
        'User-Agent': 'OpenRide/1.0 (community ride-sharing)',
      },
    });

    if (!response.ok) {
      throw new Error(`Geocoding API returned ${response.status}`);
    }

    const results = await response.json();

    return results.map(r => ({
      displayName: r.display_name,
      lat: parseFloat(r.lat),
      lng: parseFloat(r.lon),
      type: r.type,
      address: {
        road: r.address?.road,
        city: r.address?.city || r.address?.town || r.address?.village,
        state: r.address?.state,
        postcode: r.address?.postcode,
        country: r.address?.country,
      },
    }));
  } catch (error) {
    console.error('[Geocoding] Search failed:', error.message);
    return [];
  }
}

/**
 * Reverse geocode coordinates to an address
 */
export async function reverseGeocode(lat, lng) {
  try {
    const params = new URLSearchParams({
      lat: lat.toString(),
      lon: lng.toString(),
      format: 'json',
      addressdetails: '1',
    });

    const response = await fetch(`${GEOCODING_URL}/reverse?${params}`, {
      headers: {
        'User-Agent': 'OpenRide/1.0 (community ride-sharing)',
      },
    });

    if (!response.ok) {
      throw new Error(`Reverse geocoding returned ${response.status}`);
    }

    const result = await response.json();

    return {
      displayName: result.display_name,
      address: {
        road: result.address?.road,
        houseNumber: result.address?.house_number,
        city: result.address?.city || result.address?.town || result.address?.village,
        state: result.address?.state,
        postcode: result.address?.postcode,
        country: result.address?.country,
      },
    };
  } catch (error) {
    console.error('[Geocoding] Reverse lookup failed:', error.message);
    return {
      displayName: `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
      address: {},
    };
  }
}

/**
 * Geocode an address string to coordinates
 */
export async function geocodeAddress(address) {
  const results = await searchAddress(address, null, null, 1);
  if (results.length === 0) {
    return null;
  }
  return {
    lat: results[0].lat,
    lng: results[0].lng,
    displayName: results[0].displayName,
  };
}
