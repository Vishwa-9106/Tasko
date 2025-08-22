// API configuration and service functions
const API_BASE_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

// Helper function to make API requests
const apiRequest = async (endpoint, options = {}) => {
  const url = `${API_BASE_URL}${endpoint}`;
  const token = localStorage.getItem('token');
  
  const config = {
    headers: {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
      ...options.headers,
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    const data = await response.json();
    
    if (!response.ok) {
      throw new Error(data.message || 'API request failed');
    }
    
    return data;
  } catch (error) {
    console.error('API Error:', error);
    throw error;
  }
};

// Auth API functions
export const authAPI = {
  // Register new user
  register: (userData) => 
    apiRequest('/auth/register', {
      method: 'POST',
      body: JSON.stringify(userData),
    }),

  // Login user
  login: (credentials) => 
    apiRequest('/auth/login', {
      method: 'POST',
      body: JSON.stringify(credentials),
    }),

  // Get current user profile
  getProfile: () => 
    apiRequest('/auth/profile'),

  // Update user profile
  updateProfile: (profileData) => 
    apiRequest('/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(profileData),
    }),

  // Get user bookings
  getUserBookings: (userId) => 
    apiRequest(`/auth/users/${userId}/bookings`),
};

// Services API functions
export const servicesAPI = {
  // Get all services
  getAllServices: () => 
    apiRequest('/services'),

  // Get services by category
  getServicesByCategory: (category) => 
    apiRequest(`/services?category=${category}`),

  // Search services
  searchServices: (query) => 
    apiRequest(`/services/search?q=${query}`),
};

// Bookings API functions
export const bookingsAPI = {
  // Create new booking
  createBooking: (bookingData) => 
    apiRequest('/bookings', {
      method: 'POST',
      body: JSON.stringify(bookingData),
    }),

  // Get user bookings
  getUserBookings: () => 
    apiRequest('/bookings'),

  // Get booking by ID
  getBookingById: (id) => 
    apiRequest(`/bookings/${id}`),

  // Update booking status
  updateBookingStatus: (id, status) => 
    apiRequest(`/bookings/${id}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    }),

  // Cancel booking
  cancelBooking: (id) => 
    apiRequest(`/bookings/${id}/cancel`, {
      method: 'PUT',
    }),
};

// Users API functions
export const usersAPI = {
  // Get all workers
  getWorkers: () => 
    apiRequest('/users/workers'),

  // Get worker by ID
  getWorkerById: (id) => 
    apiRequest(`/users/workers/${id}`),

  // Get worker services
  getWorkerServices: (workerId) => 
    apiRequest(`/users/workers/${workerId}/services`),
};

// Health check
export const healthCheck = () => 
  apiRequest('/health');

export default {
  authAPI,
  servicesAPI,
  bookingsAPI,
  usersAPI,
  healthCheck,
};
