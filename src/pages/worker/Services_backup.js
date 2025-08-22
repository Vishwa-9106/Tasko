import React, { useState, useEffect } from 'react';
import { 
  Plus, 
  Home, 
  Utensils, 
  Shirt, 
  Wrench, 
  Car, 
  MoreHorizontal, 
  Star, 
  Clock, 
  MapPin
} from 'lucide-react';
import { authAPI } from '../../services/api';

const Services = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  const [newService, setNewService] = useState({
    name: '',
    description: '',
    price: '',
    duration: '',
    category: '',
    icon: 'Home'
  });

  // Load services on component mount
  useEffect(() => {
    loadServices();
  }, []);

  const loadServices = async () => {
    try {
      setLoading(true);
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      // For now, load from localStorage or use empty array
      const savedServices = JSON.parse(localStorage.getItem('userServices') || '[]');
      setServices(savedServices);
    } catch (err) {
      setError('Failed to load services');
      console.error('Services load error:', err);
    } finally {
      setLoading(false);
    }
  };

  const saveServices = (updatedServices) => {
    localStorage.setItem('userServices', JSON.stringify(updatedServices));
    setServices(updatedServices);
  };

  const toggleServiceStatus = (id) => {
    const updatedServices = services.map(service => 
      service.id === id ? { ...service, isActive: !service.isActive } : service
    );
    saveServices(updatedServices);
  };

  const deleteService = (id) => {
    const updatedServices = services.filter(service => service.id !== id);
    saveServices(updatedServices);
  };

  const getServiceIcon = (category) => {
    const iconMap = {
      'Cleaning': Home,
      'Cooking': Utensils,
      'Laundry': Shirt,
      'Repair': Wrench,
      'Transport': Car,
      'Other': Briefcase
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
              <DollarSign className="h-4 w-4 mr-1" />
              ₹{service.price}
            </div>
            <div className="flex items-center">
              <Clock className="h-4 w-4 mr-1" />
              {service.duration}h
            </div>
            <div className="flex items-center">
              <Star className="h-4 w-4 mr-1 text-yellow-500" />
              {service.rating}
            </div>
          </div>
        </div>
        <div className="flex space-x-2">
          <button
            onClick={() => toggleServiceStatus(service.id)}
            className={`p-2 rounded-lg transition-colors ${
              service.isActive 
                ? 'text-gray-600 hover:bg-gray-100' 
                : 'text-green-600 hover:bg-green-50'
            }`}
          >
            {service.isActive ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
          </button>
          <button
            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          >
            <Edit3 className="h-4 w-4" />
          </button>
          <button
            onClick={() => deleteService(service.id)}
            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
      
      <div className="border-t border-gray-200 pt-4">
        <div className="flex justify-between items-center text-sm">
          <span className="text-gray-600">Total Bookings: {service.bookings}</span>
          <span className="text-gray-600">Category: {service.category}</span>
        </div>
      </div>
    </div>
    );
  };

  const InlineAddService = () => {
    return (
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
            required
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

  const AddServiceModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Service</h3>
        {error && (
          <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
            <p className="text-sm text-red-600">{error}</p>
          </div>
        )}
        <div className="space-y-4">
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
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              rows={3}
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
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => {
                setShowAddModal(false);
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
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddService}
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Service
            </button>
          </div>
        </div>
      </div>
    </div>
  );

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
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Services</h1>
          <p className="text-gray-600 mt-2">Manage your service offerings and pricing</p>
        </div>
        <div className="flex space-x-3">
          <button
            onClick={() => setShowInlineAdd(true)}
            className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Quick Add
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
          >
            <Plus className="h-4 w-4 mr-2" />
            Modal Add
          </button>
        </div>
      </div>

      {/* Inline Add Service Form */}
      {showInlineAdd && (
        <div className="mb-6">
          <InlineAddService />
        </div>
      )}

      {/* Services Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {services.map((service) => (
          <ServiceCard key={service.id} service={service} />
        ))}
      </div>

      {/* Empty State */}
      {services.length === 0 && (
        <div className="text-center py-12">
          <div className="w-24 h-24 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Plus className="h-12 w-12 text-gray-400" />
          </div>
          <h3 className="text-lg font-medium text-gray-900 mb-2">No services yet</h3>
          <p className="text-gray-600 mb-6">Start by adding your first service offering</p>
          <div className="flex space-x-3 justify-center">
            <button
              onClick={() => setShowInlineAdd(true)}
              className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Quick Add Service
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="px-6 py-3 bg-gray-600 text-white rounded-lg hover:bg-gray-700 transition-colors"
            >
              Modal Add Service
            </button>
          </div>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddModal && <AddServiceModal />}
    </div>
  );
};

export default Services;
