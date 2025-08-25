import React, { useState, useEffect } from 'react';
import { 
  Search, 
  Star, 
  Clock, 
  Shield, 
  Users,
  ArrowRight,
  CheckCircle
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const Home = () => {
  const navigate = useNavigate();
  const [featuredWorkers, setFeaturedWorkers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadFeaturedWorkers();
  }, []);

  const loadFeaturedWorkers = async () => {
    try {
      setLoading(true);
      const response = await fetch(`${process.env.REACT_APP_API_URL}/users/workers`);
      
      if (response.ok) {
        const data = await response.json();
        console.log('API Response:', data); // Debug log
        
        // Handle different response structures
        let workers = [];
        if (Array.isArray(data)) {
          workers = data;
        } else if (data.workers && Array.isArray(data.workers)) {
          workers = data.workers;
        } else if (data.data && Array.isArray(data.data)) {
          workers = data.data;
        }
        
        console.log('Workers array:', workers); // Debug log
        
        // Get top 3 workers with highest ratings
        const topWorkers = workers
          .filter(worker => worker.rating > 0)
          .sort((a, b) => b.rating - a.rating)
          .slice(0, 3)
          .map(worker => ({
            id: worker._id,
            name: `${worker.firstName} ${worker.lastName}`,
            specialty: worker.services && worker.services.length > 0 
              ? worker.services[0].category || worker.services[0].name 
              : 'General Services',
            rating: worker.rating || 4.5,
            reviews: worker.reviewCount || 0,
            image: worker.profileImage || 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop&crop=face',
            hourlyRate: worker.hourlyRate || 25
          }));
        
        setFeaturedWorkers(topWorkers);
      } else {
        // Fallback to demo data if API fails
        setFeaturedWorkers([]);
      }
    } catch (error) {
      console.error('Error loading workers:', error);
      setFeaturedWorkers([]);
    } finally {
      setLoading(false);
    }
  };

  const popularServices = [
    {
      id: 1,
      name: 'House Cleaning',
      description: 'Professional home cleaning services',
      price: 'From $50',
      icon: '🏠',
      rating: 4.8,
      bookings: 1250
    },
    {
      id: 2,
      name: 'Bathroom Cleaning',
      description: 'Deep bathroom sanitization',
      price: 'From $30',
      icon: '🚿',
      rating: 4.9,
      bookings: 890
    },
    {
      id: 3,
      name: 'Home Cooking',
      description: 'Fresh meals prepared at home',
      price: 'From $40',
      icon: '👨‍🍳',
      rating: 4.7,
      bookings: 650
    },
    {
      id: 4,
      name: 'Laundry Service',
      description: 'Washing, drying, and folding',
      price: 'From $25',
      icon: '👕',
      rating: 4.6,
      bookings: 420
    }
  ];


  const howItWorks = [
    {
      step: 1,
      title: 'Search & Browse',
      description: 'Find the perfect service provider for your needs',
      icon: Search
    },
    {
      step: 2,
      title: 'Book & Schedule',
      description: 'Choose your preferred date and time',
      icon: Clock
    },
    {
      step: 3,
      title: 'Relax & Enjoy',
      description: 'Sit back while professionals handle the work',
      icon: CheckCircle
    }
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20">
          <div className="text-center">
            <h1 className="text-4xl md:text-6xl font-bold mb-6">
              Home Services Made Simple
            </h1>
            <p className="text-xl md:text-2xl mb-8 text-primary-100">
              Connect with trusted professionals for all your household needs
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => navigate('/search')}
                className="px-8 py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Find Services
              </button>
              <button className="px-8 py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-primary-600 transition-colors">
                How It Works
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Services */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">Popular Services</h2>
          <p className="text-gray-600 text-lg">Choose from our most requested home services</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {popularServices.map((service) => (
            <div 
              key={service.id}
              className="bg-white rounded-lg shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow cursor-pointer"
              onClick={() => navigate('/search')}
            >
              <div className="text-4xl mb-4">{service.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{service.name}</h3>
              <p className="text-gray-600 text-sm mb-4">{service.description}</p>
              <div className="flex justify-between items-center mb-3">
                <span className="text-primary-600 font-semibold">{service.price}</span>
                <div className="flex items-center text-sm text-gray-600">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  {service.rating}
                </div>
              </div>
              <p className="text-xs text-gray-500">{service.bookings} bookings this month</p>
            </div>
          ))}
        </div>
      </div>

      {/* Featured Workers */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Service Providers</h2>
            <p className="text-gray-600 text-lg">Meet some of our top-rated professionals</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {loading ? (
              <div className="col-span-3 text-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600 mx-auto"></div>
                <p className="mt-2 text-gray-600">Loading featured workers...</p>
              </div>
            ) : featuredWorkers.length > 0 ? (
              featuredWorkers.map((worker) => (
                <div key={worker.id} className="text-center">
                  <img
                    src={worker.image}
                    alt={worker.name}
                    className="w-24 h-24 rounded-full mx-auto mb-4 object-cover"
                  />
                  <h3 className="text-lg font-semibold text-gray-900 mb-1">{worker.name}</h3>
                  <p className="text-gray-600 mb-2">{worker.specialty}</p>
                  <div className="flex items-center justify-center mb-2">
                    <Star className="h-4 w-4 text-yellow-500 mr-1" />
                    <span className="text-sm font-medium">{worker.rating}</span>
                    <span className="text-sm text-gray-600 ml-1">({worker.reviews} reviews)</span>
                  </div>
                  <p className="text-primary-600 font-semibold">₹{worker.hourlyRate}/hour</p>
                </div>
              ))
            ) : (
              <div className="col-span-3 text-center py-8">
                <p className="text-gray-600">No featured workers available at the moment.</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* How It Works */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-gray-900 mb-4">How It Works</h2>
          <p className="text-gray-600 text-lg">Getting help for your home is easier than ever</p>
        </div>
        
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          {howItWorks.map((step, index) => (
            <div key={step.step} className="text-center">
              <div className="relative">
                <div className="w-16 h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-4">
                  <step.icon className="h-8 w-8 text-white" />
                </div>
                {index < howItWorks.length - 1 && (
                  <ArrowRight className="hidden md:block absolute top-8 left-full transform -translate-y-1/2 translate-x-4 h-6 w-6 text-gray-400" />
                )}
              </div>
              <h3 className="text-lg font-semibold text-gray-900 mb-2">{step.title}</h3>
              <p className="text-gray-600">{step.description}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Trust & Safety */}
      <div className="bg-gray-100 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your Safety is Our Priority</h2>
            <p className="text-gray-600 text-lg">All service providers are thoroughly vetted and insured</p>
          </div>
          
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <Shield className="h-12 w-12 text-primary-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Background Checked</h3>
              <p className="text-gray-600">All professionals undergo comprehensive background verification</p>
            </div>
            <div className="text-center">
              <Users className="h-12 w-12 text-primary-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Reviewed & Rated</h3>
              <p className="text-gray-600">Real reviews from verified customers help you choose the best</p>
            </div>
            <div className="text-center">
              <CheckCircle className="h-12 w-12 text-primary-600 mx-auto mb-4" />
              <h3 className="text-lg font-semibold text-gray-900 mb-2">Satisfaction Guaranteed</h3>
              <p className="text-gray-600">We stand behind every service with our satisfaction guarantee</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 text-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl font-bold mb-4">Ready to Get Started?</h2>
          <p className="text-xl text-primary-100 mb-8">
            Join thousands of satisfied customers who trust Cookie for their home services
          </p>
          <button 
            onClick={() => navigate('/search')}
            className="px-8 py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
          >
            Book Your First Service
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
