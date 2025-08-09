const mongoose = require('mongoose');

const serviceSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  price: {
    type: Number,
    required: true,
    min: 1
  },
  duration: {
    type: Number,
    required: true,
    min: 0.5
  },
  category: {
    type: String,
    required: true,
    enum: ['Cleaning', 'Cooking', 'Laundry', 'Dishwashing', 'Other']
  },
  workerId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  bookings: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Index for efficient queries
serviceSchema.index({ workerId: 1, isActive: 1 });
serviceSchema.index({ category: 1, isActive: 1 });

module.exports = mongoose.model('Service', serviceSchema);
