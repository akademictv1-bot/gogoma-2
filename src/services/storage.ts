import * as SecureStore from 'expo-secure-store';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

export const saveUserSession = async (key: string, value: any) => {
    const stringValue = JSON.stringify(value);
    if (Platform.OS !== 'web') {
        await SecureStore.setItemAsync(key, stringValue);
    } else {
        await AsyncStorage.setItem(key, stringValue);
    }
};

export const getUserSession = async (key: string) => {
    let result;
    if (Platform.OS !== 'web') {
        result = await SecureStore.getItemAsync(key);
    } else {
        result = await AsyncStorage.getItem(key);
    }
    return result ? JSON.parse(result) : null;
};

export const clearUserSession = async (key: string) => {
    if (Platform.OS !== 'web') {
        await SecureStore.deleteItemAsync(key);
    } else {
        await AsyncStorage.removeItem(key);
    }
};
