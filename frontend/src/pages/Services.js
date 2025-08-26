import React, { useState } from 'react';
import { 
  Plus, 
  Edit3, 
  Trash2, 
  DollarSign, 
  Clock, 
  Star,
  Eye,
  EyeOff
} from 'lucide-react';

const Services = () => {
  const [services, setServices] = useState([
    {
      id: 1,
      name: 'House Cleaning',
      description: 'Complete house cleaning including all rooms, dusting, vacuuming, and mopping.',
      price: 80,
      duration: 3,
      category: 'Cleaning',
      isActive: true,
      rating: 4.8,
      bookings: 25
    },
    {
      id: 2,
      name: 'Bathroom Deep Clean',
      description: 'Thorough bathroom cleaning including tiles, fixtures, and sanitization.',
      price: 45,
      duration: 1.5,
      category: 'Cleaning',
      isActive: true,
      rating: 4.9,
      bookings: 18
    },
    {
      id: 3,
      name: 'Home Cooking',
      description: 'Prepare fresh meals according to your preferences and dietary requirements.',
      price: 60,
      duration: 2,
      category: 'Cooking',
      isActive: false,
      rating: 4.7,
      bookings: 12
    },
    {
      id: 4,
      name: 'Laundry Service',
      description: 'Washing, drying, folding, and organizing your laundry.',
      price: 35,
      duration: 2,
      category: 'Laundry',
      isActive: true,
      rating: 4.6,
      bookings: 8
    }
  ]);

  const [showAddModal, setShowAddModal] = useState(false);
  const [editingService, setEditingService] = useState(null);

  const toggleServiceStatus = (id) => {
    setServices(services.map(service => 
      service.id === id ? { ...service, isActive: !service.isActive } : service
    ));
  };

  const deleteService = (id) => {
    setServices(services.filter(service => service.id !== id));
  };

  const ServiceCard = ({ service }) => (
    <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
      <div className="flex justify-between items-start mb-4">
        <div className="flex-1">
          <div className="flex items-center mb-2">
            <h3 className="text-lg font-semibold text-gray-900">{service.name}</h3>
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
              ${service.price}
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
            onClick={() => setEditingService(service)}
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

  const AddServiceModal = () => (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg p-6 w-full max-w-md">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Add New Service</h3>
        <form className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Service Name</label>
            <input
              type="text"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="e.g., Kitchen Deep Clean"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
            <textarea
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              placeholder="Describe your service..."
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Price ($)</label>
              <input
                type="number"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="50"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Duration (hours)</label>
              <input
                type="number"
                step="0.5"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                placeholder="2"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
            <select className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500">
              <option value="">Select category</option>
              <option value="Cleaning">Cleaning</option>
              <option value="Dishwashing">Dishwashing</option>
              <option value="Laundry">Laundry</option>
              <option value="Cooking">Cooking</option>
              <option value="Cloud Kitchen">Cloud Kitchen</option>
              <option value="Baby Sitting">Baby Sitting</option>
              <option value="Gardening">Gardening</option>
              <option value="Maintenance">Maintenance</option>
            </select>
          </div>
          <div className="flex space-x-3 pt-4">
            <button
              type="button"
              onClick={() => setShowAddModal(false)}
              className="flex-1 px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="flex-1 px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
            >
              Add Service
            </button>
          </div>
        </form>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">My Services</h1>
          <p className="text-gray-600 mt-2">Manage your service offerings and pricing</p>
        </div>
        <button
          onClick={() => setShowAddModal(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Service
        </button>
      </div>

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
          <button
            onClick={() => setShowAddModal(true)}
            className="px-6 py-3 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Add Your First Service
          </button>
        </div>
      )}

      {/* Add Service Modal */}
      {showAddModal && <AddServiceModal />}
    </div>
  );
};

export default Services;
