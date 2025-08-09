const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

const app = express();

// Middleware
app.use(cors());
app.use(express.json());

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vishwadhanapal9126:Vishwa9126@cookie.2gnualo.mongodb.net/?retryWrites=true&w=majority&appName=cookie';

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(async () => {
  console.log('✅ Connected to MongoDB successfully');
  
  // Drop the problematic geospatial index if it exists
  try {
    const User = require('./models/User');
    await User.collection.dropIndex({ email: 1, userType: 1, location: '2dsphere', services: 1, isActive: 1 });
    console.log('✅ Dropped old geospatial index successfully');
  } catch (error) {
    console.log('ℹ️  Geospatial index may not exist or already dropped');
  }
})
.catch((error) => {
  console.error('❌ MongoDB connection error:', error);
  process.exit(1);
});

// Routes
try {
  app.use('/api/auth', require('./routes/auth'));
  app.use('/api/users', require('./routes/users'));
  app.use('/api/services', require('./routes/services'));
  app.use('/api/bookings', require('./routes/bookings'));
} catch (error) {
  console.log('⚠️  Some route files may be missing, server will continue without them');
}

// Health check endpoint
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    message: 'Cookie API is running',
    timestamp: new Date().toISOString()
  });
});

// Error handling middleware
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  res.status(500).json({ 
    message: 'Internal server error',
    error: process.env.NODE_ENV === 'development' ? error.message : 'Something went wrong'
  });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
});
