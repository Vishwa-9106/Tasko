import { getApps, initializeApp } from "firebase/app";
import { browserLocalPersistence, getAuth, onAuthStateChanged, setPersistence } from "firebase/auth";
import { API_BASE_URL } from "./config";

export let auth;

let initialized = false;
let authReadyPromise = null;

function waitForAuthStateReady() {
  if (!auth) {
    return Promise.resolve();
  }

  if (!authReadyPromise) {
    authReadyPromise =
      typeof auth.authStateReady === "function"
        ? auth.authStateReady()
        : new Promise((resolve) => {
            const unsubscribe = onAuthStateChanged(auth, () => {
              unsubscribe();
              resolve();
            });
          });
  }

  return authReadyPromise;
}

export async function initializeFirebaseClient() {
  if (initialized && auth) {
    return { auth };
  }

  const response = await fetch(`${API_BASE_URL}/api/config/client`);
  if (!response.ok) {
    throw new Error("Failed to load Firebase client config from backend");
  }

  const payload = await response.json();
  const firebaseConfig = payload?.firebaseConfig;

  if (!firebaseConfig?.apiKey || !firebaseConfig?.projectId) {
    throw new Error("Invalid Firebase config in backend response");
  }

  const app = getApps().length ? getApps()[0] : initializeApp(firebaseConfig);
  auth = getAuth(app);
  await setPersistence(auth, browserLocalPersistence);
  initialized = true;

  return { auth };
}

export async function waitForInitialAuthSession() {
  await initializeFirebaseClient();
  await waitForAuthStateReady();
  return auth?.currentUser || null;
}
