import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { initializeFirebaseClient } from "./firebase";

async function bootstrap() {
  try {
    await initializeFirebaseClient();
    ReactDOM.createRoot(document.getElementById("root")).render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
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
