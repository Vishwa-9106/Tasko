const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Booking Schema (embedded in User or separate collection)
const bookingSchema = new mongoose.Schema({
  customer: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  worker: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  service: {
    name: String,
    description: String,
    price: Number,
    duration: Number,
    category: String
  },
  scheduledDate: {
    type: Date,
    required: true
  },
  scheduledTime: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  notes: String,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'],
    default: 'pending'
  },
  totalAmount: {
    type: Number,
    required: true
  },
  paymentStatus: {
    type: String,
    enum: ['pending', 'paid', 'refunded'],
    default: 'pending'
  },
  review: {
    rating: {
      type: Number,
      min: 1,
      max: 5
    },
    comment: String,
    createdAt: Date
  }
}, {
  timestamps: true
});

const Booking = mongoose.model('Booking', bookingSchema);

// @route   POST /api/bookings
// @desc    Create a new booking
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const customer = await User.findById(req.userId);

    if (customer.userType !== 'customer') {
      return res.status(403).json({ message: 'Only customers can create bookings' });
    }

    const {
      workerId,
      serviceId,
      scheduledDate,
      scheduledTime,
      address,
      notes
    } = req.body;

    // Validate required fields
    if (!workerId || !serviceId || !scheduledDate || !scheduledTime || !address) {
      return res.status(400).json({ message: 'Please provide all required fields' });
    }

    // Find worker and service
    const worker = await User.findOne({
      _id: workerId,
      userType: 'worker',
      isActive: true
    });

    if (!worker) {
      return res.status(404).json({ message: 'Worker not found' });
    }

    const service = worker.services.id(serviceId);
    if (!service || !service.isActive) {
      return res.status(404).json({ message: 'Service not found or inactive' });
    }

    // Create booking
    const booking = new Booking({
      customer: req.userId,
      worker: workerId,
      service: {
        name: service.name,
        description: service.description,
        price: service.price,
        duration: service.duration,
        category: service.category
      },
      scheduledDate: new Date(scheduledDate),
      scheduledTime,
      address,
      notes: notes || '',
      totalAmount: service.price,
      status: 'pending'
    });

    await booking.save();

    // Populate customer and worker details
    await booking.populate('customer', 'firstName lastName email phone');
    await booking.populate('worker', 'firstName lastName email phone');

    res.status(201).json({
      message: 'Booking created successfully',
      booking
    });

  } catch (error) {
    console.error('Create booking error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/bookings
// @desc    Get user's bookings
// @access  Private
router.get('/', auth, async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const user = await User.findById(req.userId);

    let query = {};
    if (user.userType === 'customer') {
      query.customer = req.userId;
    } else if (user.userType === 'worker') {
      query.worker = req.userId;
    }

    if (status) {
      query.status = status;
    }

    const bookings = await Booking.find(query)
      .populate('customer', 'firstName lastName email phone')
      .populate('worker', 'firstName lastName email phone')
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const total = await Booking.countDocuments(query);

    res.json({
      bookings,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get bookings error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/bookings/:bookingId/status
// @desc    Update booking status
// @access  Private
router.put('/:bookingId/status', auth, async (req, res) => {
  try {
    const { status } = req.body;
    const validStatuses = ['pending', 'confirmed', 'in-progress', 'completed', 'cancelled'];

    if (!validStatuses.includes(status)) {
      return res.status(400).json({ message: 'Invalid status' });
    }

    const booking = await Booking.findById(req.params.bookingId)
      .populate('customer', 'firstName lastName email phone')
      .populate('worker', 'firstName lastName email phone');

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check permissions
    const user = await User.findById(req.userId);
    if (user.userType === 'worker' && booking.worker._id.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }
    if (user.userType === 'customer' && booking.customer._id.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    booking.status = status;
    await booking.save();

    // Update worker stats if completed
    if (status === 'completed') {
      const worker = await User.findById(booking.worker._id);
      worker.completedJobs += 1;
      worker.totalEarnings += booking.totalAmount;
      await worker.save();
    }

    res.json({
      message: 'Booking status updated successfully',
      booking
    });

  } catch (error) {
    console.error('Update booking status error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   POST /api/bookings/:bookingId/review
// @desc    Add review to completed booking
// @access  Private
router.post('/:bookingId/review', auth, async (req, res) => {
  try {
    const { rating, comment } = req.body;

    if (!rating || rating < 1 || rating > 5) {
      return res.status(400).json({ message: 'Rating must be between 1 and 5' });
    }

    const booking = await Booking.findById(req.params.bookingId);

    if (!booking) {
      return res.status(404).json({ message: 'Booking not found' });
    }

    // Check if customer owns this booking
    if (booking.customer.toString() !== req.userId) {
      return res.status(403).json({ message: 'Not authorized' });
    }

    // Check if booking is completed
    if (booking.status !== 'completed') {
      return res.status(400).json({ message: 'Can only review completed bookings' });
    }

    // Add review
    booking.review = {
      rating: parseInt(rating),
      comment: comment || '',
      createdAt: new Date()
    };

    await booking.save();

    // Update worker's rating
    const worker = await User.findById(booking.worker);
    const workerBookings = await Booking.find({
      worker: booking.worker,
      status: 'completed',
      'review.rating': { $exists: true }
    });

    const totalRating = workerBookings.reduce((sum, b) => sum + b.review.rating, 0);
    worker.rating = totalRating / workerBookings.length;
    worker.reviewCount = workerBookings.length;
    await worker.save();

    res.json({
      message: 'Review added successfully',
      booking
    });

  } catch (error) {
    console.error('Add review error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
