import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  Search, 
  Calendar, 
  Heart, 
  User, 
  LogOut,
  Cookie
} from 'lucide-react';

const CustomerNavbar = ({ onLogout }) => {
  const navItems = [
    { path: '/customer/home', icon: Home, label: 'Home' },
    { path: '/customer/search', icon: Search, label: 'Find Workers' },
    { path: '/customer/bookings', icon: Calendar, label: 'My Bookings' },
    { path: '/customer/favorites', icon: Heart, label: 'Favorites' },
    { path: '/customer/profile', icon: User, label: 'Profile' },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-gray-200">
        <Cookie className="h-8 w-8 text-primary-600 mr-2" />
        <span className="text-xl font-bold text-gray-800">Cookie</span>
      </div>

      {/* Navigation */}
      <nav className="mt-8">
        <div className="px-4 space-y-2">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors duration-200 ${
                  isActive
                    ? 'bg-primary-50 text-primary-700 border-r-2 border-primary-600'
                    : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
                }`
              }
            >
              <item.icon className="h-5 w-5 mr-3" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <button 
          onClick={onLogout}
          className="flex items-center w-full px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 rounded-lg transition-colors duration-200"
        >
          <LogOut className="h-4 w-4 mr-3" />
          Logout
        </button>
      </div>
    </div>
  );
};

export default CustomerNavbar;
