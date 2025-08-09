const jwt = require('jsonwebtoken');
const User = require('../models/User');

const JWT_SECRET = process.env.JWT_SECRET || 'cookie-app-secret-key-2024';

const auth = async (req, res, next) => {
  try {
    // Get token from header
    const token = req.header('Authorization')?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ message: 'No token provided, authorization denied' });
    }

    // Verify token
    const decoded = jwt.verify(token, JWT_SECRET);
    
    // Check if user exists and is active
    const user = await User.findById(decoded.userId);
    if (!user || !user.isActive) {
      return res.status(401).json({ message: 'Token is not valid' });
    }

    // Add user id to request
    req.userId = decoded.userId;
    req.user = user;
    next();

  } catch (error) {
    console.error('Auth middleware error:', error);
    res.status(401).json({ message: 'Token is not valid' });
  }
};

module.exports = auth;
