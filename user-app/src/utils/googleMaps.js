import { API_BASE_URL } from "../config";

const GOOGLE_MAPS_SCRIPT_ID = "tasko-google-maps-script";

let clientConfigPromise = null;
let googleMapsPromise = null;

function getExistingGoogleMapsInstance() {
  if (typeof window === "undefined") {
    return null;
  }

  return window.google?.maps || null;
}

export async function loadClientMapConfig() {
  if (!clientConfigPromise) {
    clientConfigPromise = fetch(`${API_BASE_URL}/api/config/client`)
      .then(async (response) => {
        if (!response.ok) {
          throw new Error("Failed to load booking map configuration.");
        }
        return response.json();
      })
      .catch((error) => {
        clientConfigPromise = null;
        throw error;
      });
  }

  return clientConfigPromise;
}

function loadGoogleMapsScript(apiKey) {
  return new Promise((resolve, reject) => {
    const existingInstance = getExistingGoogleMapsInstance();
    if (existingInstance) {
      resolve(existingInstance);
      return;
    }

    const existingScript = document.getElementById(GOOGLE_MAPS_SCRIPT_ID);
    if (existingScript) {
      existingScript.addEventListener("load", () => resolve(getExistingGoogleMapsInstance()), { once: true });
      existingScript.addEventListener("error", () => reject(new Error("Failed to load Google Maps.")), { once: true });
      return;
    }

    const script = document.createElement("script");
    script.id = GOOGLE_MAPS_SCRIPT_ID;
    script.async = true;
    script.defer = true;
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`;
    script.onload = () => {
      const maps = getExistingGoogleMapsInstance();
      if (!maps) {
        reject(new Error("Google Maps loaded without exposing the maps API."));
        return;
      }
      resolve(maps);
    };
    script.onerror = () => reject(new Error("Failed to load Google Maps."));
    document.head.appendChild(script);
  });
}

export async function loadGoogleMapsApi(apiKey) {
  const existingInstance = getExistingGoogleMapsInstance();
  if (existingInstance) {
    return existingInstance;
  }

  if (!apiKey) {
    throw new Error("Google Maps browser key is not configured.");
  }

  if (!googleMapsPromise) {
    googleMapsPromise = loadGoogleMapsScript(apiKey).catch((error) => {
      googleMapsPromise = null;
      throw error;
    });
  }

  return googleMapsPromise;
}
