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
  const [showHowItWorks, setShowHowItWorks] = useState(false);
  const [services, setServices] = useState([]);
  const [workers, setWorkers] = useState([]);
  const [stats, setStats] = useState({ totalServices: 0, totalWorkers: 0, totalBookings: 0 });

  const scrollToHowItWorks = () => {
    const howItWorksSection = document.getElementById('how-it-works');
    if (howItWorksSection) {
      howItWorksSection.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // Load real data on component mount
  useEffect(() => {
    const loadRealData = () => {
      try {
        // Load services from localStorage
        const savedServices = JSON.parse(localStorage.getItem('services') || '[]');
        const userServices = JSON.parse(localStorage.getItem('userServices') || '[]');
        const allServices = [...savedServices, ...userServices];
        
        // Get top 4 services by bookings or rating
        const topServices = allServices
          .sort((a, b) => (b.bookings || 0) - (a.bookings || 0))
          .slice(0, 4)
          .map(service => ({
            id: service.id || Math.random(),
            name: service.name || service.title,
            description: service.description,
            price: `From ₹${service.price || service.basePrice || 500}`,
            icon: getServiceIcon(service.name || service.title),
            rating: service.rating || 4.5,
            bookings: service.bookings || Math.floor(Math.random() * 500) + 100
          }));
        
        setServices(topServices.length > 0 ? topServices : getDefaultServices());
        
        // Load workers data
        const savedWorkers = JSON.parse(localStorage.getItem('workers') || '[]');
        const registeredUsers = JSON.parse(localStorage.getItem('registeredUsers') || '[]');
        const workerUsers = registeredUsers.filter(user => user.userType === 'worker');
        
        const topWorkers = workerUsers
          .slice(0, 3)
          .map(worker => ({
            id: worker.id || Math.random(),
            name: `${worker.firstName} ${worker.lastName}`,
            specialty: worker.services?.[0] || 'General Services',
            rating: worker.rating || (4.5 + Math.random() * 0.4),
            reviews: worker.reviews || Math.floor(Math.random() * 100) + 20,
            image: worker.profilePhoto || `https://images.unsplash.com/photo-${Math.random() > 0.5 ? '1494790108755-2616b612b786' : '1507003211169-0a1dd7228f2d'}?w=150&h=150&fit=crop&crop=face`,
            hourlyRate: worker.hourlyRate || Math.floor(Math.random() * 20) + 20
          }));
        
        setWorkers(topWorkers.length > 0 ? topWorkers : getDefaultWorkers());
        
        // Calculate stats
        const userBookings = JSON.parse(localStorage.getItem('userBookings') || '[]');
        const allBookings = JSON.parse(localStorage.getItem('bookings') || '[]');
        
        setStats({
          totalServices: allServices.length,
          totalWorkers: workerUsers.length,
          totalBookings: userBookings.length + allBookings.length
        });
        
      } catch (err) {
        console.error('Error loading real data:', err);
        // Fallback to default data
        setServices(getDefaultServices());
        setWorkers(getDefaultWorkers());
      }
    };
    
    loadRealData();
  }, []);

  const getServiceIcon = (serviceName) => {
    const name = serviceName?.toLowerCase() || '';
    if (name.includes('clean')) return '🏠';
    if (name.includes('cook') || name.includes('food')) return '👨‍🍳';
    if (name.includes('laundry') || name.includes('wash')) return '👕';
    if (name.includes('bathroom')) return '🚿';
    if (name.includes('garden')) return '🌱';
    if (name.includes('repair') || name.includes('fix')) return '🔧';
    if (name.includes('paint')) return '🎨';
    return '🏠';
  };

  const getDefaultServices = () => [];

  const getDefaultWorkers = () => [];


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
            <p className="text-xl text-primary-100 mb-8">
            Join {stats.totalBookings > 0 ? `${stats.totalBookings}+` : 'thousands of'} satisfied customers who trust Cookie for their home services
          </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button 
                onClick={() => navigate('/search')}
                className="px-8 py-4 bg-white text-primary-600 font-semibold rounded-lg hover:bg-gray-100 transition-colors"
              >
                Find Services
              </button>
              <button 
                onClick={scrollToHowItWorks}
                className="px-8 py-4 border-2 border-white text-white font-semibold rounded-lg hover:bg-white hover:text-primary-600 transition-colors"
              >
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
        
        {services.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {services.map((service) => (
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
        ) : (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🏠</div>
            <h3 className="text-xl font-semibold text-gray-900 mb-2">No Services Available Yet</h3>
            <p className="text-gray-600 mb-6">Be the first to add services to our platform!</p>
            <button 
              onClick={() => navigate('/search')}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Explore Services
            </button>
          </div>
        )}
      </div>

      {/* Featured Workers */}
      <div className="bg-white py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="text-center mb-12">
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Featured Service Providers</h2>
            <p className="text-gray-600 text-lg">Meet some of our top-rated professionals</p>
          </div>
          
          {workers.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {workers.map((worker) => (
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
              ))}
            </div>
          ) : (
            <div className="text-center py-12">
              <div className="text-6xl mb-4">👥</div>
              <h3 className="text-xl font-semibold text-gray-900 mb-2">No Service Providers Yet</h3>
              <p className="text-gray-600 mb-6">Join as a service provider to be featured here!</p>
              <button 
                onClick={() => navigate('/register')}
                className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Become a Provider
              </button>
            </div>
          )}
        </div>
      </div>

      {/* How It Works */}
      <div id="how-it-works" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
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
          <p className="text-xl md:text-2xl mb-8 text-primary-100">
            Connect with {stats.totalWorkers > 0 ? stats.totalWorkers : 'trusted'} professionals for all your household needs
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
