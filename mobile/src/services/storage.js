import * as SecureStore from 'expo-secure-store';

const KEYS = {
  TOKEN: 'openride_token',
  REFRESH_TOKEN: 'openride_refresh_token',
  USER_ROLE: 'openride_user_role',
};

export const saveToken = async (token) => {
  await SecureStore.setItemAsync(KEYS.TOKEN, token);
};

export const getToken = async () => {
  return await SecureStore.getItemAsync(KEYS.TOKEN);
};

export const removeToken = async () => {
  await SecureStore.deleteItemAsync(KEYS.TOKEN);
};

export const saveRefreshToken = async (token) => {
  await SecureStore.setItemAsync(KEYS.REFRESH_TOKEN, token);
};

export const getRefreshToken = async () => {
  return await SecureStore.getItemAsync(KEYS.REFRESH_TOKEN);
};

export const removeRefreshToken = async () => {
  await SecureStore.deleteItemAsync(KEYS.REFRESH_TOKEN);
};

export const saveUserRole = async (role) => {
  await SecureStore.setItemAsync(KEYS.USER_ROLE, role);
};

export const getUserRole = async () => {
  return await SecureStore.getItemAsync(KEYS.USER_ROLE);
};
