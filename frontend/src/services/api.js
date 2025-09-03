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
    let data = {};
    try {
      data = await response.json();
    } catch (_) {
      // Non-JSON response; keep data as empty object
    }

    if (response.status === 401) {
      // Unauthorized: clear auth and redirect to login
      localStorage.removeItem('userType');
      localStorage.removeItem('isAuthenticated');
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      // Force redirect so protected routes do not reload admin pages
      window.location.href = '/login';
      throw new Error(data.message || 'Unauthorized');
    }

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

  // Add review to booking
  addReview: (bookingId, reviewData) => 
    apiRequest(`/bookings/${bookingId}/review`, {
      method: 'POST',
      body: JSON.stringify(reviewData),
    }),
};

// Messages API functions
export const messagesAPI = {
  // Send a new message
  sendMessage: (messageData) => 
    apiRequest('/messages', {
      method: 'POST',
      body: JSON.stringify(messageData),
    }),

  // Get messages for a specific booking
  getMessages: (bookingId, page = 1, limit = 50) => 
    apiRequest(`/messages/${bookingId}?page=${page}&limit=${limit}`),

  // Get all conversations for current user
  getConversations: () => 
    apiRequest('/messages/conversations'),
};

// Users API functions
export const usersAPI = {
  // Get all workers with optional search parameters
  getWorkers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/users/workers${queryString ? `?${queryString}` : ''}`);
  },

  // Admin: Get all workers (active + blocked)
  getAdminWorkers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/users/admin/workers${queryString ? `?${queryString}` : ''}`);
  },

  // Get all customers with optional search parameters
  getCustomers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/users/customers${queryString ? `?${queryString}` : ''}`);
  },

  // Admin: Get all customers (active + blocked)
  getAdminCustomers: (params = {}) => {
    const queryString = new URLSearchParams(params).toString();
    return apiRequest(`/users/admin/customers${queryString ? `?${queryString}` : ''}`);
  },

  // Get customer by ID (detailed profile)
  getCustomerById: (id) =>
    apiRequest(`/users/customer/${id}`),

  // Get worker by ID
  getWorkerById: (id) => 
    apiRequest(`/users/worker/${id}`),

  // Admin: Get worker by ID (includes blocked users)
  getAdminWorkerById: (id) =>
    apiRequest(`/users/admin/worker/${id}`),

  // Get worker reviews
  getWorkerReviews: (workerId) => 
    apiRequest(`/users/worker/${workerId}/reviews`),

  // Get worker services
  getWorkerServices: (workerId) => 
    apiRequest(`/users/workers/${workerId}/services`),

  // Get user's favorite workers
  getFavorites: () => 
    apiRequest('/users/favorites'),

  // Add/remove worker from favorites
  toggleFavorite: (workerId) => 
    apiRequest(`/users/favorites/${workerId}`, {
      method: 'POST'
    }),

  // Update user profile with file upload
  updateProfileWithPhoto: async (formData) => {
    const token = localStorage.getItem('token');
    const response = await fetch(`${API_BASE_URL}/users/profile`, {
      method: 'PUT',
      headers: {
        'Authorization': `Bearer ${token}`
      },
      body: formData
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.message || 'Profile update failed');
    }
    
    return response.json();
  },
  
  // Block a user by ID (admin only)
  blockUser: (userId) => 
    apiRequest(`/users/${userId}/block`, {
      method: 'PUT'
    }),
};

// Categories API functions
export const categoriesAPI = {
  // Create a new category with optional services (admin only)
  addCategory: (name, services = []) =>
    apiRequest('/categories', {
      method: 'POST',
      body: JSON.stringify({ name, services })
    }),
  // Add a new service name to a category constants list (admin only)
  addService: (category, name) =>
    apiRequest(`/categories/${encodeURIComponent(category)}/services`, {
      method: 'POST',
      body: JSON.stringify({ name })
    }),
  // Delete a service name from a category constants list (admin only)
  deleteService: (category, name) =>
    apiRequest(`/categories/${encodeURIComponent(category)}/services`, {
      method: 'DELETE',
      body: JSON.stringify({ name })
    }),
};

// Health check
export const healthCheck = () => 
  apiRequest('/health');

const api = {
  authAPI,
  servicesAPI,
  bookingsAPI,
  messagesAPI,
  usersAPI,
  categoriesAPI,
  healthCheck,
};

export default api;
