import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import WorkerNavbar from './components/WorkerNavbar';
import CustomerNavbar from './components/CustomerNavbar';
import { SocketProvider, useSocket } from './contexts/SocketContext';
import NotificationToast from './components/NotificationToast';

// Worker Pages
import WorkerDashboard from './pages/worker/Dashboard';
import WorkerProfile from './pages/worker/Profile';
import WorkerServices from './pages/worker/Services';
import WorkerBookings from './pages/worker/Bookings';
import WorkerEarnings from './pages/worker/Earnings';

// Customer Pages
import CustomerHome from './pages/customer/Home';
import SearchWorkers from './pages/customer/SearchWorkers';
import CustomerBookings from './pages/customer/BookingHistory';
import Favorites from './pages/customer/Favorites';
import CustomerProfile from './pages/customer/Profile';
import BookService from './pages/customer/BookService';
import WorkerProfileView from './pages/customer/WorkerProfile';
import Payment from './pages/customer/Payment';

// Shared Pages
import Login from './pages/Login';
import Register from './pages/Register';
import './index.css';

const AppContent = () => {
  const [userType, setUserType] = useState(localStorage.getItem('userType') || null);
  const [isAuthenticated, setIsAuthenticated] = useState(localStorage.getItem('isAuthenticated') === 'true');
  const { notifications, clearNotification } = useSocket();

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
  };

  return (
    <Router future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <div className="min-h-screen bg-gray-50">
        {/* Notification Toasts */}
        {notifications.map((notification) => (
          <NotificationToast
            key={notification.id}
            notification={notification}
            onClose={clearNotification}
          />
        ))}
        <Routes>
          <Route 
            path="/login" 
            element={
              isAuthenticated ? 
                <Navigate to={userType === 'worker' ? '/worker/dashboard' : '/customer/home'} replace /> :
                <Login onLogin={handleLogin} />
            } 
          />
          <Route 
            path="/register" 
            element={
              isAuthenticated ? 
                <Navigate to={userType === 'worker' ? '/worker/dashboard' : '/customer/home'} replace /> :
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
                    <Route path="/profile" element={<CustomerProfile />} />
                    <Route path="/book/:workerId" element={<BookService />} />
                    <Route path="/worker/:workerId" element={<WorkerProfileView />} />
                    <Route path="/payment" element={<Payment />} />
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
                <Navigate to={userType === 'worker' ? '/worker/dashboard' : '/customer/home'} replace />
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
      <AppContent />
    </SocketProvider>
  );
}

export default App;
