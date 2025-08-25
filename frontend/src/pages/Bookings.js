import React, { useState } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  Mail,
  CheckCircle,
  XCircle,
  AlertCircle,
  Filter
} from 'lucide-react';

const Bookings = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [bookings] = useState([
    {
      id: 1,
      service: 'House Cleaning',
      customer: {
        name: 'Sarah Johnson',
        phone: '+1 (555) 123-4567',
        email: 'sarah.j@email.com',
        address: '123 Main St, New York, NY'
      },
      date: '2024-01-15',
      time: '10:00 AM',
      duration: 3,
      amount: 80,
      status: 'confirmed',
      notes: 'Please focus on kitchen and bathrooms'
    },
    {
      id: 2,
      service: 'Bathroom Deep Clean',
      customer: {
        name: 'Mike Chen',
        phone: '+1 (555) 987-6543',
        email: 'mike.chen@email.com',
        address: '456 Oak Ave, New York, NY'
      },
      date: '2024-01-16',
      time: '2:00 PM',
      duration: 1.5,
      amount: 45,
      status: 'pending',
      notes: 'Two bathrooms need cleaning'
    },
    {
      id: 3,
      service: 'Home Cooking',
      customer: {
        name: 'Emma Davis',
        phone: '+1 (555) 456-7890',
        email: 'emma.davis@email.com',
        address: '789 Pine St, New York, NY'
      },
      date: '2024-01-17',
      time: '6:00 PM',
      duration: 2,
      amount: 60,
      status: 'confirmed',
      notes: 'Vegetarian meal for 4 people'
    },
    {
      id: 4,
      service: 'House Cleaning',
      customer: {
        name: 'Robert Wilson',
        phone: '+1 (555) 321-0987',
        email: 'robert.w@email.com',
        address: '321 Elm St, New York, NY'
      },
      date: '2024-01-12',
      time: '9:00 AM',
      duration: 3,
      amount: 80,
      status: 'completed',
      notes: 'Regular weekly cleaning'
    }
  ]);

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'completed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'confirmed':
        return <CheckCircle className="h-4 w-4" />;
      case 'pending':
        return <AlertCircle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 'all') return true;
    return booking.status === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'All Bookings', count: bookings.length },
    { id: 'pending', label: 'Pending', count: bookings.filter(b => b.status === 'pending').length },
    { id: 'confirmed', label: 'Confirmed', count: bookings.filter(b => b.status === 'confirmed').length },
    { id: 'completed', label: 'Completed', count: bookings.filter(b => b.status === 'completed').length }
  ];

  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">{booking.service}</h3>
          <p className="text-gray-600 text-sm">Booking #{booking.id}</p>
        </div>
        <div className={`flex items-center px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(booking.status)}`}>
          {getStatusIcon(booking.status)}
          <span className="ml-1 capitalize">{booking.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        {/* Customer Info */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Customer</h4>
          <div className="flex items-center text-sm text-gray-600">
            <User className="h-4 w-4 mr-2" />
            {booking.customer.name}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Phone className="h-4 w-4 mr-2" />
            {booking.customer.phone}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Mail className="h-4 w-4 mr-2" />
            {booking.customer.email}
          </div>
          <div className="flex items-start text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 mt-0.5" />
            <span>{booking.customer.address}</span>
          </div>
        </div>

        {/* Booking Details */}
        <div className="space-y-2">
          <h4 className="font-medium text-gray-900">Booking Details</h4>
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            {booking.date}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            {booking.time} ({booking.duration}h)
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Amount:</span> ${booking.amount}
          </div>
        </div>
      </div>

      {booking.notes && (
        <div className="mb-4">
          <h4 className="font-medium text-gray-900 mb-2">Special Notes</h4>
          <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-lg">{booking.notes}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3 pt-4 border-t border-gray-200">
        {booking.status === 'pending' && (
          <>
            <button className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors">
              Accept
            </button>
            <button className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors">
              Decline
            </button>
          </>
        )}
        {booking.status === 'confirmed' && (
          <>
            <button className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors">
              Mark Complete
            </button>
            <button className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors">
              Contact Customer
            </button>
          </>
        )}
        {booking.status === 'completed' && (
          <button className="flex-1 bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors">
            View Details
          </button>
        )}
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-2">Manage your service bookings and schedule</p>
        </div>
        <button className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          <Filter className="h-4 w-4 mr-2" />
          Filter
        </button>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-6">
        <nav className="-mb-px flex space-x-8">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-2 px-1 border-b-2 font-medium text-sm whitespace-nowrap ${
                activeTab === tab.id
                  ? 'border-primary-500 text-primary-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab.label}
              <span className={`ml-2 px-2 py-0.5 rounded-full text-xs ${
                activeTab === tab.id
                  ? 'bg-primary-100 text-primary-600'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {tab.count}
              </span>
            </button>
          ))}
        </nav>
      </div>

      {/* Bookings List */}
      <div className="space-y-6">
        {filteredBookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>

      {/* Empty State */}
      {filteredBookings.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Calendar className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
          <p className="text-gray-600">
            {activeTab === 'all' 
              ? "You don't have any bookings yet" 
              : `No ${activeTab} bookings at the moment`
            }
          </p>
        </div>
      )}
    </div>
  );
};

export default Bookings;
