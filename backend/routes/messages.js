const express = require('express');
const mongoose = require('mongoose');
const Message = require('../models/Message');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// @route   POST /api/messages
// @desc    Send a new message between customer and worker
// @access  Private
router.post('/', auth, async (req, res) => {
  try {
    const { bookingId, receiverId, message } = req.body;
    
    // Validate required fields
    if (!bookingId || !receiverId || !message?.trim()) {
      return res.status(400).json({ 
        message: 'Booking ID, receiver ID, and message are required' 
      });
    }

    // Verify receiver exists
    const receiver = await User.findById(receiverId);
    if (!receiver) {
      return res.status(404).json({ message: 'Receiver not found' });
    }

    // Verify sender and receiver are different user types (customer <-> worker)
    const sender = await User.findById(req.userId);
    if (sender.userType === receiver.userType) {
      return res.status(400).json({ 
        message: 'Messages can only be sent between customers and workers' 
      });
    }

    // Create new message
    const newMessage = new Message({
      booking: bookingId,
      sender: req.userId,
      receiver: receiverId,
      message: message.trim()
    });

    await newMessage.save();

    // Populate sender and receiver details for response
    await newMessage.populate('sender', 'firstName lastName userType');
    await newMessage.populate('receiver', 'firstName lastName userType');

    res.status(201).json({
      message: 'Message sent successfully',
      data: newMessage
    });

  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/messages/:bookingId
// @desc    Get all messages for a specific booking
// @access  Private
router.get('/:bookingId', auth, async (req, res) => {
  try {
    const { bookingId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    // Find messages for this booking where user is sender or receiver
    const messages = await Message.find({
      booking: bookingId,
      $or: [
        { sender: req.userId },
        { receiver: req.userId }
      ]
    })
    .populate('sender', 'firstName lastName userType')
    .populate('receiver', 'firstName lastName userType')
    .sort({ createdAt: 1 }) // Oldest first for chat display
    .limit(limit * 1)
    .skip((page - 1) * limit);

    // Mark messages as read if current user is the receiver
    const unreadMessages = messages.filter(msg => 
      msg.receiver._id.toString() === req.userId && !msg.isRead
    );
    
    if (unreadMessages.length > 0) {
      await Message.updateMany(
        {
          _id: { $in: unreadMessages.map(msg => msg._id) },
          receiver: req.userId
        },
        {
          isRead: true,
          readAt: new Date()
        }
      );
    }

    const total = await Message.countDocuments({
      booking: bookingId,
      $or: [
        { sender: req.userId },
        { receiver: req.userId }
      ]
    });

    res.json({
      messages,
      pagination: {
        current: parseInt(page),
        pages: Math.ceil(total / limit),
        total
      }
    });

  } catch (error) {
    console.error('Get messages error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   GET /api/messages/conversations
// @desc    Get all conversations for the current user
// @access  Private
router.get('/conversations', auth, async (req, res) => {
  try {
    // Get all unique conversations for this user
    const conversations = await Message.aggregate([
      {
        $match: {
          $or: [
            { sender: new mongoose.Types.ObjectId(req.userId) },
            { receiver: new mongoose.Types.ObjectId(req.userId) }
          ]
        }
      },
      {
        $sort: { createdAt: -1 }
      },
      {
        $group: {
          _id: '$booking',
          lastMessage: { $first: '$$ROOT' },
          unreadCount: {
            $sum: {
              $cond: [
                {
                  $and: [
                    { $eq: ['$receiver', new mongoose.Types.ObjectId(req.userId)] },
                    { $eq: ['$isRead', false] }
                  ]
                },
                1,
                0
              ]
            }
          }
        }
      },
      {
        $lookup: {
          from: 'bookings',
          localField: '_id',
          foreignField: '_id',
          as: 'booking'
        }
      },
      {
        $unwind: '$booking'
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.sender',
          foreignField: '_id',
          as: 'sender'
        }
      },
      {
        $lookup: {
          from: 'users',
          localField: 'lastMessage.receiver',
          foreignField: '_id',
          as: 'receiver'
        }
      },
      {
        $sort: { 'lastMessage.createdAt': -1 }
      }
    ]);

    res.json(conversations);

  } catch (error) {
    console.error('Get conversations error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

module.exports = router;
