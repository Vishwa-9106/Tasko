import { createContext, useContext, useEffect, useMemo, useState } from "react";
import {
  GoogleAuthProvider,
  OAuthProvider,
  onAuthStateChanged,
  signInWithCustomToken,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile
} from "firebase/auth";
import { auth } from "../firebase";
import api from "../api";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (firebaseUser) => {
      setUser(firebaseUser);
      setLoading(false);
    });

    return () => unsub();
  }, []);

  const syncUserRecord = async (firebaseUser, fallbackName = "") => {
    await api.post("/api/users/register", {
      uid: firebaseUser.uid,
      name: firebaseUser.displayName || fallbackName || "",
      email: firebaseUser.email || ""
    });
  };

  const validateUserRole = async (firebaseUser) => {
    const idToken = await firebaseUser.getIdToken();
    await api.post("/api/auth/sync-role", {
      idToken,
      role: "user",
      name: firebaseUser.displayName || ""
    });
    await api.post("/api/auth/validate", { idToken, expectedRole: "user" });
  };

  const register = async ({ name, email, password }) => {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedName = name.trim();
    const response = await api.post("/api/auth/register", {
      email: normalizedEmail,
      password,
      displayName: normalizedName
    });
    const credential = await signInWithCustomToken(auth, response.data.customToken);
    if (normalizedName && credential.user.displayName !== normalizedName) {
      await updateProfile(credential.user, { displayName: normalizedName });
    }
    await syncUserRecord(credential.user, normalizedName);
    await validateUserRole(credential.user);
    return credential;
  };

  const login = async (email, password) => {
    const credential = await signInWithEmailAndPassword(auth, email, password);
    await syncUserRecord(credential.user);
    await validateUserRole(credential.user);
    return credential;
  };

  const loginWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: "select_account" });
    const credential = await signInWithPopup(auth, provider);
    try {
      await syncUserRecord(credential.user);
      await validateUserRole(credential.user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("User sync/validation failed after Google sign-in:", error);
    }
    return credential;
  };

  const loginWithApple = async () => {
    const provider = new OAuthProvider("apple.com");
    provider.addScope("email");
    provider.addScope("name");
    const credential = await signInWithPopup(auth, provider);
    try {
      await syncUserRecord(credential.user);
      await validateUserRole(credential.user);
    } catch (error) {
      // eslint-disable-next-line no-console
      console.warn("User sync/validation failed after Apple sign-in:", error);
    }
    return credential;
  };
  const logout = () => signOut(auth);

  const value = useMemo(
    () => ({ user, loading, register, login, loginWithGoogle, loginWithApple, logout }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error("useAuth must be used inside AuthProvider");
  }

  return context;
}
