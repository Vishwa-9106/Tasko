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
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex justify-between items-start mb-4">
          <div className="flex-1">
            <div className="flex items-center mb-2">
              <div className="flex items-center mr-3">
                <div className="w-10 h-10 bg-primary-100 rounded-lg flex items-center justify-center mr-3">
                  <IconComponent className="h-5 w-5 text-primary-600" />
                </div>
                <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
              </div>
              <span className={`ml-3 inline-flex px-2 py-1 text-xs font-semibold rounded-full ${
                service.isActive 
                  ? 'bg-green-100 text-green-800' 
                  : 'bg-gray-100 text-gray-800'
              }`}>
                {service.isActive ? 'Active' : 'Inactive'}
              </span>
            </div>
            <p className="text-gray-600 text-sm mb-3">{service.description}</p>
            <div className="flex items-center space-x-4 text-sm text-gray-500">
              <div className="flex items-center">
                <Star className="h-4 w-4 mr-1" />
                <span>{service.rating || 0}</span>
              </div>
              <div className="flex items-center">
                <Clock className="h-4 w-4 mr-1" />
                <span>{service.duration}h</span>
              </div>
              <div className="flex items-center">
                <MapPin className="h-4 w-4 mr-1" />
                <span>{service.bookings || 0} bookings</span>
              </div>
            </div>
          </div>
        </div>
        <div className="border-t border-gray-200 pt-4">
          <div className="flex justify-between items-center">
            <span className="text-2xl font-bold text-primary-600">₹{service.price}</span>
            <div className="flex space-x-2">
              <button 
                onClick={() => handleToggleService(service._id, service.isActive)}
                className={`px-3 py-1 text-xs rounded hover:opacity-80 ${
                  service.isActive 
                    ? 'bg-yellow-100 text-yellow-700' 
                    : 'bg-green-100 text-green-700'
                }`}
              >
                {service.isActive ? 'Deactivate' : 'Activate'}
              </button>
              <button 
                onClick={() => handleDeleteService(service._id)}
                className="px-3 py-1 text-xs bg-red-100 text-red-700 rounded hover:bg-red-200"
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
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading services...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex justify-between items-center mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">My Services</h1>
          <p className="text-gray-600">Manage your service offerings</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInlineAdd(!showInlineAdd)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showInlineAdd ? 'Hide Form' : 'Add Service'}
          </button>
        </div>
      </div>

      {/* Inline Add Service Form */}
      {showInlineAdd && (
        <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-primary-300 p-6 mb-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Service</h3>
          {error && (
            <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
          <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Name</label>
                <input
                  type="text"
                  value={serviceName}
                  onChange={(e) => setServiceName(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="e.g., Kitchen Deep Clean"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select 
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="Describe your service..."
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                <input
                  type="number"
                  value={servicePrice}
                  onChange={(e) => setServicePrice(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
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
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  placeholder="2"
                  min="0.5"
                />
              </div>
            </div>
            <div className="flex space-x-3 pt-4">
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
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleAddService}
                className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
              >
                Add Service
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {services.map((service) => (
          <ServiceCard key={service._id || service.id} service={service} />
        ))}
        
        {services.length === 0 && !showInlineAdd && (
          <div className="col-span-full text-center py-12">
            <div className="text-gray-400 mb-4">
              <Home className="h-12 w-12 mx-auto" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">No services yet</h3>
            <p className="text-gray-600 mb-4">Start by adding your first service offering</p>
            <button
              onClick={() => setShowInlineAdd(true)}
              className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
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
