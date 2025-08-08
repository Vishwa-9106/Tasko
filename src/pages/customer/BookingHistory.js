import React, { useState } from 'react';
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

const BookingHistory = () => {
  const [activeTab, setActiveTab] = useState('all');
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [selectedBooking, setSelectedBooking] = useState(null);
  const [rating, setRating] = useState(0);
  const [review, setReview] = useState('');

  const bookings = [
    {
      id: 1,
      service: 'House Cleaning',
      worker: {
        name: 'Maria Rodriguez',
        image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face'
      },
      date: '2024-01-15',
      time: '10:00 AM',
      duration: 3,
      amount: 80,
      status: 'completed',
      address: '123 Main St, New York, NY',
      hasReview: false
    },
    {
      id: 2,
      service: 'Home Cooking',
      worker: {
        name: 'James Wilson',
        image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face'
      },
      date: '2024-01-20',
      time: '6:00 PM',
      duration: 2,
      amount: 60,
      status: 'confirmed',
      address: '123 Main St, New York, NY',
      hasReview: false
    },
    {
      id: 3,
      service: 'Bathroom Cleaning',
      worker: {
        name: 'Sarah Chen',
        image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face'
      },
      date: '2024-01-25',
      time: '2:00 PM',
      duration: 1.5,
      amount: 45,
      status: 'upcoming',
      address: '123 Main St, New York, NY',
      hasReview: false
    },
    {
      id: 4,
      service: 'Laundry Service',
      worker: {
        name: 'Lisa Thompson',
        image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face'
      },
      date: '2024-01-10',
      time: '11:00 AM',
      duration: 2,
      amount: 35,
      status: 'completed',
      address: '123 Main St, New York, NY',
      hasReview: true,
      myRating: 5,
      myReview: 'Excellent service! Very thorough and professional.'
    }
  ];

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

  const submitReview = () => {
    // Handle review submission
    console.log('Submitting review:', { rating, review, bookingId: selectedBooking.id });
    setShowReviewModal(false);
    setRating(0);
    setReview('');
    setSelectedBooking(null);
  };

  const BookingCard = ({ booking }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex items-center">
          <img
            src={booking.worker.image}
            alt={booking.worker.name}
            className="w-12 h-12 rounded-full object-cover mr-4"
          />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">{booking.service}</h3>
            <p className="text-gray-600 text-sm">with {booking.worker.name}</p>
          </div>
        </div>
        <div className={`flex items-center px-3 py-1 rounded-full border text-sm font-medium ${getStatusColor(booking.status)}`}>
          {getStatusIcon(booking.status)}
          <span className="ml-1 capitalize">{booking.status}</span>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-gray-600">
            <Calendar className="h-4 w-4 mr-2" />
            {booking.date}
          </div>
          <div className="flex items-center text-sm text-gray-600">
            <Clock className="h-4 w-4 mr-2" />
            {booking.time} ({booking.duration}h)
          </div>
          <div className="flex items-start text-sm text-gray-600">
            <MapPin className="h-4 w-4 mr-2 mt-0.5" />
            <span>{booking.address}</span>
          </div>
        </div>
        <div className="space-y-2">
          <div className="text-sm text-gray-600">
            <span className="font-medium">Total Amount:</span> ${booking.amount}
          </div>
          <div className="text-sm text-gray-600">
            <span className="font-medium">Booking ID:</span> #{booking.id}
          </div>
        </div>
      </div>

      {/* Review Section */}
      {booking.hasReview && booking.myReview && (
        <div className="mb-4 p-4 bg-gray-50 rounded-lg">
          <div className="flex items-center mb-2">
            <span className="text-sm font-medium text-gray-700 mr-2">Your Review:</span>
            <div className="flex">
              {[1, 2, 3, 4, 5].map((star) => (
                <Star
                  key={star}
                  className={`h-4 w-4 ${
                    star <= booking.myRating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                  }`}
                />
              ))}
            </div>
          </div>
          <p className="text-sm text-gray-600">{booking.myReview}</p>
        </div>
      )}

      {/* Actions */}
      <div className="flex space-x-3 pt-4 border-t border-gray-200">
        {booking.status === 'completed' && !booking.hasReview && (
          <button
            onClick={() => openReviewModal(booking)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Star className="h-4 w-4 mr-2" />
            Leave Review
          </button>
        )}
        {booking.status === 'completed' && booking.hasReview && (
          <button
            onClick={() => openReviewModal(booking)}
            className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Star className="h-4 w-4 mr-2" />
            Edit Review
          </button>
        )}
        {(booking.status === 'upcoming' || booking.status === 'confirmed') && (
          <>
            <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <MessageCircle className="h-4 w-4 mr-2" />
              Message Worker
            </button>
            <button className="flex items-center px-4 py-2 border border-red-300 text-red-700 rounded-lg hover:bg-red-50 transition-colors">
              <XCircle className="h-4 w-4 mr-2" />
              Cancel
            </button>
          </>
        )}
        <button className="flex items-center px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          <RefreshCw className="h-4 w-4 mr-2" />
          Book Again
        </button>
      </div>
    </div>
  );

  const ReviewModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {selectedBooking?.hasReview ? 'Edit Review' : 'Leave a Review'}
        </h3>
        
        <div className="mb-4">
          <label className="block text-sm font-medium text-gray-700 mb-2">Rating</label>
          <div className="flex space-x-1">
            {[1, 2, 3, 4, 5].map((star) => (
              <button
                key={star}
                onClick={() => setRating(star)}
                className={`p-1 ${
                  star <= rating ? 'text-yellow-500' : 'text-gray-300'
                } hover:text-yellow-500 transition-colors`}
              >
                <Star className={`h-6 w-6 ${star <= rating ? 'fill-current' : ''}`} />
              </button>
            ))}
          </div>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-2">Review</label>
          <textarea
            value={review}
            onChange={(e) => setReview(e.target.value)}
            rows={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Share your experience..."
          />
        </div>

        <div className="flex space-x-3">
          <button
            onClick={() => setShowReviewModal(false)}
            className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={submitReview}
            className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Submit Review
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Booking History</h1>
        <p className="text-gray-600 mt-2">View and manage your service bookings</p>
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
              ? "You haven't made any bookings yet" 
              : `No ${activeTab} bookings at the moment`
            }
          </p>
        </div>
      )}

      {/* Review Modal */}
      {showReviewModal && <ReviewModal />}
    </div>
  );
};

export default BookingHistory;
