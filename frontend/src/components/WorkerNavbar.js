import React, { useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { 
  Home, 
  User, 
  Briefcase, 
  Calendar, 
  DollarSign, 
  LogOut,
  Cookie,
  Menu,
  X
} from 'lucide-react';

const WorkerNavbar = () => {
  const navigate = useNavigate();
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

  const handleLogout = () => {
    localStorage.removeItem('userType');
    localStorage.removeItem('isAuthenticated');
    navigate('/login');
    window.location.reload();
  };

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  const navItems = [
    { to: '/worker/dashboard', icon: Home, label: 'Dashboard' },
    { to: '/worker/profile', icon: User, label: 'Profile' },
    { to: '/worker/services', icon: Briefcase, label: 'Services' },
    { to: '/worker/bookings', icon: Calendar, label: 'Bookings' },
    { to: '/worker/earnings', icon: DollarSign, label: 'Earnings' }
  ];

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Cookie className="h-6 w-6 text-primary-600 mr-2" />
            <h1 className="text-lg font-bold text-gray-900">Cookie</h1>
          </div>
          <button
            onClick={toggleMobileMenu}
            className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
          >
            {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={closeMobileMenu}></div>
      )}

      {/* Sidebar */}
      <div className={`bg-white shadow-sm border-r border-gray-200 w-64 min-h-screen fixed left-0 top-0 z-50 transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="p-4 lg:p-6 border-b border-gray-200">
          <div className="flex items-center">
            <Cookie className="h-6 w-6 lg:h-8 lg:w-8 text-primary-600 mr-2 lg:mr-3" />
            <div>
              <h1 className="text-lg lg:text-xl font-bold text-gray-900">Cookie</h1>
              <p className="text-xs lg:text-sm text-gray-600">Worker Dashboard</p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="p-3 lg:p-4">
          <ul className="space-y-1 lg:space-y-2">
            {navItems.map((item) => (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  onClick={closeMobileMenu}
                  className={({ isActive }) =>
                    `flex items-center px-3 lg:px-4 py-2.5 lg:py-3 text-sm font-medium rounded-lg transition-colors ${
                      isActive
                        ? 'bg-primary-100 text-primary-700 border border-primary-200'
                        : 'text-gray-600 hover:bg-gray-100 hover:text-gray-900'
                    }`
                  }
                >
                  <item.icon className="h-4 w-4 lg:h-5 lg:w-5 mr-2 lg:mr-3" />
                  {item.label}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* Logout */}
        <div className="absolute bottom-3 lg:bottom-4 left-3 lg:left-4 right-3 lg:right-4">
          <button
            onClick={() => {
              handleLogout();
              closeMobileMenu();
            }}
            className="flex items-center w-full px-3 lg:px-4 py-2.5 lg:py-3 text-sm font-medium text-gray-600 hover:bg-gray-100 hover:text-gray-900 rounded-lg transition-colors"
          >
            <LogOut className="h-4 w-4 lg:h-5 lg:w-5 mr-2 lg:mr-3" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default WorkerNavbar;
