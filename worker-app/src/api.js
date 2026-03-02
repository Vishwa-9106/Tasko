import axios from "axios";
import { API_BASE_URL } from "./config";

export const WORKER_SESSION_TOKEN_KEY = "tasko_worker_session_token";
export const WORKER_ID_KEY = "tasko_worker_id";

export const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const token = localStorage.getItem(WORKER_SESSION_TOKEN_KEY);
  if (token) {
    config.headers = config.headers || {};
    config.headers["x-worker-session-token"] = token;
  }
  return config;
});
