import { FirebaseApp, getApps, initializeApp } from 'firebase/app';
import { Auth, GoogleAuthProvider, User, getAuth, onAuthStateChanged, signInWithPopup, signOut } from 'firebase/auth';

const env = (import.meta as any).env || {};

const firebaseConfig = {
  apiKey: String(env.VITE_FIREBASE_API_KEY || ''),
  authDomain: String(env.VITE_FIREBASE_AUTH_DOMAIN || ''),
  projectId: String(env.VITE_FIREBASE_PROJECT_ID || ''),
  appId: String(env.VITE_FIREBASE_APP_ID || ''),
  storageBucket: String(env.VITE_FIREBASE_STORAGE_BUCKET || ''),
  messagingSenderId: String(env.VITE_FIREBASE_MESSAGING_SENDER_ID || '')
};

export const isFirebaseAuthConfigured = Boolean(
  firebaseConfig.apiKey && firebaseConfig.authDomain && firebaseConfig.projectId && firebaseConfig.appId
);

let app: FirebaseApp | null = null;
let auth: Auth | null = null;

function getFirebaseAuth(): Auth {
  if (!isFirebaseAuthConfigured) throw new Error('Firebase sign-in is not configured for this deployment.');
  if (!app) app = getApps()[0] || initializeApp(firebaseConfig);
  if (!auth) auth = getAuth(app);
  return auth;
}

export function subscribeToAuthState(callback: (user: User | null) => void) {
  if (!isFirebaseAuthConfigured) {
    callback(null);
    return () => undefined;
  }
  return onAuthStateChanged(getFirebaseAuth(), callback);
}

export async function signInWithGoogle(): Promise<User> {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  const credential = await signInWithPopup(getFirebaseAuth(), provider);
  return credential.user;
}

export async function signOutCurrentUser() {
  if (!isFirebaseAuthConfigured) return;
  await signOut(getFirebaseAuth());
}

export async function getCurrentFirebaseIdToken(forceRefresh = false): Promise<string | null> {
  if (!isFirebaseAuthConfigured) return null;
  const user = getFirebaseAuth().currentUser;
  return user ? user.getIdToken(forceRefresh) : null;
}
