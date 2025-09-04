import React, { useState } from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Calendar, 
  Heart, 
  User, 
  LogOut,
  Cookie,
  Menu,
  X,
  ShoppingBag,
  ShoppingCart
} from 'lucide-react';
import { useCart } from '../contexts/CartContext';

const CustomerNavbar = ({ onLogout }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { count, openCart } = useCart();

  const navItems = [
    { path: '/customer/home', icon: Home, label: 'Home' },
    { path: '/customer/search', icon: Search, label: 'Find Workers' },
    { path: '/customer/bookings', icon: Calendar, label: 'My Bookings' },
    { path: '/customer/favorites', icon: Heart, label: 'Favorites' },
    { path: '/customer/products', icon: ShoppingBag, label: 'Cookie Product' },
    { path: '/customer/profile', icon: User, label: 'Profile' },
  ];

  const toggleMobileMenu = () => {
    setIsMobileMenuOpen(!isMobileMenuOpen);
  };

  const closeMobileMenu = () => {
    setIsMobileMenuOpen(false);
  };

  return (
    <>
      {/* Mobile Header */}
      <div className="lg:hidden bg-white shadow-sm border-b border-gray-200 fixed top-0 left-0 right-0 z-50">
        <div className="flex items-center justify-between px-4 py-3">
          <div className="flex items-center">
            <Cookie className="h-6 w-6 text-primary-600 mr-2" />
            <span className="text-lg font-bold text-gray-800">Cookie</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={openCart}
              className="relative p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
              aria-label="Open cart"
            >
              <ShoppingCart className="h-6 w-6" />
              {count > 0 && (
                <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-primary-600 text-white text-[10px] leading-[18px] text-center">
                  {count}
                </span>
              )}
            </button>
            <button
              onClick={toggleMobileMenu}
              className="p-2 rounded-lg text-gray-600 hover:bg-gray-100 transition-colors"
            >
              {isMobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu Overlay */}
      {isMobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black bg-opacity-50" onClick={closeMobileMenu}></div>
      )}

      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r border-gray-200 z-50 transform transition-transform duration-300 ease-in-out ${
        isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      }`}>
        {/* Logo */}
        <div className="flex items-center justify-between h-16 border-b border-gray-200 px-3 lg:px-4">
          <div className="flex items-center">
            <Cookie className="h-6 w-6 lg:h-8 lg:w-8 text-primary-600 mr-2" />
            <span className="text-lg lg:text-xl font-bold text-gray-800">Cookie</span>
          </div>
          {/* Cart icon removed from sidebar as requested */}
          <div />
        </div>

        {/* Navigation */}
        <nav className="mt-6 lg:mt-8">
          <div className="px-3 lg:px-4 space-y-1 lg:space-y-2">
            {navItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                onClick={closeMobileMenu}
                className={({ isActive }) =>
                  `flex items-center px-3 lg:px-4 py-2.5 lg:py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                    isActive
                      ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                  }`
                }
              >
                <item.icon className="h-4 w-4 lg:h-5 lg:w-5 mr-2 lg:mr-3" />
                {item.label}
              </NavLink>
            ))}
          </div>
        </nav>

        {/* Logout */}
        <div className="absolute bottom-0 left-0 right-0 p-3 lg:p-4 border-t border-gray-200">
          <button 
            onClick={() => {
              onLogout();
              closeMobileMenu();
            }}
            className="flex items-center w-full px-3 lg:px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors duration-200"
          >
            <LogOut className="h-4 w-4 mr-2 lg:mr-3" />
            Logout
          </button>
        </div>
      </div>
    </>
  );
};

export default CustomerNavbar;
