const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const User = require('../models/User');
const auth = require('../middleware/auth');

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads/profiles');
    // Create directory if it doesn't exist
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    // Create unique filename with timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, `profile-${uniqueSuffix}${path.extname(file.originalname)}`);
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Check if file is an image
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are allowed!'), false);
    }
  }
});

// JWT Secret (in production, use environment variable)
const JWT_SECRET = process.env.JWT_SECRET || 'cookie-app-secret-key-2024';

// Generate JWT token
const generateToken = (userId) => {
  return jwt.sign({ userId }, JWT_SECRET, { expiresIn: '7d' });
};

// @route   POST /api/auth/register
// @desc    Register a new user (customer or worker)
// @access  Public
router.post('/register', async (req, res) => {
  try {
    const {
      firstName,
      lastName,
      email,
      password,
      phone,
      userType,
      location,
      services,
      skills,
      languages,
      hourlyRate
    } = req.body;

    // Validate required fields
    if (!firstName || !lastName || !email || !password || !phone || !userType) {
      return res.status(400).json({
        message: 'Please provide all required fields'
      });
    }

    // Check if user already exists
    const existingUser = await User.findOne({ email: email.toLowerCase() });
    if (existingUser) {
      return res.status(400).json({
        message: 'User with this email already exists'
      });
    }

    // Create user data
    const userData = {
      firstName,
      lastName,
      email: email.toLowerCase(),
      password,
      phone,
      userType,
      location: location || '',
    };

    // Add worker-specific fields if userType is worker
    if (userType === 'worker') {
      userData.services = services || [];
      userData.skills = skills || [];
      userData.languages = languages || ['English'];
      userData.hourlyRate = hourlyRate || 25;
    }

    // Create new user
    const user = new User(userData);
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    const publicProfile = user.getPublicProfile();

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: publicProfile
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({
      message: 'Server error during registration',
      error: error.message
    });
  }
});

// @route   POST /api/auth/login
// @desc    Login user
// @access  Public
router.post('/login', async (req, res) => {
  try {
    const { email, password, userType } = req.body;

    // Validate required fields
    if (!email || !password || !userType) {
      return res.status(400).json({
        message: 'Please provide email, password, and user type'
      });
    }

    // Find user by email and userType
    const user = await User.findOne({ 
      email: email.toLowerCase(),
      userType: userType
    });

    if (!user) {
      return res.status(401).json({
        message: 'Invalid credentials or user type'
      });
    }

    // Check if account is active
    if (!user.isActive) {
      return res.status(401).json({
        message: 'Account is deactivated. Please contact support.'
      });
    }

    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      return res.status(401).json({
        message: 'Invalid credentials'
      });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    // Generate token
    const token = generateToken(user._id);

    // Return user data (without password)
    const publicProfile = user.getPublicProfile();

    res.json({
      message: 'Login successful',
      token,
      user: publicProfile
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({
      message: 'Server error during login',
      error: error.message
    });
  }
});

// @route   GET /api/auth/me
// @desc    Get current user profile
// @access  Private
router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    const publicProfile = user.getPublicProfile();
    res.json(publicProfile);

  } catch (error) {
    console.error('Get profile error:', error);
    res.status(500).json({
      message: 'Server error',
      error: error.message
    });
  }
});

// @route   PUT /api/auth/profile
// @desc    Update user profile
// @access  Private
router.put('/profile', auth, async (req, res) => {
  try {
    console.log('Profile update request body:', req.body);
    console.log('User ID:', req.userId);
    
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Found user:', user.email);

    // Validate and sanitize input data
    const updateData = {};
    const allowedUpdates = [
      'firstName', 'lastName', 'phone', 'bio', 'location', 
      'services', 'skills', 'languages', 'hourlyRate', 'availability'
    ];

    // Only include fields that are defined and valid
    allowedUpdates.forEach(field => {
      if (req.body[field] !== undefined && req.body[field] !== null) {
        console.log(`Preparing to update ${field}:`, req.body[field]);
        
        // Special handling for different field types
        if (field === 'hourlyRate') {
          updateData[field] = Number(req.body[field]) || 0;
        } else if (field === 'skills' || field === 'languages' || field === 'services') {
          updateData[field] = Array.isArray(req.body[field]) ? req.body[field] : [];
        } else {
          updateData[field] = String(req.body[field]).trim();
        }
      }
    });

    console.log('Sanitized update data:', updateData);

    // Use findByIdAndUpdate for better error handling
    const updatedUser = await User.findByIdAndUpdate(
      req.userId,
      { $set: updateData },
      { 
        new: true, 
        runValidators: true,
        context: 'query'
      }
    );

    if (!updatedUser) {
      return res.status(404).json({ message: 'User not found after update' });
    }

    console.log('User updated successfully');

    const publicProfile = updatedUser.getPublicProfile();
    res.json({
      message: 'Profile updated successfully',
      user: publicProfile
    });

  } catch (error) {
    console.error('Profile update error details:', error);
    console.error('Error name:', error.name);
    console.error('Error code:', error.code);
    
    // Handle specific MongoDB validation errors
    if (error.name === 'ValidationError') {
      const validationErrors = Object.values(error.errors).map(err => err.message);
      return res.status(400).json({
        message: 'Validation error',
        errors: validationErrors
      });
    }
    
    if (error.code === 11000) {
      return res.status(400).json({
        message: 'Duplicate field error',
        error: 'Email already exists'
      });
    }

    res.status(500).json({
      message: 'Server error during profile update',
      error: error.message
    });
  }
});

// @route   POST /api/auth/logout
// @desc    Logout user (client-side token removal)
// @access  Private
router.post('/logout', auth, (req, res) => {
  res.json({ message: 'Logout successful' });
});

// @route   POST /api/auth/upload-profile-photo
// @desc    Upload profile photo
// @access  Private
router.post('/upload-profile-photo', auth, upload.single('profilePhoto'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file uploaded' });
    }

    // Create the URL for the uploaded file
    const profileImageUrl = `/uploads/profiles/${req.file.filename}`;

    // Update user's profile image in database
    const user = await User.findByIdAndUpdate(
      req.userId,
      { profileImage: profileImageUrl },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    console.log('Profile photo uploaded successfully:', profileImageUrl);

    res.json({
      message: 'Profile photo uploaded successfully',
      profileImageUrl: profileImageUrl
    });

  } catch (error) {
    console.error('Profile photo upload error:', error);
    res.status(500).json({
      message: 'Error uploading profile photo',
      error: error.message
    });
  }
});

module.exports = router;
