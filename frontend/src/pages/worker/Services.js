import React, { useState, useEffect } from 'react';
import { Plus, Home, Utensils, Shirt, Wrench, Car, MoreHorizontal, Star, Clock, MapPin } from 'lucide-react';

const Services = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  
  // Simple state for form inputs - no complex object
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceDuration, setServiceDuration] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');

  useEffect(() => {
    loadWorkerServices();
  }, []);

  const loadWorkerServices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view your services');
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/auth/me`, {
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        const userData = await response.json();
        setServices(userData.services || []);
      } else {
        setError('Failed to load services');
      }
    } catch (err) {
      console.error('Services load error:', err);
      setError('Failed to load services');
    } finally {
      setLoading(false);
    }
  };

  const getServiceIcon = (category) => {
    const iconMap = {
      'Cleaning': Home,
      'Cooking': Utensils,
      'Laundry': Shirt,
      'Repair': Wrench,
      'Transport': Car,
      'Other': MoreHorizontal
    };
    return iconMap[category] || Home;
  };

  const handleAddService = async () => {
    if (!serviceName || !serviceDescription || !servicePrice || !serviceDuration || !serviceCategory) {
      setError('Please fill in all fields');
      return;
    }

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to add services');
        return;
      }

      const response = await fetch(`${process.env.REACT_APP_API_URL}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          name: serviceName,
          description: serviceDescription,
          price: parseFloat(servicePrice),
          duration: parseFloat(serviceDuration),
          category: serviceCategory
        })
      });

      if (response.ok) {
        // Reload services to get the updated list
        await loadWorkerServices();
        
        // Reset form
        setServiceName('');
        setServiceDescription('');
        setServicePrice('');
        setServiceDuration('');
        setServiceCategory('');
        setShowInlineAdd(false);
        setError('');
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to add service');
      }
    } catch (err) {
      console.error('Add service error:', err);
      setError('Failed to add service');
    }
  };

  const handleDeleteService = async (serviceId) => {
    if (!window.confirm('Are you sure you want to delete this service?')) {
      return;
    }

    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadWorkerServices();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete service');
      }
    } catch (err) {
      console.error('Delete service error:', err);
      setError('Failed to delete service');
    }
  };

  const handleToggleService = async (serviceId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      const response = await fetch(`${process.env.REACT_APP_API_URL}/services/${serviceId}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          isActive: !currentStatus
        })
      });

      if (response.ok) {
        await loadWorkerServices();
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to update service');
      }
    } catch (err) {
      console.error('Toggle service error:', err);
      setError('Failed to update service');
    }
  };

  const ServiceCard = ({ service }) => {
    const IconComponent = getServiceIcon(service.category);
    
    return (
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-4 sm:p-6">
        <div className="flex justify-between items-start mb-3 sm:mb-4">
          <div className="flex-1 min-w-0">
            <div className="flex flex-col sm:flex-row sm:items-center mb-2 space-y-2 sm:space-y-0">
              <div className="flex items-center">
                <div className="w-8 h-8 sm:w-10 sm:h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-2 sm:mr-3 flex-shrink-0">
                  <IconComponent className="h-4 w-4 sm:h-5 sm:w-5 text-primary-600" />
                </div>
                <h3 className="text-base sm:text-lg font-semibold text-gray-900 truncate">{service.name}</h3>
              </div>
              <span className={`self-start sm:ml-3 inline-flex px-2 py-1 text-xs font-semibold rounded-full flex-shrink-0 ${
                service.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {service.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-3 line-clamp-2">{service.description}</p>
            <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-xs sm:text-sm text-gray-500">
              <div className="flex items-center">
                <Star className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span>{service.rating || 0}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span>{service.duration}h</span>
              </div>
              <div className="flex items-center">
                <MapPin className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                <span>{service.bookings || 0} bookings</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-3 sm:pt-4">
          <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center space-y-3 sm:space-y-0">
            <span className="text-xl sm:text-2xl font-bold text-primary-600">₹{service.price}</span>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
              <button 
                onClick={() => handleToggleService(service._id, service.isActive)}
                className={`px-3 py-1.5 sm:py-1 text-xs rounded hover:opacity-80 transition-colors ${
                  service.isActive 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {service.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button 
                onClick={() => handleDeleteService(service._id)}
                className="px-3 py-1.5 sm:py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (loading) {
    return (
      <div className="p-4 sm:p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-6 w-6 sm:h-8 sm:w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2 text-sm sm:text-base">Loading services...</span>
      </div>
    );
  }

  return (
    <div className="p-3 sm:p-4 lg:p-6">
      <div className="flex flex-col sm:flex-row sm:justify-between sm:items-center mb-4 sm:mb-6 space-y-3 sm:space-y-0">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900">My Services</h1>
          <p className="text-sm sm:text-base text-gray-600">Manage your service offerings</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInlineAdd(!showInlineAdd)}
            className="px-3 sm:px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center text-sm sm:text-base"
          >
            <Plus className="h-4 w-4 mr-2" />
            <span className="hidden sm:inline">{showInlineAdd ? 'Hide Form' : 'Add Service'}</span>
            <span className="sm:hidden">{showInlineAdd ? 'Hide' : 'Add'}</span>
          </button>
        </div>
      </div>

      {/* Inline Add Service Form */}
      {showInlineAdd && (
        <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-primary-300 p-4 sm:p-6 mb-4 sm:mb-6">
          <h3 className="text-base sm:text-lg font-semibold text-gray-900 mb-3 sm:mb-4">Add New Service</h3>
          {error && (
            <div className="mb-3 sm:mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Name</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Kitchen Deep Clean"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select 
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select category</option>
                  <option value="Cleaning">Cleaning</option>
                  <option value="Cooking">Cooking</option>
                  <option value="Laundry">Laundry</option>
                  <option value="Repair">Repair & Maintenance</option>
                  <option value="Transport">Transport</option>
                  <option value="Other">Other</option>
                </select>
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                rows={2}
                value={serviceDescription}
                onChange={(e) => setServiceDescription(e.target.value)}
                className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe your service..."
              />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <input
                  type="number"
                  value={servicePrice}
                  onChange={(e) => setServicePrice(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="500"
                  min="0"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Duration (hours)</label>
                <input
                  type="number"
                  step="0.5"
                  value={serviceDuration}
                  onChange={(e) => setServiceDuration(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="2"
                  min="0.5"
                />
              </div>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-3 sm:pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowInlineAdd(false);
                  setError('');
                  setServiceName('');
                  setServiceDescription('');
                  setServicePrice('');
                  setServiceDuration('');
                  setServiceCategory('');
                }}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddService}
                className="w-full sm:w-auto px-4 py-2 text-sm sm:text-base bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-2 xl:grid-cols-3 gap-4 sm:gap-6">
        {services.map((service) => (
          <ServiceCard key={service._id || service.id} service={service} />
        ))}
        
        {services.length === 0 && !showInlineAdd && (
          <div className="col-span-full text-center py-8 sm:py-12">
            <div className="text-gray-400 mb-4">
              <Home className="h-10 w-10 sm:h-12 sm:w-12 mx-auto" />
            </div>
            <h3 className="text-base sm:text-lg font-medium text-gray-900 mb-2">No services yet</h3>
            <p className="text-sm sm:text-base text-gray-600 mb-4">Start by adding your first service offering</p>
            <button
              onClick={() => setShowInlineAdd(true)}
              className="px-4 py-2 text-sm sm:text-base bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Your First Service
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default Services;
