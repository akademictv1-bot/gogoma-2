import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

export const firebaseConfig = {
    apiKey: Platform.select({
        ios: process.env.EXPO_PUBLIC_FIREBASE_API_KEY_IOS,
        android: process.env.EXPO_PUBLIC_FIREBASE_API_KEY_ANDROID,
        default: process.env.EXPO_PUBLIC_FIREBASE_API_KEY_WEB,
    }),
    authDomain: process.env.EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN,
    databaseURL: process.env.EXPO_PUBLIC_FIREBASE_DATABASE_URL,
    projectId: process.env.EXPO_PUBLIC_FIREBASE_PROJECT_ID,
    storageBucket: process.env.EXPO_PUBLIC_FIREBASE_STORAGE_BUCKET,
    messagingSenderId: process.env.EXPO_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
    appId: Platform.select({
        ios: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_IOS,
        android: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_ANDROID,
        default: process.env.EXPO_PUBLIC_FIREBASE_APP_ID_WEB,
    }),
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

const storage = getStorage(app);

const auth = getAuth(app);

export { db, storage, auth };
export default app;
