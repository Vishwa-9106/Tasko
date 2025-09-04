import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';

// Minimal inline SVG icons to avoid external deps
const IconUsers = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
    <path d="M17 21v-2a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v2" />
    <circle cx="9" cy="7" r="4" />
    <path d="M23 21v-2a4 4 0 0 0-3-3.87" />
    <path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);
const IconUserCog = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
    <circle cx="8" cy="8" r="4" />
    <path d="M2 21a6 6 0 0 1 12 0" />
    <circle cx="19" cy="13" r="2" />
    <path d="M19 11v-1" /><path d="M19 17v-1" /><path d="M21 13h1" /><path d="M16 13h1" />
    <path d="M20.6 14.6l.7.7" /><path d="M16.7 10.7l.7.7" />
    <path d="M20.6 11.4l.7-.7" /><path d="M16.7 15.3l.7-.7" />
  </svg>
);
const IconGrid = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
    <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" />
    <rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
  </svg>
);
const IconPackage = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
    <path d="M16.5 9.4 7.5 4.21" />
    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 2 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="M3.29 7 12 12l8.71-5M12 22V12" />
  </svg>
);

const IconClipboard = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={props.className}>
    <rect x="8" y="3" width="8" height="4" rx="1" ry="1" />
    <path d="M16 7h1a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V9a2 2 0 0 1 2-2h1" />
    <path d="M9 12h6M9 16h6" />
  </svg>
);

const cards = [
  {
    title: 'Cookie Workers',
    icon: IconUsers,
    color: 'from-blue-500 to-indigo-600',
    hover: 'hover:shadow-blue-200/60',
    path: '/admin/workers',
    bgIcon: 'text-blue-100'
  },
  {
    title: 'Cookie Customers',
    icon: IconUserCog,
    color: 'from-emerald-500 to-teal-600',
    hover: 'hover:shadow-emerald-200/60',
    path: '/admin/customers',
    bgIcon: 'text-emerald-100'
  },
  {
    title: 'Category',
    icon: IconGrid,
    color: 'from-amber-500 to-orange-600',
    hover: 'hover:shadow-amber-200/60',
    path: '/admin/categories',
    bgIcon: 'text-amber-100'
  },
  {
    title: 'Cookie Products',
    icon: IconPackage,
    color: 'from-purple-500 to-fuchsia-600',
    hover: 'hover:shadow-fuchsia-200/60',
    path: '/admin/products',
    bgIcon: 'text-purple-100'
  },
  {
    title: 'Orders',
    icon: IconClipboard,
    color: 'from-rose-500 to-red-600',
    hover: 'hover:shadow-rose-200/60',
    path: '/admin/orders',
    bgIcon: 'text-rose-100'
  }
];

const AdminHome = () => {
  const navigate = useNavigate();
  const [showConfirm, setShowConfirm] = useState(false);
  const handleLogout = () => {
    // Clear auth state
    localStorage.removeItem('userType');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    // Redirect to login with full reload to reset app auth state
    window.location.href = '/login';
  };

  return (
    <div className="min-h-screen bg-gray-50 py-10 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="flex items-start justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Admin Home</h1>
            <p className="mt-2 text-gray-600">Manage your platform sections</p>
          </div>
          <button
            onClick={() => setShowConfirm(true)}
            className="ml-4 inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
          >
            Logout
          </button>
        </div>

        {showConfirm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="mx-4 max-w-md w-full rounded-lg bg-white p-6 shadow-xl">
              <h2 className="text-lg font-semibold text-gray-900">Are you sure you want to logout?</h2>
              <div className="mt-6 flex justify-end gap-3">
                <button
                  onClick={() => setShowConfirm(false)}
                  className="inline-flex items-center rounded-md bg-gray-100 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-200 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
                >
                  No
                </button>
                <button
                  onClick={handleLogout}
                  className="inline-flex items-center rounded-md bg-red-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-red-700 focus:outline-none focus:ring-2 focus:ring-red-500 focus:ring-offset-2"
                >
                  Yes
                </button>
              </div>
            </div>
          </div>
        )}

        <div className="mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
          {cards.map(({ title, icon: Icon, color, hover, path, bgIcon }) => (
            <button
              key={title}
              onClick={() => navigate(path)}
              className={`group relative w-full overflow-hidden rounded-xl bg-white p-5 text-left shadow-sm transition-all ${hover} hover:shadow-xl focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500`}
            >
              <div className={`absolute -right-6 -top-6 h-24 w-24 rounded-full bg-gradient-to-br ${color} opacity-10`} />
              <div className="flex items-center gap-4">
                <div className={`flex h-12 w-12 items-center justify-center rounded-lg bg-gradient-to-br ${color} text-white shadow`}> 
                  <Icon className="h-6 w-6" />
                </div>
                <div className="min-w-0">
                  <h2 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{title}</h2>
                  <p className="mt-1 text-xs sm:text-sm text-gray-500">Tap to manage</p>
                </div>
              </div>
              <div className="mt-4">
                <div className={`h-2 w-16 rounded-full bg-gradient-to-r ${color} opacity-80 group-hover:opacity-100 transition-opacity`} />
              </div>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AdminHome;
