import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import "./index.css";
import { AuthProvider } from "./context/AuthContext";
import { initializeFirebaseClient } from "./firebase";

async function bootstrap() {
  try {
    await initializeFirebaseClient();
    ReactDOM.createRoot(document.getElementById("root")).render(
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    );
  } catch (error) {
    ReactDOM.createRoot(document.getElementById("root")).render(
      <div style={{ padding: "1rem", fontFamily: "Segoe UI, sans-serif" }}>
        Failed to initialize app: {String(error)}
      </div>
    );
  }
}

bootstrap();
