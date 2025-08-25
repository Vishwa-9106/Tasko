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
    },
    {
      id: 5,
      name: 'Maintenance',
      description: 'Professional home maintenance and repair services',
      price: 'From $60',
      icon: '🛠️',
      rating: 4.5,
      bookings: 300
    },
    {
      id: 6,
      name: 'Cloud Kitchen',
      description: 'Delicious meals delivered from our cloud kitchen',
      price: 'From $35',
      icon: '🍱',
      rating: 4.8,
      bookings: 700
    },
    {
      id: 7,
      name: 'cookie Products',
      description: 'Fresh groceries and daily essentials delivered to your home',
      price: 'From $20',
      icon: '🛒',
      rating: 4.8,
      bookings: 700
    },
    {
      id: 8,
      name: 'Baby Sitting',
      description: 'Trusted babysitting and childcare services',
      price: 'From $45',
      icon: '🍼',
      rating: 4.7,
      bookings: 350
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
      <section className="bg-gradient-to-r from-primary-600 to-primary-700 text-white py-12 sm:py-16 lg:py-20">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center">
            <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold mb-4 sm:mb-6">
              Home Services Made Simple
            </h1>
            <p className="text-lg sm:text-xl md:text-2xl mb-6 sm:mb-8 max-w-3xl mx-auto px-4">
              Find trusted professionals for all your household needs
            </p>
            <button 
              onClick={() => navigate('/customer/search')}
              className="bg-white text-primary-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
            >
              Find Services
              <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Popular Services */}
      <section className="py-12 sm:py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">Popular Services</h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4">
              Choose from our most requested home services
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {popularServices.map((service) => (
              <div 
                key={service.id}
                onClick={() => navigate('/customer/search')}
                className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 hover:shadow-md transition-all duration-200 cursor-pointer group hover:scale-105"
              >
                <div className="text-2xl sm:text-3xl md:text-4xl mb-3 sm:mb-4">{service.icon}</div>
                <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">{service.name}</h3>
                <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4 line-clamp-2">{service.description}</p>
                <div className="flex items-center justify-between">
                  <span className="text-xs sm:text-sm md:text-base font-medium text-primary-600">From ₹{service.price}</span>
                  <div className="flex items-center text-xs text-gray-500">
                    <Star className="h-3 w-3 sm:h-4 sm:w-4 fill-current text-yellow-400 mr-1" />
                    {service.rating}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="py-12 sm:py-16 bg-white">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-8 sm:mb-12">
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900 mb-3 sm:mb-4">How It Works</h2>
            <p className="text-sm sm:text-base text-gray-600 max-w-2xl mx-auto px-4">
              Getting help for your home has never been easier
            </p>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 sm:gap-8">
            {howItWorks.map((step, index) => (
              <div key={index} className="text-center">
                <div className="w-12 h-12 sm:w-16 sm:h-16 bg-primary-100 rounded-full flex items-center justify-center mx-auto mb-3 sm:mb-4">
                  <step.icon className="h-6 w-6 sm:h-8 sm:w-8 text-primary-600" />
                </div>
                <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                <p className="text-sm sm:text-base text-gray-600 px-2">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 sm:py-16 bg-primary-600">
        <div className="max-w-4xl mx-auto text-center px-4 sm:px-6 lg:px-8">
          <h2 className="text-2xl sm:text-3xl font-bold text-white mb-3 sm:mb-4">
            Ready to get started?
          </h2>
          <p className="text-lg sm:text-xl text-primary-100 mb-6 sm:mb-8 px-4">
            Join thousands of satisfied customers who trust us with their home services
          </p>
          <button 
            onClick={() => navigate('/customer/search')}
            className="bg-white text-primary-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-gray-100 transition-colors inline-flex items-center"
          >
            Get Started
            <ArrowRight className="ml-2 h-4 w-4 sm:h-5 sm:w-5" />
          </button>
        </div>
      </section>
    </div>
  );
};

export default Home;
