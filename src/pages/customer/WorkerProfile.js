import React, { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  Star, 
  MapPin, 
  Clock, 
  Heart,
  DollarSign,
  User,
  ArrowLeft,
  MessageCircle,
  Calendar,
  CheckCircle,
  Shield
} from 'lucide-react';

const WorkerProfile = () => {
  const { workerId } = useParams();
  const navigate = useNavigate();
  const [isFavorite, setIsFavorite] = useState(false);

  // Mock worker data - in real app, fetch by workerId
  const worker = {
    id: workerId,
    name: 'Maria Rodriguez',
    rating: 4.9,
    reviews: 127,
    hourlyRate: 25,
    location: 'Manhattan, NY',
    distance: 2.3,
    services: ['House Cleaning', 'Bathroom Cleaning', 'Kitchen Deep Clean'],
    image: 'https://images.unsplash.com/photo-1494790108755-2616b612b786?w=300&h=300&fit=crop&crop=face',
    availability: 'Available today',
    completedJobs: 340,
    responseTime: '1 hour',
    verified: true,
    joinDate: '2022-03-15',
    bio: 'Professional house cleaner with over 5 years of experience. I take pride in providing thorough and reliable cleaning services. I use eco-friendly products and pay attention to every detail to ensure your home is spotless.',
    skills: ['Deep Cleaning', 'Eco-friendly Products', 'Pet-friendly', 'Move-in/Move-out'],
    languages: ['English', 'Spanish'],
    backgroundCheck: true,
    insurance: true
  };

  const reviews = [
    {
      id: 1,
      customer: 'Sarah Johnson',
      rating: 5,
      date: '2024-01-10',
      comment: 'Maria did an amazing job cleaning our house. Very thorough and professional. Will definitely book again!'
    },
    {
      id: 2,
      customer: 'Mike Chen',
      rating: 5,
      date: '2024-01-08',
      comment: 'Excellent service! Maria was punctual, friendly, and left our home sparkling clean. Highly recommended.'
    },
    {
      id: 3,
      customer: 'Emma Davis',
      rating: 4,
      date: '2024-01-05',
      comment: 'Great cleaning service. Maria was very careful with our furniture and did a thorough job.'
    }
  ];

  const toggleFavorite = () => {
    setIsFavorite(!isFavorite);
  };

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
          <h1 className="text-3xl font-bold text-gray-900">Worker Profile</h1>
          <p className="text-gray-600 mt-2">View detailed information about this service provider</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Main Profile */}
        <div className="lg:col-span-2 space-y-6">
          {/* Worker Info Card */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center">
                <img
                  src={worker.image}
                  alt={worker.name}
                  className="w-24 h-24 rounded-full object-cover mr-6"
                />
                <div>
                  <div className="flex items-center mb-2">
                    <h2 className="text-2xl font-bold text-gray-900">{worker.name}</h2>
                    {worker.verified && (
                      <div className="ml-3 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                        <CheckCircle className="w-4 h-4 text-white" />
                      </div>
                    )}
                  </div>
                  <div className="flex items-center text-gray-600 mb-2">
                    <Star className="h-5 w-5 text-yellow-500 mr-2" />
                    <span className="font-semibold">{worker.rating}</span>
                    <span className="ml-1">({worker.reviews} reviews)</span>
                  </div>
                  <div className="flex items-center text-gray-600 mb-2">
                    <MapPin className="h-5 w-5 mr-2" />
                    {worker.location} • {worker.distance} miles away
                  </div>
                  <div className="flex items-center text-gray-600">
                    <Clock className="h-5 w-5 mr-2" />
                    {worker.availability}
                  </div>
                </div>
              </div>
              <button
                onClick={toggleFavorite}
                className={`p-3 rounded-full transition-colors ${
                  isFavorite
                    ? 'text-red-500 bg-red-50'
                    : 'text-gray-400 hover:text-red-500 hover:bg-red-50'
                }`}
              >
                <Heart className={`h-6 w-6 ${isFavorite ? 'fill-current' : ''}`} />
              </button>
            </div>

            {/* Services */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">Services Offered</h3>
              <div className="flex flex-wrap gap-2">
                {worker.services.map((service, index) => (
                  <span
                    key={index}
                    className="px-3 py-1 bg-primary-100 text-primary-800 text-sm font-medium rounded-full"
                  >
                    {service}
                  </span>
                ))}
              </div>
            </div>

            {/* Bio */}
            <div className="mb-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-3">About</h3>
              <p className="text-gray-600 leading-relaxed">{worker.bio}</p>
            </div>

            {/* Skills & Languages */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Skills</h3>
                <div className="space-y-2">
                  {worker.skills.map((skill, index) => (
                    <div key={index} className="flex items-center text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      {skill}
                    </div>
                  ))}
                </div>
              </div>
              <div>
                <h3 className="text-lg font-semibold text-gray-900 mb-3">Languages</h3>
                <div className="space-y-2">
                  {worker.languages.map((language, index) => (
                    <div key={index} className="flex items-center text-gray-600">
                      <CheckCircle className="h-4 w-4 text-green-500 mr-2" />
                      {language}
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Reviews */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-6">Customer Reviews</h3>
            <div className="space-y-6">
              {reviews.map((review) => (
                <div key={review.id} className="border-b border-gray-200 pb-6 last:border-b-0">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center">
                      <div className="w-10 h-10 bg-gray-200 rounded-full flex items-center justify-center mr-3">
                        <User className="h-5 w-5 text-gray-600" />
                      </div>
                      <div>
                        <p className="font-medium text-gray-900">{review.customer}</p>
                        <p className="text-sm text-gray-600">{review.date}</p>
                      </div>
                    </div>
                    <div className="flex">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <Star
                          key={star}
                          className={`h-4 w-4 ${
                            star <= review.rating ? 'text-yellow-500 fill-current' : 'text-gray-300'
                          }`}
                        />
                      ))}
                    </div>
                  </div>
                  <p className="text-gray-600">{review.comment}</p>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Sidebar */}
        <div className="lg:col-span-1 space-y-6">
          {/* Quick Stats */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Quick Stats</h3>
            <div className="space-y-4">
              <div className="flex justify-between">
                <span className="text-gray-600">Hourly Rate:</span>
                <span className="font-semibold text-primary-600">${worker.hourlyRate}/hour</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Jobs Completed:</span>
                <span className="font-semibold">{worker.completedJobs}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Response Time:</span>
                <span className="font-semibold">{worker.responseTime}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Member Since:</span>
                <span className="font-semibold">
                  {new Date(worker.joinDate).toLocaleDateString('en-US', { 
                    year: 'numeric', 
                    month: 'short' 
                  })}
                </span>
              </div>
            </div>
          </div>

          {/* Verification */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Verification</h3>
            <div className="space-y-3">
              <div className="flex items-center">
                <Shield className={`h-5 w-5 mr-3 ${worker.backgroundCheck ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={worker.backgroundCheck ? 'text-green-700' : 'text-gray-500'}>
                  Background Check
                </span>
              </div>
              <div className="flex items-center">
                <Shield className={`h-5 w-5 mr-3 ${worker.insurance ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={worker.insurance ? 'text-green-700' : 'text-gray-500'}>
                  Insured
                </span>
              </div>
              <div className="flex items-center">
                <CheckCircle className={`h-5 w-5 mr-3 ${worker.verified ? 'text-green-500' : 'text-gray-400'}`} />
                <span className={worker.verified ? 'text-green-700' : 'text-gray-500'}>
                  Identity Verified
                </span>
              </div>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button 
              onClick={() => navigate(`/book/${worker.id}`)}
              className="w-full px-4 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              <Calendar className="h-5 w-5 inline mr-2" />
              Book Now
            </button>
            <button className="w-full px-4 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors">
              <MessageCircle className="h-5 w-5 inline mr-2" />
              Send Message
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default WorkerProfile;
