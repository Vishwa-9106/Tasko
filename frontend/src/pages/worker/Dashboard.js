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
import { bookingsAPI, usersAPI } from '../../services/api';

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
    newReviews: 0,
    reviews: []
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
          newReviews: 0,
          reviews: []
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

        // Try to fetch worker reviews
        try {
          const reviewsResponse = await usersAPI.getWorkerReviews(user._id);
          if (reviewsResponse && reviewsResponse.reviews) {
            setDashboardData(prev => ({
              ...prev,
              reviews: reviewsResponse.reviews,
              newReviews: reviewsResponse.reviews.length,
              averageRating: reviewsResponse.averageRating || prev.averageRating
            }));
          }
        } catch (reviewError) {
          console.log('Reviews not available:', reviewError);
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
      <div className="p-4 sm:p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-sm sm:text-base">Loading dashboard...</span>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {error && (
        <div className="mb-3 sm:mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">Welcome back! Here's your performance overview.</p>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
            <div className="flex items-center justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-xs sm:text-sm font-medium text-gray-600 truncate">{stat.title}</p>
                <p className="text-xl sm:text-2xl font-bold text-gray-900 mt-1 sm:mt-2">{stat.value}</p>
                <div className="flex items-center mt-1 sm:mt-2">
                  <TrendingUp className="h-3 w-3 sm:h-4 sm:w-4 text-green-500 mr-1 flex-shrink-0" />
                  <span className={`text-xs sm:text-sm font-medium truncate ${
                    stat.changeType === 'positive' ? 'text-green-600' : 'text-gray-600'
                  }`}>
                    {stat.change}
                  </span>
                </div>
              </div>
              <div className={`p-2 sm:p-3 rounded-full ${stat.color} flex-shrink-0 ml-2`}>
                <stat.icon className="h-5 w-5 sm:h-6 sm:w-6 text-white" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Recent Reviews */}
      {dashboardData.reviews.length > 0 && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 mb-6 sm:mb-8">
          <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
            <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recent Reviews</h2>
          </div>
          <div className="p-4 sm:p-6">
            <div className="space-y-3 sm:space-y-4">
              {dashboardData.reviews.slice(0, 3).map((review, index) => (
                <div key={index} className="border-l-4 border-yellow-400 pl-3 sm:pl-4 py-2">
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between mb-2 space-y-1 sm:space-y-0">
                    <div className="flex items-center">
                      <div className="flex text-yellow-400">
                        {[...Array(5)].map((_, i) => (
                          <Star
                            key={i}
                            className={`h-3 w-3 sm:h-4 sm:w-4 ${i < review.rating ? 'fill-current' : ''}`}
                          />
                        ))}
                      </div>
                      <span className="ml-2 text-xs sm:text-sm font-medium text-gray-900 truncate">{review.customerName}</span>
                    </div>
                    <span className="text-xs text-gray-500 self-start sm:self-auto">
                      {new Date(review.createdAt).toLocaleDateString()}
                    </span>
                  </div>
                  <p className="text-xs sm:text-sm text-gray-600 line-clamp-2">{review.comment}</p>
                  <p className="text-xs text-gray-500 mt-1 truncate">Service: {review.serviceName}</p>
                </div>
              ))}
            </div>
            {dashboardData.reviews.length > 3 && (
              <div className="mt-3 sm:mt-4 text-center">
                <button
                  onClick={() => navigate('/worker/bookings', { state: { showReviews: true } })}
                  className="text-primary-600 hover:text-primary-700 text-xs sm:text-sm font-medium"
                >
                  View all {dashboardData.reviews.length} reviews
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Recent Bookings */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        <div className="px-4 sm:px-6 py-3 sm:py-4 border-b border-gray-200">
          <h2 className="text-base sm:text-lg font-semibold text-gray-900">Recent Bookings</h2>
        </div>
        
        {/* Mobile Card View */}
        <div className="block sm:hidden">
          {dashboardData.recentBookings.length > 0 ? (
            <div className="divide-y divide-gray-200">
              {dashboardData.recentBookings.map((booking) => (
                <div key={booking._id || booking.id} className="p-4">
                  <div className="flex justify-between items-start mb-2">
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-medium text-gray-900 truncate">
                        {typeof booking.service === 'object' ? booking.service.name || 'Service' : booking.service || 'Service'}
                      </h3>
                      <p className="text-xs text-gray-600 truncate">{booking.customerName || 'Customer'}</p>
                    </div>
                    <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ml-2 ${getStatusColor(booking.status)}`}>
                      {booking.status}
                    </span>
                  </div>
                  <div className="flex justify-between items-center text-xs text-gray-500">
                    <span>{new Date(booking.date).toLocaleDateString()}</span>
                    <span className="font-medium text-gray-900">₹{booking.amount || 0}</span>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="p-4 text-center text-gray-500 text-sm">
              No bookings yet. Start accepting jobs to see them here!
            </div>
          )}
        </div>
        
        {/* Desktop Table View */}
        <div className="hidden sm:block overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Service
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date & Time
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 lg:px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Amount
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {dashboardData.recentBookings.length > 0 ? (
                dashboardData.recentBookings.map((booking) => (
                  <tr key={booking._id || booking.id} className="hover:bg-gray-50">
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-gray-900 truncate max-w-32 lg:max-w-none">
                        {typeof booking.service === 'object' ? booking.service.name || 'Service' : booking.service || 'Service'}
                      </div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900 truncate max-w-24 lg:max-w-none">{booking.customerName || 'Customer'}</div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <div className="text-sm text-gray-900">{new Date(booking.date).toLocaleDateString()}</div>
                      <div className="text-sm text-gray-500">{booking.time || 'Time TBD'}</div>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded-full ${getStatusColor(booking.status)}`}>
                        {booking.status}
                      </span>
                    </td>
                    <td className="px-4 lg:px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      ₹{booking.amount || 0}
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="5" className="px-4 lg:px-6 py-4 text-center text-gray-500 text-sm">
                    No bookings yet. Start accepting jobs to see them here!
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Quick Actions */}
      <div className="mt-6 sm:mt-8 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6">
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center">
            <Calendar className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600 flex-shrink-0" />
            <div className="ml-3 sm:ml-4 min-w-0">
              <h3 className="text-base sm:text-lg font-medium text-gray-900">Today's Schedule</h3>
              <p className="text-xs sm:text-sm text-gray-600">{dashboardData.todaySchedule} bookings scheduled</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/worker/bookings')}
            className="mt-3 sm:mt-4 w-full bg-primary-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
          >
            View Schedule
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
          <div className="flex items-center">
            <AlertCircle className="h-6 w-6 sm:h-8 sm:w-8 text-orange-600 flex-shrink-0" />
            <div className="ml-3 sm:ml-4 min-w-0">
              <h3 className="text-base sm:text-lg font-medium text-gray-900">Pending Requests</h3>
              <p className="text-xs sm:text-sm text-gray-600">{dashboardData.pendingRequests} requests awaiting response</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/worker/bookings', { state: { showPending: true } })}
            className="mt-3 sm:mt-4 w-full bg-orange-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-orange-700 transition-colors text-sm sm:text-base"
          >
            Review Requests
          </button>
        </div>

        <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 sm:col-span-2 lg:col-span-1">
          <div className="flex items-center">
            <Star className="h-6 w-6 sm:h-8 sm:w-8 text-yellow-600 flex-shrink-0" />
            <div className="ml-3 sm:ml-4 min-w-0">
              <h3 className="text-base sm:text-lg font-medium text-gray-900">Reviews</h3>
              <p className="text-xs sm:text-sm text-gray-600">{dashboardData.newReviews} new reviews received</p>
            </div>
          </div>
          <button 
            onClick={() => navigate('/worker/bookings', { state: { showReviews: true } })}
            className="mt-3 sm:mt-4 w-full bg-yellow-600 text-white py-2 px-3 sm:px-4 rounded-lg hover:bg-yellow-700 transition-colors text-sm sm:text-base"
          >
            View Reviews
          </button>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
