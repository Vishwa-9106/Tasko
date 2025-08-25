import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  Home, 
  User, 
  Briefcase, 
  Calendar, 
  DollarSign, 
  LogOut,
  Cookie
} from 'lucide-react';

const WorkerNavbar = ({ onLogout }) => {
  const navItems = [
    { path: '/worker/dashboard', icon: Home, label: 'Dashboard' },
    { path: '/worker/profile', icon: User, label: 'Profile' },
    { path: '/worker/services', icon: Briefcase, label: 'My Services' },
    { path: '/worker/bookings', icon: Calendar, label: 'Bookings' },
    { path: '/worker/earnings', icon: DollarSign, label: 'Earnings' },
  ];

  return (
    <div className="fixed left-0 top-0 h-full w-64 bg-white shadow-lg border-r border-gray-200">
      {/* Logo */}
      <div className="flex items-center justify-center h-16 border-b border-gray-200">
        <Cookie className="h-8 w-8 text-primary-600 mr-2" />
        <span className="text-xl font-bold text-gray-800">Cookie Worker</span>
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

      {/* User Info & Logout */}
      <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200">
        <div className="flex items-center mb-4">
          <div className="w-10 h-10 bg-primary-100 rounded-full flex items-center justify-center">
            <User className="h-6 w-6 text-primary-600" />
          </div>
          <div className="ml-3">
            <p className="text-sm font-medium text-gray-900">John Doe</p>
            <p className="text-xs text-gray-500">Worker</p>
          </div>
        </div>
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

export default WorkerNavbar;
