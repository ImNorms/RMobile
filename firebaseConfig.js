// firebaseConfig.js
import { initializeApp, getApps, getApp } from "firebase/app";
import {
  initializeAuth,
  getReactNativePersistence,
} from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import ReactNativeAsyncStorage from "@react-native-async-storage/async-storage";

const firebaseConfig = {
  apiKey: "AIzaSyCgBbhvk9TANfxq81bWcPsnwnfVoKcHRfc",
  authDomain: "hoa-appp.firebaseapp.com",
  projectId: "hoa-appp",
  storageBucket: "hoa-appp.firebasestorage.app",
  messagingSenderId: "55802883937",
  appId: "1:55802883937:web:ce7e8a87acaee625275f20"
};

// Ensure only one app is initialized
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// ✅ Initialize auth with AsyncStorage persistence
const auth = initializeAuth(app, {
  persistence: getReactNativePersistence(ReactNativeAsyncStorage),
});

// Firestore
const db = getFirestore(app);

export { app, auth, db };
