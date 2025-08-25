import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Calendar, 
  Clock, 
  MapPin, 
  User, 
  Star,
  DollarSign,
  ArrowLeft,
  CheckCircle,
  X
} from 'lucide-react';
import { usersAPI, bookingsAPI } from '../../services/api';

const BookService = () => {
  const { workerId } = useParams();
  const navigate = useNavigate();
  
  const [selectedService, setSelectedService] = useState('');
  const [selectedDate, setSelectedDate] = useState('');
  const [selectedTime, setSelectedTime] = useState('');
  const [notes, setNotes] = useState('');
  const [address, setAddress] = useState('');
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showSuccessMessage, setShowSuccessMessage] = useState(false);

  useEffect(() => {
    const fetchWorker = async () => {
      try {
        setLoading(true);
        const response = await usersAPI.getWorkerById(workerId);
        
        // Handle different response formats
        const workerInfo = response.worker || response;
        
        if (!workerInfo || !workerInfo._id) {
          throw new Error('Invalid worker data received');
        }
        
        const workerData = {
          id: workerInfo._id,
          name: `${workerInfo.firstName || ''} ${workerInfo.lastName || ''}`.trim() || 'Unknown Worker',
          rating: workerInfo.rating || 4.5,
          reviews: workerInfo.reviewCount || 0,
          image: workerInfo.profileImage || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          services: workerInfo.services?.map((service, index) => ({
            id: service._id || `service-${index}`,
            name: service.name || service.category || 'General Service',
            price: service.price || 25,
            duration: service.duration || 1,
            description: service.description || ''
          })) || []
        };
        
        setWorker(workerData);
      } catch (error) {
        console.error('Error fetching worker:', error);
        setError(error.message || 'Failed to load worker details');
      } finally {
        setLoading(false);
      }
    };

    if (workerId) {
      fetchWorker();
    }
  }, [workerId]);

  const timeSlots = [
    '9:00 AM', '10:00 AM', '11:00 AM', '12:00 PM',
    '1:00 PM', '2:00 PM', '3:00 PM', '4:00 PM', '5:00 PM'
  ];

  const selectedServiceData = worker?.services?.find(s => s.id === selectedService);

  const handleBooking = async () => {
    if (!selectedService || !selectedDate || !selectedTime || !address.trim()) {
      alert('Please fill in all required fields including address');
      return;
    }
    
    try {
      setSubmitting(true);
      
      const bookingData = {
        workerId,
        serviceId: selectedService,
        scheduledDate: selectedDate,
        scheduledTime: selectedTime,
        address: address.trim(),
        notes: notes.trim()
      };
      
      await bookingsAPI.createBooking(bookingData);
      
      // Show success message instead of alert
      setShowSuccessMessage(true);
      
      // Auto-hide after 5 seconds and navigate
      setTimeout(() => {
        setShowSuccessMessage(false);
        navigate('/customer/bookings');
      }, 5000);
      
    } catch (error) {
      console.error('Booking error:', error);
      alert(error.message || 'Failed to create booking. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
          <p className="mt-4 text-gray-600">Loading worker details...</p>
        </div>
      </div>
    );
  }

  if (error || !worker) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <p className="text-red-600 mb-4">{error || 'Worker not found'}</p>
          <button 
            onClick={() => navigate('/customer/search')}
            className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Back to Search
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex items-center mb-8">
        <button
          onClick={() => navigate(-1)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors mr-4"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Book Service</h1>
          <p className="text-gray-600 mt-2">Schedule a service with {worker.name}</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Booking Form */}
        <div className="lg:col-span-2 space-y-6">
          {/* Worker Info */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-center mb-4">
              <img
                src={worker.image}
                alt={worker.name}
                className="w-16 h-16 rounded-full object-cover mr-4"
              />
              <div>
                <h3 className="text-lg font-semibold text-gray-900">{worker.name}</h3>
                <div className="flex items-center text-sm text-gray-600">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  {worker.rating} ({worker.reviews} reviews)
                </div>
              </div>
            </div>
          </div>

          {/* Service Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Service</h3>
            <div className="space-y-3">
              {worker.services.map((service) => (
                <label
                  key={service.id}
                  className={`flex items-center justify-between p-4 border rounded-lg cursor-pointer transition-colors ${
                    selectedService === service.id.toString()
                      ? 'border-primary-500 bg-primary-50'
                      : 'border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center">
                    <input
                      type="radio"
                      name="service"
                      value={service.id}
                      checked={selectedService === service.id}
                      onChange={(e) => setSelectedService(e.target.value)}
                      className="mr-3"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{service.name}</p>
                      <p className="text-sm text-gray-600">{service.duration}h duration</p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold text-gray-900">₹{service.price}</p>
                  </div>
                </label>
              ))}
            </div>
          </div>

          {/* Date & Time Selection */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Select Date & Time</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Date</label>
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  min={new Date().toISOString().split('T')[0]}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Time</label>
                <select
                  value={selectedTime}
                  onChange={(e) => setSelectedTime(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select time</option>
                  {timeSlots.map((time) => (
                    <option key={time} value={time}>{time}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Address */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Service Address</h3>
            <div className="flex items-start">
              <MapPin className="h-5 w-5 text-gray-400 mr-3 mt-0.5" />
              <div className="flex-1">
                <input
                  type="text"
                  value={address}
                  onChange={(e) => setAddress(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="Enter service address"
                  required
                />
              </div>
            </div>
          </div>

          {/* Special Notes */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Special Instructions</h3>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Any special instructions or notes for the service provider..."
            />
          </div>
        </div>

        {/* Booking Summary */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 sticky top-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Booking Summary</h3>
            
            {selectedServiceData ? (
              <div className="space-y-4">
                <div className="flex justify-between">
                  <span className="text-gray-600">Service:</span>
                  <span className="font-medium">{selectedServiceData.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Duration:</span>
                  <span className="font-medium">{selectedServiceData.duration}h</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Date:</span>
                  <span className="font-medium">{selectedDate || 'Not selected'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Time:</span>
                  <span className="font-medium">{selectedTime || 'Not selected'}</span>
                </div>
                <div className="border-t border-gray-200 pt-4">
                  <div className="flex justify-between text-lg font-semibold">
                    <span>Total:</span>
                    <span className="text-primary-600">₹{selectedServiceData.price}</span>
                  </div>
                </div>
              </div>
            ) : (
              <p className="text-gray-500 text-center py-8">Select a service to see summary</p>
            )}

            <button
              onClick={handleBooking}
              disabled={!selectedService || !selectedDate || !selectedTime || !address.trim() || submitting}
              className="w-full mt-6 px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
            >
              <CheckCircle className="h-5 w-5 inline mr-2" />
              {submitting ? 'Sending Request...' : 'Confirm Booking'}
            </button>
          </div>

          {/* Success Message */}
          {showSuccessMessage && (
            <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4 animate-fade-in">
              <div className="flex items-center justify-between">
                <div className="flex items-center">
                  <CheckCircle className="h-5 w-5 text-green-500 mr-3" />
                  <p className="text-green-800 font-medium">
                    Booking request sent successfully! The worker will be notified.
                  </p>
                </div>
                <button
                  onClick={() => setShowSuccessMessage(false)}
                  className="text-green-500 hover:text-green-700 transition-colors"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default BookService;
