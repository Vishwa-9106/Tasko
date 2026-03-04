import crypto from "crypto";
import fs from "fs/promises";
import path from "path";
import { Express, Request, Response } from "express";
import { db } from "./firebaseAdmin";

type TaskoMartProductStatus = "Available" | "Out of Stock";
type TaskoMartOrderStatus = "Pending" | "Preparing" | "Out for Delivery" | "Delivered" | "Cancelled";
type TaskoMartPaymentStatus = "Pending" | "Paid" | "Failed" | "Refunded";

type TaskoMartProductRecord = {
  id: string;
  name: string;
  description: string;
  category: string;
  price: number;
  discountPrice: number | null;
  stockQuantity: number;
  status: TaskoMartProductStatus;
  imageUrl: string;
  createdAt: string;
  updatedAt: string;
};

type TaskoMartOrderItemRecord = {
  productId: string;
  name: string;
  quantity: number;
  price: number;
  imageUrl: string;
};

type TaskoMartOrderRecord = {
  id: string;
  orderId: string;
  userId: string;
  userName: string;
  userEmail: string;
  userPhone: string;
  deliveryAddress: string;
  items: TaskoMartOrderItemRecord[];
  totalAmount: number;
  orderStatus: TaskoMartOrderStatus;
  paymentStatus: TaskoMartPaymentStatus;
  orderDate: string;
  createdAt: string;
  updatedAt: string;
};

type RegisterTaskoMartRoutesOptions = {
  validateAdminSession: (sessionToken: string) => boolean;
};

type ProductInputBody = {
  name?: unknown;
  description?: unknown;
  category?: unknown;
  price?: unknown;
  discountPrice?: unknown;
  stockQuantity?: unknown;
  stock?: unknown;
  status?: unknown;
  image?: unknown;
  imageFile?: unknown;
};

type CheckoutInputBody = {
  userId?: unknown;
  userName?: unknown;
  userEmail?: unknown;
  userPhone?: unknown;
  deliveryAddress?: unknown;
  items?: unknown;
  paymentStatus?: unknown;
  customerInfo?: unknown;
};

const inMemoryProducts = new Map<string, TaskoMartProductRecord>();
const inMemoryOrders = new Map<string, TaskoMartOrderRecord>();

const groceryCategories = [
  "Fruits & Vegetables",
  "Dairy & Bakery",
  "Snacks & Beverages",
  "Staples & Grains",
  "Personal Care",
  "Household",
  "Frozen Foods",
  "Spices & Condiments"
];

const productStatuses: TaskoMartProductStatus[] = ["Available", "Out of Stock"];
const orderStatuses: TaskoMartOrderStatus[] = ["Pending", "Preparing", "Out for Delivery", "Delivered", "Cancelled"];
const paymentStatuses: TaskoMartPaymentStatus[] = ["Pending", "Paid", "Failed", "Refunded"];

const uploadsRoot = path.resolve(__dirname, "../uploads");
const taskoMartProductImageRoot = path.join(uploadsRoot, "taskomart-products");
const maxProductImageBytes = 6 * 1024 * 1024;
const allowedImageMimeTypes: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp"
};

function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readTrimmedString(value: unknown): string {
  if (Array.isArray(value)) {
    return typeof value[0] === "string" ? value[0].trim() : "";
  }
  return typeof value === "string" ? value.trim() : "";
}

function readOptionalNumber(value: unknown): number | null {
  if (value === null || value === undefined) {
    return null;
  }
  if (typeof value === "string" && value.trim() === "") {
    return null;
  }
  const numberValue = Number(value);
  return Number.isFinite(numberValue) ? numberValue : null;
}

function readNonNegativeNumber(value: unknown): number | null {
  const parsed = readOptionalNumber(value);
  if (parsed === null) return null;
  if (parsed < 0) return null;
  return parsed;
}

function readNonNegativeInteger(value: unknown): number | null {
  const parsed = readOptionalNumber(value);
  if (parsed === null) return null;
  if (parsed < 0) return null;
  return Math.floor(parsed);
}

function hasOwn(record: Record<string, unknown>, key: string): boolean {
  return Object.prototype.hasOwnProperty.call(record, key);
}

function parseDateTimestamp(value: unknown): number | null {
  const textValue = readTrimmedString(value);
  if (!textValue) return null;
  const parsed = new Date(textValue);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.getTime();
}

function parseDateEndTimestamp(value: unknown): number | null {
  const textValue = readTrimmedString(value);
  if (!textValue) return null;
  const parsed = new Date(textValue);
  if (Number.isNaN(parsed.getTime())) return null;

  const dayPattern = /^\d{4}-\d{2}-\d{2}$/;
  if (dayPattern.test(textValue)) {
    parsed.setHours(23, 59, 59, 999);
  }

  return parsed.getTime();
}

function toEpoch(value: string): number {
  const parsed = new Date(value).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function isFirestoreUnavailableError(error: unknown): boolean {
  const message = getErrorMessage(error);
  return (
    message.includes("5 NOT_FOUND") ||
    message.includes("database (default) does not exist") ||
    message.includes("The caller does not have permission")
  );
}

function normalizeProductStatus(value: unknown, stockQuantity: number): TaskoMartProductStatus {
  if (stockQuantity <= 0) {
    return "Out of Stock";
  }

  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "available") return "Available";
  if (normalized === "out of stock") return "Out of Stock";
  return "Available";
}

function normalizeOrderStatus(value: unknown): TaskoMartOrderStatus {
  const normalized = readTrimmedString(value).toLowerCase().replace(/_/g, " ");
  if (normalized === "preparing") return "Preparing";
  if (normalized === "out for delivery") return "Out for Delivery";
  if (normalized === "delivered") return "Delivered";
  if (normalized === "cancelled") return "Cancelled";
  return "Pending";
}

function isRecognizedOrderStatus(value: unknown): boolean {
  const normalized = readTrimmedString(value).toLowerCase().replace(/_/g, " ");
  return ["pending", "preparing", "out for delivery", "delivered", "cancelled"].includes(normalized);
}

function normalizePaymentStatus(value: unknown): TaskoMartPaymentStatus {
  const normalized = readTrimmedString(value).toLowerCase();
  if (normalized === "paid") return "Paid";
  if (normalized === "failed") return "Failed";
  if (normalized === "refunded") return "Refunded";
  return "Pending";
}

function normalizeOrderItems(value: unknown): TaskoMartOrderItemRecord[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .map((entry): TaskoMartOrderItemRecord | null => {
      if (!isRecord(entry)) {
        return null;
      }

      const productId =
        readTrimmedString(entry.productId) ||
        readTrimmedString(entry.product) ||
        readTrimmedString(entry.id);
      const name = readTrimmedString(entry.name);
      const quantity = readNonNegativeInteger(entry.quantity);
      const price = readNonNegativeNumber(entry.price);
      if (!productId || !name || quantity === null || quantity <= 0 || price === null) {
        return null;
      }

      return {
        productId,
        name,
        quantity,
        price,
        imageUrl: readTrimmedString(entry.imageUrl)
      };
    })
    .filter((item): item is TaskoMartOrderItemRecord => item !== null);
}

function normalizeProductRecord(productId: string, data: Record<string, unknown>): TaskoMartProductRecord {
  const now = new Date().toISOString();
  const stockQuantity = readNonNegativeInteger(data.stockQuantity ?? data.stock) ?? 0;
  const basePrice = readNonNegativeNumber(data.price) ?? 0;
  const discount = readOptionalNumber(data.discountPrice);
  const normalizedDiscount =
    discount === null || discount < 0 || discount > basePrice ? null : discount;

  return {
    id: productId,
    name: readTrimmedString(data.name),
    description: readTrimmedString(data.description),
    category: readTrimmedString(data.category),
    price: basePrice,
    discountPrice: normalizedDiscount,
    stockQuantity,
    status: normalizeProductStatus(data.status, stockQuantity),
    imageUrl: readTrimmedString(data.imageUrl),
    createdAt: readTrimmedString(data.createdAt) || now,
    updatedAt: readTrimmedString(data.updatedAt) || now
  };
}

function normalizeOrderRecord(orderId: string, data: Record<string, unknown>): TaskoMartOrderRecord {
  const now = new Date().toISOString();
  const items = normalizeOrderItems(data.items);
  const totalFromPayload = readNonNegativeNumber(data.totalAmount);
  const computedTotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const totalAmount = totalFromPayload === null ? computedTotal : totalFromPayload;

  return {
    id: orderId,
    orderId: readTrimmedString(data.orderId) || createOrderCode(),
    userId: readTrimmedString(data.userId),
    userName: readTrimmedString(data.userName),
    userEmail: readTrimmedString(data.userEmail),
    userPhone: readTrimmedString(data.userPhone),
    deliveryAddress: readTrimmedString(data.deliveryAddress),
    items,
    totalAmount,
    orderStatus: normalizeOrderStatus(data.orderStatus),
    paymentStatus: normalizePaymentStatus(data.paymentStatus),
    orderDate: readTrimmedString(data.orderDate) || now,
    createdAt: readTrimmedString(data.createdAt) || now,
    updatedAt: readTrimmedString(data.updatedAt) || now
  };
}

function toProductResponse(record: TaskoMartProductRecord): Record<string, unknown> {
  return {
    id: record.id,
    name: record.name,
    description: record.description,
    category: record.category,
    price: record.price,
    discountPrice: record.discountPrice,
    stockQuantity: record.stockQuantity,
    status: record.status,
    imageUrl: record.imageUrl,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function toOrderSummaryResponse(record: TaskoMartOrderRecord): Record<string, unknown> {
  return {
    id: record.id,
    orderId: record.orderId,
    userName: record.userName,
    orderDate: record.orderDate,
    totalAmount: record.totalAmount,
    orderStatus: record.orderStatus,
    paymentStatus: record.paymentStatus
  };
}

function toOrderDetailResponse(record: TaskoMartOrderRecord): Record<string, unknown> {
  return {
    id: record.id,
    orderId: record.orderId,
    userId: record.userId,
    userName: record.userName,
    userEmail: record.userEmail,
    userPhone: record.userPhone,
    deliveryAddress: record.deliveryAddress,
    items: record.items,
    totalAmount: record.totalAmount,
    orderStatus: record.orderStatus,
    paymentStatus: record.paymentStatus,
    orderDate: record.orderDate,
    createdAt: record.createdAt,
    updatedAt: record.updatedAt
  };
}

function getAdminSessionToken(req: Request): string {
  const headerToken = readTrimmedString(req.header("x-admin-session-token"));
  if (headerToken) {
    return headerToken;
  }

  const authorizationHeader = readTrimmedString(req.header("authorization"));
  if (authorizationHeader.toLowerCase().startsWith("bearer ")) {
    return authorizationHeader.slice(7).trim();
  }

  const queryToken = readTrimmedString(req.query.sessionToken);
  if (queryToken) {
    return queryToken;
  }

  if (isRecord(req.body)) {
    return readTrimmedString(req.body.sessionToken);
  }

  return "";
}

function resolveImageExtension(fileName: string, mimeType: string): string {
  const mimeKey = mimeType.toLowerCase();
  if (allowedImageMimeTypes[mimeKey]) {
    return allowedImageMimeTypes[mimeKey];
  }

  const extension = fileName.split(".").pop()?.toLowerCase() || "";
  if (extension === "jpeg") return "jpg";
  if (["jpg", "png", "webp"].includes(extension)) {
    return extension;
  }
  return "";
}

async function persistProductImage(input: unknown): Promise<string> {
  if (!isRecord(input)) {
    throw new Error("Invalid product image payload.");
  }

  const name = readTrimmedString(input.name);
  const type = readTrimmedString(input.type);
  const dataUrl = readTrimmedString(input.dataUrl);
  const extension = resolveImageExtension(name, type);
  if (!extension) {
    throw new Error("Only JPG, PNG and WEBP images are allowed.");
  }

  const match = dataUrl.match(/^data:[^;]+;base64,(.+)$/);
  if (!match) {
    throw new Error("Invalid image content.");
  }

  const imageBuffer = Buffer.from(match[1], "base64");
  if (imageBuffer.byteLength === 0 || imageBuffer.byteLength > maxProductImageBytes) {
    throw new Error("Image size must be between 1 byte and 6MB.");
  }

  await fs.mkdir(taskoMartProductImageRoot, { recursive: true });
  const generatedName = `${Date.now()}-${crypto.randomUUID()}.${extension}`;
  const absolutePath = path.join(taskoMartProductImageRoot, generatedName);
  await fs.writeFile(absolutePath, imageBuffer);

  return `/uploads/taskomart-products/${generatedName}`;
}

async function deleteProductImage(imageUrl: string): Promise<void> {
  const normalized = readTrimmedString(imageUrl);
  if (!normalized.startsWith("/uploads/taskomart-products/")) {
    return;
  }

  const relativePath = normalized.replace(/^\/uploads\//, "");
  const absolutePath = path.resolve(uploadsRoot, relativePath);
  const normalizedUploadsRoot = path.resolve(uploadsRoot);
  if (!absolutePath.startsWith(normalizedUploadsRoot)) {
    return;
  }

  await fs.unlink(absolutePath).catch(() => {});
}

async function listProducts(): Promise<TaskoMartProductRecord[]> {
  try {
    const snapshot = await db.collection("taskomart_products").get();
    const products = snapshot.docs.map((document) => normalizeProductRecord(document.id, document.data()));
    products.forEach((product) => inMemoryProducts.set(product.id, product));
    return products.sort((left, right) => toEpoch(right.updatedAt) - toEpoch(left.updatedAt));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryProducts.values()).sort((left, right) => toEpoch(right.updatedAt) - toEpoch(left.updatedAt));
}

async function getProductById(productId: string): Promise<TaskoMartProductRecord | null> {
  try {
    const document = await db.collection("taskomart_products").doc(productId).get();
    if (document.exists) {
      const product = normalizeProductRecord(document.id, document.data() || {});
      inMemoryProducts.set(product.id, product);
      return product;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return inMemoryProducts.get(productId) || null;
}

async function saveProduct(product: TaskoMartProductRecord): Promise<void> {
  const payload = {
    name: product.name,
    description: product.description,
    category: product.category,
    price: product.price,
    discountPrice: product.discountPrice,
    stockQuantity: product.stockQuantity,
    status: product.status,
    imageUrl: product.imageUrl,
    createdAt: product.createdAt,
    updatedAt: product.updatedAt
  };

  try {
    await db.collection("taskomart_products").doc(product.id).set(payload, { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryProducts.set(product.id, product);
}

async function deleteProductById(productId: string): Promise<void> {
  try {
    await db.collection("taskomart_products").doc(productId).delete();
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryProducts.delete(productId);
}

async function listOrders(): Promise<TaskoMartOrderRecord[]> {
  try {
    const snapshot = await db.collection("taskomart_orders").get();
    const orders = snapshot.docs.map((document) => normalizeOrderRecord(document.id, document.data()));
    orders.forEach((order) => inMemoryOrders.set(order.id, order));
    return orders.sort((left, right) => toEpoch(right.orderDate) - toEpoch(left.orderDate));
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryOrders.values()).sort((left, right) => toEpoch(right.orderDate) - toEpoch(left.orderDate));
}

async function getOrderById(orderId: string): Promise<TaskoMartOrderRecord | null> {
  try {
    const document = await db.collection("taskomart_orders").doc(orderId).get();
    if (document.exists) {
      const order = normalizeOrderRecord(document.id, document.data() || {});
      inMemoryOrders.set(order.id, order);
      return order;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return inMemoryOrders.get(orderId) || null;
}

async function getOrderByOrderCode(orderCode: string): Promise<TaskoMartOrderRecord | null> {
  const normalizedOrderCode = readTrimmedString(orderCode);
  if (!normalizedOrderCode) {
    return null;
  }

  try {
    const snapshot = await db
      .collection("taskomart_orders")
      .where("orderId", "==", normalizedOrderCode)
      .limit(1)
      .get();
    if (!snapshot.empty) {
      const document = snapshot.docs[0];
      const order = normalizeOrderRecord(document.id, document.data());
      inMemoryOrders.set(order.id, order);
      return order;
    }
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  return Array.from(inMemoryOrders.values()).find((order) => order.orderId === normalizedOrderCode) || null;
}

async function saveOrder(order: TaskoMartOrderRecord): Promise<void> {
  const payload = {
    orderId: order.orderId,
    userId: order.userId,
    userName: order.userName,
    userEmail: order.userEmail,
    userPhone: order.userPhone,
    deliveryAddress: order.deliveryAddress,
    items: order.items,
    totalAmount: order.totalAmount,
    orderStatus: order.orderStatus,
    paymentStatus: order.paymentStatus,
    orderDate: order.orderDate,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt
  };

  try {
    await db.collection("taskomart_orders").doc(order.id).set(payload, { merge: true });
  } catch (error) {
    if (!isFirestoreUnavailableError(error)) {
      throw error;
    }
  }

  inMemoryOrders.set(order.id, order);
}

function createOrderCode(): string {
  const epochSuffix = Date.now().toString().slice(-8);
  const randomSuffix = crypto.randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();
  return `TM-${epochSuffix}-${randomSuffix}`;
}

function ensureValidAdminSession(req: Request, res: Response, validateAdminSession: (token: string) => boolean): string | null {
  const sessionToken = getAdminSessionToken(req);
  if (!sessionToken || !validateAdminSession(sessionToken)) {
    res.status(401).json({ message: "Admin session is invalid or expired" });
    return null;
  }
  return sessionToken;
}

function inferPaymentStatusFromCustomerInfo(customerInfo: Record<string, unknown> | null): TaskoMartPaymentStatus {
  if (!customerInfo) {
    return "Pending";
  }
  const option = readTrimmedString(customerInfo.paymentOption).toLowerCase();
  if (!option) return "Pending";
  return option === "cash on delivery" ? "Pending" : "Paid";
}

function normalizeCategoryFilter(value: unknown): string {
  return readTrimmedString(value).toLowerCase();
}

export function registerTaskoMartRoutes(app: Express, options: RegisterTaskoMartRoutesOptions): void {
  app.get("/api/admin/taskomart/products", async (req: Request, res: Response) => {
    if (!ensureValidAdminSession(req, res, options.validateAdminSession)) {
      return;
    }

    try {
      const searchText = readTrimmedString(req.query.search).toLowerCase();
      const categoryFilter = normalizeCategoryFilter(req.query.category);
      const products = await listProducts();

      const filtered = products.filter((product) => {
        const matchesSearch =
          !searchText ||
          product.name.toLowerCase().includes(searchText) ||
          product.description.toLowerCase().includes(searchText);
        const matchesCategory = !categoryFilter || product.category.toLowerCase() === categoryFilter;
        return matchesSearch && matchesCategory;
      });

      const categories = Array.from(
        new Set([
          ...groceryCategories,
          ...products.map((product) => product.category).filter((value) => Boolean(readTrimmedString(value)))
        ])
      ).sort((left, right) => left.localeCompare(right));

      return res.json({
        products: filtered.map((product) => toProductResponse(product)),
        categories,
        statuses: productStatuses
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to load TaskoMart products",
        error: getErrorMessage(error)
      });
    }
  });

  app.post("/api/admin/taskomart/products", async (req: Request, res: Response) => {
    if (!ensureValidAdminSession(req, res, options.validateAdminSession)) {
      return;
    }

    try {
      if (!isRecord(req.body)) {
        return res.status(400).json({ message: "Invalid product payload." });
      }

      const payload = req.body as ProductInputBody;
      const name = readTrimmedString(payload.name);
      const description = readTrimmedString(payload.description);
      const category = readTrimmedString(payload.category);
      const price = readNonNegativeNumber(payload.price);
      const stockQuantity = readNonNegativeInteger(payload.stockQuantity ?? payload.stock);
      const discountPrice = readOptionalNumber(payload.discountPrice);
      const imageInput = payload.image ?? payload.imageFile;

      if (!name || !category || price === null || stockQuantity === null) {
        return res.status(400).json({
          message: "name, category, price and stockQuantity are required."
        });
      }
      if (discountPrice !== null && (discountPrice < 0 || discountPrice > price)) {
        return res.status(400).json({ message: "discountPrice must be less than or equal to price." });
      }

      let imageUrl = "";
      if (imageInput !== undefined && imageInput !== null && String(imageInput).trim() !== "") {
        imageUrl = await persistProductImage(imageInput);
      }

      const now = new Date().toISOString();
      const productId = `taskomart-product-${crypto.randomUUID()}`;
      const product = normalizeProductRecord(productId, {
        name,
        description,
        category,
        price,
        discountPrice,
        stockQuantity,
        status: payload.status,
        imageUrl,
        createdAt: now,
        updatedAt: now
      });

      await saveProduct(product);
      return res.status(201).json({
        message: "Product created successfully.",
        product: toProductResponse(product)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to create product",
        error: getErrorMessage(error)
      });
    }
  });

  app.put("/api/admin/taskomart/products/:productId", async (req: Request, res: Response) => {
    if (!ensureValidAdminSession(req, res, options.validateAdminSession)) {
      return;
    }

    try {
      const productId = readTrimmedString(req.params.productId);
      if (!productId) {
        return res.status(400).json({ message: "productId is required." });
      }

      if (!isRecord(req.body)) {
        return res.status(400).json({ message: "Invalid product payload." });
      }

      const existing = await getProductById(productId);
      if (!existing) {
        return res.status(404).json({ message: "Product not found." });
      }

      const body = req.body as Record<string, unknown>;
      const nextProduct: TaskoMartProductRecord = { ...existing };
      let replacedImage = false;

      if (hasOwn(body, "name")) {
        const nextName = readTrimmedString(body.name);
        if (!nextName) {
          return res.status(400).json({ message: "name cannot be empty." });
        }
        nextProduct.name = nextName;
      }

      if (hasOwn(body, "description")) {
        nextProduct.description = readTrimmedString(body.description);
      }

      if (hasOwn(body, "category")) {
        const nextCategory = readTrimmedString(body.category);
        if (!nextCategory) {
          return res.status(400).json({ message: "category cannot be empty." });
        }
        nextProduct.category = nextCategory;
      }

      if (hasOwn(body, "price")) {
        const nextPrice = readNonNegativeNumber(body.price);
        if (nextPrice === null) {
          return res.status(400).json({ message: "price must be a non-negative number." });
        }
        nextProduct.price = nextPrice;
      }

      if (hasOwn(body, "discountPrice")) {
        const parsedDiscount = readOptionalNumber(body.discountPrice);
        if (parsedDiscount !== null && parsedDiscount < 0) {
          return res.status(400).json({ message: "discountPrice must be a non-negative number." });
        }
        nextProduct.discountPrice = parsedDiscount;
      }

      if (hasOwn(body, "stockQuantity") || hasOwn(body, "stock")) {
        const stockSource = hasOwn(body, "stockQuantity") ? body.stockQuantity : body.stock;
        const nextStockQuantity = readNonNegativeInteger(stockSource);
        if (nextStockQuantity === null) {
          return res.status(400).json({ message: "stockQuantity must be a non-negative integer." });
        }
        nextProduct.stockQuantity = nextStockQuantity;
      }

      if (hasOwn(body, "image") || hasOwn(body, "imageFile")) {
        const imageInput = hasOwn(body, "image") ? body.image : body.imageFile;
        if (imageInput !== undefined && imageInput !== null && String(imageInput).trim() !== "") {
          const nextImageUrl = await persistProductImage(imageInput);
          nextProduct.imageUrl = nextImageUrl;
          replacedImage = true;
        }
      }

      if (nextProduct.discountPrice !== null && nextProduct.discountPrice > nextProduct.price) {
        return res.status(400).json({ message: "discountPrice must be less than or equal to price." });
      }

      const nextStatusInput = hasOwn(body, "status") ? body.status : nextProduct.status;
      nextProduct.status = normalizeProductStatus(nextStatusInput, nextProduct.stockQuantity);
      nextProduct.updatedAt = new Date().toISOString();

      await saveProduct(nextProduct);

      if (replacedImage && existing.imageUrl && existing.imageUrl !== nextProduct.imageUrl) {
        await deleteProductImage(existing.imageUrl);
      }

      return res.json({
        message: "Product updated successfully.",
        product: toProductResponse(nextProduct)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update product",
        error: getErrorMessage(error)
      });
    }
  });

  app.delete("/api/admin/taskomart/products/:productId", async (req: Request, res: Response) => {
    if (!ensureValidAdminSession(req, res, options.validateAdminSession)) {
      return;
    }

    try {
      const productId = readTrimmedString(req.params.productId);
      if (!productId) {
        return res.status(400).json({ message: "productId is required." });
      }

      const existing = await getProductById(productId);
      if (!existing) {
        return res.status(404).json({ message: "Product not found." });
      }

      await deleteProductById(productId);
      await deleteProductImage(existing.imageUrl);

      return res.json({ message: "Product deleted successfully." });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to delete product",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/taskomart/products", async (req: Request, res: Response) => {
    try {
      const searchText = readTrimmedString(req.query.search).toLowerCase();
      const categoryFilter = normalizeCategoryFilter(req.query.category);
      const statusFilter = readTrimmedString(req.query.status);
      const products = await listProducts();

      const filtered = products.filter((product) => {
        const matchesSearch =
          !searchText ||
          product.name.toLowerCase().includes(searchText) ||
          product.description.toLowerCase().includes(searchText);
        const matchesCategory = !categoryFilter || product.category.toLowerCase() === categoryFilter;
        const matchesStatus = !statusFilter || product.status === normalizeProductStatus(statusFilter, product.stockQuantity);
        return matchesSearch && matchesCategory && matchesStatus;
      });

      return res.json(filtered.map((product) => toProductResponse(product)));
    } catch (error) {
      return res.status(500).json({
        message: "Failed to load products",
        error: getErrorMessage(error)
      });
    }
  });

  app.post("/api/taskomart/orders", async (req: Request, res: Response) => {
    try {
      if (!isRecord(req.body)) {
        return res.status(400).json({ message: "Invalid order payload." });
      }

      const payload = req.body as CheckoutInputBody;
      const customerInfo = isRecord(payload.customerInfo) ? payload.customerInfo : null;
      const requestItems = normalizeOrderItems(payload.items);
      if (requestItems.length === 0) {
        return res.status(400).json({ message: "At least one order item is required." });
      }

      const quantityByProductId = new Map<string, number>();
      requestItems.forEach((item) => {
        quantityByProductId.set(item.productId, (quantityByProductId.get(item.productId) || 0) + item.quantity);
      });

      const currentProducts = new Map<string, TaskoMartProductRecord>();
      for (const [productId, requestedQuantity] of quantityByProductId.entries()) {
        const product = await getProductById(productId);
        if (!product) {
          return res.status(400).json({ message: `Product not found: ${productId}` });
        }
        if (product.stockQuantity < requestedQuantity) {
          return res
            .status(400)
            .json({ message: `Insufficient stock for ${product.name}. Available: ${product.stockQuantity}` });
        }
        currentProducts.set(productId, product);
      }

      const orderItems: TaskoMartOrderItemRecord[] = Array.from(quantityByProductId.entries()).map(
        ([productId, quantity]) => {
          const product = currentProducts.get(productId) as TaskoMartProductRecord;
          return {
            productId: product.id,
            name: product.name,
            quantity,
            price: product.discountPrice !== null ? product.discountPrice : product.price,
            imageUrl: product.imageUrl
          };
        }
      );

      const userName =
        readTrimmedString(payload.userName) ||
        readTrimmedString(customerInfo?.name) ||
        readTrimmedString((req.body as Record<string, unknown>).name);
      const deliveryAddress =
        readTrimmedString(payload.deliveryAddress) || readTrimmedString(customerInfo?.address);
      const userEmail =
        readTrimmedString(payload.userEmail) || readTrimmedString(customerInfo?.email);
      const userPhone =
        readTrimmedString(payload.userPhone) || readTrimmedString(customerInfo?.phone);
      if (!userName || !deliveryAddress) {
        return res.status(400).json({ message: "userName and deliveryAddress are required." });
      }

      const paymentStatusInput = readTrimmedString(payload.paymentStatus);
      const paymentStatus = paymentStatusInput
        ? normalizePaymentStatus(paymentStatusInput)
        : inferPaymentStatusFromCustomerInfo(customerInfo);
      const now = new Date().toISOString();
      const previousProductStates = Array.from(currentProducts.values()).map((product) => ({ ...product }));

      try {
        await Promise.all(
          previousProductStates.map(async (product) => {
            const orderedQuantity = quantityByProductId.get(product.id) || 0;
            const nextStockQuantity = Math.max(0, product.stockQuantity - orderedQuantity);
            const nextProduct: TaskoMartProductRecord = {
              ...product,
              stockQuantity: nextStockQuantity,
              status: normalizeProductStatus(product.status, nextStockQuantity),
              updatedAt: now
            };
            await saveProduct(nextProduct);
          })
        );
      } catch (stockError) {
        return res.status(500).json({
          message: "Failed to update product stock",
          error: getErrorMessage(stockError)
        });
      }

      const orderDocumentId = `taskomart-order-${crypto.randomUUID()}`;
      const order = normalizeOrderRecord(orderDocumentId, {
        orderId: createOrderCode(),
        userId: readTrimmedString(payload.userId),
        userName,
        userEmail,
        userPhone,
        deliveryAddress,
        items: orderItems,
        totalAmount: orderItems.reduce((sum, item) => sum + item.price * item.quantity, 0),
        orderStatus: "Pending",
        paymentStatus,
        orderDate: now,
        createdAt: now,
        updatedAt: now
      });

      try {
        await saveOrder(order);
      } catch (saveError) {
        await Promise.all(previousProductStates.map((product) => saveProduct(product).catch(() => {})));
        throw saveError;
      }

      return res.status(201).json({
        message: "Order created successfully.",
        order: toOrderDetailResponse(order)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to create order",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/taskomart/orders", async (req: Request, res: Response) => {
    try {
      const userId = readTrimmedString(req.query.userId);
      const userEmail = readTrimmedString(req.query.userEmail).toLowerCase();
      const userPhone = readTrimmedString(req.query.userPhone);
      if (!userId && !userEmail && !userPhone) {
        return res
          .status(400)
          .json({ message: "Provide at least one filter: userId, userEmail, or userPhone." });
      }

      const orders = await listOrders();
      const filtered = orders.filter((order) => {
        if (userId && order.userId && order.userId !== userId) {
          return false;
        }
        if (userEmail && order.userEmail.toLowerCase() !== userEmail) {
          return false;
        }
        if (userPhone && order.userPhone !== userPhone) {
          return false;
        }
        return true;
      });

      return res.json(filtered.map((order) => toOrderDetailResponse(order)));
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch orders",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/admin/taskomart/orders", async (req: Request, res: Response) => {
    if (!ensureValidAdminSession(req, res, options.validateAdminSession)) {
      return;
    }

    try {
      const statusFilterInput = readTrimmedString(req.query.status);
      const fromDateTimestamp = parseDateTimestamp(req.query.fromDate);
      const toDateTimestamp = parseDateEndTimestamp(req.query.toDate);

      if (statusFilterInput && !isRecognizedOrderStatus(statusFilterInput)) {
        return res.status(400).json({ message: "Invalid order status filter." });
      }
      if (readTrimmedString(req.query.fromDate) && fromDateTimestamp === null) {
        return res.status(400).json({ message: "Invalid fromDate filter." });
      }
      if (readTrimmedString(req.query.toDate) && toDateTimestamp === null) {
        return res.status(400).json({ message: "Invalid toDate filter." });
      }

      const normalizedStatusFilter = statusFilterInput ? normalizeOrderStatus(statusFilterInput) : "";
      const orders = await listOrders();
      const filteredOrders = orders.filter((order) => {
        const orderTime = toEpoch(order.orderDate || order.createdAt);
        if (normalizedStatusFilter && order.orderStatus !== normalizedStatusFilter) {
          return false;
        }
        if (fromDateTimestamp !== null && orderTime < fromDateTimestamp) {
          return false;
        }
        if (toDateTimestamp !== null && orderTime > toDateTimestamp) {
          return false;
        }
        return true;
      });

      return res.json({
        orders: filteredOrders.map((order) => toOrderSummaryResponse(order)),
        statuses: orderStatuses,
        paymentStatuses
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch TaskoMart orders",
        error: getErrorMessage(error)
      });
    }
  });

  app.get("/api/admin/taskomart/orders/:orderId", async (req: Request, res: Response) => {
    if (!ensureValidAdminSession(req, res, options.validateAdminSession)) {
      return;
    }

    try {
      const orderIdentifier = readTrimmedString(req.params.orderId);
      if (!orderIdentifier) {
        return res.status(400).json({ message: "orderId is required." });
      }

      const order = (await getOrderById(orderIdentifier)) || (await getOrderByOrderCode(orderIdentifier));
      if (!order) {
        return res.status(404).json({ message: "Order not found." });
      }

      return res.json({
        order: toOrderDetailResponse(order)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to fetch order details",
        error: getErrorMessage(error)
      });
    }
  });

  app.patch("/api/admin/taskomart/orders/:orderId/status", async (req: Request, res: Response) => {
    if (!ensureValidAdminSession(req, res, options.validateAdminSession)) {
      return;
    }

    try {
      if (!isRecord(req.body)) {
        return res.status(400).json({ message: "Invalid status payload." });
      }

      const orderIdentifier = readTrimmedString(req.params.orderId);
      const statusInput = readTrimmedString(req.body.status);
      if (!orderIdentifier || !statusInput) {
        return res.status(400).json({ message: "orderId and status are required." });
      }

      if (!isRecognizedOrderStatus(statusInput)) {
        return res.status(400).json({ message: "Invalid order status." });
      }

      const nextStatus = normalizeOrderStatus(statusInput);

      const currentOrder =
        (await getOrderById(orderIdentifier)) || (await getOrderByOrderCode(orderIdentifier));
      if (!currentOrder) {
        return res.status(404).json({ message: "Order not found." });
      }

      const updatedOrder: TaskoMartOrderRecord = {
        ...currentOrder,
        orderStatus: nextStatus,
        updatedAt: new Date().toISOString()
      };
      await saveOrder(updatedOrder);

      return res.json({
        message: "Order status updated successfully.",
        order: toOrderDetailResponse(updatedOrder)
      });
    } catch (error) {
      return res.status(500).json({
        message: "Failed to update order status",
        error: getErrorMessage(error)
      });
    }
  });
}
