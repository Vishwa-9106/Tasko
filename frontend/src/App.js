import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WorkerNavbar from './components/WorkerNavbar';
import CustomerNavbar from './components/CustomerNavbar';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import { CartProvider } from './contexts/CartContext';
import CartDrawer from './components/CartDrawer';
import NotificationToast from './components/NotificationToast';

// Worker Pages
import WorkerDashboard from './pages/worker/Dashboard';
import WorkerProfile from './pages/worker/Profile';
import WorkerServices from './pages/worker/Services';
import WorkerBookings from './pages/worker/Bookings';
import WorkerEarnings from './pages/worker/Earnings';

// Customer Pages
import CustomerHome from './pages/customer/Home';
import CategoryServices from './pages/customer/CategoryServices';
import SearchWorkers from './pages/customer/SearchWorkers';
import CustomerBookings from './pages/customer/BookingHistory';
import Favorites from './pages/customer/Favorites';
import CustomerProducts from './pages/customer/Products';
import CustomerProfile from './pages/customer/Profile';
import BookService from './pages/customer/BookService';
import WorkerProfileView from './pages/customer/WorkerProfile';
import Payment from './pages/customer/Payment';
import Checkout from './pages/customer/Checkout';
import OrderSuccess from './pages/customer/OrderSuccess';
import MyOrders from './pages/customer/MyOrders';

// Shared Pages
import Login from './pages/Login';
import Register from './pages/Register';
import './index.css';
// Admin Pages
import AdminHome from './pages/admin/Home';
import AdminWorkers from './pages/admin/Workers';
import AdminCustomers from './pages/admin/Customers';
import AdminCategories from './pages/admin/Categories';
import AdminProducts from './pages/admin/Products';
import WorkerDetails from './pages/admin/WorkerDetails';
import CustomerDetails from './pages/admin/CustomerDetails';
import AdminOrders from './pages/admin/Orders';

const AppContent = () => {
  const [userType, setUserType] = useState(localStorage.getItem('userType') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('isAuthenticated') === 'true');
  const { notifications, clearNotification, isBlocked, blockMessage, clearBlock } = useSocket();

  useEffect(() => {
    // Listen for auth changes
    const handleStorageChange = () => {
      setUserType(localStorage.getItem('userType'));
      setIsAuthenticated(localStorage.getItem('isAuthenticated') === 'true');
    };

    window.addEventListener('storage', handleStorageChange);
    return () => window.removeEventListener('storage', handleStorageChange);
  }, []);

  const handleLogin = (type) => {
    setUserType(type);
    setIsAuthenticated(true);
    localStorage.setItem('userType', type);
    localStorage.setItem('isAuthenticated', 'true');
  };

  const handleLogout = () => {
    setUserType(null);
    setIsAuthenticated(false);
    localStorage.removeItem('userType');
    localStorage.removeItem('isAuthenticated');
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    clearBlock();
    // Redirect to login
    window.location.href = '/login';
  };

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-gray-50 relative">
        {isBlocked && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60">
            <div className="mx-4 max-w-md w-full rounded-lg bg-white p-6 shadow-xl">
              <h2 className="text-xl font-semibold text-red-700">Account Blocked</h2>
              <p className="mt-2 text-sm text-gray-700">{blockMessage || 'Your account has been blocked by admin.'}</p>
              <p className="mt-2 text-xs text-gray-500">You have been logged out and cannot use the app.</p>
              <div className="mt-4 flex justify-end">
                <button onClick={handleLogout} className="rounded-md bg-red-600 text-white px-4 py-2 text-sm hover:bg-red-700">Logout</button>
              </div>
            </div>
          </div>
        )}
        {/* Notification Toasts */}
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={clearNotification}
          />
        ))}
        {/* Cart Drawer */}
        <CartDrawer />
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
                <Navigate to={userType === 'admin' ? '/admin/home' : (userType === 'worker' ? '/worker/dashboard' : '/customer/home')} replace /> :
                <Login onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/register" 
            element={
              isAuthenticated ? 
                <Navigate to={userType === 'admin' ? '/admin/home' : (userType === 'worker' ? '/worker/dashboard' : '/customer/home')} replace /> :
                <Register onRegister={handleLogin} />
            } 
          />
          
          {/* Worker Routes */}
          <Route path="/worker/*" element={
            !isAuthenticated || userType !== 'worker' ? 
              <Navigate to="/login" replace /> :
              <div className="flex">
                <WorkerNavbar onLogout={handleLogout} />
                <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
                  <Routes>
                    <Route path="/" element={<Navigate to="/worker/dashboard" replace />} />
                    <Route path="/dashboard" element={<WorkerDashboard />} />
                    <Route path="/profile" element={<WorkerProfile />} />
                    <Route path="/services" element={<WorkerServices />} />
                    <Route path="/bookings" element={<WorkerBookings />} />
                    <Route path="/earnings" element={<WorkerEarnings />} />
                  </Routes>
                </main>
              </div>
          } />

          {/* Customer Routes */}
          <Route path="/customer/*" element={
            !isAuthenticated || userType !== 'customer' ? 
              <Navigate to="/login" replace /> :
              <div className="flex">
                <CustomerNavbar onLogout={handleLogout} />
                <main className="flex-1 lg:ml-64 pt-16 lg:pt-0">
                  <Routes>
                    <Route path="/" element={<Navigate to="/customer/home" replace />} />
                    <Route path="/home" element={<CustomerHome />} />
                    <Route path="/search" element={<SearchWorkers />} />
                    <Route path="/bookings" element={<CustomerBookings />} />
                    <Route path="/favorites" element={<Favorites />} />
                    <Route path="/products" element={<CustomerProducts />} />
                    <Route path="/orders" element={<MyOrders />} />
                    <Route path="/profile" element={<CustomerProfile />} />
                    <Route path="/book/:workerId" element={<BookService />} />
                    <Route path="/services/:categoryName" element={<CategoryServices />} />
                    <Route path="/bookings/:serviceId" element={<BookService />} />
                    <Route path="/worker/:workerId" element={<WorkerProfileView />} />
                    <Route path="/payment" element={<Payment />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/order-success" element={<OrderSuccess />} />
                  </Routes>
                </main>
              </div>
          } />

          {/* Admin Routes */}
          <Route path="/admin/*" element={
            !isAuthenticated || userType !== 'admin' ?
              <Navigate to="/login" replace /> :
              <div className="flex">
                {/* No navbar for blank admin home as requested */}
                <main className="flex-1">
                  <Routes>
                    <Route path="/" element={<Navigate to="/admin/home" replace />} />
                    <Route path="/home" element={<AdminHome />} />
                    <Route path="/workers" element={<AdminWorkers />} />
                    <Route path="/workers/:id" element={<WorkerDetails />} />
                    <Route path="/customers" element={<AdminCustomers />} />
                    <Route path="/customers/:id" element={<CustomerDetails />} />
                    <Route path="/categories" element={<AdminCategories />} />
                    <Route path="/products" element={<AdminProducts />} />
                    <Route path="/orders" element={<AdminOrders />} />
                  </Routes>
                </main>
              </div>
          } />

          {/* Default redirect */}
          <Route 
            path="/" 
            element={
              !isAuthenticated ? 
                <Navigate to="/login" replace /> :
                <Navigate to={userType === 'admin' ? '/admin/home' : (userType === 'worker' ? '/worker/dashboard' : '/customer/home')} replace />
            } 
          />
        </Routes>
      </div>
    </Router>
  );
};

function App() {
  return (
    <SocketProvider>
      <CartProvider>
        <AppContent />
      </CartProvider>
    </SocketProvider>
  );
}

export default App;
