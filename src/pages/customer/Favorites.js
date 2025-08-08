import React, { useState } from 'react';
import { 
  Heart, 
  Star, 
  MapPin, 
  Clock, 
  DollarSign,
  User,
  MessageCircle,
  Calendar,
  Trash2
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Favorites = () => {
  const navigate = useNavigate();
  const [favorites, setFavorites] = useState([
    {
      id: 2,
      name: 'James Wilson',
      rating: 4.8,
      reviews: 89,
      hourlyRate: 30,
      location: 'Brooklyn, NY',
      distance: 4.1,
      services: ['Home Cooking', 'Meal Prep'],
      image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop&crop=face',
      availability: 'Available tomorrow',
      completedJobs: 156,
      responseTime: '30 minutes',
      verified: true,
      lastBooked: '2024-01-10',
      totalBookings: 3
    },
    {
      id: 5,
      name: 'Lisa Thompson',
      rating: 4.8,
      reviews: 112,
      hourlyRate: 26,
      location: 'Bronx, NY',
      distance: 8.2,
      services: ['Home Cooking', 'Baking'],
      image: 'https://images.unsplash.com/photo-1544005313-94ddf0286df2?w=150&h=150&fit=crop&crop=face',
      availability: 'Available this week',
      completedJobs: 267,
      responseTime: '1 hour',
      verified: true,
      lastBooked: '2024-01-05',
      totalBookings: 2
    },
    {
      id: 7,
      name: 'Michael Brown',
      rating: 4.9,
      reviews: 203,
      hourlyRate: 28,
      location: 'Manhattan, NY',
      distance: 2.8,
      services: ['House Cleaning', 'Deep Cleaning'],
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      availability: 'Available today',
      completedJobs: 445,
      responseTime: '15 minutes',
      verified: true,
      lastBooked: '2023-12-28',
      totalBookings: 5
    }
  ]);

  const removeFavorite = (workerId) => {
    setFavorites(favorites.filter(worker => worker.id !== workerId));
  };

  const stats = {
    totalFavorites: favorites.length,
    totalBookings: favorites.reduce((sum, worker) => sum + worker.totalBookings, 0),
    averageRating: (favorites.reduce((sum, worker) => sum + worker.rating, 0) / favorites.length).toFixed(1),
    averageRate: Math.round(favorites.reduce((sum, worker) => sum + worker.hourlyRate, 0) / favorites.length)
  };

  const WorkerCard = ({ worker }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center">
          <img
            src={worker.image}
            alt={worker.name}
            className="w-16 h-16 rounded-full object-cover mr-4"
          />
          <div>
            <div className="flex items-center mb-1">
              <h3 className="text-lg font-semibold text-gray-900">{worker.name}</h3>
              {worker.verified && (
                <div className="ml-2 w-5 h-5 bg-blue-500 rounded-full flex items-center justify-center">
                  <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex items-center text-sm text-gray-600 mb-1">
              <Star className="h-4 w-4 text-yellow-500 mr-1" />
              {worker.rating} ({worker.reviews} reviews)
            </div>
            <div className="flex items-center text-sm text-gray-600">
              <MapPin className="h-4 w-4 mr-1" />
              {worker.location} • {worker.distance} miles away
            </div>
          </div>
        </div>
        <button
          onClick={() => removeFavorite(worker.id)}
          className="p-2 text-red-500 hover:bg-red-50 rounded-full transition-colors"
          title="Remove from favorites"
        >
          <Trash2 className="h-5 w-5" />
        </button>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-2 mb-3">
          {worker.services.map((service, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full"
            >
              {service}
            </span>
          ))}
        </div>
        
        <div className="grid grid-cols-2 gap-4 text-sm text-gray-600">
          <div className="flex items-center">
            <DollarSign className="h-4 w-4 mr-1" />
            ${worker.hourlyRate}/hour
          </div>
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            {worker.availability}
          </div>
          <div className="flex items-center">
            <User className="h-4 w-4 mr-1" />
            {worker.completedJobs} jobs completed
          </div>
          <div className="flex items-center">
            <Clock className="h-4 w-4 mr-1" />
            Responds in {worker.responseTime}
          </div>
        </div>
      </div>

      {/* Booking History with this worker */}
      <div className="mb-4 p-3 bg-gray-50 rounded-lg">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Your history:</span>
          <span className="font-medium text-gray-900">{worker.totalBookings} bookings</span>
        </div>
        <div className="flex justify-between items-center text-sm mt-1">
          <span className="text-gray-600">Last booked:</span>
          <span className="text-gray-900">{worker.lastBooked}</span>
        </div>
      </div>

      <div className="flex space-x-3">
        <button 
          onClick={() => navigate(`/worker/${worker.id}`)}
          className="flex-1 px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
        >
          View Profile
        </button>
        <button 
          onClick={() => navigate(`/book/${worker.id}`)}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Book Now
        </button>
        <button className="px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
          <MessageCircle className="h-4 w-4" />
        </button>
      </div>
    </div>
  );

  const StatCard = ({ title, value, subtitle, icon: Icon, color }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-medium text-gray-600">{title}</p>
          <p className="text-2xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-sm text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-full ${color}`}>
          <Icon className="h-6 w-6 text-white" />
        </div>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">My Favorites</h1>
        <p className="text-gray-600 mt-2">Your saved service providers for quick booking</p>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
        <StatCard
          title="Favorite Workers"
          value={stats.totalFavorites}
          icon={Heart}
          color="bg-red-500"
        />
        <StatCard
          title="Total Bookings"
          value={stats.totalBookings}
          subtitle="with favorites"
          icon={Calendar}
          color="bg-blue-500"
        />
        <StatCard
          title="Average Rating"
          value={`${stats.averageRating}★`}
          subtitle="of your favorites"
          icon={Star}
          color="bg-yellow-500"
        />
        <StatCard
          title="Average Rate"
          value={`$${stats.averageRate}/hr`}
          subtitle="of your favorites"
          icon={DollarSign}
          color="bg-green-500"
        />
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 mb-8">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button 
            onClick={() => navigate('/search')}
            className="flex items-center justify-center px-4 py-3 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
          >
            <User className="h-5 w-5 mr-2" />
            Find New Workers
          </button>
          <button className="flex items-center justify-center px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
            <Calendar className="h-5 w-5 mr-2" />
            Book with Favorite
          </button>
          <button 
            onClick={() => navigate('/bookings')}
            className="flex items-center justify-center px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
          >
            <Clock className="h-5 w-5 mr-2" />
            View Booking History
          </button>
        </div>
      </div>

      {/* Favorites List */}
      {favorites.length > 0 ? (
        <div className="space-y-6">
          {favorites.map((worker) => (
            <WorkerCard key={worker.id} worker={worker} />
          ))}
        </div>
      ) : (
        /* Empty State */
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Heart className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No favorites yet</h3>
          <p className="text-gray-600 mb-6">
            Save your preferred service providers for quick and easy booking
          </p>
          <button 
            onClick={() => navigate('/search')}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Find Service Providers
          </button>
        </div>
      )}

      {/* Tips */}
      <div className="mt-8 bg-blue-50 border border-blue-200 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-blue-900 mb-2">💡 Pro Tips</h3>
        <ul className="text-blue-800 text-sm space-y-1">
          <li>• Save workers you've had great experiences with for easy rebooking</li>
          <li>• Favorite workers often offer loyalty discounts for repeat customers</li>
          <li>• You can message your favorite workers directly for scheduling flexibility</li>
        </ul>
      </div>
    </div>
  );
};

export default Favorites;
