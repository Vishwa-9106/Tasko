import { useEffect, useMemo, useState } from "react";
import api from "./api";
import { API_BASE_URL } from "./config";

const PAGE_TABS = ["Products", "Orders"];
const PRODUCT_STATUS_OPTIONS = ["Available", "Out of Stock"];
const ORDER_STATUS_OPTIONS = ["Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
const PAYMENT_STATUS_OPTIONS = ["Pending", "Paid", "Failed", "Refunded"];
const GROCERY_CATEGORIES = [
  "Fruits & Vegetables",
  "Dairy & Bakery",
  "Snacks & Beverages",
  "Staples & Grains",
  "Personal Care",
  "Household",
  "Frozen Foods",
  "Spices & Condiments"
];

const defaultProductDraft = {
  name: "",
  description: "",
  category: GROCERY_CATEGORIES[0],
  price: "",
  discountPrice: "",
  stockQuantity: "",
  status: "Available",
  imageUrl: "",
  imageFile: null,
  imagePreview: ""
};

const currency = (value) =>
  new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 2
  }).format(Number.isFinite(Number(value)) ? Number(value) : 0);

const displayDate = (value) => {
  const parsed = new Date(value || "");
  if (Number.isNaN(parsed.getTime())) return "-";
  return parsed.toLocaleString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
};

const normalizeProduct = (record) => {
  const stockQuantity = Number.isFinite(Number(record?.stockQuantity))
    ? Math.max(0, Math.floor(Number(record.stockQuantity)))
    : 0;
  const statusFromRecord = String(record?.status || "").toLowerCase();
  const status =
    stockQuantity <= 0 || statusFromRecord === "out of stock" ? "Out of Stock" : "Available";

  return {
    id: String(record?.id || ""),
    name: String(record?.name || ""),
    description: String(record?.description || ""),
    category: String(record?.category || ""),
    price: Number.isFinite(Number(record?.price)) ? Number(record.price) : 0,
    discountPrice:
      record?.discountPrice === null || record?.discountPrice === undefined || record?.discountPrice === ""
        ? null
        : Number.isFinite(Number(record.discountPrice))
          ? Number(record.discountPrice)
          : null,
    stockQuantity,
    status,
    imageUrl: String(record?.imageUrl || ""),
    createdAt: String(record?.createdAt || ""),
    updatedAt: String(record?.updatedAt || "")
  };
};

const normalizeOrderSummary = (record) => ({
  id: String(record?.id || ""),
  orderId: String(record?.orderId || ""),
  userName: String(record?.userName || "-"),
  orderDate: String(record?.orderDate || record?.createdAt || ""),
  totalAmount: Number.isFinite(Number(record?.totalAmount)) ? Number(record.totalAmount) : 0,
  orderStatus: String(record?.orderStatus || "Pending"),
  paymentStatus: String(record?.paymentStatus || "Pending")
});

const normalizeOrderDetail = (record) => ({
  id: String(record?.id || ""),
  orderId: String(record?.orderId || ""),
  userId: String(record?.userId || ""),
  userName: String(record?.userName || "-"),
  userEmail: String(record?.userEmail || ""),
  userPhone: String(record?.userPhone || ""),
  deliveryAddress: String(record?.deliveryAddress || "-"),
  items: Array.isArray(record?.items)
    ? record.items.map((item) => ({
        productId: String(item?.productId || ""),
        name: String(item?.name || ""),
        quantity: Number.isFinite(Number(item?.quantity)) ? Number(item.quantity) : 0,
        price: Number.isFinite(Number(item?.price)) ? Number(item.price) : 0,
        imageUrl: String(item?.imageUrl || "")
      }))
    : [],
  totalAmount: Number.isFinite(Number(record?.totalAmount)) ? Number(record.totalAmount) : 0,
  orderStatus: String(record?.orderStatus || "Pending"),
  paymentStatus: String(record?.paymentStatus || "Pending"),
  orderDate: String(record?.orderDate || record?.createdAt || "")
});

function resolveImageUrl(imageUrl) {
  const value = String(imageUrl || "").trim();
  if (!value) {
    return "";
  }
  if (/^https?:\/\//i.test(value)) {
    return value;
  }
  const normalizedBase = API_BASE_URL.replace(/\/+$/, "");
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${normalizedBase}${normalizedPath}`;
}

async function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read image file."));
    reader.readAsDataURL(file);
  });
}

export default function TaskoMartManagement({ sessionToken, pushToast, onSessionExpired }) {
  const [activePage, setActivePage] = useState("Products");

  const [products, setProducts] = useState([]);
  const [availableCategories, setAvailableCategories] = useState([]);
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [productSearch, setProductSearch] = useState("");
  const [productCategoryFilter, setProductCategoryFilter] = useState("");
  const [productModal, setProductModal] = useState(null);
  const [savingProduct, setSavingProduct] = useState(false);
  const [deletingProductId, setDeletingProductId] = useState("");

  const [orders, setOrders] = useState([]);
  const [loadingOrders, setLoadingOrders] = useState(false);
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderFromDate, setOrderFromDate] = useState("");
  const [orderToDate, setOrderToDate] = useState("");
  const [orderDetails, setOrderDetails] = useState(null);
  const [loadingOrderDetails, setLoadingOrderDetails] = useState(false);
  const [updatingOrderStatus, setUpdatingOrderStatus] = useState(false);

  const categoryOptions = useMemo(
    () => Array.from(new Set([...GROCERY_CATEGORIES, ...availableCategories])).sort((left, right) => left.localeCompare(right)),
    [availableCategories]
  );

  const handleApiError = async (error, fallbackMessage) => {
    if (error?.response?.status === 401) {
      pushToast?.("error", "Admin session expired. Please login again.");
      if (typeof onSessionExpired === "function") {
        await onSessionExpired();
      }
      return;
    }
    const message = error?.response?.data?.message || error?.response?.data?.error || fallbackMessage;
    pushToast?.("error", message);
  };

  const loadProducts = async () => {
    setLoadingProducts(true);
    try {
      const response = await api.get("/api/admin/taskomart/products", {
        params: {
          sessionToken,
          search: productSearch.trim() || undefined,
          category: productCategoryFilter || undefined
        }
      });

      const rawProducts = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.products)
          ? response.data.products
          : [];
      const rawCategories = Array.isArray(response?.data?.categories) ? response.data.categories : [];

      setProducts(rawProducts.map(normalizeProduct));
      setAvailableCategories(rawCategories.map((category) => String(category || "").trim()).filter(Boolean));
    } catch (error) {
      await handleApiError(error, "Failed to load TaskoMart products.");
    } finally {
      setLoadingProducts(false);
    }
  };

  const loadOrders = async () => {
    setLoadingOrders(true);
    try {
      const response = await api.get("/api/admin/taskomart/orders", {
        params: {
          sessionToken,
          status: orderStatusFilter || undefined,
          fromDate: orderFromDate || undefined,
          toDate: orderToDate || undefined
        }
      });

      const rawOrders = Array.isArray(response?.data)
        ? response.data
        : Array.isArray(response?.data?.orders)
          ? response.data.orders
          : [];
      setOrders(rawOrders.map(normalizeOrderSummary));
    } catch (error) {
      await handleApiError(error, "Failed to load TaskoMart orders.");
    } finally {
      setLoadingOrders(false);
    }
  };

  useEffect(() => {
    if (!sessionToken) return;
    if (activePage !== "Products") return;
    const timer = window.setTimeout(() => {
      loadProducts().catch(() => {});
    }, 220);
    return () => window.clearTimeout(timer);
  }, [activePage, sessionToken, productSearch, productCategoryFilter]);

  useEffect(() => {
    if (!sessionToken) return;
    if (activePage !== "Orders") return;
    loadOrders().catch(() => {});
  }, [activePage, sessionToken, orderStatusFilter, orderFromDate, orderToDate]);

  const openAddProduct = () => {
    setProductModal({
      mode: "create",
      productId: "",
      ...defaultProductDraft
    });
  };

  const openEditProduct = (product) => {
    setProductModal({
      mode: "edit",
      productId: product.id,
      name: product.name,
      description: product.description,
      category: product.category || categoryOptions[0] || GROCERY_CATEGORIES[0],
      price: String(product.price),
      discountPrice: product.discountPrice === null ? "" : String(product.discountPrice),
      stockQuantity: String(product.stockQuantity),
      status: product.status,
      imageUrl: product.imageUrl,
      imageFile: null,
      imagePreview: resolveImageUrl(product.imageUrl)
    });
  };

  const closeProductModal = () => {
    if (savingProduct) return;
    setProductModal(null);
  };

  const onProductDraftChange = (field, value) => {
    setProductModal((current) => (current ? { ...current, [field]: value } : current));
  };

  const onProductImageChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      pushToast?.("error", "Please choose a valid image file.");
      return;
    }

    try {
      const previewDataUrl = await fileToDataUrl(file);
      setProductModal((current) =>
        current
          ? {
              ...current,
              imageFile: file,
              imagePreview: previewDataUrl
            }
          : current
      );
    } catch (error) {
      pushToast?.("error", error?.message || "Failed to read image file.");
    }
  };

  const submitProduct = async (event) => {
    event.preventDefault();
    if (!productModal) return;

    const name = productModal.name.trim();
    const description = productModal.description.trim();
    const category = productModal.category.trim();
    const price = Number(productModal.price);
    const stockQuantity = Math.floor(Number(productModal.stockQuantity));
    const discountPriceRaw = String(productModal.discountPrice || "").trim();
    const discountPrice = discountPriceRaw === "" ? null : Number(discountPriceRaw);

    if (!name || !category || !Number.isFinite(price) || price < 0 || !Number.isFinite(stockQuantity) || stockQuantity < 0) {
      pushToast?.("error", "Please fill all required product fields with valid values.");
      return;
    }
    if (discountPrice !== null && (!Number.isFinite(discountPrice) || discountPrice < 0 || discountPrice > price)) {
      pushToast?.("error", "Discount price must be less than or equal to product price.");
      return;
    }

    setSavingProduct(true);
    try {
      let imagePayload;
      if (productModal.imageFile) {
        const imageDataUrl = await fileToDataUrl(productModal.imageFile);
        imagePayload = {
          name: productModal.imageFile.name,
          type: productModal.imageFile.type,
          dataUrl: imageDataUrl
        };
      }

      const payload = {
        name,
        description,
        category,
        price,
        discountPrice,
        stockQuantity,
        status: stockQuantity <= 0 ? "Out of Stock" : productModal.status,
        image: imagePayload,
        sessionToken
      };

      if (productModal.mode === "create") {
        await api.post("/api/admin/taskomart/products", payload);
        pushToast?.("success", "Product created successfully.");
      } else {
        await api.put(`/api/admin/taskomart/products/${productModal.productId}`, payload);
        pushToast?.("success", "Product updated successfully.");
      }

      setProductModal(null);
      await loadProducts();
    } catch (error) {
      await handleApiError(error, "Failed to save product.");
    } finally {
      setSavingProduct(false);
    }
  };

  const deleteProduct = async (product) => {
    if (!product?.id) return;
    const confirmed = window.confirm(`Delete "${product.name}" from TaskoMart products?`);
    if (!confirmed) return;

    setDeletingProductId(product.id);
    try {
      await api.delete(`/api/admin/taskomart/products/${product.id}`, {
        data: { sessionToken }
      });
      pushToast?.("success", "Product deleted successfully.");
      await loadProducts();
    } catch (error) {
      await handleApiError(error, "Failed to delete product.");
    } finally {
      setDeletingProductId("");
    }
  };

  const openOrderDetails = async (order) => {
    if (!order?.id) return;
    setLoadingOrderDetails(true);
    try {
      const response = await api.get(`/api/admin/taskomart/orders/${order.id}`, {
        params: { sessionToken }
      });
      const detailsRecord = response?.data?.order || response?.data || {};
      setOrderDetails(normalizeOrderDetail(detailsRecord));
    } catch (error) {
      await handleApiError(error, "Failed to load order details.");
    } finally {
      setLoadingOrderDetails(false);
    }
  };

  const updateOrderStatus = async () => {
    if (!orderDetails?.id) return;
    setUpdatingOrderStatus(true);
    try {
      const response = await api.patch(`/api/admin/taskomart/orders/${orderDetails.id}/status`, {
        status: orderDetails.orderStatus,
        sessionToken
      });
      const updated = normalizeOrderDetail(response?.data?.order || orderDetails);
      setOrderDetails(updated);
      setOrders((current) =>
        current.map((order) =>
          order.id === updated.id
            ? { ...order, orderStatus: updated.orderStatus, paymentStatus: updated.paymentStatus }
            : order
        )
      );
      pushToast?.("success", "Order status updated successfully.");
    } catch (error) {
      await handleApiError(error, "Failed to update order status.");
    } finally {
      setUpdatingOrderStatus(false);
    }
  };

  return (
    <section className="erp-card p-5">
      <div className="mb-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-slate-900">TaskoMart Management</h2>
          <p className="text-sm text-slate-500">Manage grocery products and customer orders.</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {PAGE_TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              className={`erp-tab ${activePage === tab ? "erp-tab-active" : ""}`}
              onClick={() => setActivePage(tab)}
            >
              {tab}
            </button>
          ))}
        </div>
      </div>

      {activePage === "Products" ? (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="block min-w-[220px] flex-1">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Search Product</span>
              <input
                type="text"
                className="erp-input"
                value={productSearch}
                onChange={(event) => setProductSearch(event.target.value)}
                placeholder="Search by product name"
              />
            </label>
            <label className="block min-w-[220px]">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Filter Category</span>
              <select
                className="erp-select"
                value={productCategoryFilter}
                onChange={(event) => setProductCategoryFilter(event.target.value)}
              >
                <option value="">All Categories</option>
                {categoryOptions.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="erp-btn erp-btn-primary" onClick={openAddProduct}>
              Add Product
            </button>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Product Image</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Price</th>
                  <th>Stock Quantity</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loadingProducts ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500">
                      Loading products...
                    </td>
                  </tr>
                ) : products.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  products.map((product) => (
                    <tr key={product.id}>
                      <td>
                        {product.imageUrl ? (
                          <img
                            src={resolveImageUrl(product.imageUrl)}
                            alt={product.name}
                            className="h-12 w-12 rounded-lg border border-slate-200 object-cover"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-lg border border-dashed border-slate-300 text-[10px] text-slate-400">
                            No Image
                          </div>
                        )}
                      </td>
                      <td>
                        <div className="font-medium text-slate-900">{product.name}</div>
                        <p className="mt-1 max-w-xs whitespace-normal text-xs text-slate-500">{product.description || "-"}</p>
                      </td>
                      <td>{product.category || "-"}</td>
                      <td>
                        <div>{currency(product.price)}</div>
                        {product.discountPrice !== null ? (
                          <div className="text-xs text-emerald-700">Discount: {currency(product.discountPrice)}</div>
                        ) : null}
                      </td>
                      <td>{product.stockQuantity}</td>
                      <td>
                        <span className={`erp-badge ${product.status === "Available" ? "erp-badge-positive" : "erp-badge-negative"}`}>
                          {product.status}
                        </span>
                      </td>
                      <td>
                        <div className="flex flex-wrap gap-2">
                          <button type="button" className="erp-btn erp-btn-soft" onClick={() => openEditProduct(product)}>
                            Edit
                          </button>
                          <button
                            type="button"
                            className="erp-btn erp-btn-danger"
                            disabled={deletingProductId === product.id}
                            onClick={() => deleteProduct(product)}
                          >
                            {deletingProductId === product.id ? "Deleting..." : "Delete"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      ) : (
        <>
          <div className="mb-4 flex flex-wrap items-end gap-2">
            <label className="block min-w-[200px]">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Order Status</span>
              <select
                className="erp-select"
                value={orderStatusFilter}
                onChange={(event) => setOrderStatusFilter(event.target.value)}
              >
                <option value="">All Statuses</option>
                {ORDER_STATUS_OPTIONS.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <label className="block min-w-[180px]">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">From Date</span>
              <input
                type="date"
                className="erp-input"
                value={orderFromDate}
                onChange={(event) => setOrderFromDate(event.target.value)}
              />
            </label>
            <label className="block min-w-[180px]">
              <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">To Date</span>
              <input
                type="date"
                className="erp-input"
                value={orderToDate}
                onChange={(event) => setOrderToDate(event.target.value)}
              />
            </label>
          </div>

          <div className="overflow-x-auto">
            <table className="erp-table">
              <thead>
                <tr>
                  <th>Order ID</th>
                  <th>User Name</th>
                  <th>Order Date</th>
                  <th>Total Amount</th>
                  <th>Order Status</th>
                  <th>Payment Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {loadingOrders ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500">
                      Loading orders...
                    </td>
                  </tr>
                ) : orders.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="text-center text-slate-500">
                      No orders found.
                    </td>
                  </tr>
                ) : (
                  orders.map((order) => (
                    <tr key={order.id}>
                      <td>{order.orderId || order.id}</td>
                      <td>{order.userName}</td>
                      <td>{displayDate(order.orderDate)}</td>
                      <td>{currency(order.totalAmount)}</td>
                      <td>
                        <span className="erp-badge">{order.orderStatus}</span>
                      </td>
                      <td>
                        <span className={`erp-badge ${order.paymentStatus === "Paid" ? "erp-badge-positive" : ""}`}>
                          {order.paymentStatus}
                        </span>
                      </td>
                      <td>
                        <button type="button" className="erp-btn erp-btn-soft" onClick={() => openOrderDetails(order)}>
                          View Details
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </>
      )}

      {productModal ? (
        <div className="erp-drawer-overlay items-center justify-center" onClick={closeProductModal}>
          <div
            className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between">
              <div>
                <h3 className="text-lg font-semibold text-slate-900">
                  {productModal.mode === "create" ? "Add Product" : "Edit Product"}
                </h3>
                <p className="text-sm text-slate-500">Manage TaskoMart grocery product details.</p>
              </div>
              <button type="button" className="erp-icon-btn" onClick={closeProductModal} disabled={savingProduct}>
                X
              </button>
            </div>

            <form className="grid gap-3 md:grid-cols-2" onSubmit={submitProduct}>
              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Product Name</span>
                <input
                  type="text"
                  className="erp-input"
                  value={productModal.name}
                  onChange={(event) => onProductDraftChange("name", event.target.value)}
                  required
                />
              </label>

              <label className="block md:col-span-2">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Product Description</span>
                <textarea
                  rows={3}
                  className="erp-input resize-none"
                  value={productModal.description}
                  onChange={(event) => onProductDraftChange("description", event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Product Category</span>
                <select
                  className="erp-select"
                  value={productModal.category}
                  onChange={(event) => onProductDraftChange("category", event.target.value)}
                  required
                >
                  {categoryOptions.map((category) => (
                    <option key={category} value={category}>
                      {category}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Status</span>
                <select
                  className="erp-select"
                  value={productModal.status}
                  onChange={(event) => onProductDraftChange("status", event.target.value)}
                >
                  {PRODUCT_STATUS_OPTIONS.map((status) => (
                    <option key={status} value={status}>
                      {status}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Product Price</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="erp-input"
                  value={productModal.price}
                  onChange={(event) => onProductDraftChange("price", event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Discount Price (Optional)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  className="erp-input"
                  value={productModal.discountPrice}
                  onChange={(event) => onProductDraftChange("discountPrice", event.target.value)}
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Stock Quantity</span>
                <input
                  type="number"
                  min="0"
                  className="erp-input"
                  value={productModal.stockQuantity}
                  onChange={(event) => onProductDraftChange("stockQuantity", event.target.value)}
                  required
                />
              </label>

              <label className="block">
                <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Product Image Upload</span>
                <input type="file" accept="image/*" className="erp-input" onChange={onProductImageChange} />
              </label>

              <div className="md:col-span-2">
                {productModal.imagePreview ? (
                  <img
                    src={productModal.imagePreview}
                    alt="Product preview"
                    className="h-28 w-28 rounded-xl border border-slate-200 object-cover"
                  />
                ) : productModal.imageUrl ? (
                  <img
                    src={resolveImageUrl(productModal.imageUrl)}
                    alt="Product"
                    className="h-28 w-28 rounded-xl border border-slate-200 object-cover"
                  />
                ) : null}
              </div>

              <div className="flex flex-wrap justify-end gap-2 pt-2 md:col-span-2">
                <button type="button" className="erp-btn erp-btn-soft" onClick={closeProductModal} disabled={savingProduct}>
                  Cancel
                </button>
                <button type="submit" className="erp-btn erp-btn-primary" disabled={savingProduct}>
                  {savingProduct ? "Saving..." : "Save Product"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {orderDetails || loadingOrderDetails ? (
        <div className="erp-drawer-overlay" onClick={() => (updatingOrderStatus ? null : setOrderDetails(null))}>
          <aside className="erp-drawer" onClick={(event) => event.stopPropagation()}>
            {loadingOrderDetails ? (
              <p className="text-sm text-slate-500">Loading order details...</p>
            ) : orderDetails ? (
              <>
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <h3 className="text-lg font-semibold text-slate-900">Order Details</h3>
                    <p className="text-sm text-slate-500">{orderDetails.orderId || orderDetails.id}</p>
                  </div>
                  <button
                    type="button"
                    className="erp-icon-btn"
                    onClick={() => setOrderDetails(null)}
                    disabled={updatingOrderStatus}
                  >
                    X
                  </button>
                </div>

                <div className="space-y-3 text-sm text-slate-700">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">User Name</p>
                      <p className="mt-1 font-medium text-slate-900">{orderDetails.userName || "-"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Order Date</p>
                      <p className="mt-1 font-medium text-slate-900">{displayDate(orderDetails.orderDate)}</p>
                    </div>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Email</p>
                      <p className="mt-1 font-medium text-slate-900">{orderDetails.userEmail || "-"}</p>
                    </div>
                    <div className="rounded-xl bg-slate-50 p-3">
                      <p className="text-xs uppercase tracking-wide text-slate-500">Phone</p>
                      <p className="mt-1 font-medium text-slate-900">{orderDetails.userPhone || "-"}</p>
                    </div>
                  </div>

                  <div className="rounded-xl bg-slate-50 p-3">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Delivery Address</p>
                    <p className="mt-1 text-slate-900">{orderDetails.deliveryAddress || "-"}</p>
                  </div>

                  <div className="overflow-x-auto rounded-xl border border-slate-200">
                    <table className="erp-table">
                      <thead>
                        <tr>
                          <th>Product</th>
                          <th>Quantity</th>
                          <th>Price</th>
                          <th>Total</th>
                        </tr>
                      </thead>
                      <tbody>
                        {orderDetails.items.length === 0 ? (
                          <tr>
                            <td colSpan={4} className="text-center text-slate-500">
                              No ordered products.
                            </td>
                          </tr>
                        ) : (
                          orderDetails.items.map((item) => (
                            <tr key={`${item.productId}-${item.name}`}>
                              <td>{item.name}</td>
                              <td>{item.quantity}</td>
                              <td>{currency(item.price)}</td>
                              <td>{currency(item.price * item.quantity)}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  </div>

                  <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-right">
                    <p className="text-xs uppercase tracking-wide text-slate-500">Total Price</p>
                    <p className="text-lg font-semibold text-slate-900">{currency(orderDetails.totalAmount)}</p>
                  </div>

                  <div className="grid gap-3 sm:grid-cols-2">
                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Order Status</span>
                      <select
                        className="erp-select"
                        value={orderDetails.orderStatus}
                        onChange={(event) => setOrderDetails((current) => (current ? { ...current, orderStatus: event.target.value } : current))}
                      >
                        {ORDER_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="block">
                      <span className="mb-1 block text-xs uppercase tracking-wide text-slate-500">Payment Status</span>
                      <select className="erp-select" value={orderDetails.paymentStatus} disabled>
                        {PAYMENT_STATUS_OPTIONS.map((status) => (
                          <option key={status} value={status}>
                            {status}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="flex justify-end">
                    <button
                      type="button"
                      className="erp-btn erp-btn-primary"
                      onClick={updateOrderStatus}
                      disabled={updatingOrderStatus}
                    >
                      {updatingOrderStatus ? "Updating..." : "Update Order Status"}
                    </button>
                  </div>
                </div>
              </>
            ) : null}
          </aside>
        </div>
      ) : null}
    </section>
  );
}
