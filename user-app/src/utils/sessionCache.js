const cachePrefix = "tasko:cache:";

function isSessionStorageAvailable() {
  try {
    return typeof window !== "undefined" && Boolean(window.sessionStorage);
  } catch (_error) {
    return false;
  }
}

export function readSessionCache(key, ttlMs) {
  if (!isSessionStorageAvailable()) return null;

  try {
    const raw = window.sessionStorage.getItem(`${cachePrefix}${key}`);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;

    const cachedAt = Number(parsed.cachedAt);
    if (!Number.isFinite(cachedAt)) return null;
    if (Date.now() - cachedAt > ttlMs) return null;

    return parsed.value ?? null;
  } catch (_error) {
    return null;
  }
}

export function writeSessionCache(key, value) {
  if (!isSessionStorageAvailable()) return;

  try {
    window.sessionStorage.setItem(
      `${cachePrefix}${key}`,
      JSON.stringify({
        cachedAt: Date.now(),
        value
      })
    );
  } catch (_error) {
    // Ignore session storage write failures.
  }
}
