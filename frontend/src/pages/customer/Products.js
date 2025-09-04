import React, { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ShoppingCart } from 'lucide-react';
import { productsAPI } from '../../services/api';
import { useCart } from '../../contexts/CartContext';

const BACKEND_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/?api\/?$/, '');

const ProductCard = ({ product }) => {
  const { addToCart, openCart } = useCart();
  const { name, description, price, imageUrl, category, stock } = product;
  const outOfStock = Number(stock) === 0;
  return (
    <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden group hover:shadow-md transition-all duration-200">
      {imageUrl ? (
        <img src={`${BACKEND_BASE}${imageUrl}`} alt={name} className="h-40 w-full object-cover" />
      ) : (
        <div className="h-40 w-full bg-gray-100 flex items-center justify-center text-gray-400 text-sm">No Image</div>
      )}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-1">{name}</h3>
          <span className="shrink-0 rounded bg-green-50 px-2 py-0.5 text-xs sm:text-sm font-medium text-green-700">₹{Number(price).toFixed(2)}</span>
        </div>
        {category && (
          <div className="mt-2">
            <span className="inline-flex items-center rounded-full bg-gray-100 px-2 py-0.5 text-xs font-medium text-gray-700 mr-2">{category}</span>
            {Number(stock) === 0 ? (
              <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">Out of Stock</span>
            ) : (
              Number(stock) > 0 && Number(stock) < 5 && (
                <span className="inline-flex items-center rounded-full bg-yellow-50 px-2 py-0.5 text-[10px] font-medium text-yellow-800">Low stock</span>
              )
            )}
          </div>
        )}
        {description ? (
          <p className="mt-2 text-sm text-gray-600 line-clamp-2">{description}</p>
        ) : (
          <p className="mt-2 text-sm text-gray-500">No description</p>
        )}
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={() => addToCart(product, 1)}
            disabled={outOfStock}
            className={`inline-flex items-center justify-center rounded-md px-3 py-2 text-sm font-medium transition-colors ${outOfStock ? 'bg-gray-300 text-gray-600 cursor-not-allowed' : 'bg-primary-600 text-white hover:bg-primary-700'}`}
          >
            {outOfStock ? 'Out of Stock' : 'Add to Cart'}
          </button>
          <button
            type="button"
            onClick={() => { if (!outOfStock) { addToCart(product, 1); openCart(); } }}
            disabled={outOfStock}
            className={`inline-flex items-center justify-center rounded-md border px-3 py-2 text-sm font-medium transition-colors ${outOfStock ? 'border-gray-300 text-gray-400 cursor-not-allowed' : 'border-primary-600 text-primary-700 hover:bg-primary-50'}`}
          >
            Buy Now
          </button>
        </div>
      </div>
    </div>
  );
};

const CustomerProducts = () => {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('all');
  const [sortBy, setSortBy] = useState('price_asc'); // price_asc | price_desc
  const intervalRef = useRef(null);
  const navigate = useNavigate();
  const { count, openCart } = useCart();

  const load = async () => {
    setLoading((prev) => prev === false && products.length === 0);
    setError('');
    try {
      const data = await productsAPI.list();
      setProducts(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load products');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // initial load
    load();

    // auto-refresh every 15s
    intervalRef.current = setInterval(load, 15000);

    // refresh when tab gains visibility
    const onVisibility = () => {
      if (document.visibilityState === 'visible') load();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
      document.removeEventListener('visibilitychange', onVisibility);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const categories = useMemo(() => {
    const set = new Set();
    for (const p of products) {
      if (p && p.category) set.add(p.category);
    }
    return ['all', ...Array.from(set)];
  }, [products]);

  const filtered = useMemo(() => {
    // Show all active products, including out-of-stock ones; purchase buttons handle disabled state
    let list = products.filter((p) => p && (p.isActive !== false));

    const q = search.trim().toLowerCase();
    if (q) {
      list = list.filter((p) => {
        const name = (p.name || '').toLowerCase();
        const cat = (p.category || '').toLowerCase();
        return name.includes(q) || cat.includes(q);
      });
    }

    if (category !== 'all') {
      list = list.filter((p) => p.category === category);
    }

    if (sortBy === 'price_asc') {
      list = [...list].sort((a, b) => Number(a.price) - Number(b.price));
    } else if (sortBy === 'price_desc') {
      list = [...list].sort((a, b) => Number(b.price) - Number(a.price));
    }

    return list;
  }, [products, search, category, sortBy]);

  const content = useMemo(() => {
    if (loading && products.length === 0) {
      return <div className="text-gray-500">Loading...</div>;
    }
    if (error) {
      return <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>;
    }
    if (filtered.length === 0) {
      return <div className="rounded border bg-white p-6 text-center text-gray-500">No products available.</div>;
    }
    return (
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
        {filtered.map((p) => (
          <ProductCard key={p._id} product={p} />
        ))}
      </div>
    );
  }, [loading, error, filtered]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8 flex items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Cookie's Products</h1>
            <p className="mt-1 text-gray-600">Browse items added by admin</p>
          </div>
          <div className="flex items-center gap-2 sm:gap-3">
            <button
              type="button"
              onClick={() => navigate('/customer/orders')}
              className="shrink-0 rounded-md border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              My Orders
            </button>
            <button
              type="button"
              onClick={openCart}
              className="relative shrink-0 p-2 rounded-md border text-gray-700 hover:bg-gray-50"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-5 w-5" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] leading-[18px] text-center">
                  {count}
                </span>
              )}
            </button>
          </div>
        </div>

        <div className="mb-6 flex w-full items-center gap-3">
          <div className="basis-1/2 min-w-0">
            <label className="sr-only" htmlFor="search">Search products</label>
            <div className="relative">
              <input
                id="search"
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search by name or category..."
                className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 pl-9 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
              />
              <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400">🔎</span>
            </div>
          </div>
          <div className="basis-1/4">
            <label className="sr-only" htmlFor="category">Category</label>
            <select
              id="category"
              value={category}
              onChange={(e) => setCategory(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              {categories.map((c) => (
                <option key={c} value={c}>{c === 'all' ? 'All categories' : c}</option>
              ))}
            </select>
          </div>
          <div className="basis-1/4">
            <label className="sr-only" htmlFor="sortBy">Sort by</label>
            <select
              id="sortBy"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500"
            >
              <option value="price_asc">Price: Low to High</option>
              <option value="price_desc">Price: High to Low</option>
            </select>
          </div>
        </div>
        <div className="mb-4 text-sm text-gray-600">Showing {filtered.length} {filtered.length === 1 ? 'product' : 'products'}</div>
        {content}
      </div>
    </div>
  );
};

export default CustomerProducts;
