const mongoose = require('mongoose');

// Message Schema for customer-worker communication
const messageSchema = new mongoose.Schema({
  // Reference to the booking this message relates to
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true
  },
  
  // User who sent the message
  sender: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // User who will receive the message
  receiver: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  
  // The actual message content
  message: {
    type: String,
    required: true,
    trim: true,
    maxlength: 1000
  },
  
  // Message status tracking
  isRead: {
    type: Boolean,
    default: false
  },
  
  // When the message was read
  readAt: {
    type: Date
  }
}, {
  timestamps: true // Adds createdAt and updatedAt automatically
});

// Index for efficient querying by booking and participants
messageSchema.index({ booking: 1, createdAt: -1 });
messageSchema.index({ sender: 1, receiver: 1, createdAt: -1 });

// Method to mark message as read
messageSchema.methods.markAsRead = function() {
  this.isRead = true;
  this.readAt = new Date();
  return this.save();
};

module.exports = mongoose.model('Message', messageSchema);
