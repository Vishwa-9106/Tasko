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
const io = socketIo(server, {
  cors: {
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    methods: ["GET", "POST"]
  }
});

// Make io available to routes
app.set('io', io);

// Middleware
app.use(cors());
app.use(express.json());

// Serve static files from uploads directory
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// MongoDB connection
const MONGODB_URI = process.env.MONGODB_URI || 'mongodb+srv://vishwadhanapal9126:Vishwa9126@cookie.2gnualo.mongodb.net/?retryWrites=true&w=majority&appName=cookie';

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
