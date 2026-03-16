import * as SecureStore from 'expo-secure-store';

export async function getStoredString(key: string) {
  try {
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function setStoredString(key: string, value: string) {
  await SecureStore.setItemAsync(key, value);
}

export async function removeStoredString(key: string) {
  await SecureStore.deleteItemAsync(key);
}
