const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  // Basic Info
  firstName: {
    type: String,
    required: true,
    trim: true
  },
  lastName: {
    type: String,
    required: true,
    trim: true
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true
  },
  password: {
    type: String,
    required: true,
    minlength: 6
  },
  phone: {
    type: String,
    required: true
  },
  userType: {
    type: String,
    enum: ['customer', 'worker', 'admin'],
    required: true
  },
  
  // Profile Info
  bio: {
    type: String,
    default: ''
  },
  profileImage: {
    type: String,
    default: ''
  },
  location: {
    type: String,
    default: ''
  },
  
  // Payment Information
  bankAccount: {
    bankName: String,
    accountHolderName: String,
    lastFour: String,
    routingNumber: String,
    accountNumber: String, // This should be encrypted in production
    isVerified: {
      type: Boolean,
      default: false
    }
  },
  
  // Worker-specific fields
  services: [{
    name: String,
    description: String,
    price: Number,
    duration: Number,
    category: String,
    isActive: {
      type: Boolean,
      default: true
    }
  }],
  skills: [String],
  languages: [String],
  hourlyRate: {
    type: Number,
    default: 0
  },
  availability: {
    type: String,
    default: 'Available'
  },
  
  // Verification & Trust
  isVerified: {
    type: Boolean,
    default: false
  },
  backgroundCheck: {
    type: Boolean,
    default: false
  },
  insurance: {
    type: Boolean,
    default: false
  },
  
  // Statistics
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  reviewCount: {
    type: Number,
    default: 0
  },
  completedJobs: {
    type: Number,
    default: 0
  },
  totalEarnings: {
    type: Number,
    default: 0
  },
  
  // Reviews received (for workers)
  reviews: [{
    bookingId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking'
    },
    customerId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User'
    },
    customerName: String,
    rating: {
      type: Number,
      min: 1,
      max: 5,
      required: true
    },
    comment: String,
    serviceName: String,
    createdAt: {
      type: Date,
      default: Date.now
    }
  }],
  
  // Customer-specific fields
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }],
  
  // Account status
  isActive: {
    type: Boolean,
    default: true
  },
  lastLogin: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Index for search functionality
userSchema.index({ 
  email: 1, 
  userType: 1, 
  services: 1,
  isActive: 1 
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  
  try {
    const salt = await bcrypt.genSalt(12);
    this.password = await bcrypt.hash(this.password, salt);
    next();
  } catch (error) {
    next(error);
  }
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Get full name
userSchema.virtual('fullName').get(function() {
  return `${this.firstName} ${this.lastName}`;
});

// Get public profile (exclude sensitive data)
userSchema.methods.getPublicProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  return user;
};

// Get worker profile for search results
userSchema.methods.getWorkerProfile = function() {
  const user = this.toObject();
  delete user.password;
  delete user.__v;
  delete user.totalEarnings;
  return user;
};

module.exports = mongoose.model('User', userSchema);
