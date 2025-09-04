import React from 'react';
import { useNavigate } from 'react-router-dom';
import { X, Trash2 } from 'lucide-react';
import { useCart } from '../contexts/CartContext';

const BACKEND_BASE = (process.env.REACT_APP_API_URL || 'http://localhost:5000/api').replace(/\/?api\/?$/, '');

const CartDrawer = () => {
  const { isOpen, closeCart, items, updateQuantity, removeFromCart, total, clearCart } = useCart();
  const navigate = useNavigate();

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      <div className="absolute inset-0 bg-black/50" onClick={closeCart} />
      <div className="absolute right-0 top-0 h-full w-full max-w-md bg-white shadow-xl flex flex-col">
        <div className="flex items-center justify-between border-b px-4 py-3">
          <h2 className="text-lg font-semibold text-gray-800">Your Cart</h2>
          <button onClick={closeCart} className="p-2 text-gray-500 hover:text-gray-700"><X className="h-5 w-5" /></button>
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {items.length === 0 ? (
            <div className="text-center text-gray-500">Your cart is empty.</div>
          ) : (
            items.map((it) => (
              <div key={it.productId} className="flex items-center gap-3 border rounded-lg p-3">
                {it.imageUrl ? (
                  <img src={`${BACKEND_BASE}${it.imageUrl}`} alt={it.name} className="h-16 w-16 rounded object-cover" />
                ) : (
                  <div className="h-16 w-16 rounded bg-gray-100 flex items-center justify-center text-xs text-gray-400">No Image</div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="font-medium text-gray-900 truncate">{it.name}</div>
                  <div className="text-sm text-gray-600">₹{Number(it.price).toFixed(2)}</div>
                  <div className="mt-2 flex items-center gap-2">
                    <label className="sr-only" htmlFor={`qty-${it.productId}`}>Quantity</label>
                    <input
                      id={`qty-${it.productId}`}
                      type="number"
                      min={1}
                      value={it.quantity}
                      onChange={(e) => updateQuantity(it.productId, Number(e.target.value) || 1)}
                      className="w-20 rounded border px-2 py-1 text-sm"
                    />
                    <button onClick={() => removeFromCart(it.productId)} className="ml-auto inline-flex items-center gap-1 rounded bg-red-50 px-2 py-1 text-xs font-medium text-red-700 hover:bg-red-100">
                      <Trash2 className="h-4 w-4" /> Remove
                    </button>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
        <div className="border-t p-4">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Total</span>
            <span className="text-lg font-semibold text-gray-900">₹{total.toFixed(2)}</span>
          </div>
          <div className="mt-3 flex gap-3">
            <button onClick={clearCart} disabled={items.length === 0} className="flex-1 rounded border px-4 py-2 text-sm hover:bg-gray-50 disabled:opacity-60">Clear</button>
            <button onClick={() => { closeCart(); navigate('/customer/checkout'); }} disabled={items.length === 0} className="flex-1 rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">Checkout</button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CartDrawer;
