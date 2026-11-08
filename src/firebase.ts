import AsyncStorage from '@react-native-async-storage/async-storage';
import { getApp, getApps, initializeApp } from 'firebase/app';
import { getAuth, initializeAuth, getReactNativePersistence, Auth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';
import { Platform } from 'react-native';

// These values identify the Firebase project; they are not secrets.
// Access is controlled by the Firestore security rules (see firestore.rules).
const firebaseConfig = {
  apiKey: 'AIzaSyD3vuo1deY_NVTacWUQ3FMyKab656YtSIY',
  authDomain: 'grocery-and-receipt.firebaseapp.com',
  projectId: 'grocery-and-receipt',
  storageBucket: 'grocery-and-receipt.firebasestorage.app',
  messagingSenderId: '195188366863',
  appId: '1:195188366863:web:83e07fb46a96a9643c4d7a',
};

const isFirstInit = getApps().length === 0;
export const app = isFirstInit ? initializeApp(firebaseConfig) : getApp();

// Persist the (anonymous) sign-in so each phone keeps the same identity across launches.
// (getReactNativePersistence only exists in Firebase's native build; web uses its default persistence.)
export const auth: Auth = isFirstInit && Platform.OS !== 'web'
  ? initializeAuth(app, { persistence: getReactNativePersistence(AsyncStorage) })
  : getAuth(app);

export const db = getFirestore(app);
