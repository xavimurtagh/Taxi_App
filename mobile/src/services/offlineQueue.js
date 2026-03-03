import AsyncStorage from '@react-native-async-storage/async-storage';
import { post, put } from './api';

const QUEUE_STORAGE_KEY = '@openride_offline_queue';

/**
 * Action types supported by the offline queue.
 */
export const ACTION_TYPES = {
  LOCATION_UPDATE: 'location_update',
  RIDE_ACCEPT: 'ride_accept',
  RIDE_COMPLETE: 'ride_complete',
  RIDE_CANCEL: 'ride_cancel',
};

/**
 * API endpoint mapping for each action type.
 */
const ACTION_ENDPOINTS = {
  [ACTION_TYPES.LOCATION_UPDATE]: {
    method: 'put',
    getUrl: (payload) => `/drivers/location`,
  },
  [ACTION_TYPES.RIDE_ACCEPT]: {
    method: 'post',
    getUrl: (payload) => `/rides/${payload.rideId}/accept`,
  },
  [ACTION_TYPES.RIDE_COMPLETE]: {
    method: 'post',
    getUrl: (payload) => `/rides/${payload.rideId}/complete`,
  },
  [ACTION_TYPES.RIDE_CANCEL]: {
    method: 'post',
    getUrl: (payload) => `/rides/${payload.rideId}/cancel`,
  },
};

/**
 * Read the current queue from AsyncStorage.
 * @returns {Promise<Array>} The queued actions.
 */
const readQueue = async () => {
  try {
    const data = await AsyncStorage.getItem(QUEUE_STORAGE_KEY);
    return data ? JSON.parse(data) : [];
  } catch (error) {
    console.warn('[OfflineQueue] Failed to read queue:', error.message);
    return [];
  }
};

/**
 * Write the queue to AsyncStorage.
 * @param {Array} queue - The queue to persist.
 */
const writeQueue = async (queue) => {
  try {
    await AsyncStorage.setItem(QUEUE_STORAGE_KEY, JSON.stringify(queue));
  } catch (error) {
    console.warn('[OfflineQueue] Failed to write queue:', error.message);
  }
};

/**
 * Check if the device appears to be online by making a lightweight fetch.
 * @returns {Promise<boolean>} True if online, false otherwise.
 */
export const isOnline = async () => {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const response = await fetch('https://clients3.google.com/generate_204', {
      method: 'HEAD',
      signal: controller.signal,
    });

    clearTimeout(timeoutId);
    return response.status >= 200 && response.status < 400;
  } catch (error) {
    return false;
  }
};

/**
 * Queue an action for later processing when the device is offline.
 * @param {string} actionType - One of the ACTION_TYPES values.
 * @param {object} payload - The action payload data.
 * @returns {Promise<void>}
 */
export const queueAction = async (actionType, payload) => {
  if (!ACTION_ENDPOINTS[actionType]) {
    console.warn(`[OfflineQueue] Unknown action type: ${actionType}`);
    return;
  }

  const action = {
    id: `${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
    type: actionType,
    payload,
    timestamp: new Date().toISOString(),
    retries: 0,
  };

  const queue = await readQueue();
  queue.push(action);
  await writeQueue(queue);

  console.log(
    `[OfflineQueue] Queued action: ${actionType} (queue size: ${queue.length})`
  );
};

/**
 * Process all queued actions in FIFO order.
 * Actions that fail due to network errors are kept in the queue for retry.
 * Actions that fail due to server errors (4xx/5xx) are removed after max retries.
 * @returns {Promise<{ processed: number, failed: number, remaining: number }>}
 */
export const processQueue = async () => {
  const online = await isOnline();
  if (!online) {
    console.log('[OfflineQueue] Device is offline, skipping queue processing.');
    const queue = await readQueue();
    return { processed: 0, failed: 0, remaining: queue.length };
  }

  const queue = await readQueue();
  if (queue.length === 0) {
    return { processed: 0, failed: 0, remaining: 0 };
  }

  console.log(`[OfflineQueue] Processing ${queue.length} queued actions...`);

  const MAX_RETRIES = 3;
  let processed = 0;
  let failed = 0;
  const remainingQueue = [];

  for (const action of queue) {
    const endpoint = ACTION_ENDPOINTS[action.type];
    if (!endpoint) {
      // Unknown action type; discard
      failed++;
      continue;
    }

    try {
      const url = endpoint.getUrl(action.payload);
      const data = { ...action.payload };

      // Remove rideId from payload body since it is in the URL
      delete data.rideId;

      if (endpoint.method === 'post') {
        await post(url, data);
      } else if (endpoint.method === 'put') {
        await put(url, data);
      }

      processed++;
      console.log(`[OfflineQueue] Processed: ${action.type} (${action.id})`);
    } catch (error) {
      const isNetworkError =
        !error.response || error.code === 'ECONNABORTED' || error.message === 'Network Error';

      if (isNetworkError) {
        // Network error: keep in queue for retry
        remainingQueue.push(action);
        console.log(
          `[OfflineQueue] Network error for ${action.type}, will retry later.`
        );
        // Stop processing further if network is down
        break;
      }

      // Server error: retry up to MAX_RETRIES
      action.retries = (action.retries || 0) + 1;
      if (action.retries < MAX_RETRIES) {
        remainingQueue.push(action);
        console.log(
          `[OfflineQueue] Server error for ${action.type}, retry ${action.retries}/${MAX_RETRIES}.`
        );
      } else {
        failed++;
        console.log(
          `[OfflineQueue] Discarding ${action.type} after ${MAX_RETRIES} retries.`
        );
      }
    }
  }

  await writeQueue(remainingQueue);

  const result = {
    processed,
    failed,
    remaining: remainingQueue.length,
  };

  console.log(
    `[OfflineQueue] Done. Processed: ${processed}, Failed: ${failed}, Remaining: ${remainingQueue.length}`
  );

  return result;
};

/**
 * Get the current number of pending actions in the queue.
 * @returns {Promise<number>}
 */
export const getQueueSize = async () => {
  const queue = await readQueue();
  return queue.length;
};

/**
 * Clear all actions from the queue.
 * @returns {Promise<void>}
 */
export const clearQueue = async () => {
  await writeQueue([]);
  console.log('[OfflineQueue] Queue cleared.');
};

/**
 * Set up automatic queue processing on reconnection.
 * Call this once when the app initializes. It periodically checks
 * connectivity and processes the queue when back online.
 * @param {number} intervalMs - Check interval in milliseconds (default 30000).
 * @returns {function} A cleanup function to stop the auto-processing.
 */
export const setupAutoProcess = (intervalMs = 30000) => {
  let wasOffline = false;

  const intervalId = setInterval(async () => {
    const online = await isOnline();

    if (online && wasOffline) {
      console.log('[OfflineQueue] Back online, processing queued actions...');
      await processQueue();
    }

    wasOffline = !online;
  }, intervalMs);

  // Also try to process on initial setup
  processQueue().catch(() => {});

  return () => {
    clearInterval(intervalId);
  };
};
