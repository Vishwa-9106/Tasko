import axios from "axios";
import { API_BASE_URL } from "./config";

export const ADMIN_SESSION_TOKEN_KEY = "tasko_admin_session_token";

const api = axios.create({
  baseURL: API_BASE_URL
});

api.interceptors.request.use((config) => {
  const sessionToken = localStorage.getItem(ADMIN_SESSION_TOKEN_KEY);
  if (sessionToken) {
    config.headers = config.headers || {};
    if (typeof config.headers.set === "function") {
      config.headers.set("x-admin-session-token", sessionToken);
      config.headers.set("authorization", `Bearer ${sessionToken}`);
    } else {
      config.headers["x-admin-session-token"] = sessionToken;
      config.headers.authorization = `Bearer ${sessionToken}`;
    }
  }
  return config;
});

export default api;
