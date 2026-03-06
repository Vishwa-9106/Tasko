const TASKOMART_CART_KEY = "taskomart:cart:items";
const TASKOMART_CART_UPDATED_EVENT = "taskomart:cart:updated";

function isClient() {
  return typeof window !== "undefined";
}

function toNumber(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function safeParseCart(rawValue) {
  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .map((item) => ({
        id: String(item?.id || ""),
        name: String(item?.name || "TaskoMart Product"),
        category: String(item?.category || "General"),
        imageUrl: String(item?.imageUrl || ""),
        price: toNumber(item?.price),
        quantity: Math.max(1, Math.trunc(toNumber(item?.quantity) || 1))
      }))
      .filter((item) => item.id);
  } catch {
    return [];
  }
}

function emitCartUpdated() {
  if (!isClient()) return;
  window.dispatchEvent(new CustomEvent(TASKOMART_CART_UPDATED_EVENT));
}

function writeTaskoMartCart(items) {
  if (!isClient()) return;
  window.localStorage.setItem(TASKOMART_CART_KEY, JSON.stringify(items));
  emitCartUpdated();
}

export function readTaskoMartCart() {
  if (!isClient()) return [];
  return safeParseCart(window.localStorage.getItem(TASKOMART_CART_KEY));
}

export function getTaskoMartCartCount() {
  return readTaskoMartCart().reduce((sum, item) => sum + Math.max(1, item.quantity), 0);
}

export function getTaskoMartCartSubtotal() {
  return readTaskoMartCart().reduce((sum, item) => sum + item.price * Math.max(1, item.quantity), 0);
}

export function addTaskoMartCartItem(product) {
  const cartItems = readTaskoMartCart();
  const productId = String(product?.id || "").trim();
  if (!productId) return cartItems;

  const existingIndex = cartItems.findIndex((item) => item.id === productId);
  if (existingIndex >= 0) {
    const existing = cartItems[existingIndex];
    cartItems[existingIndex] = {
      ...existing,
      quantity: existing.quantity + 1
    };
  } else {
    cartItems.push({
      id: productId,
      name: String(product?.name || "TaskoMart Product"),
      category: String(product?.category || "General"),
      imageUrl: String(product?.imageUrl || ""),
      price: toNumber(product?.price),
      quantity: 1
    });
  }

  writeTaskoMartCart(cartItems);
  return cartItems;
}

export function setTaskoMartCartItemQuantity(productId, quantity) {
  const targetId = String(productId || "").trim();
  if (!targetId) return readTaskoMartCart();

  const cartItems = readTaskoMartCart();
  const nextQuantity = Math.trunc(toNumber(quantity));
  const itemIndex = cartItems.findIndex((item) => item.id === targetId);
  if (itemIndex < 0) return cartItems;

  if (nextQuantity <= 0) {
    cartItems.splice(itemIndex, 1);
  } else {
    cartItems[itemIndex] = {
      ...cartItems[itemIndex],
      quantity: Math.max(1, nextQuantity)
    };
  }

  writeTaskoMartCart(cartItems);
  return cartItems;
}

export function removeTaskoMartCartItem(productId) {
  return setTaskoMartCartItemQuantity(productId, 0);
}

export function clearTaskoMartCart() {
  writeTaskoMartCart([]);
  return [];
}

export function onTaskoMartCartUpdated(listener) {
  if (!isClient()) return () => {};

  const handleStorage = (event) => {
    if (event.key === TASKOMART_CART_KEY) {
      listener(getTaskoMartCartCount());
    }
  };

  const handleCustom = () => {
    listener(getTaskoMartCartCount());
  };

  window.addEventListener("storage", handleStorage);
  window.addEventListener(TASKOMART_CART_UPDATED_EVENT, handleCustom);

  return () => {
    window.removeEventListener("storage", handleStorage);
    window.removeEventListener(TASKOMART_CART_UPDATED_EVENT, handleCustom);
  };
}
