import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const configured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId,
);

// 避免未填 .env 時立刻因無效 Firebase 設定造成難解的錯誤。
const safeConfig = configured
  ? firebaseConfig
  : {
      apiKey: 'missing-config',
      authDomain: 'invalid.example',
      projectId: 'toasteism-not-configured',
      appId: '1:123456789:web:missing',
    };

const app = initializeApp(safeConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
