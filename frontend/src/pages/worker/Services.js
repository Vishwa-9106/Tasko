import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Home, Star, Clock, MapPin } from 'lucide-react';
import { CATEGORIES, ICON_MAP, HOME_CLEANING_OPTIONS, LAUNDRY_OPTIONS, DISHWASHING_OPTIONS, COOKING_OPTIONS, GARDENING_OPTIONS, BABYSITTING_OPTIONS, MAINTENANCE_OPTIONS, CLOUD_KITCHEN_OPTIONS } from '../../constants/categories';

const Services = () => {
  const [services, setServices] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showInlineAdd, setShowInlineAdd] = useState(false);
  
  // Simple state for form inputs - no complex object
  const [serviceName, setServiceName] = useState('');
  const [serviceDescription, setServiceDescription] = useState('');
  const [servicePrice, setServicePrice] = useState('');
  const [serviceCategory, setServiceCategory] = useState('');
  // Per-field errors
  const [fieldErrors, setFieldErrors] = useState({});
  // Success toast message
  const [successMessage, setSuccessMessage] = useState('');
  // Controls animated visibility of the toast
  const [showToast, setShowToast] = useState(false);
  // Themed delete confirmation modal state
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [pendingDeleteId, setPendingDeleteId] = useState(null);

  const navigate = useNavigate();

  // Ensure serviceName aligns with category switch behavior
  useEffect(() => {
    if (serviceCategory === 'Home Cleaning') {
      if (serviceName && !HOME_CLEANING_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    } else if (serviceCategory === 'Laundry') {
      if (serviceName && !LAUNDRY_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    } else if (serviceCategory === 'Dishwashing') {
      if (serviceName && !DISHWASHING_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    } else if (serviceCategory === 'Cooking') {
      if (serviceName && !COOKING_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    } else if (serviceCategory === 'Cloud Kitchen') {
      if (serviceName && !CLOUD_KITCHEN_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    } else if (serviceCategory === 'Gardening') {
      if (serviceName && !GARDENING_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    } else if (serviceCategory === 'Baby Sitting') {
      if (serviceName && !BABYSITTING_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    } else if (serviceCategory === 'Maintenance') {
      if (serviceName && !MAINTENANCE_OPTIONS.includes(serviceName)) {
        setServiceName('');
      }
    }
    // For other categories, keep user's typed value
  }, [serviceCategory]);

  useEffect(() => {
    loadWorkerServices();
  }, []);

  const loadWorkerServices = async () => {
    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to view your services');
        // Redirect to login if no token
        navigate('/login', { replace: true, state: { message: 'Please log in to view your services' } });
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
      } else if (response.status === 401) {
        // Unauthorized: clear token and redirect to login
        localStorage.removeItem('token');
        setError('Session expired. Please log in again.');
        navigate('/login', { replace: true, state: { message: 'Session expired. Please log in again.' } });
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
    return ICON_MAP[category] || Home;
  };

  // Validate fields and return { valid, errors, nameForBackend }
  const validateForm = () => {
    const errors = {};
    // Category
    if (!serviceCategory) {
      errors.category = 'Category is required.';
    }
    // Service name (single value)
    if (!serviceName.trim()) {
      errors.serviceName = 'Service name is required.';
    }
    // Description
    if (!serviceDescription.trim()) {
      errors.description = 'Description is required.';
    }
    // Price
    const priceNum = Number(servicePrice);
    if (!servicePrice || Number.isNaN(priceNum) || priceNum <= 0) {
      errors.price = 'Enter a valid price greater than 0.';
    }

    setFieldErrors(errors);
    const valid = Object.keys(errors).length === 0;
    const nameForBackend = serviceName.trim();
    return { valid, errors, nameForBackend, priceNum };
  };

  const handleAddService = async () => {
    const { valid, nameForBackend, priceNum } = validateForm();
    if (!valid) return;

    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to add services');
        navigate('/login', { replace: true, state: { message: 'Please log in to add services' } });
        return;
      }

      // Backend requires: name, description, price, duration, category
      const payload = {
        name: nameForBackend,
        description: serviceDescription.trim(),
        price: priceNum,
        duration: 1, // Default duration to satisfy backend validation
        category: serviceCategory
      };

      const response = await fetch(`${process.env.REACT_APP_API_URL}/services`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (response.ok) {
        await loadWorkerServices();
        // Clear form
        setServiceName('');
        setServiceDescription('');
        setServicePrice('');
        setServiceCategory('');
        setFieldErrors({});
        setShowInlineAdd(false);
        setError('');
        // Success toast (top-center with animation)
        setSuccessMessage('✅ Service added successfully.');
        setShowToast(true);
        // Visible for 3s, then animate out
        setTimeout(() => setShowToast(false), 3000);
        // After fade-out completes, clear message to unmount
        setTimeout(() => setSuccessMessage(''), 3400);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        setError('Session expired. Please log in again.');
        navigate('/login', { replace: true, state: { message: 'Session expired. Please log in again.' } });
      } else {
        const errorData = await response.json();
        // If backend returns generic message, surface field guidance
        if (response.status === 400 && errorData?.message) {
          setError(errorData.message);
        } else {
          setError(errorData.message || 'Failed to add service');
        }
      }
    } catch (err) {
      console.error('Add service error:', err);
      setError('Failed to add service');
    }
  };

  const handleDeleteService = async (serviceId) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to manage services');
        navigate('/login', { replace: true, state: { message: 'Please log in to manage services' } });
        return;
      }
      const response = await fetch(`${process.env.REACT_APP_API_URL}/services/${serviceId}`, {
        method: 'DELETE',
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });

      if (response.ok) {
        await loadWorkerServices();
        // Close modal and clear pending id
        setShowDeleteConfirm(false);
        setPendingDeleteId(null);
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        setError('Session expired. Please log in again.');
        navigate('/login', { replace: true, state: { message: 'Session expired. Please log in again.' } });
      } else {
        const errorData = await response.json();
        setError(errorData.message || 'Failed to delete service');
      }
    } catch (err) {
      console.error('Delete service error:', err);
      setError('Failed to delete service');
    }
  };

  // Open the themed confirmation modal
  const openDeleteConfirm = (serviceId) => {
    setPendingDeleteId(serviceId);
    setShowDeleteConfirm(true);
  };

  // Close modal without deleting
  const cancelDelete = () => {
    setShowDeleteConfirm(false);
    setPendingDeleteId(null);
  };

  // Confirm deletion
  const confirmDelete = () => {
    if (pendingDeleteId) {
      handleDeleteService(pendingDeleteId);
    }
  };

  const handleToggleService = async (serviceId, currentStatus) => {
    try {
      const token = localStorage.getItem('token');
      if (!token) {
        setError('Please log in to manage services');
        navigate('/login', { replace: true, state: { message: 'Please log in to manage services' } });
        return;
      }
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
      } else if (response.status === 401) {
        localStorage.removeItem('token');
        setError('Session expired. Please log in again.');
        navigate('/login', { replace: true, state: { message: 'Session expired. Please log in again.' } });
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
                onClick={() => openDeleteConfirm(service._id)}
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
      {successMessage && (
        <div className="fixed inset-x-0 top-0 z-50 flex justify-center pointer-events-none">
          <div
            className={
              `mt-4 transform transition-all duration-300 ease-out ` +
              (showToast ? 'opacity-100 translate-y-2' : 'opacity-0 -translate-y-4')
            }
          >
            <div className="bg-green-600 text-white px-4 py-3 rounded-lg shadow-lg text-sm sm:text-base text-center">{successMessage}</div>
          </div>
        </div>
      )}
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
          {/* Global error removed; we show per-field errors inline */}
          <div className="space-y-3 sm:space-y-4">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 sm:gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                <select 
                  value={serviceCategory}
                  onChange={(e) => setServiceCategory(e.target.value)}
                  className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                >
                  <option value="">Select category</option>
                  {CATEGORIES.map((cat) => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
                {fieldErrors.category && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.category}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Service Name</label>
                {serviceCategory === 'Home Cleaning' || serviceCategory === 'Laundry' || serviceCategory === 'Dishwashing' || serviceCategory === 'Cooking' || serviceCategory === 'Cloud Kitchen' || serviceCategory === 'Gardening' || serviceCategory === 'Baby Sitting' || serviceCategory === 'Maintenance' ? (
                  <select
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                  >
                    <option value="">Select service</option>
                    {(serviceCategory === 'Home Cleaning'
                      ? HOME_CLEANING_OPTIONS
                      : serviceCategory === 'Laundry'
                        ? LAUNDRY_OPTIONS
                        : serviceCategory === 'Dishwashing'
                          ? DISHWASHING_OPTIONS
                          : serviceCategory === 'Cooking'
                            ? COOKING_OPTIONS
                            : serviceCategory === 'Cloud Kitchen'
                              ? CLOUD_KITCHEN_OPTIONS
                              : serviceCategory === 'Gardening'
                              ? GARDENING_OPTIONS
                              : serviceCategory === 'Baby Sitting'
                                ? BABYSITTING_OPTIONS
                                : MAINTENANCE_OPTIONS).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </select>
                ) : (
                  <input
                    type="text"
                    value={serviceName}
                    onChange={(e) => setServiceName(e.target.value)}
                    className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 transition-all"
                    placeholder="e.g., Kitchen Deep Clean"
                  />
                )}
                {fieldErrors.serviceName && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.serviceName}</p>
                )}
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
              {fieldErrors.description && (
                <p className="mt-1 text-xs text-red-600">{fieldErrors.description}</p>
              )}
            </div>
            <div className="grid grid-cols-1 gap-3 sm:gap-4">
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
                {fieldErrors.price && (
                  <p className="mt-1 text-xs text-red-600">{fieldErrors.price}</p>
                )}
              </div>
            </div>
            <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-3 pt-3 sm:pt-4">
              <button
                type="button"
                onClick={() => {
                  setShowInlineAdd(false);
                  setError('');
                  setFieldErrors({});
                  setServiceName('');
                  setServiceDescription('');
                  setServicePrice('');
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
      {/* Themed Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center">
          {/* Overlay */}
          <div
            className="absolute inset-0 bg-black/40"
            onClick={cancelDelete}
            aria-hidden="true"
          />

          {/* Modal */}
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-delete-title"
            className="relative w-full sm:w-auto sm:min-w-[22rem] max-w-md bg-white rounded-lg shadow-lg border border-gray-200 mx-3 sm:mx-0 p-4 sm:p-6"
          >
            <h3 id="confirm-delete-title" className="text-base sm:text-lg font-semibold text-gray-900 mb-2">
              Confirm Deletion
            </h3>
            <p className="text-sm sm:text-base text-gray-700">
              Are you sure you want to delete this service?
            </p>
            <div className="mt-4 sm:mt-6 flex flex-col sm:flex-row-reverse gap-2">
              <button
                type="button"
                onClick={confirmDelete}
                className="w-full sm:w-auto inline-flex justify-center px-4 py-2 rounded-lg bg-primary-600 text-white hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-primary-500 focus:ring-offset-2"
              >
                OK
              </button>
              <button
                type="button"
                onClick={cancelDelete}
                className="w-full sm:w-auto inline-flex justify-center px-4 py-2 rounded-lg border border-gray-300 text-gray-700 bg-white hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-gray-300 focus:ring-offset-2"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Services;
