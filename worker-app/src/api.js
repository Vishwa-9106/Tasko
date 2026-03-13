import axios from "axios";
import { API_BASE_URL } from "./config";
import { auth, initializeFirebaseClient } from "./firebase";

export const WORKER_ID_KEY = "tasko_worker_id";

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use(async (config) => {
  await initializeFirebaseClient();
  const token = auth?.currentUser ? await auth.currentUser.getIdToken() : "";
  if (token) {
    config.headers = config.headers || {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});
