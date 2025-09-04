import React from 'react';
import { useLocation, useNavigate } from 'react-router-dom';

const OrderSuccess = () => {
  const { state } = useLocation();
  const navigate = useNavigate();
  const orderId = state?.orderId;

  return (
    <div className="min-h-screen bg-gray-50 py-8 sm:py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-2xl mx-auto text-center bg-white border rounded-xl p-6">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Order Confirmed!</h1>
        <p className="mt-2 text-gray-600">Thank you for your purchase. Your order has been placed successfully.</p>
        {orderId && <p className="mt-1 text-sm text-gray-500">Order ID: {orderId}</p>}
        <div className="mt-6 flex flex-col sm:flex-row items-center justify-center gap-3">
          <button onClick={() => navigate('/customer/products')} className="rounded bg-primary-600 px-4 py-2 text-sm font-medium text-white hover:bg-primary-700">Continue Shopping</button>
        </div>
      </div>
    </div>
  );
};

export default OrderSuccess;
