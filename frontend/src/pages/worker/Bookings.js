import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Phone, 
  MessageCircle,
  CheckCircle,
  XCircle,
  AlertTriangle,
  RefreshCw,
  Star,
  ChevronDown,
  ChevronUp
} from 'lucide-react';
import { bookingsAPI, usersAPI } from '../../services/api';
import ChatModal from '../../components/ChatModal';
import ReviewCard from '../../components/ReviewCard';
import { useSocket } from '../../contexts/SocketContext';

const Bookings = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState('all');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [retryCount, setRetryCount] = useState(0);
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
  const [workerReviews, setWorkerReviews] = useState([]);
  const [showReviews, setShowReviews] = useState(false);
  const [reviewsLoading, setReviewsLoading] = useState(false);
  const { notifications } = useSocket();

  useEffect(() => {
    loadBookings();
    // Load current user info from localStorage
    const user = JSON.parse(localStorage.getItem('user') || '{}');
    setCurrentUser({
      id: user._id,
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim(),
      userType: user.userType
    });
    
    // Load worker reviews if user is a worker
    if (user.userType === 'worker') {
      loadWorkerReviews(user._id);
    }
  }, [activeTab]);

  useEffect(() => {
    // Check if navigated from dashboard with pending filter or reviews
    if (location.state?.showPending) {
      setActiveTab('pending');
    }
    if (location.state?.showReviews) {
      setShowReviews(true);
    }
  }, [location.state]);

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError('');
      
      // Fetch real bookings from API
      const response = await bookingsAPI.getUserBookings();
      
      // Transform backend booking data to match component format
      const formattedBookings = (response.bookings || []).map(booking => ({
        _id: booking._id,
        id: booking._id,
        service: booking.service.name,
        customer: {
          name: `${booking.customer.firstName} ${booking.customer.lastName}`,
          notes: booking.notes || '',
          customerPhone: booking.customer.phone || 'Not provided',
          customerId: booking.customer._id,
          customerName: `${booking.customer.firstName} ${booking.customer.lastName}`
        },
        address: booking.address,
        date: new Date(booking.scheduledDate).toLocaleDateString(),
        time: booking.scheduledTime,
        duration: booking.service.duration || 1,
        amount: booking.totalAmount,
        status: booking.status,
      }));
      
      setBookings(formattedBookings);
    } catch (err) {
      console.error('Bookings load error:', err);
      setError('Failed to load bookings. Please try again.');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const updateBookingStatus = async (bookingId, newStatus) => {
    try {
      // Update booking status via API
      await bookingsAPI.updateBookingStatus(bookingId, newStatus);
      
      // Update local state to reflect the change immediately
      const updatedBookings = bookings.map(booking => 
        booking._id === bookingId || booking.id === bookingId 
          ? { ...booking, status: newStatus } 
          : booking
      );
      setBookings(updatedBookings);
      
      // Show success message
      setError('');
    } catch (err) {
      console.error('Failed to update booking status:', err);
      setError('Failed to update booking status. Please try again.');
    }
  };

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
        return <AlertTriangle className="h-4 w-4" />;
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertTriangle className="h-4 w-4" />;
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
            {booking.customer.customerPhone}
          </div>
          <div className="flex items-start text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 mt-0.5" />
            <span>{booking.address}</span>
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
            <span className="font-medium">Amount:</span> ₹{booking.amount}
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
            <button 
              onClick={() => updateBookingStatus(booking._id || booking.id, 'confirmed')}
              className="flex-1 bg-green-600 text-white py-2 px-4 rounded-lg hover:bg-green-700 transition-colors"
            >
              Accept
            </button>
            <button 
              onClick={() => updateBookingStatus(booking._id || booking.id, 'cancelled')}
              className="flex-1 bg-red-600 text-white py-2 px-4 rounded-lg hover:bg-red-700 transition-colors"
            >
              Decline
            </button>
          </>
        )}
        {booking.status === 'confirmed' && (
          <>
            <button 
              onClick={() => updateBookingStatus(booking._id || booking.id, 'completed')}
              className="flex-1 bg-blue-600 text-white py-2 px-4 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Mark Complete
            </button>
            <button 
              onClick={() => openChatWithCustomer(booking)}
              className="flex-1 bg-gray-600 text-white py-2 px-4 rounded-lg hover:bg-gray-700 transition-colors relative flex items-center justify-center"
            >
              <MessageCircle className="h-4 w-4 mr-2" />
              Contact
              {/* Show notification badge if there are unread messages for this booking */}
              {notifications.some(n => n.type === 'message' && n.data?.booking === booking.id) && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 flex items-center justify-center">
                  {notifications.filter(n => n.type === 'message' && n.data?.booking === booking.id).length}
                </span>
              )}
            </button>
          </>
        )}
      </div>
    </div>
  );

  const openChatWithCustomer = (booking) => {
    setSelectedBookingForChat({
      id: booking.id,
      service: booking.service,
      date: booking.date,
      customer: {
        id: booking.customer.customerId,
        name: booking.customer.customerName
      }
    });
    setShowChatModal(true);
  };

  const closeChatModal = () => {
    setShowChatModal(false);
  };

  const loadWorkerReviews = async (workerId) => {
    try {
      setReviewsLoading(true);
      const response = await usersAPI.getWorkerReviews(workerId);
      setWorkerReviews(response.reviews || []);
    } catch (error) {
      console.error('Failed to load worker reviews:', error);
    } finally {
      setReviewsLoading(false);
    }
  };

  const toggleReviewsSection = () => {
    setShowReviews(!showReviews);
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading bookings...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
          <button 
            onClick={loadBookings}
            className="mt-2 text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Bookings</h1>
          <p className="text-gray-600 mt-2">Manage your service bookings and schedule</p>
        </div>
        <div className="flex space-x-3">
          <button 
            onClick={toggleReviewsSection}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <Star className="h-4 w-4 mr-2" />
            Reviews ({workerReviews.length})
            {showReviews ? <ChevronUp className="h-4 w-4 ml-2" /> : <ChevronDown className="h-4 w-4 ml-2" />}
          </button>
          <button 
            onClick={loadBookings}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <RefreshCw className="h-4 w-4 mr-2" />
            Refresh
          </button>
        </div>
      </div>

      {/* Reviews Section */}
      {showReviews && (
        <div className="mb-8 bg-white rounded-lg shadow-sm border border-gray-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-semibold text-gray-900">Customer Reviews</h2>
            {currentUser && (
              <button
                onClick={() => loadWorkerReviews(currentUser.id)}
                className="text-sm text-blue-600 hover:text-blue-800"
              >
                Refresh Reviews
              </button>
            )}
          </div>
          
          {reviewsLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
              <span className="ml-2">Loading reviews...</span>
            </div>
          ) : workerReviews.length > 0 ? (
            <div className="space-y-4 max-h-96 overflow-y-auto">
              {workerReviews.map((review) => (
                <ReviewCard key={review._id} review={review} />
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <Star className="h-12 w-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">No reviews yet. Complete some bookings to start receiving reviews!</p>
            </div>
          )}
        </div>
      )}

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
      
      {/* Chat Modal */}
      {showChatModal && selectedBookingForChat && currentUser && (
        <ChatModal
          isOpen={showChatModal}
          onClose={closeChatModal}
          booking={selectedBookingForChat}
          otherUser={selectedBookingForChat.customer}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default Bookings;
