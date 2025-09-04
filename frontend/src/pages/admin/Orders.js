import React, { useEffect, useMemo, useState } from 'react';
import { ordersAPI } from '../../services/api';

const AdminOrders = () => {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    setError('');
    try {
      const data = await ordersAPI.listAll();
      setOrders(Array.isArray(data) ? data : []);
    } catch (e) {
      setError(e.message || 'Failed to load orders');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const updateStatus = async (id, status) => {
    try {
      await ordersAPI.updateStatus(id, status);
      await load();
    } catch (e) {
      alert(e.message || 'Failed to update status');
    }
  };

  const statusOptions = ['Pending', 'Confirmed', 'Delivered', 'Cancelled'];

  const content = useMemo(() => {
    if (loading) return <div className="text-gray-500">Loading...</div>;
    if (error) return <div className="rounded bg-red-50 p-3 text-sm text-red-700">{error}</div>;
    if (orders.length === 0) return <div className="rounded border bg-white p-6 text-center text-gray-500">No orders found.</div>;

    return (
      <div className="overflow-x-auto bg-white border rounded-xl">
        <table className="min-w-full text-sm">
          <thead className="bg-gray-50 text-gray-700">
            <tr>
              <th className="px-4 py-2 text-left">Order ID</th>
              <th className="px-4 py-2 text-left">Customer</th>
              <th className="px-4 py-2 text-left">Items</th>
              <th className="px-4 py-2 text-left">Total</th>
              <th className="px-4 py-2 text-left">Status</th>
              <th className="px-4 py-2 text-left">Placed At</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((o) => (
              <tr key={o._id} className="border-t">
                <td className="px-4 py-2 align-top text-gray-700">{o._id}</td>
                <td className="px-4 py-2 align-top text-gray-700">
                  <div className="font-medium">{o.customerInfo?.name}</div>
                  <div className="text-xs text-gray-500">{o.customerInfo?.phone}</div>
                  <div className="text-xs text-gray-500 line-clamp-1">{o.customerInfo?.address}</div>
                </td>
                <td className="px-4 py-2 align-top text-gray-700">
                  <ul className="list-disc pl-5 space-y-1">
                    {o.items?.map((it, idx) => (
                      <li key={idx} className="text-xs">{it.name} × {it.quantity}</li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-2 align-top text-gray-700">₹{Number(o.total).toFixed(2)}</td>
                <td className="px-4 py-2 align-top text-gray-700">
                  <select value={o.status} onChange={(e) => updateStatus(o._id, e.target.value)} className="rounded border px-2 py-1 text-xs">
                    {statusOptions.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2 align-top text-gray-700 text-xs">{new Date(o.createdAt).toLocaleString()}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  }, [orders, loading, error]);

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 sm:mb-8">
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Orders</h1>
          <p className="mt-1 text-gray-600">Manage customer orders</p>
        </div>
        {content}
      </div>
    </div>
  );
};

export default AdminOrders;
