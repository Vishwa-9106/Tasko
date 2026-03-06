import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api";
import { API_BASE_URL } from "../config";
import { useAuth } from "../context/AuthContext";
import UserPortalShell from "../components/UserPortalShell";
import { CategoryIcon } from "../components/PortalIcons";
import { groceryCategories } from "./homeData";
import {
  clearTaskoMartCart,
  onTaskoMartCartUpdated,
  readTaskoMartCart,
  removeTaskoMartCartItem,
  setTaskoMartCartItemQuantity
} from "../utils/taskomartCart";

function normalizeText(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function resolveImageUrl(imageUrl) {
  const source = String(imageUrl || "").trim();
  if (!source) return "";
  if (source.startsWith("http://") || source.startsWith("https://")) return source;
  if (source.startsWith("/")) return `${API_BASE_URL}${source}`;
  return `${API_BASE_URL}/${source}`;
}

function toRupee(value) {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return "INR 0";
  return `INR ${Math.round(amount)}`;
}

function readErrorMessage(error) {
  if (error?.response?.data?.message) {
    return String(error.response.data.message);
  }
  if (error?.message) {
    return String(error.message);
  }
  return "Unable to place order right now. Please try again.";
}

export default function CartPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [cartItems, setCartItems] = useState(() => readTaskoMartCart());
  const [submitting, setSubmitting] = useState(false);
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [customerInfo, setCustomerInfo] = useState({
    name: user?.displayName || "",
    phone: "",
    address: ""
  });

  useEffect(() => {
    setCustomerInfo((current) => ({
      ...current,
      name: current.name || user?.displayName || user?.email || ""
    }));
  }, [user]);

  useEffect(() => {
    setCartItems(readTaskoMartCart());
    return onTaskoMartCartUpdated(() => {
      setCartItems(readTaskoMartCart());
    });
  }, []);

  const totalItems = useMemo(
    () => cartItems.reduce((sum, item) => sum + Math.max(1, Number(item.quantity) || 1), 0),
    [cartItems]
  );
  const subtotal = useMemo(
    () => cartItems.reduce((sum, item) => sum + Number(item.price || 0) * Math.max(1, Number(item.quantity) || 1), 0),
    [cartItems]
  );

  const handleCheckout = async (event) => {
    event.preventDefault();
    setCheckoutError("");
    setCheckoutMessage("");

    if (cartItems.length === 0) {
      setCheckoutError("Your cart is empty.");
      return;
    }

    const userName = String(customerInfo.name || "").trim();
    const deliveryAddress = String(customerInfo.address || "").trim();
    const userPhone = String(customerInfo.phone || "").trim();

    if (!userName || !deliveryAddress) {
      setCheckoutError("Name and delivery address are required.");
      return;
    }

    try {
      setSubmitting(true);
      const productsResponse = await api.get("/api/taskomart/products", {
        params: { limit: 100 }
      });
      const availableProducts = Array.isArray(productsResponse.data) ? productsResponse.data : [];
      const availableIds = new Set(
        availableProducts
          .map((item) => String(item?.id || item?._id || "").trim())
          .filter(Boolean)
      );

      const unavailableItems = cartItems.filter((item) => !availableIds.has(String(item.id || "").trim()));
      if (unavailableItems.length > 0) {
        unavailableItems.forEach((item) => removeTaskoMartCartItem(item.id));
        setCheckoutError("Some items are no longer available and were removed from your cart. Please try again.");
        return;
      }

      const response = await api.post("/api/taskomart/orders", {
        userId: user?.uid || "",
        userName,
        userEmail: user?.email || "",
        userPhone,
        deliveryAddress,
        items: cartItems.map((item) => ({
          productId: item.id,
          name: String(item.name || "TaskoMart Product"),
          price: Number(item.price || 0),
          imageUrl: String(item.imageUrl || ""),
          quantity: Math.max(1, Number(item.quantity) || 1)
        })),
        paymentStatus: "Pending"
      });

      const orderCode = response?.data?.order?.orderId;
      clearTaskoMartCart();
      setCartItems([]);
      setCheckoutMessage(orderCode ? `Order placed successfully. Order ID: ${orderCode}` : "Order placed successfully.");
      setCustomerInfo((current) => ({ ...current, address: "" }));
    } catch (error) {
      setCheckoutError(readErrorMessage(error));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <UserPortalShell activeNav="taskomart">
      <section className="tasko-page-header">
        <p>TaskoMart</p>
        <h1>Your Cart</h1>
        <p>Review products, update quantity, and checkout.</p>
      </section>

      {checkoutMessage ? <p className="tasko-empty-state">{checkoutMessage}</p> : null}
      {checkoutError ? <p className="tasko-empty-state">{checkoutError}</p> : null}

      <section className="tasko-cart-layout">
        <div className="tasko-content-panel tasko-cart-items-panel">
          <div className="tasko-cart-items-head">
            <h2>Cart Items</h2>
            <p>{totalItems} item(s)</p>
          </div>

          {cartItems.length === 0 ? (
            <div className="tasko-cart-empty">
              <p>Your cart is empty.</p>
              <button type="button" onClick={() => navigate("/taskomart")}>
                Continue Shopping
              </button>
            </div>
          ) : (
            <div className="tasko-cart-list">
              {cartItems.map((item) => {
                const iconName =
                  groceryCategories.find((category) => normalizeText(category.name) === normalizeText(item.category))?.icon ||
                  "beverages";
                const imageUrl = resolveImageUrl(item.imageUrl);

                return (
                  <article key={item.id} className="tasko-card tasko-cart-item">
                    <div className="tasko-cart-image-wrap">
                      {imageUrl ? (
                        <img src={imageUrl} alt={item.name} className="tasko-cart-image" />
                      ) : (
                        <span className="tasko-card-icon large">
                          <CategoryIcon name={iconName} className="tasko-line-icon" />
                        </span>
                      )}
                    </div>

                    <div className="tasko-cart-item-info">
                      <p className="tasko-product-category">{item.category}</p>
                      <h3>{item.name}</h3>
                      <p className="tasko-cart-price">{toRupee(item.price)}</p>
                      <p className="tasko-cart-line-total">
                        Line Total: {toRupee(Number(item.price || 0) * Math.max(1, Number(item.quantity) || 1))}
                      </p>
                    </div>

                    <div className="tasko-cart-actions">
                      <div className="tasko-cart-qty-controls">
                        <button
                          type="button"
                          onClick={() => setTaskoMartCartItemQuantity(item.id, Math.max(0, Number(item.quantity) - 1))}
                          aria-label={`Decrease quantity for ${item.name}`}
                          disabled={submitting}
                        >
                          -
                        </button>
                        <span>{Math.max(1, Number(item.quantity) || 1)}</span>
                        <button
                          type="button"
                          onClick={() => setTaskoMartCartItemQuantity(item.id, Math.max(1, Number(item.quantity) + 1))}
                          aria-label={`Increase quantity for ${item.name}`}
                          disabled={submitting}
                        >
                          +
                        </button>
                      </div>
                      <button
                        type="button"
                        className="tasko-cart-remove-btn"
                        onClick={() => removeTaskoMartCartItem(item.id)}
                        disabled={submitting}
                      >
                        Remove
                      </button>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <aside className="tasko-content-panel tasko-cart-summary-panel">
          <h2>Checkout</h2>
          <div className="tasko-cart-summary-row">
            <span>Items</span>
            <strong>{totalItems}</strong>
          </div>
          <div className="tasko-cart-summary-row">
            <span>Subtotal</span>
            <strong>{toRupee(subtotal)}</strong>
          </div>

          <form className="tasko-cart-checkout-form" onSubmit={handleCheckout}>
            <label className="tasko-cart-field">
              <span>Name</span>
              <input
                type="text"
                value={customerInfo.name}
                onChange={(event) => setCustomerInfo((current) => ({ ...current, name: event.target.value }))}
                placeholder="Your full name"
                required
              />
            </label>
            <label className="tasko-cart-field">
              <span>Phone</span>
              <input
                type="tel"
                value={customerInfo.phone}
                onChange={(event) => setCustomerInfo((current) => ({ ...current, phone: event.target.value }))}
                placeholder="Phone number"
              />
            </label>
            <label className="tasko-cart-field">
              <span>Delivery Address</span>
              <textarea
                value={customerInfo.address}
                onChange={(event) => setCustomerInfo((current) => ({ ...current, address: event.target.value }))}
                placeholder="House / street / area / city"
                required
              />
            </label>

            <button type="submit" className="tasko-cart-checkout-btn" disabled={submitting || cartItems.length === 0}>
              {submitting ? "Placing Order..." : "Checkout"}
            </button>
            <button
              type="button"
              className="tasko-cart-clear-btn"
              onClick={() => clearTaskoMartCart()}
              disabled={submitting || cartItems.length === 0}
            >
              Clear Cart
            </button>
          </form>
        </aside>
      </section>
    </UserPortalShell>
  );
}
