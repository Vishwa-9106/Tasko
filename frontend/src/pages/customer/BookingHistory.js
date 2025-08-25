import React, { useState, useEffect } from 'react';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  Star,
  MessageCircle,
  RefreshCw,
  XCircle,
  CheckCircle,
  AlertCircle
} from 'lucide-react';
import { bookingsAPI } from '../../services/api';
import ChatModal from '../../components/ChatModal';
import { useSocket } from '../../contexts/SocketContext';

const BookingHistory = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showChatModal, setShowChatModal] = useState(false);
  const [selectedBookingForChat, setSelectedBookingForChat] = useState(null);
  const [currentUser, setCurrentUser] = useState(null);
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
  }, []);

  const loadBookings = async () => {
    try {
      setLoading(true);
      const response = await bookingsAPI.getUserBookings();
      
      const formattedBookings = (response.bookings || []).map(booking => ({
        id: booking._id,
        service: booking.service.name,
        worker: {
          name: `${booking.worker.firstName} ${booking.worker.lastName}`,
          image: booking.worker.profileImage || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face'
        },
        date: new Date(booking.scheduledDate).toLocaleDateString(),
        time: booking.scheduledTime,
        duration: booking.service.duration || 1,
        amount: booking.totalAmount,
        status: booking.status,
        address: booking.address,
        hasReview: !!booking.review?.rating,
        myRating: booking.review?.rating || 0,
        myReview: booking.review?.comment || '',
        notes: booking.notes,
        workerId: booking.worker._id,
        workerName: `${booking.worker.firstName} ${booking.worker.lastName}`
      }));
      
      setBookings(formattedBookings);
    } catch (err) {
      console.error('Failed to load bookings:', err);
      setError('Failed to load bookings');
      setBookings([]);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (status) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800 border-green-200';
      case 'confirmed':
        return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'upcoming':
        return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'cancelled':
        return 'bg-red-100 text-red-800 border-red-200';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusIcon = (status) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4" />;
      case 'confirmed':
        return <Clock className="h-4 w-4" />;
      case 'upcoming':
        return <AlertCircle className="h-4 w-4" />;
      case 'cancelled':
        return <XCircle className="h-4 w-4" />;
      default:
        return <AlertCircle className="h-4 w-4" />;
    }
  };

  const filteredBookings = bookings.filter(booking => {
    if (activeTab === 'all') return true;
    if (activeTab === 'upcoming') return booking.status === 'upcoming' || booking.status === 'confirmed';
    if (activeTab === 'completed') return booking.status === 'completed';
    return booking.status === activeTab;
  });

  const tabs = [
    { id: 'all', label: 'All Bookings', count: bookings.length },
    { id: 'upcoming', label: 'Upcoming', count: bookings.filter(b => b.status === 'upcoming' || b.status === 'confirmed').length },
    { id: 'completed', label: 'Completed', count: bookings.filter(b => b.status === 'completed').length }
  ];

  const openReviewModal = (booking) => {
    setSelectedBooking(booking);
    setRating(booking.myRating || 0);
    setReview(booking.myReview || '');
    setShowReviewModal(true);
  };

  const submitReview = async () => {
    try {
      await bookingsAPI.addReview(selectedBooking.id, {
        rating,
        comment: review
      });
      
      // Update local booking data
      setBookings(prev => prev.map(booking => 
        booking.id === selectedBooking.id 
          ? { ...booking, hasReview: true, myRating: rating, myReview: review }
          : booking
      ));
      
      setShowReviewModal(false);
      setRating(0);
      setReview('');
      setSelectedBooking(null);
    } catch (err) {
      console.error('Failed to submit review:', err);
      alert('Failed to submit review. Please try again.');
    }
  };

  const cancelBooking = async (bookingId) => {
    if (!window.confirm('Are you sure you want to cancel this booking?')) {
      return;
    }
    
    try {
      await bookingsAPI.updateBookingStatus(bookingId, 'cancelled');
      setBookings(prev => prev.map(booking => 
        booking.id === bookingId 
          ? { ...booking, status: 'cancelled' }
          : booking
      ));
    } catch (err) {
      console.error('Failed to cancel booking:', err);
      alert('Failed to cancel booking. Please try again.');
    }
  };

  const openChatWithWorker = (booking) => {
    setSelectedBookingForChat({
      id: booking.id,
      service: booking.service,
      date: booking.date,
      worker: {
        id: booking.workerId,
        name: booking.workerName
      }
    });
    setShowChatModal(true);
  };

  const closeChatModal = () => {
    setShowChatModal(false);
    setSelectedBookingForChat(null);
  };

  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-start mb-4">
        <div className="flex items-start mb-3 sm:mb-0">
          <img
            src={booking.worker.image}
            alt={booking.worker.name}
            className="w-10 h-10 sm:w-12 sm:h-12 rounded-full object-cover mr-3 sm:mr-4 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <h3 className="text-base sm:text-lg font-semibold text-gray-900 line-clamp-1">{booking.service}</h3>
            <p className="text-gray-600 text-xs sm:text-sm truncate">with {booking.worker.name}</p>
          </div>
        </div>
        <div className={`flex items-center px-2 sm:px-3 py-1 rounded-full border text-xs sm:text-sm font-medium self-start ${getStatusColor(booking.status)}`}>
          {getStatusIcon(booking.status)}
          <span className="ml-1 capitalize">{booking.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center text-xs sm:text-sm text-gray-600">
            <Calendar className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{booking.date}</span>
          </div>
          <div className="flex items-center text-xs sm:text-sm text-gray-600">
            <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-2 flex-shrink-0" />
            <span className="truncate">{booking.time} ({booking.duration}h)</span>
          </div>
          <div className="flex items-start text-xs sm:text-sm text-gray-600">
            <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-2 mt-0.5 flex-shrink-0" />
            <span className="line-clamp-2">{booking.address}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-xs sm:text-sm text-gray-600">
            <span className="font-medium">Total Amount:</span> ₹{booking.amount}
          </div>
          <div className="text-xs sm:text-sm text-gray-600">
            <span className="font-medium">Booking ID:</span> <span className="truncate">#{booking.id}</span>
          </div>
        </div>
      </div>

      {/* Review Section */}
      {booking.hasReview && booking.myReview && (
        <div className="mb-4 p-3 sm:p-4 bg-gray-50 rounded-lg">
          <div className="flex flex-col sm:flex-row sm:items-center mb-2">
            <span className="text-xs sm:text-sm font-medium text-gray-700 mb-1 sm:mb-0 sm:mr-2">Your Review:</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-3 w-3 sm:h-4 sm:w-4 ${
                    star <= booking.myRating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-xs sm:text-sm text-gray-600 line-clamp-3">{booking.myReview}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 pt-3 sm:pt-4 border-t border-gray-200">
        {booking.status === 'completed' && !booking.hasReview && (
          <button
            onClick={() => openReviewModal(booking)}
            className="flex items-center justify-center px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-xs sm:text-sm"
          >
            <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            Leave Review
          </button>
        )}
        {booking.status === 'completed' && booking.hasReview && (
          <button
            onClick={() => openReviewModal(booking)}
            className="flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm"
          >
            <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
            Edit Review
          </button>
        )}
        {(booking.status === 'upcoming' || booking.status === 'confirmed') && (
          <>
            <button 
              onClick={() => openChatWithWorker(booking)}
              className="flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors relative text-xs sm:text-sm"
            >
              <MessageCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              <span className="hidden sm:inline">Message Worker</span>
              <span className="sm:hidden">Message</span>
              {/* Show notification badge if there are unread messages for this booking */}
              {notifications.some(n => n.type === 'message' && n.data?.booking === booking.id) && (
                <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full h-4 w-4 sm:h-5 sm:w-5 flex items-center justify-center">
                  {notifications.filter(n => n.type === 'message' && n.data?.booking === booking.id).length}
                </span>
              )}
            </button>
            <button 
              onClick={() => cancelBooking(booking.id)}
              className="flex items-center justify-center px-3 sm:px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors text-xs sm:text-sm"
            >
              <XCircle className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
              Cancel
            </button>
          </>
        )}
        <button className="flex items-center justify-center px-3 sm:px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-xs sm:text-sm">
          <RefreshCw className="h-3 w-3 sm:h-4 sm:w-4 mr-2" />
          Book Again
        </button>
      </div>
    </div>
  );

  const ReviewModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg p-4 sm:p-6 w-full max-w-md max-h-[90vh] overflow-y-auto">
        <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">
          {selectedBooking?.hasReview ? 'Edit Review' : 'Leave a Review'}
        </h3>
        
        <div className="mb-3 sm:mb-4">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Rating</label>
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`p-1 ${
                  star <= rating ? 'text-yellow-500' : 'text-gray-300'
                } hover:text-yellow-500 transition-colors`}
              >
                <Star className={`h-5 w-5 sm:h-6 sm:w-6 ${star <= rating ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="mb-4 sm:mb-6">
          <label className="block text-xs sm:text-sm font-medium text-gray-700 mb-2">Review</label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm"
            placeholder="Share your experience..."
          />
        </div>

        <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
          <button
            onClick={() => setShowReviewModal(false)}
            className="flex-1 px-3 sm:px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors text-sm"
          >
            Cancel
          </button>
          <button
            onClick={submitReview}
            className="flex-1 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm"
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="p-3 sm:p-4 lg:p-6">
        <div className="text-center py-8 sm:py-12">
          <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading your bookings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {error && (
        <div className="mb-3 sm:mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-xs sm:text-sm text-red-600">{error}</p>
          <button 
            onClick={loadBookings}
            className="mt-2 text-xs sm:text-sm text-red-700 underline hover:no-underline"
          >
            Try again
          </button>
        </div>
      )}
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Booking History</h1>
        <p className="text-sm sm:text-base text-gray-600 mt-1 sm:mt-2">View and manage your service bookings</p>
      </div>

      {/* Tabs */}
      <div className="border-b border-gray-200 mb-4 sm:mb-6">
        <nav className="-mb-px flex overflow-x-auto scrollbar-hide">
          <div className="flex space-x-4 sm:space-x-8 min-w-max">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-2 px-1 border-b-2 font-medium text-xs sm:text-sm whitespace-nowrap ${
                  activeTab === tab.id
                    ? 'border-primary-500 text-primary-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                <span className="hidden sm:inline">{tab.label}</span>
                <span className="sm:hidden">
                  {tab.id === 'all' ? 'All' : tab.id === 'upcoming' ? 'Upcoming' : 'Completed'}
                </span>
                <span className={`ml-1 sm:ml-2 px-1.5 sm:px-2 py-0.5 rounded-full text-xs ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-600'
                    : 'bg-gray-100 text-gray-600'
                }`}>
                  {tab.count}
                </span>
              </button>
            ))}
          </div>
        </nav>
      </div>

      {/* Bookings List */}
      <div className="space-y-4 sm:space-y-6">
        {filteredBookings.map((booking) => (
          <BookingCard key={booking.id} booking={booking} />
        ))}
      </div>

      {/* Empty State */}
      {filteredBookings.length === 0 && (
        <div className="text-center py-8 sm:py-12">
          <div className="w-16 h-16 sm:w-24 sm:h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
            <Calendar className="h-8 w-8 sm:h-12 sm:w-12 text-gray-400" />
          </div>
          <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No bookings found</h3>
          <p className="text-sm sm:text-base text-gray-600 px-4">
            {activeTab === 'all' 
              ? "You haven't made any bookings yet" 
              : `No ${activeTab} bookings at the moment`
            }
          </p>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && <ReviewModal />}
      
      {/* Chat Modal */}
      {showChatModal && selectedBookingForChat && currentUser && (
        <ChatModal
          isOpen={showChatModal}
          onClose={closeChatModal}
          booking={selectedBookingForChat}
          otherUser={selectedBookingForChat.worker}
          currentUser={currentUser}
        />
      )}
    </div>
  );
};

export default BookingHistory;
