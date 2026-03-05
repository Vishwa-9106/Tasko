import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api";
import { API_BASE_URL } from "../config";
import UserPortalShell from "../components/UserPortalShell";
import { CategoryIcon, SearchIcon } from "../components/PortalIcons";
import { groceryCategories } from "./homeData";
import { readSessionCache, writeSessionCache } from "../utils/sessionCache";

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
  if (!Number.isFinite(amount)) return "Price on request";
  return `INR ${Math.round(amount)}`;
}

const fallbackProducts = [
  {
    id: "veg-basket",
    name: "Daily Vegetable Basket",
    category: "Vegetables",
    price: 249,
    imageUrl: ""
  },
  {
    id: "fruit-combo",
    name: "Fresh Fruit Combo",
    category: "Fruits",
    price: 299,
    imageUrl: ""
  },
  {
    id: "dairy-pack",
    name: "Dairy Essentials",
    category: "Dairy",
    price: 199,
    imageUrl: ""
  },
  {
    id: "snack-box",
    name: "Evening Snack Box",
    category: "Snacks",
    price: 159,
    imageUrl: ""
  },
  {
    id: "beverage-pack",
    name: "Beverage Family Pack",
    category: "Beverages",
    price: 219,
    imageUrl: ""
  },
  {
    id: "rice-dal-kit",
    name: "Rice & Dal Kit",
    category: "Rice & Dal",
    price: 349,
    imageUrl: ""
  }
];

export default function TaskoMartPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const [products, setProducts] = useState(fallbackProducts);
  const [loading, setLoading] = useState(true);

  const selectedCategory = searchParams.get("category") || "";
  const selectedSearch = searchParams.get("search") || "";

  useEffect(() => {
    const loadProducts = async () => {
      const cacheKey = "taskomart:products:list";
      const cachedProducts = readSessionCache(cacheKey, 60 * 1000);
      if (Array.isArray(cachedProducts) && cachedProducts.length > 0) {
        setProducts(cachedProducts);
        return;
      }

      const response = await api.get("/api/taskomart/products", {
        params: { limit: 20 }
      });
      const list = Array.isArray(response.data) ? response.data : [];
      if (list.length === 0) {
        setProducts(fallbackProducts);
        return;
      }

      const normalized = list.map((item, index) => ({
        id: item?.id || item?._id || `taskomart-item-${index}`,
        name: item?.name || `TaskoMart Product ${index + 1}`,
        category: item?.category || "General",
        price: item?.discountPrice ?? item?.price,
        imageUrl: resolveImageUrl(item?.imageUrl),
        status: item?.status || "Available"
      }));
      setProducts(normalized);
      writeSessionCache(cacheKey, normalized);
    };

    loadProducts()
      .catch(() => {
        setProducts(fallbackProducts);
      })
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const builtIn = groceryCategories.map((category) => category.name);
    const discovered = products.map((product) => product.category);
    return Array.from(new Set([...builtIn, ...discovered])).filter(Boolean);
  }, [products]);

  const filteredProducts = useMemo(() => {
    const categoryFilter = normalizeText(selectedCategory);
    const searchFilter = normalizeText(selectedSearch);

    return products.filter((product) => {
      const categoryText = normalizeText(product.category);
      const searchable = normalizeText(`${product.name} ${product.category}`);
      const categoryMatches = !categoryFilter || categoryText === categoryFilter;
      const searchMatches = !searchFilter || searchable.includes(searchFilter);
      return categoryMatches && searchMatches;
    });
  }, [products, selectedCategory, selectedSearch]);

  return (
    <UserPortalShell activeNav="taskomart">
      <section className="tasko-page-header">
        <p>TaskoMart</p>
        <h1>Grocery Product Listing</h1>
        <p>Browse grocery categories and discover products available near you.</p>
      </section>

      <section className="tasko-content-panel">
        <div className="tasko-toolbar">
          <div className="tasko-chip-row">
            {categories.map((categoryName) => {
              const isActive = normalizeText(selectedCategory) === normalizeText(categoryName);
              return (
                <button
                  key={categoryName}
                  type="button"
                  className={`tasko-chip ${isActive ? "is-active" : ""}`}
                  onClick={() => {
                    const next = new URLSearchParams(searchParams);
                    next.set("category", categoryName);
                    setSearchParams(next);
                  }}
                >
                  {categoryName}
                </button>
              );
            })}
          </div>

          <form
            className="tasko-inline-search"
            onSubmit={(event) => {
              event.preventDefault();
            }}
          >
            <label htmlFor="taskomart-search" className="sr-only">
              Search products
            </label>
            <SearchIcon className="tasko-search-icon" />
            <input
              id="taskomart-search"
              type="search"
              value={selectedSearch}
              onChange={(event) => {
                const next = new URLSearchParams(searchParams);
                const nextValue = event.target.value;
                if (nextValue.trim()) {
                  next.set("search", nextValue);
                } else {
                  next.delete("search");
                }
                setSearchParams(next);
              }}
              placeholder="Search products"
            />
          </form>
        </div>

        {loading ? <p className="tasko-empty-state">Loading products...</p> : null}

        {!loading && filteredProducts.length === 0 ? (
          <p className="tasko-empty-state">No products found for this category.</p>
        ) : (
          <div className="taskomart-grid">
            {filteredProducts.map((product) => {
              const iconName =
                groceryCategories.find((category) => normalizeText(category.name) === normalizeText(product.category))
                  ?.icon || "beverages";

              return (
                <article key={product.id} className="tasko-product-card">
                  <div className="tasko-product-image-wrap">
                    {product.imageUrl ? (
                      <img src={product.imageUrl} alt={product.name} className="tasko-product-image" />
                    ) : (
                      <span className="tasko-card-icon large">
                        <CategoryIcon name={iconName} className="tasko-line-icon" />
                      </span>
                    )}
                  </div>
                  <p className="tasko-product-category">{product.category}</p>
                  <h3>{product.name}</h3>
                  <p className="tasko-product-price">{toRupee(product.price)}</p>
                  <button type="button">View Product</button>
                </article>
              );
            })}
          </div>
        )}
      </section>
    </UserPortalShell>
  );
}
