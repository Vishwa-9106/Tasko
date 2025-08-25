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
    <div className="min-h-screen bg-gray-50 w-full overflow-x-hidden">
      {/* Hero Section */}
      <div className="bg-gradient-to-r from-primary-600 to-primary-800 text-white w-full">
        <div className="container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-8 xs:py-12 sm:py-16 lg:py-20 max-w-7xl">
          <div className="text-center w-full">
            <h1 className="text-2xl xs:text-3xl sm:text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-bold mb-3 xs:mb-4 sm:mb-6 leading-tight px-2">
              Home Services Made Simple
            </h1>
            <p className="text-base xs:text-lg sm:text-xl md:text-2xl mb-4 xs:mb-6 sm:mb-8 text-primary-100 max-w-xs xs:max-w-sm sm:max-w-2xl md:max-w-4xl mx-auto px-2 xs:px-4">
              Connect with trusted professionals for all your household needs
            </p>
            <div className="flex flex-col xs:flex-col sm:flex-row gap-2 xs:gap-3 sm:gap-4 justify-center items-center w-full max-w-xs xs:max-w-sm sm:max-w-none mx-auto px-2">
              <button 
                onClick={() => navigate('/customer/search')}
                className="w-full xs:w-full sm:w-auto px-4 xs:px-6 sm:px-8 py-2.5 xs:py-3 sm:py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-xs xs:text-sm sm:text-base"
              >
                Find Services
              </button>
              <button className="w-full xs:w-full sm:w-auto px-4 xs:px-6 sm:px-8 py-2.5 xs:py-3 sm:py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-primary-600 transition-colors text-xs xs:text-sm sm:text-base">
                How It Works
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Popular Services */}
      <div className="w-full">
        <div className="container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-8 xs:py-12 sm:py-16 max-w-7xl">
          <div className="text-center mb-6 xs:mb-8 sm:mb-12">
            <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 mb-2 xs:mb-3 sm:mb-4 px-2">Popular Services</h2>
            <p className="text-gray-600 text-sm xs:text-base sm:text-lg max-w-xs xs:max-w-sm sm:max-w-2xl mx-auto px-2 xs:px-4">Choose from our most requested home services</p>
          </div>
          
          <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 xs:gap-4 sm:gap-6">
            {popularServices.map((service) => (
              <div 
                key={service.id}
                className="bg-white rounded-lg shadow-sm border border-gray-200 p-3 xs:p-4 sm:p-6 hover:shadow-md transition-all duration-200 cursor-pointer transform hover:scale-105 w-full"
                onClick={() => navigate('/customer/search')}
              >
                <div className="text-2xl xs:text-3xl sm:text-4xl mb-2 xs:mb-3 sm:mb-4">{service.icon}</div>
                <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-gray-900 mb-1 xs:mb-2 truncate">{service.name}</h3>
                <p className="text-gray-600 text-xs xs:text-xs sm:text-sm mb-2 xs:mb-3 sm:mb-4 leading-relaxed h-8 xs:h-10 sm:h-12 overflow-hidden">{service.description}</p>
                <div className="flex justify-between items-center mb-1 xs:mb-2 sm:mb-3">
                  <span className="text-primary-600 font-semibold text-xs xs:text-sm sm:text-base">{service.price}</span>
                  <div className="flex items-center text-xs xs:text-xs sm:text-sm text-gray-600">
                    <Star className="h-3 w-3 xs:h-3 xs:w-3 sm:h-4 sm:w-4 text-yellow-500 mr-1" />
                    {service.rating}
                  </div>
                </div>
                <p className="text-xs text-gray-500 truncate">{service.bookings} bookings this month</p>
              </div>
            ))}
          </div>
        </div>
      </div>


      {/* How It Works */}
      <div className="w-full">
        <div className="container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 py-8 xs:py-12 sm:py-16 max-w-7xl">
          <div className="text-center mb-6 xs:mb-8 sm:mb-12">
            <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 mb-2 xs:mb-3 sm:mb-4 px-2">How It Works</h2>
            <p className="text-gray-600 text-sm xs:text-base sm:text-lg max-w-xs xs:max-w-sm sm:max-w-2xl mx-auto px-2 xs:px-4">Getting help for your home is easier than ever</p>
          </div>
          
          <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-3 gap-4 xs:gap-6 sm:gap-8">
            {howItWorks.map((step, index) => (
              <div key={step.step} className="text-center relative">
                <div className="relative mb-3 xs:mb-4 sm:mb-6">
                  <div className="w-10 h-10 xs:w-12 xs:h-12 sm:w-16 sm:h-16 bg-primary-600 rounded-full flex items-center justify-center mx-auto mb-3 xs:mb-4">
                    <step.icon className="h-5 w-5 xs:h-6 xs:w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  {index < howItWorks.length - 1 && (
                    <>
                      <ArrowRight className="hidden sm:block absolute top-5 xs:top-6 sm:top-8 left-full transform -translate-y-1/2 translate-x-1 xs:translate-x-2 sm:translate-x-4 h-4 w-4 xs:h-5 xs:w-5 sm:h-6 sm:w-6 text-gray-400" />
                      <div className="sm:hidden w-px h-6 xs:h-8 bg-gray-300 mx-auto mt-2 xs:mt-4"></div>
                    </>
                  )}
                </div>
                <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-gray-900 mb-1 xs:mb-2 px-2">{step.title}</h3>
                <p className="text-gray-600 text-xs xs:text-sm sm:text-base px-2 xs:px-4">{step.description}</p>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Trust & Safety */}
      <div className="bg-gray-100 py-8 xs:py-12 sm:py-16 w-full">
        <div className="container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 max-w-7xl">
          <div className="text-center mb-6 xs:mb-8 sm:mb-12">
            <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold text-gray-900 mb-2 xs:mb-3 sm:mb-4 px-2">Your Safety is Our Priority</h2>
            <p className="text-gray-600 text-sm xs:text-base sm:text-lg max-w-xs xs:max-w-sm sm:max-w-3xl mx-auto px-2 xs:px-4">All service providers are thoroughly vetted and insured</p>
          </div>
          
          <div className="grid grid-cols-1 xs:grid-cols-1 sm:grid-cols-3 gap-4 xs:gap-6 sm:gap-8">
            <div className="text-center bg-white rounded-lg p-3 xs:p-4 sm:p-6 shadow-sm">
              <Shield className="h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 text-primary-600 mx-auto mb-2 xs:mb-3 sm:mb-4" />
              <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-gray-900 mb-1 xs:mb-2 px-1">Background Checked</h3>
              <p className="text-gray-600 text-xs xs:text-sm sm:text-base px-1 xs:px-2">All professionals undergo comprehensive background verification</p>
            </div>
            <div className="text-center bg-white rounded-lg p-3 xs:p-4 sm:p-6 shadow-sm">
              <Users className="h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 text-primary-600 mx-auto mb-2 xs:mb-3 sm:mb-4" />
              <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-gray-900 mb-1 xs:mb-2 px-1">Reviewed & Rated</h3>
              <p className="text-gray-600 text-xs xs:text-sm sm:text-base px-1 xs:px-2">Real reviews from verified customers help you choose the best</p>
            </div>
            <div className="text-center bg-white rounded-lg p-3 xs:p-4 sm:p-6 shadow-sm">
              <CheckCircle className="h-8 w-8 xs:h-10 xs:w-10 sm:h-12 sm:w-12 text-primary-600 mx-auto mb-2 xs:mb-3 sm:mb-4" />
              <h3 className="text-sm xs:text-base sm:text-lg font-semibold text-gray-900 mb-1 xs:mb-2 px-1">Satisfaction Guaranteed</h3>
              <p className="text-gray-600 text-xs xs:text-sm sm:text-base px-1 xs:px-2">We stand behind every service with our satisfaction guarantee</p>
            </div>
          </div>
        </div>
      </div>

      {/* CTA Section */}
      <div className="bg-primary-600 text-white py-8 xs:py-12 sm:py-16 w-full">
        <div className="container mx-auto px-3 xs:px-4 sm:px-6 lg:px-8 text-center max-w-4xl">
          <h2 className="text-xl xs:text-2xl sm:text-3xl font-bold mb-2 xs:mb-3 sm:mb-4 px-2">Ready to Get Started?</h2>
          <p className="text-sm xs:text-base sm:text-xl text-primary-100 mb-4 xs:mb-6 sm:mb-8 max-w-xs xs:max-w-sm sm:max-w-2xl mx-auto px-2 xs:px-4">
            Join thousands of satisfied customers who trust Cookie for their home services
          </p>
          <button 
            onClick={() => navigate('/customer/search')}
            className="w-full xs:w-full sm:w-auto px-4 xs:px-6 sm:px-8 py-2.5 xs:py-3 sm:py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors text-xs xs:text-sm sm:text-base max-w-xs mx-auto"
          >
            Book Your Service
          </button>
        </div>
      </div>
    </div>
  );
};

export default Home;
