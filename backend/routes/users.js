const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { requireRole } = require('../middleware/roles');
const { uploadProfilePhoto } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');
const mongoose = require('mongoose');

// @route   GET /api/users/workers
// @desc    Get all workers with search and filter options
// @access  Public
router.get('/workers', async (req, res) => {
  try {
    const {
      search,
      service,
      location,
      minRating,
      maxPrice,
      sortBy = 'rating',
      page = 1,
      limit = 10
    } = req.query;

    // Build query
    let query = { 
      userType: 'worker', 
      isActive: true 
    };

    // Search by name, services, or location
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { 'services.name': { $regex: search, $options: 'i' } }
      ];
    }

    // Filter by service
    if (service) {
      query['services.name'] = { $regex: service, $options: 'i' };
    }

    // Filter by rating
    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    // Filter by price
    if (maxPrice) {
      query.hourlyRate = { $lte: parseFloat(maxPrice) };
    }

    // Sort options
    let sortOptions = {};
    switch (sortBy) {
      case 'rating':
        sortOptions = { rating: -1, reviewCount: -1 };
        break;
      case 'price-low':
        sortOptions = { hourlyRate: 1 };
        break;
      case 'price-high':
        sortOptions = { hourlyRate: -1 };
        break;
      case 'reviews':
        sortOptions = { reviewCount: -1 };
        break;
      default:
        sortOptions = { rating: -1 };
    }

    // Execute query with pagination
    const workers = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .limit(limit * 1)
      .skip((page - 1) * limit);

    // Get total count for pagination
    const total = await User.countDocuments(query);

    res.json({
      workers: workers.map(worker => worker.getWorkerProfile()),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });
  } catch (error) {
    console.error('Get workers error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/admin/worker/:id
// @desc    Admin: Get worker profile by ID (includes blocked users)
// @access  Private (admin only)
router.get('/admin/worker/:id', auth, requireRole('admin'), async (req, res) => {
  try {
    const worker = await User.findOne({
      _id: req.params.id,
      userType: 'worker'
    }).select('-password');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker.getWorkerProfile());

  } catch (error) {
    console.error('Admin get worker error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/admin/workers
// @desc    Admin: Get all workers (active and blocked) with search, filter, and pagination
// @access  Private (admin only)
router.get('/admin/workers', auth, requireRole('admin'), async (req, res) => {
  try {
    const {
      search,
      service,
      location,
      minRating,
      maxPrice,
      sortBy = 'rating',
      page = 1,
      limit = 10
    } = req.query;

    // Build query (no isActive filter so admins can see blocked)
    let query = {
      userType: 'worker'
    };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } },
        { 'services.name': { $regex: search, $options: 'i' } }
      ];
    }

    if (service) {
      query['services.name'] = { $regex: service, $options: 'i' };
    }

    if (minRating) {
      query.rating = { $gte: parseFloat(minRating) };
    }

    if (maxPrice) {
      query.hourlyRate = { $lte: parseFloat(maxPrice) };
    }

    let sortOptions = {};
    switch (sortBy) {
      case 'rating':
        sortOptions = { rating: -1, reviewCount: -1 };
        break;
      case 'price-low':
        sortOptions = { hourlyRate: 1 };
        break;
      case 'price-high':
        sortOptions = { hourlyRate: -1 };
        break;
      case 'reviews':
        sortOptions = { reviewCount: -1 };
        break;
      default:
        sortOptions = { rating: -1 };
    }

    const workers = await User.find(query)
      .select('-password')
      .sort(sortOptions)
      .limit(parseInt(limit) * 1)
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    // Include isActive in response (part of public profile already)
    res.json({
      workers: workers.map(w => w.getWorkerProfile()),
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Admin get workers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users/admin/customers
// @desc    Admin: Get all customers (active and blocked) with search and pagination, including works booked count
// @access  Private (admin only)
router.get('/admin/customers', auth, requireRole('admin'), async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    // Build query for customers only (no isActive filter so admins can see blocked)
    const query = { userType: 'customer' };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await User.find(query)
      .select('firstName lastName email phone location profileImage isActive')
      .limit(parseInt(limit) * 1)
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    // Aggregate booking counts per customer directly from the 'bookings' collection
    const customerIds = customers.map(c => c._id);
    const bookingsCollection = mongoose.connection.db.collection('bookings');

    const countsAgg = await bookingsCollection.aggregate([
      { $match: { customer: { $in: customerIds } } },
      { $group: { _id: '$customer', count: { $sum: 1 } } }
    ]).toArray();

    const countMap = countsAgg.reduce((acc, doc) => {
      acc[String(doc._id)] = doc.count;
      return acc;
    }, {});

    const result = customers.map(c => ({
      _id: c._id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      location: c.location || '',
      profileImage: c.profileImage || '',
      isActive: !!c.isActive,
      worksBooked: countMap[String(c._id)] || 0
    }));

    res.json({
      customers: result,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });
  } catch (error) {
    console.error('Admin get customers error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

// @route   GET /api/users/customers
// @desc    Get all customers with optional search and pagination, including works booked count
// @access  Public (consider protecting in production)
router.get('/customers', async (req, res) => {
  try {
    const { search, page = 1, limit = 10 } = req.query;

    // Build query for customers only
    const query = { userType: 'customer' };

    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
        { email: { $regex: search, $options: 'i' } },
        { phone: { $regex: search, $options: 'i' } },
        { location: { $regex: search, $options: 'i' } }
      ];
    }

    const customers = await User.find(query)
      .select('firstName lastName email phone location profileImage isActive')
      .limit(parseInt(limit) * 1)
      .skip((parseInt(page) - 1) * parseInt(limit));

    const total = await User.countDocuments(query);

    // Aggregate booking counts per customer directly from the 'bookings' collection
    const customerIds = customers.map(c => c._id);
    const bookingsCollection = mongoose.connection.db.collection('bookings');

    const countsAgg = await bookingsCollection.aggregate([
      { $match: { customer: { $in: customerIds } } },
      { $group: { _id: '$customer', count: { $sum: 1 } } }
    ]).toArray();

    const countMap = countsAgg.reduce((acc, doc) => {
      acc[String(doc._id)] = doc.count;
      return acc;
    }, {});

    const result = customers.map(c => ({
      _id: c._id,
      firstName: c.firstName,
      lastName: c.lastName,
      email: c.email,
      phone: c.phone,
      location: c.location || '',
      profileImage: c.profileImage || '',
      isActive: !!c.isActive,
      worksBooked: countMap[String(c._id)] || 0
    }));

    res.json({
      customers: result,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
        total
      }
    });

  } catch (error) {
    console.error('Get customers error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/customer/:id
// @desc    Get detailed customer profile with booking stats, services booked, workers booked, and reviews
// @access  Public (consider protecting in production)
router.get('/customer/:id', async (req, res) => {
  try {
    const customerId = req.params.id;

    const customer = await User.findOne({ _id: customerId, userType: 'customer' })
      .select('firstName lastName email phone location profileImage isActive');

    if (!customer) {
      return res.status(404).json({ message: 'Customer not found' });
    }

    const bookingsCollection = mongoose.connection.db.collection('bookings');

    // Fetch all bookings for this customer with lightweight projection
    const bookings = await bookingsCollection.find(
      { customer: customer._id },
      {
        projection: {
          service: 1,
          worker: 1,
          review: 1,
          createdAt: 1,
          updatedAt: 1,
          status: 1
        }
      }
    ).toArray();

    const totalWorksBooked = bookings.length;

    // Distinct services (by name) and worker IDs
    const serviceNames = Array.from(new Set(bookings.map(b => b?.service?.name).filter(Boolean)));
    const workerIds = Array.from(new Set(bookings.map(b => b?.worker).filter(Boolean)));

    // Fetch worker details
    let workers = [];
    if (workerIds.length) {
      workers = await User.find({ _id: { $in: workerIds } })
        .select('firstName lastName email phone profileImage userType')
        .lean();
    }

    // Reviews left by this customer (from their bookings)
    const reviews = bookings
      .filter(b => b.review && typeof b.review.rating === 'number')
      .map(b => ({
        rating: b.review.rating,
        comment: b.review.comment || '',
        date: b.review.createdAt || b.updatedAt,
        service: b.service?.name || '',
        workerId: b.worker
      }));

    // Map worker names into reviews
    const workerMap = workers.reduce((acc, w) => { acc[String(w._id)] = w; return acc; }, {});
    const reviewsWithWorker = reviews.map(r => ({
      ...r,
      workerName: workerMap[String(r.workerId)] ? `${workerMap[String(r.workerId)].firstName} ${workerMap[String(r.workerId)].lastName}` : 'Worker'
    }));

    res.json({
      _id: customer._id,
      firstName: customer.firstName,
      lastName: customer.lastName,
      email: customer.email,
      phone: customer.phone,
      location: customer.location || '',
      profileImage: customer.profileImage || '',
      isActive: !!customer.isActive,
      totalWorksBooked,
      servicesBooked: serviceNames,
      workersBooked: workers,
      reviews: reviewsWithWorker
    });

  } catch (error) {
    console.error('Get customer details error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/worker/:id
// @desc    Get worker profile by ID
// @access  Public
router.get('/worker/:id', async (req, res) => {
  try {
    const worker = await User.findOne({
      _id: req.params.id,
      userType: 'worker',
      isActive: true
    }).select('-password');

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    res.json(worker.getWorkerProfile());

  } catch (error) {
    console.error('Get worker error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/users/favorites/:workerId
// @desc    Add/remove worker from favorites
// @access  Private
router.post('/favorites/:workerId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    const workerId = req.params.workerId;

    if (user.userType !== 'customer') {
      return res.status(403).json({ message: 'Only customers can have favorites' });
    }

    // Check if worker exists
    const worker = await User.findOne({
      _id: workerId,
      userType: 'worker',
      isActive: true
    });

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Toggle favorite
    const favoriteIndex = user.favorites.indexOf(workerId);
    if (favoriteIndex > -1) {
      // Remove from favorites
      user.favorites.splice(favoriteIndex, 1);
      await user.save();
      res.json({ message: 'Removed from favorites', isFavorite: false });
    } else {
      // Add to favorites
      user.favorites.push(workerId);
      await user.save();
      res.json({ message: 'Added to favorites', isFavorite: true });
    }

  } catch (error) {
    console.error('Toggle favorite error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/favorites
// @desc    Get user's favorite workers
// @access  Private
router.get('/favorites', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId)
      .populate('favorites', '-password');

    if (user.userType !== 'customer') {
      return res.status(403).json({ message: 'Only customers can have favorites' });
    }

    const favoriteWorkers = user.favorites.map(worker => worker.getWorkerProfile());

    res.json(favoriteWorkers);

  } catch (error) {
    console.error('Get favorites error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/users/worker/:workerId/reviews
// @desc    Get all reviews for a specific worker from their profile
// @access  Public
router.get('/worker/:workerId/reviews', async (req, res) => {
  try {
    const workerId = req.params.workerId;
    
    const worker = await User.findById(workerId).select('reviews rating reviewCount');
    
    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    // Sort reviews by creation date (newest first)
    const sortedReviews = worker.reviews.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

    res.json({
      reviews: sortedReviews,
      totalReviews: worker.reviewCount,
      averageRating: worker.rating
    });

  } catch (error) {
    console.error('Get worker reviews error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/users/profile
// @desc    Update user profile including profile photo
// @access  Private
router.put('/profile', auth, uploadProfilePhoto, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Update basic profile fields
    const { firstName, lastName, bio, location, phone, hourlyRate, availability } = req.body;
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (bio) user.bio = bio;
    if (location) user.location = location;
    if (phone) user.phone = phone;
    
    // Worker-specific fields
    if (user.userType === 'worker') {
      if (hourlyRate) user.hourlyRate = hourlyRate;
      if (availability) user.availability = availability;
    }

    // Handle profile photo upload
    if (req.file) {
      // Delete old profile photo if it exists
      if (user.profileImage) {
        const oldPhotoPath = path.join(__dirname, '../uploads/profiles', path.basename(user.profileImage));
        if (fs.existsSync(oldPhotoPath)) {
          fs.unlinkSync(oldPhotoPath);
        }
      }
      
      // Set new profile photo URL
      user.profileImage = `/uploads/profiles/${req.file.filename}`;
    }

    await user.save();

    // Return updated user profile
    res.json({
      message: 'Profile updated successfully',
      user: user.getPublicProfile()
    });

  } catch (error) {
    console.error('Update profile error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/users/:id/block
// @desc    Block a user account (set isActive=false) and notify via Socket.IO
// @access  Private (admin only)
router.put('/:id/block', auth, requireRole('admin'), async (req, res) => {
  try {
    const userId = req.params.id;
    const user = await User.findByIdAndUpdate(
      userId,
      { isActive: false },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    // Emit socket event to the user's room to force logout popup
    const io = req.app.get('io');
    if (io) {
      io.to(String(user._id)).emit('user:blocked', { message: 'Your account has been blocked by admin.' });
    }

    return res.json({ message: 'User blocked successfully', user: user.getPublicProfile() });
  } catch (error) {
    console.error('Block user error:', error);
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});

module.exports = router;
