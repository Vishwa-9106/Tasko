import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Star, 
  MapPin, 
  Clock, 
  Heart,
  DollarSign,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { usersAPI } from '../../services/api';

const SearchWorkers = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [favorites, setFavorites] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);


  const services = [
    'House Cleaning',
    'Bathroom Cleaning', 
    'Home Cooking',
    'Laundry Service',
    'Dishwashing',
    'Garden Maintenance'
  ];

  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setLoading(true);
        const response = await usersAPI.getWorkers();
        
        // Load user's favorites
        const favoritesData = await usersAPI.getFavorites();
        const favoriteIds = favoritesData.map(fav => fav._id);
        setFavorites(favoriteIds);
        
        const formattedWorkers = (response.workers || []).map(worker => ({
          id: worker._id,
          name: `${worker.firstName} ${worker.lastName}`,
          rating: worker.rating || 4.5,
          reviews: worker.reviewCount || 0,
          hourlyRate: worker.hourlyRate || 25,
          location: worker.location || 'Location not specified',
          distance: Math.floor(Math.random() * 10) + 1, // Random distance for demo
          services: worker.services?.map(service => service.name || service.category) || ['General Service'],
          image: worker.profileImage || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          availability: 'Available this week',
          completedJobs: worker.completedJobs || 0,
          responseTime: '1 hour',
          verified: worker.verified || false
        }));
        
        setWorkers(formattedWorkers);
      } catch (error) {
        console.error('Error fetching workers:', error);
        setError('Failed to load workers');
        setWorkers([]);
      } finally {
        setLoading(false);
      }
    };

    fetchWorkers();
  }, []);

  const toggleFavorite = async (workerId) => {
    try {
      const response = await usersAPI.toggleFavorite(workerId);
      if (response.isFavorite) {
        setFavorites(prev => [...prev, workerId]);
      } else {
        setFavorites(prev => prev.filter(id => id !== workerId));
      }
    } catch (error) {
      console.error('Error toggling favorite:', error);
      setError('Failed to update favorite status');
    }
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
          onClick={() => toggleFavorite(worker.id)}
          className={`p-2 rounded-full transition-colors ${
            favorites.includes(worker.id)
              ? 'text-red-500 bg-red-50'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <Heart className={`h-5 w-5 ${favorites.includes(worker.id) ? 'fill-current' : ''}`} />
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
            ₹{worker.hourlyRate}/hour
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

      <div className="flex space-x-3">
        <button 
          onClick={() => navigate(`/customer/worker/${worker.id}`)}
          className="flex-1 px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors"
        >
          View Profile
        </button>
        <button 
          onClick={() => navigate(`/customer/book/${worker.id}`)}
          className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          Book Now
        </button>
      </div>
    </div>
  );


  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900 mb-4">Find Service Providers</h1>
        
        {/* Search Bar */}
        <div className="flex flex-col lg:flex-row gap-4">
          <div className="flex-1 relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, service, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            />
          </div>
          
          <div className="flex gap-3">
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            >
              <option value="rating">Sort by Rating</option>
              <option value="price-low">Price: Low to High</option>
              <option value="price-high">Price: High to Low</option>
              <option value="distance">Distance</option>
              <option value="reviews">Most Reviews</option>
            </select>
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
          {loading ? (
            <div className="text-center py-12">
              <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-4 text-gray-600">Loading service providers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <p className="text-red-600 mb-4">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Try Again
              </button>
            </div>
          ) : workers.length > 0 ? (
            <>
              <div className="mb-6">
                <p className="text-gray-600">
                  Showing {workers.length} service providers
                </p>
              </div>
              
              <div className="space-y-6">
                {workers.map((worker) => (
                  <WorkerCard key={worker.id} worker={worker} />
                ))}
              </div>

              {/* Load More */}
              <div className="text-center mt-8">
                <button className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
                  Load More Results
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-12">
              <p className="text-gray-600 mb-4">No service providers found.</p>
              <p className="text-sm text-gray-500">Try adjusting your search criteria.</p>
            </div>
          )}
      </div>
    </div>
  );
};

export default SearchWorkers;
