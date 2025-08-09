const express = require('express');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   GET /api/services
// @desc    Get all available services
// @access  Public
router.get('/', async (req, res) => {
  try {
    // Get unique services from all active workers
    const services = await User.aggregate([
      { $match: { userType: 'worker', isActive: true } },
      { $unwind: '$services' },
      { $match: { 'services.isActive': true } },
      {
        $group: {
          _id: '$services.name',
          category: { $first: '$services.category' },
          avgPrice: { $avg: '$services.price' },
          workerCount: { $sum: 1 }
        }
      },
      { $sort: { workerCount: -1 } }
    ]);

    res.json(services);

  } catch (error) {
    console.error('Get services error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/services
// @desc    Add a new service (workers only)
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (user.userType !== 'worker') {
      return res.status(403).json({ message: 'Only workers can add services' });
    }

    const { name, description, price, duration, category } = req.body;

    if (!name || !description || !price || !duration || !category) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    const newService = {
      name,
      description,
      price: parseFloat(price),
      duration: parseFloat(duration),
      category,
      isActive: true
    };

    user.services.push(newService);
    await user.save();

    res.status(201).json({
      message: 'Service added successfully',
      service: newService
    });

  } catch (error) {
    console.error('Add service error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/services/:serviceId
// @desc    Update a service (workers only)
// @access  Private
router.put('/:serviceId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (user.userType !== 'worker') {
      return res.status(403).json({ message: 'Only workers can update services' });
    }

    const service = user.services.id(req.params.serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    // Update service fields
    const { name, description, price, duration, category, isActive } = req.body;
    
    if (name !== undefined) service.name = name;
    if (description !== undefined) service.description = description;
    if (price !== undefined) service.price = parseFloat(price);
    if (duration !== undefined) service.duration = parseFloat(duration);
    if (category !== undefined) service.category = category;
    if (isActive !== undefined) service.isActive = isActive;

    await user.save();

    res.json({
      message: 'Service updated successfully',
      service
    });

  } catch (error) {
    console.error('Update service error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   DELETE /api/services/:serviceId
// @desc    Delete a service (workers only)
// @access  Private
router.delete('/:serviceId', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);

    if (user.userType !== 'worker') {
      return res.status(403).json({ message: 'Only workers can delete services' });
    }

    const service = user.services.id(req.params.serviceId);
    if (!service) {
      return res.status(404).json({ message: 'Service not found' });
    }

    user.services.pull(req.params.serviceId);
    await user.save();

    res.json({ message: 'Service deleted successfully' });

  } catch (error) {
    console.error('Delete service error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
