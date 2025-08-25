import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  DollarSign, 
  Star, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { bookingsAPI } from '../../services/api';

const Dashboard = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [dashboardData, setDashboardData] = useState({
    totalEarnings: 0,
    completedJobs: 0,
    averageRating: 0,
    pendingBookings: 0,
    recentBookings: [],
    todaySchedule: 0,
    pendingRequests: 0,
    newReviews: 0
  });

  // Load user data and calculate stats
  useEffect(() => {
    const loadDashboardData = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        
        // Set basic user stats
        setDashboardData({
          totalEarnings: user.totalEarnings || 0,
          completedJobs: user.completedJobs || 0,
          averageRating: user.rating || 0,
          pendingBookings: 0,
          recentBookings: [],
          todaySchedule: 0,
          pendingRequests: 0,
          newReviews: 0
        });

        // Try to fetch bookings from API
        try {
          const bookingsResponse = await bookingsAPI.getUserBookings();
          // Ensure bookings is always an array
          const bookings = Array.isArray(bookingsResponse) ? bookingsResponse : 
                          (bookingsResponse?.bookings && Array.isArray(bookingsResponse.bookings)) ? bookingsResponse.bookings : [];
          
          const pendingCount = bookings.filter(b => b.status === 'pending').length;
          const recentBookings = bookings.slice(0, 5); // Get last 5 bookings
          
          setDashboardData(prev => ({
            ...prev,
            pendingBookings: pendingCount,
            recentBookings: recentBookings,
            todaySchedule: bookings.filter(b => {
              const today = new Date().toDateString();
              return new Date(b.date).toDateString() === today;
            }).length
          }));
        } catch (bookingError) {
          console.log('Bookings not available:', bookingError);
        }

      } catch (err) {
        setError('Failed to load dashboard data');
        console.error('Dashboard load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadDashboardData();
  }, []);

  const stats = [
    {
      title: 'Total Earnings',
      value: `₹${dashboardData.totalEarnings}`,
      change: 'This month',
      changeType: 'neutral',
      icon: DollarSign,
      color: 'bg-green-500'
    },
    {
      title: 'Completed Jobs',
      value: dashboardData.completedJobs.toString(),
      change: 'Total completed',
      changeType: 'positive',
      icon: CheckCircle,
      color: 'bg-blue-500'
    },
    {
      title: 'Average Rating',
      value: dashboardData.averageRating.toFixed(1),
      change: 'Current rating',
      changeType: 'positive',
      icon: Star,
      color: 'bg-yellow-500'
    },
    {
      title: 'Pending Bookings',
      value: dashboardData.pendingBookings.toString(),
      change: 'Awaiting response',
      changeType: 'neutral',
      icon: Clock,
      color: 'bg-orange-500'
    }
  ];

  const getStatusColor = (status) => {
    switch (status) {
      case 'confirmed':
        return 'bg-green-100 text-green-800';
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'completed':
        return 'bg-blue-100 text-blue-800';
      default:
        return 'bg-gray-100 text-gray-800';
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-gray-600 mt-2">Welcome back! Here's your performance overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-2xl font-bold text-gray-900 mt-2">{stat.value}</p>
                <div className="flex items-center mt-2">
                  <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                  <span className={`text-sm font-medium ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboardData.recentBookings.length > 0 ? (
                dashboardData.recentBookings.map((booking) => (
                  <tr key={booking._id || booking.id} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900">
                        {typeof booking.service === 'object' ? booking.service.name || 'Service' : booking.service || 'Service'}
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{booking.customerName || 'Customer'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{new Date(booking.date).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-500">{booking.time || 'Time TBD'}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{booking.amount || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-6 py-4 text-center text-gray-500">
                    No bookings yet. Start accepting jobs to see them here!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-8 grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-primary-600" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Today's Schedule</h3>
              <p className="text-sm text-gray-600">{dashboardData.todaySchedule} bookings scheduled</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/worker/bookings')}
            className="mt-4 w-full bg-primary-600 text-white py-2 px-4 rounded-lg hover:bg-primary-700 transition-colors"
          >
            View Schedule
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <AlertCircle className="h-8 w-8 text-orange-600" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Pending Requests</h3>
              <p className="text-sm text-gray-600">{dashboardData.pendingRequests} requests awaiting response</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/worker/bookings', { state: { showPending: true } })}
            className="mt-4 w-full bg-orange-600 text-white py-2 px-4 rounded-lg hover:bg-orange-700 transition-colors"
          >
            Review Requests
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center">
            <Star className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Reviews</h3>
              <p className="text-sm text-gray-600">{dashboardData.newReviews} new reviews received</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/worker/earnings')}
            className="mt-4 w-full bg-yellow-600 text-white py-2 px-4 rounded-lg hover:bg-yellow-700 transition-colors"
          >
            View Reviews
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
