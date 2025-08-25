import React, { useState, useEffect, useMemo } from 'react';
import { 
  Search, 
  Star, 
  MapPin, 
  Heart,
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
  const [allWorkers, setAllWorkers] = useState([]);
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

  // Debounced search effect
  useEffect(() => {
    const fetchWorkers = async () => {
      try {
        setLoading(true);
        
        // Build search parameters
        const params = {};
        if (searchQuery.trim()) {
          params.search = searchQuery.trim();
        }
        if (selectedService) {
          params.service = selectedService;
        }
        if (sortBy) {
          params.sortBy = sortBy;
        }
        
        const response = await usersAPI.getWorkers(params);
        
        // Load user's favorites
        const favoritesData = await usersAPI.getFavorites();
        const favoriteIds = favoritesData.map(fav => fav._id);
        setFavorites(favoriteIds);
        
        const formattedWorkers = (response.workers || []).map(worker => ({
          id: worker._id,
          name: `${worker.firstName} ${worker.lastName}`,
          rating: worker.rating || 4.5,
          reviews: worker.reviewCount || 0,
          location: worker.location || 'Location not specified',
          distance: Math.floor(Math.random() * 10) + 1, // Random distance for demo
          services: worker.services?.map(service => service.name || service.category) || ['General Service'],
          image: worker.profileImage ? `http://localhost:5000${worker.profileImage}` : 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
          completedJobs: worker.completedJobs || 0,
          verified: worker.verified || false
        }));
        
        setWorkers(formattedWorkers);
        setAllWorkers(formattedWorkers);
      } catch (error) {
        console.error('Error fetching workers:', error);
        setError('Failed to load workers');
        setWorkers([]);
        setAllWorkers([]);
      } finally {
        setLoading(false);
      }
    };

    // Debounce search requests
    const timeoutId = setTimeout(() => {
      fetchWorkers();
    }, 300);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedService, sortBy]);

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

  // Client-side filtering as fallback (for immediate feedback)
  const filteredWorkers = useMemo(() => {
    if (!searchQuery.trim()) {
      return workers;
    }
    
    const query = searchQuery.toLowerCase();
    return workers.filter(worker => 
      worker.name.toLowerCase().includes(query) ||
      worker.location.toLowerCase().includes(query) ||
      worker.services.some(service => service.toLowerCase().includes(query))
    );
  }, [workers, searchQuery]);

  const WorkerCard = ({ worker }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-shadow">
      <div className="flex flex-col sm:flex-row sm:items-start justify-between mb-4">
        <div className="flex items-start mb-4 sm:mb-0">
          <img
            src={worker.image}
            alt={worker.name}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-full object-cover mr-3 sm:mr-4 flex-shrink-0"
          />
          <div className="min-w-0 flex-1">
            <div className="flex items-center mb-1">
              <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{worker.name}</h3>
              {worker.verified && (
                <div className="ml-2 w-4 h-4 sm:w-5 sm:h-5 bg-blue-500 rounded-full flex items-center justify-center flex-shrink-0">
                  <svg className="w-2.5 h-2.5 sm:w-3 sm:h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                </div>
              )}
            </div>
            <div className="flex items-center text-xs sm:text-sm text-gray-600 mb-1">
              <Star className="h-3 w-3 sm:h-4 sm:w-4 text-yellow-500 mr-1 flex-shrink-0" />
              <span className="truncate">{worker.rating} ({worker.reviews} reviews)</span>
            </div>
            <div className="flex items-center text-xs sm:text-sm text-gray-600">
              <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
              <span className="truncate">{worker.location} • {worker.distance} miles away</span>
            </div>
          </div>
        </div>
        <button
          onClick={() => toggleFavorite(worker.id)}
          className={`p-2 rounded-full transition-colors self-start sm:self-auto ${
            favorites.includes(worker.id)
              ? 'text-red-500 bg-red-50'
              : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
          }`}
        >
          <Heart className={`h-4 w-4 sm:h-5 sm:w-5 ${favorites.includes(worker.id) ? 'fill-current' : ''}`} />
        </button>
      </div>

      <div className="mb-4">
        <div className="flex flex-wrap gap-1 sm:gap-2 mb-3">
          {worker.services.map((service, index) => (
            <span
              key={index}
              className="px-2 py-1 bg-primary-100 text-primary-800 text-xs font-medium rounded-full"
            >
              {service}
            </span>
          ))}
        </div>
        
        <div className="flex items-center text-xs sm:text-sm text-gray-600">
          <User className="h-3 w-3 sm:h-4 sm:w-4 mr-1 flex-shrink-0" />
          {worker.completedJobs} jobs completed
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
        <button 
          onClick={() => navigate(`/customer/worker/${worker.id}`)}
          className="flex-1 px-3 sm:px-4 py-2 border border-primary-600 text-primary-600 rounded-lg hover:bg-primary-50 transition-colors text-sm sm:text-base"
        >
          View Profile
        </button>
        <button 
          onClick={() => navigate(`/customer/book/${worker.id}`)}
          className="flex-1 px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
        >
          Book Now
        </button>
      </div>
    </div>
  );


  return (
    <div className="p-3 sm:p-4 lg:p-6">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">Find Service Providers</h1>
        
        {/* Search Bar */}
        <div className="flex flex-col gap-3 sm:gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 sm:h-5 sm:w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Search by name, service, or location..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 sm:pl-10 pr-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
            />
          </div>
          
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3">
            <select
              value={selectedService}
              onChange={(e) => setSelectedService(e.target.value)}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
            >
              <option value="">All Services</option>
              {services.map((service) => (
                <option key={service} value={service}>
                  {service}
                </option>
              ))}
            </select>
            
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value)}
              className="flex-1 px-3 sm:px-4 py-2.5 sm:py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 text-sm sm:text-base"
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
            <div className="text-center py-8 sm:py-12">
              <div className="animate-spin rounded-full h-8 w-8 sm:h-12 sm:w-12 border-b-2 border-primary-600 mx-auto"></div>
              <p className="mt-3 sm:mt-4 text-sm sm:text-base text-gray-600">Loading service providers...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8 sm:py-12">
              <p className="text-red-600 mb-4 text-sm sm:text-base">{error}</p>
              <button 
                onClick={() => window.location.reload()}
                className="px-4 sm:px-6 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors text-sm sm:text-base"
              >
                Try Again
              </button>
            </div>
          ) : filteredWorkers.length > 0 ? (
            <>
              <div className="mb-4 sm:mb-6">
                <p className="text-sm sm:text-base text-gray-600">
                  {searchQuery.trim() 
                    ? `Found ${filteredWorkers.length} service provider${filteredWorkers.length !== 1 ? 's' : ''} matching "${searchQuery}"`
                    : `Showing ${filteredWorkers.length} service providers`
                  }
                </p>
              </div>
              
              <div className="space-y-4 sm:space-y-6">
                {filteredWorkers.map((worker) => (
                  <WorkerCard key={worker.id} worker={worker} />
                ))}
              </div>

              {/* Load More */}
              <div className="text-center mt-6 sm:mt-8">
                <button className="px-4 sm:px-6 py-2 sm:py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors text-sm sm:text-base">
                  Load More Results
                </button>
              </div>
            </>
          ) : (
            <div className="text-center py-8 sm:py-12">
              <div className="mb-4">
                <Search className="h-12 w-12 sm:h-16 sm:w-16 text-gray-300 mx-auto mb-3 sm:mb-4" />
                <p className="text-sm sm:text-base text-gray-600 mb-2 px-4">
                  {searchQuery.trim() 
                    ? `No service providers found matching "${searchQuery}"`
                    : 'No service providers found'
                  }
                </p>
                <p className="text-xs sm:text-sm text-gray-500 px-4">
                  {searchQuery.trim() 
                    ? 'Try searching with different keywords like worker names, services, or locations.'
                    : 'Try adjusting your search criteria.'
                  }
                </p>
              </div>
              {searchQuery.trim() && (
                <button 
                  onClick={() => setSearchQuery('')}
                  className="px-3 sm:px-4 py-2 text-primary-600 hover:text-primary-700 font-medium text-sm sm:text-base"
                >
                  Clear search
                </button>
              )}
            </div>
          )}
      </div>
    </div>
  );
};

export default SearchWorkers;
