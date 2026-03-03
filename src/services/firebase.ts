import { initializeApp, getApps, getApp } from 'firebase/app';
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { Platform } from 'react-native';

const firebaseConfig = {
    apiKey: Platform.select({
        ios: "AIzaSyCTjHWm_RkeMbeTjlusK92IUBMVL5jcxLU",
        android: "AIzaSyCMMt-uvTjolWtHOVPdbfJ0_rwMndzt10I",
        default: "AIzaSyAiCRqKono7N2KxkCGpPD9lAlHRx-AUGKY" // Web/Default
    }),
    authDomain: "gogoma-2.firebaseapp.com",
    databaseURL: "https://gogoma-2-default-rtdb.firebaseio.com",
    projectId: "gogoma-2",
    storageBucket: "gogoma-2.firebasestorage.app",
    messagingSenderId: "50833835620",
    appId: Platform.select({
        ios: "1:50833835620:ios:aca57e76f9adbf4cad8171",
        android: "1:50833835620:android:68a930bb70443b33ad8171",
        default: "1:50833835620:web:c63b6def7f1ccc23ad8171"
    })
};

const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
const db = initializeFirestore(app, {
    localCache: persistentLocalCache({
        tabManager: persistentMultipleTabManager()
    })
});

const storage = getStorage(app);

export { db, storage };
export default app;
