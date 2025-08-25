import React, { useState, useEffect, useRef } from 'react';
import { 
  X, 
  Send, 
  MessageCircle, 
  User,
  Clock
} from 'lucide-react';
import { messagesAPI } from '../services/api';
import { useSocket } from '../contexts/SocketContext';

const ChatModal = ({ 
  isOpen, 
  onClose, 
  booking, 
  otherUser, // The person we're chatting with (worker for customer, customer for worker)
  currentUser 
}) => {
  const [messages, setMessages] = useState([]);
  const [newMessage, setNewMessage] = useState('');
  const [loading, setLoading] = useState(false);
  const [sending, setSending] = useState(false);
  const messagesEndRef = useRef(null);
  const { socket, isConnected, sendMessage: sendSocketMessage } = useSocket();

  // Auto-scroll to bottom when new messages arrive
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Load messages when modal opens
  useEffect(() => {
    if (isOpen && booking?.id) {
      loadMessages();
    }
  }, [isOpen, booking?.id]);

  // Listen for real-time messages via socket
  useEffect(() => {
    if (!socket || !isOpen) return;

    // Listen for incoming messages
    const handleNewMessage = (messageData) => {
      // Only add message if it belongs to current conversation
      if (messageData.booking === booking?.id) {
        setMessages(prev => {
          // Check if message already exists to avoid duplicates
          const exists = prev.some(msg => msg._id === messageData._id);
          if (!exists) {
            return [...prev, messageData];
          }
          return prev;
        });
      }
    };

    // Listen for message sent confirmation
    const handleMessageSent = (messageData) => {
      if (messageData.booking === booking?.id) {
        setMessages(prev => {
          const exists = prev.some(msg => msg._id === messageData._id);
          if (!exists) {
            return [...prev, messageData];
          }
          return prev;
        });
      }
    };

    socket.on('message:receive', handleNewMessage);
    socket.on('message:sent', handleMessageSent);

    return () => {
      socket.off('message:receive', handleNewMessage);
      socket.off('message:sent', handleMessageSent);
    };
  }, [socket, isOpen, booking?.id]);

  const loadMessages = async () => {
    try {
      setLoading(true);
      const response = await messagesAPI.getMessages(booking.id);
      setMessages(response.messages || []);
    } catch (error) {
      console.error('Failed to load messages:', error);
    } finally {
      setLoading(false);
    }
  };

  const sendMessage = async () => {
    if (!newMessage.trim() || sending) return;

    try {
      setSending(true);
      
      const messageData = {
        senderId: currentUser.id,
        receiverId: otherUser.id,
        bookingId: booking.id,
        message: newMessage.trim()
      };

      // Send via socket for real-time delivery
      if (socket && isConnected) {
        sendSocketMessage(messageData);
        setNewMessage('');
      } else {
        // Fallback to API if socket not available
        const response = await messagesAPI.sendMessage({
          bookingId: booking.id,
          receiverId: otherUser.id,
          message: newMessage.trim()
        });
        
        setMessages(prev => [...prev, response.data]);
        setNewMessage('');
      }
      
    } catch (error) {
      console.error('Failed to send message:', error);
      alert('Failed to send message. Please try again.');
    } finally {
      setSending(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  };

  const formatTime = (timestamp) => {
    return new Date(timestamp).toLocaleTimeString([], { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };

  const formatDate = (timestamp) => {
    const date = new Date(timestamp);
    const today = new Date();
    const yesterday = new Date(today);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === today.toDateString()) {
      return 'Today';
    } else if (date.toDateString() === yesterday.toDateString()) {
      return 'Yesterday';
    } else {
      return date.toLocaleDateString();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg w-full max-w-md h-[600px] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <div className="flex items-center">
            <MessageCircle className="h-5 w-5 text-primary-600 mr-2" />
            <div>
              <h3 className="font-semibold text-gray-900">{otherUser.name}</h3>
              <p className="text-sm text-gray-600">
                {booking.service} - {booking.date}
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Messages Area */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
            </div>
          ) : messages.length > 0 ? (
            <>
              {messages.map((message, index) => {
                const isCurrentUser = message.sender._id === currentUser.id;
                const showDate = index === 0 || 
                  formatDate(message.createdAt) !== formatDate(messages[index - 1].createdAt);

                return (
                  <div key={message._id}>
                    {/* Date separator */}
                    {showDate && (
                      <div className="flex items-center justify-center my-4">
                        <div className="bg-gray-100 text-gray-600 text-xs px-3 py-1 rounded-full">
                          {formatDate(message.createdAt)}
                        </div>
                      </div>
                    )}

                    {/* Message bubble */}
                    <div className={`flex ${isCurrentUser ? 'justify-end' : 'justify-start'}`}>
                      <div className={`max-w-xs lg:max-w-md px-4 py-2 rounded-lg ${
                        isCurrentUser 
                          ? 'bg-primary-600 text-white' 
                          : 'bg-gray-100 text-gray-900'
                      }`}>
                        <p className="text-sm">{message.message}</p>
                        <div className={`flex items-center mt-1 text-xs ${
                          isCurrentUser ? 'text-primary-100' : 'text-gray-500'
                        }`}>
                          <Clock className="h-3 w-3 mr-1" />
                          {formatTime(message.createdAt)}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div ref={messagesEndRef} />
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-gray-500">
              <MessageCircle className="h-12 w-12 mb-4" />
              <p className="text-center">
                No messages yet. Start the conversation!
              </p>
            </div>
          )}
        </div>

        {/* Message Input */}
        <div className="border-t border-gray-200 p-4">
          <div className="flex items-center space-x-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyPress={handleKeyPress}
              placeholder="Type your message..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
              disabled={sending || !isConnected}
            />
            <button
              onClick={sendMessage}
              disabled={!newMessage.trim() || sending || !isConnected}
              className="p-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
              title={!isConnected ? 'Connecting...' : ''}
            >
              {sending ? (
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
              ) : (
                <Send className="h-5 w-5" />
              )}
            </button>
          </div>
          {!isConnected && (
            <p className="text-xs text-amber-600 mt-1">
              Connecting to real-time messaging...
            </p>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatModal;
