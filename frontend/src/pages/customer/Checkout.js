import React, { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useCart } from '../../contexts/CartContext';
import { ordersAPI } from '../../services/api';

const Checkout = () => {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const [form, setForm] = useState({ name: '', address: '', phone: '', paymentOption: 'Cash on Delivery' });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');

  const disabled = useMemo(() => submitting || items.length === 0, [submitting, items.length]);

  const handleChange = (e) => setForm((f) => ({ ...f, [e.target.name]: e.target.value }));

  const submitOrder = async (e) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);
    try {
      const payload = {
        customerInfo: form,
        items: items.map((it) => ({ productId: it.productId, name: it.name, price: it.price, quantity: it.quantity })),
        total,
      };
      const order = await ordersAPI.createOrder(payload);
      clearCart();
      navigate('/customer/order-success', { state: { orderId: order._id } });
    } catch (err) {
      setError(err.message || 'Failed to place order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-5xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Checkout</h1>
          <p className="mt-1 text-gray-600">Enter your details and confirm your order</p>
        </div>
        {items.length === 0 ? (
          <div className="rounded border bg-white p-6 text-center text-gray-500">Your cart is empty.</div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <form onSubmit={submitOrder} className="lg:col-span-2 bg-white border rounded-xl p-4 sm:p-6">
              {error && <div className="mb-3 rounded bg-red-50 p-2 text-sm text-red-700">{error}</div>}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="name">Name</label>
                  <input id="name" name="name" value={form.name} onChange={handleChange} required className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="phone">Phone</label>
                  <input id="phone" name="phone" value={form.phone} onChange={handleChange} required className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="address">Address</label>
                  <textarea id="address" name="address" rows={3} value={form.address} onChange={handleChange} required className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500" />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor="paymentOption">Payment Option</label>
                  <select id="paymentOption" name="paymentOption" value={form.paymentOption} onChange={handleChange} className="w-full rounded-md border px-3 py-2 text-sm shadow-sm focus:border-primary-500 focus:outline-none focus:ring-1 focus:ring-primary-500">
                    <option>Cash on Delivery</option>
                    <option>UPI</option>
                    <option>Card</option>
                    <option>Net Banking</option>
                    <option>Wallet</option>
                  </select>
                </div>
              </div>
              <div className="mt-6 flex gap-3">
                <button type="button" onClick={() => navigate('/customer/products')} className="rounded border px-4 py-2 text-sm hover:bg-gray-50">Cancel</button>
                <button type="submit" disabled={disabled} className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700 disabled:opacity-60">{submitting ? 'Placing Order...' : 'Confirm Order'}</button>
              </div>
            </form>
            <div className="bg-white border rounded-xl p-4 sm:p-6">
              <h2 className="text-lg font-semibold text-gray-900 mb-3">Order Summary</h2>
              <div className="space-y-3">
                {items.map((it) => (
                  <div key={it.productId} className="flex items-center justify-between">
                    <div className="min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{it.name}</div>
                      <div className="text-xs text-gray-600">Qty: {it.quantity}</div>
                    </div>
                    <div className="text-sm text-gray-700">₹{(it.price * it.quantity).toFixed(2)}</div>
                  </div>
                ))}
              </div>
              <div className="mt-4 border-t pt-3 flex items-center justify-between">
                <span className="text-sm text-gray-600">Total</span>
                <span className="text-lg font-semibold text-gray-900">₹{total.toFixed(2)}</span>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default Checkout;
