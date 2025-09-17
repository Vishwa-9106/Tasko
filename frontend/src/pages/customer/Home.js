import React, { useState, useEffect, useMemo } from 'react';
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
import * as CAT from '../../constants/categories';

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

  // Build category cards directly from constants so new ones show automatically
  const categoryCards = useMemo(() => {
    const list = Array.isArray(CAT.CATEGORIES) ? CAT.CATEGORIES : [];
    return list.map((name, idx) => {
      const Icon = CAT.ICON_MAP?.[name];
      return {
        id: idx + 1,
        name,
        // Optional: lightweight descriptions per category (fallback empty)
        description: '',
        Icon,
      };
    });
  }, []);

  // Color palette for lively, colorful UI accents used across cards/steps
  const palette = useMemo(() => ([
    {
      name: 'pink',
      cardHoverBgFrom: 'hover:from-white',
      cardHoverBgTo: 'hover:to-pink-50',
      ring: 'ring-pink-200',
      iconBg: 'from-pink-500 to-rose-600',
      text: 'text-pink-600'
    },
    {
      name: 'indigo',
      cardHoverBgFrom: 'hover:from-white',
      cardHoverBgTo: 'hover:to-indigo-50',
      ring: 'ring-indigo-200',
      iconBg: 'from-indigo-500 to-blue-600',
      text: 'text-indigo-600'
    },
    {
      name: 'emerald',
      cardHoverBgFrom: 'hover:from-white',
      cardHoverBgTo: 'hover:to-emerald-50',
      ring: 'ring-emerald-200',
      iconBg: 'from-emerald-500 to-teal-600',
      text: 'text-emerald-600'
    },
    {
      name: 'amber',
      cardHoverBgFrom: 'hover:from-white',
      cardHoverBgTo: 'hover:to-amber-50',
      ring: 'ring-amber-200',
      iconBg: 'from-amber-500 to-orange-600',
      text: 'text-amber-600'
    },
    {
      name: 'violet',
      cardHoverBgFrom: 'hover:from-white',
      cardHoverBgTo: 'hover:to-violet-50',
      ring: 'ring-violet-200',
      iconBg: 'from-violet-500 to-purple-600',
      text: 'text-violet-600'
    },
    {
      name: 'cyan',
      cardHoverBgFrom: 'hover:from-white',
      cardHoverBgTo: 'hover:to-cyan-50',
      ring: 'ring-cyan-200',
      iconBg: 'from-cyan-500 to-sky-600',
      text: 'text-cyan-600'
    },
  ]), []);

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
            {categoryCards.map((card, idx) => {
              const slug = card.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '');
              const IconComp = card.Icon;
              const color = palette[idx % palette.length];
              return (
                <div
                  key={card.id}
                  onClick={() => navigate(`/customer/services/${slug}`)}
                  className={`rounded-xl border border-gray-200 p-4 sm:p-6 transition-all duration-200 cursor-pointer group hover:-translate-y-1 hover:shadow-xl ring-0 hover:ring-2 ${color.ring} bg-white bg-gradient-to-br ${color.cardHoverBgFrom} ${color.cardHoverBgTo}`}
                >
                  <div className="mb-3 sm:mb-4">
                    {IconComp ? (
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${color.iconBg} text-white flex items-center justify-center shadow-md`}>
                        <IconComp className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                    ) : (
                      <div className={`w-10 h-10 sm:w-12 sm:h-12 rounded-xl bg-gradient-to-br ${color.iconBg} text-white flex items-center justify-center shadow-md`}>
                        <Users className="h-5 w-5 sm:h-6 sm:w-6" />
                      </div>
                    )}
                  </div>
                  <h3 className="text-base sm:text-lg md:text-xl font-semibold text-gray-900 mb-2">{card.name}</h3>
                  {card.description ? (
                    <p className="text-xs sm:text-sm md:text-base text-gray-600 mb-3 sm:mb-4 line-clamp-2">{card.description}</p>
                  ) : (
                    <p className="text-xs sm:text-sm md:text-base text-gray-500 mb-3 sm:mb-4">Explore services</p>
                  )}
                  <div className="flex items-center justify-between">
                    <span className={`text-xs sm:text-sm md:text-base font-medium ${color.text}`}>Browse</span>
                    <div className="flex items-center text-xs text-gray-500 group-hover:translate-x-0.5 transition-transform">
                      <ArrowRight className="h-4 w-4" />
                    </div>
                  </div>
                </div>
              );
            })}
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
            {howItWorks.map((step, index) => {
              const color = palette[index % palette.length];
              return (
                <div key={index} className="text-center">
                  <div className={`w-12 h-12 sm:w-16 sm:h-16 rounded-2xl bg-gradient-to-br ${color.iconBg} flex items-center justify-center mx-auto mb-3 sm:mb-4 shadow-md transform transition-transform hover:scale-105`}>
                    <step.icon className="h-6 w-6 sm:h-8 sm:w-8 text-white" />
                  </div>
                  <h3 className="text-lg sm:text-xl font-semibold text-gray-900 mb-2">{step.title}</h3>
                  <p className="text-sm sm:text-base text-gray-600 px-2">{step.description}</p>
                </div>
              );
            })}
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
            className="bg-white text-primary-600 px-6 sm:px-8 py-3 sm:py-4 rounded-lg text-base sm:text-lg font-semibold hover:bg-gray-100 hover:shadow-lg transition-all inline-flex items-center"
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
