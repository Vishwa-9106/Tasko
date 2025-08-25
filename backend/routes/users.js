const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const { uploadProfilePhoto } = require('../middleware/upload');
const path = require('path');
const fs = require('fs');

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

module.exports = router;
