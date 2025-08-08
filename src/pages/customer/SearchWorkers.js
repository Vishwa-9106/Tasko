import React, { useState } from 'react';
import { 
  Search, 
  Filter, 
  Star, 
  MapPin, 
  Clock, 
  Heart,
  DollarSign,
  User
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const SearchWorkers = () => {
  const navigate = useNavigate();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedService, setSelectedService] = useState('');
  const [sortBy, setSortBy] = useState('rating');
  const [showFilters, setShowFilters] = useState(false);
  const [favorites, setFavorites] = useState([2, 5]);

  const [filters, setFilters] = useState({
    priceRange: [0, 100],
    rating: 4,
    availability: '',
    distance: 10
  });

  const services = [
    'House Cleaning',
    'Bathroom Cleaning', 
    'Home Cooking',
    'Laundry Service',
    'Dishwashing',
    'Garden Maintenance'
  ];

  const workers = [
    {
      id: 1,
      name: 'Maria Rodriguez',
      rating: 4.9,
      reviews: 127,
      hourlyRate: 25,
      location: 'Manhattan, NY',
      distance: 2.3,
      services: ['House Cleaning', 'Bathroom Cleaning'],
      image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=150&h=150&fit=crop&crop=face',
      availability: 'Available today',
      completedJobs: 340,
      responseTime: '1 hour',
      verified: true
    },
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
      verified: true
    },
    {
      id: 3,
      name: 'Sarah Chen',
      rating: 4.9,
      reviews: 156,
      hourlyRate: 22,
      location: 'Queens, NY',
      distance: 6.8,
      services: ['Laundry Service', 'Organization'],
      image: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop&crop=face',
      availability: 'Available this week',
      completedJobs: 289,
      responseTime: '2 hours',
      verified: true
    },
    {
      id: 4,
      name: 'David Kim',
      rating: 4.7,
      reviews: 73,
      hourlyRate: 28,
      location: 'Manhattan, NY',
      distance: 1.9,
      services: ['House Cleaning', 'Dishwashing'],
      image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
      availability: 'Available today',
      completedJobs: 198,
      responseTime: '45 minutes',
      verified: false
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
      verified: true
    }
  ];

  const toggleFavorite = (workerId) => {
    setFavorites(prev => 
      prev.includes(workerId) 
        ? prev.filter(id => id !== workerId)
        : [...prev, workerId]
    );
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
      </div>
    </div>
  );

  const FilterPanel = () => (
    <div className={`bg-white rounded-lg shadow-sm border border-gray-200 p-6 ${showFilters ? 'block' : 'hidden'} lg:block`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">Filters</h3>
      
      <div className="space-y-6">
        {/* Service Type */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Service Type</label>
          <select
            value={selectedService}
            onChange={(e) => setSelectedService(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">All Services</option>
            {services.map((service) => (
              <option key={service} value={service}>{service}</option>
            ))}
          </select>
        </div>

        {/* Price Range */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Price Range: ${filters.priceRange[0]} - ${filters.priceRange[1]}/hour
          </label>
          <input
            type="range"
            min="0"
            max="100"
            value={filters.priceRange[1]}
            onChange={(e) => setFilters({...filters, priceRange: [0, parseInt(e.target.value)]})}
            className="w-full"
          />
        </div>

        {/* Rating */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Minimum Rating: {filters.rating} stars
          </label>
          <input
            type="range"
            min="1"
            max="5"
            step="0.1"
            value={filters.rating}
            onChange={(e) => setFilters({...filters, rating: parseFloat(e.target.value)})}
            className="w-full"
          />
        </div>

        {/* Distance */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">
            Distance: Within {filters.distance} miles
          </label>
          <input
            type="range"
            min="1"
            max="25"
            value={filters.distance}
            onChange={(e) => setFilters({...filters, distance: parseInt(e.target.value)})}
            className="w-full"
          />
        </div>

        {/* Availability */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Availability</label>
          <select
            value={filters.availability}
            onChange={(e) => setFilters({...filters, availability: e.target.value})}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
          >
            <option value="">Any time</option>
            <option value="today">Available today</option>
            <option value="tomorrow">Available tomorrow</option>
            <option value="week">Available this week</option>
          </select>
        </div>
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
            <button
              onClick={() => setShowFilters(!showFilters)}
              className="lg:hidden flex items-center px-4 py-3 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              <Filter className="h-5 w-5 mr-2" />
              Filters
            </button>
            
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

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Filters Sidebar */}
        <div className="lg:col-span-1">
          <FilterPanel />
        </div>

        {/* Results */}
        <div className="lg:col-span-3">
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
        </div>
      </div>
    </div>
  );
};

export default SearchWorkers;
