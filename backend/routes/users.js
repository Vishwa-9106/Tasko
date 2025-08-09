const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

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

    // Search by name or services
    if (search) {
      query.$or = [
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } },
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

module.exports = router;
