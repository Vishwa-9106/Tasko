const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const path = require('path');
const dotenv = require('dotenv');
const http = require('http');
const socketIo = require('socket.io');

// Load environment variables
dotenv.config();

const app = express();
const server = http.createServer(app);

// Build allowed origins from env for CORS
const FRONTEND_URLS_ENV = process.env.FRONTEND_URLS || process.env.FRONTEND_URL || '';
const FRONTEND_URLS = FRONTEND_URLS_ENV
  .split(',')
  .map(s => s.trim())
  .filter(Boolean);
const DEFAULT_ORIGINS = ['http://localhost:3000'];
const ALLOWED_ORIGINS = [...DEFAULT_ORIGINS, ...FRONTEND_URLS];

// Helper to check wildcard subdomains like https://*.vercel.app
const isOriginAllowed = (origin) => {
  if (!origin) return true; // allow non-browser requests
  for (const o of ALLOWED_ORIGINS) {
    if (o === origin) return true;
    // Very simple wildcard support for Vercel previews
    if (o.includes('*.vercel.app') && origin.endsWith('.vercel.app')) return true;
  }
  return false;
};

const io = socketIo(server, {
  cors: {
    origin: (origin, callback) => {
      if (isOriginAllowed(origin)) return callback(null, true);
      return callback(new Error('Not allowed by CORS'));
    },
    methods: ["GET", "POST"],
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors({
  origin: (origin, callback) => {
    if (isOriginAllowed(origin)) return callback(null, true);
    return callback(new Error('Not allowed by CORS'));
  },
  credentials: true,
}));
app.use(express.json({ limit: "25mb" }));
app.use(express.urlencoded({ limit: "25mb", extended: true }));

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI;
if (!MONGODB_URI) {
  console.error('❌ MONGODB_URI is not set. Please configure it in your environment.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => {
  console.log('✅ Connected to MongoDB successfully');
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
  app.use('/api/categories', require('./routes/categories'));
  app.use('/api/bookings', require('./routes/bookings'));
  app.use('/api/messages', require('./routes/messages'));
  app.use('/api/products', require('./routes/products'));
  app.use('/api/orders', require('./routes/orders'));
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

// Avoid noisy 404s from Chrome DevTools local probing in development.
app.get('/.well-known/appspecific/com.chrome.devtools.json', (req, res) => {
  res.type('application/json').json({});
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

// Socket.IO connection handling
io.on('connection', (socket) => {
  console.log(`👤 User connected: ${socket.id}`);

  // Join user to their personal room for direct messaging
  socket.on('join', (userId) => {
    socket.join(userId);
    console.log(`👤 User ${userId} joined their room`);
  });

  // Handle sending messages
  socket.on('message:send', async (data) => {
    try {
      const { senderId, receiverId, bookingId, message } = data;
      
      // Save message to database
      const Message = require('./models/Message');
      const newMessage = new Message({
        booking: bookingId,
        sender: senderId,
        receiver: receiverId,
        message: message,
        isRead: false
      });
      
      const savedMessage = await newMessage.save();
      await savedMessage.populate(['sender', 'receiver']);
      
      // Emit to receiver's room for real-time delivery
      socket.to(receiverId).emit('message:receive', {
        _id: savedMessage._id,
        message: savedMessage.message,
        sender: savedMessage.sender,
        receiver: savedMessage.receiver,
        booking: savedMessage.booking,
        createdAt: savedMessage.createdAt,
        isRead: savedMessage.isRead
      });
      
      // Confirm to sender that message was sent
      socket.emit('message:sent', {
        _id: savedMessage._id,
        message: savedMessage.message,
        sender: savedMessage.sender,
        receiver: savedMessage.receiver,
        booking: savedMessage.booking,
        createdAt: savedMessage.createdAt,
        isRead: savedMessage.isRead
      });
      
      console.log(`📨 Message sent from ${senderId} to ${receiverId}`);
    } catch (error) {
      console.error('❌ Error sending message:', error);
      socket.emit('message:error', { error: 'Failed to send message' });
    }
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    console.log(`👤 User disconnected: ${socket.id}`);
  });
});

server.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📍 Health check: http://localhost:${PORT}/api/health`);
  console.log(`🔌 Socket.IO server initialized`);
});
