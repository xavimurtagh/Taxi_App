const API_BASE = '/api/v1';

export function getToken() {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('openride_token');
}

export function setToken(token) {
  if (typeof window === 'undefined') return;
  localStorage.setItem('openride_token', token);
}

export function removeToken() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem('openride_token');
}

export function isAuthenticated() {
  return !!getToken();
}

export async function fetchAPI(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const url = `${API_BASE}${path}`;

  try {
    const response = await fetch(url, {
      ...options,
      headers,
    });

    if (response.status === 401) {
      removeToken();
      if (typeof window !== 'undefined') {
        window.dispatchEvent(new CustomEvent('openride:unauthorized'));
      }
    }

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const error = new Error(errorData.error || errorData.message || `Request failed with status ${response.status}`);
      error.status = response.status;
      error.data = errorData;
      throw error;
    }

    if (response.status === 204) {
      return null;
    }

    return await response.json();
  } catch (err) {
    if (err.status) throw err;
    const error = new Error('Network error. Please check your connection.');
    error.status = 0;
    throw error;
  }
}

export function formatCurrency(amount) {
  if (amount == null) return '$0.00';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

export function formatNumber(num) {
  if (num == null) return '0';
  return new Intl.NumberFormat('en-US').format(num);
}

export function formatDate(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr) {
  if (!dateStr) return '';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeRemaining(endDateStr) {
  if (!endDateStr) return '';
  const now = new Date();
  const end = new Date(endDateStr);
  const diff = end - now;

  if (diff <= 0) return 'Ended';

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

  if (days > 0) return `${days}d ${hours}h remaining`;
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
  if (hours > 0) return `${hours}h ${minutes}m remaining`;
  return `${minutes}m remaining`;
}
