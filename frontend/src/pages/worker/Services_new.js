import React, { useState, useEffect } from 'react';
import { Plus, Home, Utensils, Shirt, Wrench, Car, MoreHorizontal, Star, Clock, MapPin } from 'lucide-react';

const Services = () => {
  const [services, setServices] = useState([]);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    category: '',
    icon: 'Home'
  });

  // Load services from localStorage on component mount
  useEffect(() => {
    const savedServices = JSON.parse(localStorage.getItem('userServices') || '[]');
    setServices(savedServices);
  }, []);

  // Save services to localStorage
  const saveServices = (updatedServices) => {
    setServices(updatedServices);
    localStorage.setItem('userServices', JSON.stringify(updatedServices));
  };

  // Get icon component based on category
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

  const handleInputChange = (field, value) => {
    setNewService(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleAddService = () => {
    if (!newService.name || !newService.description || !newService.price || !newService.duration || !newService.category) {
      setError('Please fill in all fields');
      return;
    }

    const service = {
      id: Date.now(),
      name: newService.name,
      description: newService.description,
      price: parseFloat(newService.price),
      duration: parseFloat(newService.duration),
      category: newService.category,
      isActive: true,
      rating: 0,
      bookings: 0
    };

    const updatedServices = [...services, service];
    saveServices(updatedServices);
    
    // Reset form
    setNewService({
      name: '',
      description: '',
      price: '',
      duration: '',
      category: '',
      icon: 'Home'
    });
    setShowAddModal(false);
    setShowInlineAdd(false);
    setError('');
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
              <span>{service.rating}</span>
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              <span>{service.duration}h</span>
            </div>
            <div className="flex items-center">
              <MapPin className="h-4 w-4 mr-1" />
              <span>{service.bookings} bookings</span>
            </div>
          </div>
        </div>
        <div className="text-right">
          <span className="text-2xl font-bold text-primary-600">₹{service.price}</span>
        </div>
      </div>
    </div>
    );
  };

  const InlineAddService = () => (
    <div className="bg-white rounded-lg shadow-sm border-2 border-dashed border-primary-300 p-6">
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
              value={newService.name}
              onChange={(e) => handleInputChange('name', e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Kitchen Deep Clean"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select 
              value={newService.category}
              onChange={(e) => handleInputChange('category', e.target.value)}
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
            value={newService.description}
            onChange={(e) => handleInputChange('description', e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
            placeholder="Describe your service..."
          />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
            <input
              type="number"
              value={newService.price}
              onChange={(e) => handleInputChange('price', e.target.value)}
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
              value={newService.duration}
              onChange={(e) => handleInputChange('duration', e.target.value)}
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
              setNewService({
                name: '',
                description: '',
                price: '',
                duration: '',
                category: '',
                icon: 'Home'
              });
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
  );

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
            className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            {showInlineAdd ? 'Hide Form' : 'Quick Add'}
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors flex items-center"
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Service
          </button>
        </div>
      </div>

      {/* Inline Add Service Form */}
      {showInlineAdd && <InlineAddService />}

      {/* Services Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 mt-6">
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
              onClick={() => setShowAddModal(true)}
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
