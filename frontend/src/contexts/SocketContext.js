import React, { createContext, useContext, useEffect, useState } from 'react';
import io from 'socket.io-client';

const SocketContext = createContext();

export const useSocket = () => {
  const context = useContext(SocketContext);
  if (!context) {
    throw new Error('useSocket must be used within a SocketProvider');
  }
  return context;
};

export const SocketProvider = ({ children }) => {
  const [socket, setSocket] = useState(null);
  const [isConnected, setIsConnected] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [isBlocked, setIsBlocked] = useState(false);
  const [blockMessage, setBlockMessage] = useState('');

  useEffect(() => {
    // Initialize socket connection
    const newSocket = io(process.env.REACT_APP_API_URL?.replace('/api', '') || 'http://localhost:5000', {
      transports: ['websocket', 'polling']
    });

    // Listen for admin block event
    newSocket.on('user:blocked', (payload) => {
      console.log('⛔ User blocked event received:', payload);
      setBlockMessage(payload?.message || 'Your account has been blocked by admin.');
      setIsBlocked(true);
    });

    // Connection event handlers
    newSocket.on('connect', () => {
      console.log('🔌 Connected to Socket.IO server');
      setIsConnected(true);
      
      // Join user's personal room for direct messaging
      const user = JSON.parse(localStorage.getItem('user') || '{}');
      if (user._id) {
        newSocket.emit('join', user._id);
      }
    });

    newSocket.on('disconnect', () => {
      console.log('🔌 Disconnected from Socket.IO server');
      setIsConnected(false);
    });

    // Listen for incoming messages
    newSocket.on('message:receive', (messageData) => {
      console.log('📨 New message received:', messageData);
      
      // Add notification for new message
      const notification = {
        id: Date.now(),
        type: 'message',
        title: 'New Message',
        message: `New message from ${messageData.sender.firstName} ${messageData.sender.lastName}`,
        timestamp: new Date(),
        data: messageData
      };
      
      setNotifications(prev => [notification, ...prev]);
      
      // Auto-remove notification after 5 seconds
      setTimeout(() => {
        setNotifications(prev => prev.filter(n => n.id !== notification.id));
      }, 5000);
    });

    setSocket(newSocket);

    // Cleanup on unmount
    return () => {
      newSocket.disconnect();
    };
  }, []);

  // Function to send a message via socket
  const sendMessage = (messageData) => {
    if (socket && isConnected) {
      socket.emit('message:send', messageData);
    }
  };

  // Function to clear a specific notification
  const clearNotification = (notificationId) => {
    setNotifications(prev => prev.filter(n => n.id !== notificationId));
  };

  // Function to clear all notifications
  const clearAllNotifications = () => {
    setNotifications([]);
  };

  // Function to clear block state (used after logout)
  const clearBlock = () => {
    setIsBlocked(false);
    setBlockMessage('');
  };

  const value = {
    socket,
    isConnected,
    notifications,
    sendMessage,
    clearNotification,
    clearAllNotifications,
    isBlocked,
    blockMessage,
    clearBlock
  };

  return (
    <SocketContext.Provider value={value}>
      {children}
    </SocketContext.Provider>
  );
};

export default SocketContext;
