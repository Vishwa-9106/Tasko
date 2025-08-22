import React, { useState, useEffect } from 'react';
import { 
  User, 
  Bell,
  CreditCard,
  Shield,
  Edit3,
  Save
} from 'lucide-react';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [activeTab, setActiveTab] = useState('personal');
  
  const [profile, setProfile] = useState({
    name: '',
    email: '',
    phone: '',
    address: '',
    bio: '',
    joinDate: '',
    totalBookings: 0,
    totalSpent: 0
  });

  const [notifications, setNotifications] = useState({
    bookingUpdates: true,
    workerMessages: true,
    promotions: false,
    reminders: true,
    newsletter: false
  });

  const [paymentMethods, setPaymentMethods] = useState([]);

  // Load user profile data on component mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        const userBookings = JSON.parse(localStorage.getItem('userBookings') || '[]');
        
        if (user) {
          // Calculate stats from bookings
          const completedBookings = userBookings.filter(booking => booking.status === 'completed');
          const totalSpent = completedBookings.reduce((sum, booking) => sum + (booking.price || 0), 0);
          
          setProfile({
            name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Customer',
            email: user.email || '',
            phone: user.phone || '',
            address: user.location || '',
            bio: user.bio || '',
            joinDate: user.createdAt || new Date().toISOString(),
            totalBookings: userBookings.length,
            totalSpent: totalSpent
          });
        }
        
        // Load saved payment methods from localStorage
        const savedPaymentMethods = JSON.parse(localStorage.getItem('userPaymentMethods') || '[]');
        setPaymentMethods(savedPaymentMethods);
        
        // Load notification preferences
        const savedNotifications = JSON.parse(localStorage.getItem('userNotifications') || '{}');
        if (Object.keys(savedNotifications).length > 0) {
          setNotifications(savedNotifications);
        }
      } catch (err) {
        console.error('Profile load error:', err);
      }
    };
    
    loadProfile();
  }, []);

  const handleSave = async () => {
    try {
      // Update user data in localStorage
      const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
      const [firstName, ...lastNameParts] = profile.name.split(' ');
      const lastName = lastNameParts.join(' ');
      
      const updatedUser = {
        ...currentUser,
        firstName: firstName || '',
        lastName: lastName || '',
        email: profile.email,
        phone: profile.phone,
        location: profile.address,
        bio: profile.bio
      };
      
      localStorage.setItem('user', JSON.stringify(updatedUser));
      localStorage.setItem('userNotifications', JSON.stringify(notifications));
      
      setIsEditing(false);
    } catch (err) {
      console.error('Profile save error:', err);
    }
  };

  const handleNotificationChange = (key) => {
    setNotifications(prev => ({
      ...prev,
      [key]: !prev[key]
    }));
  };

  const tabs = [
    { id: 'personal', label: 'Personal Info', icon: User },
    { id: 'notifications', label: 'Notifications', icon: Bell },
    { id: 'payment', label: 'Payment Methods', icon: CreditCard },
    { id: 'security', label: 'Security', icon: Shield }
  ];

  const PersonalInfo = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Personal Information</h3>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {isEditing ? <Save className="h-4 w-4 mr-2" /> : <Edit3 className="h-4 w-4 mr-2" />}
          {isEditing ? 'Save Changes' : 'Edit Profile'}
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Full Name</label>
          <input
            type="text"
            value={profile.name}
            onChange={(e) => setProfile({...profile, name: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Email Address</label>
          <input
            type="email"
            value={profile.email}
            onChange={(e) => setProfile({...profile, email: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Phone Number</label>
          <input
            type="tel"
            value={profile.phone}
            onChange={(e) => setProfile({...profile, phone: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
          />
        </div>
        
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Address</label>
          <input
            type="text"
            value={profile.address}
            onChange={(e) => setProfile({...profile, address: e.target.value})}
            disabled={!isEditing}
            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
        <textarea
          value={profile.bio}
          onChange={(e) => setProfile({...profile, bio: e.target.value})}
          disabled={!isEditing}
          rows={3}
          className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500 disabled:bg-gray-50"
          placeholder="Tell us a bit about yourself..."
        />
      </div>

      {/* Account Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 pt-6 border-t border-gray-200">
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-600">{profile.totalBookings}</p>
          <p className="text-sm text-gray-600">Total Bookings</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-600">₹{profile.totalSpent}</p>
          <p className="text-sm text-gray-600">Total Spent</p>
        </div>
        <div className="text-center">
          <p className="text-2xl font-bold text-primary-600">
            {new Date(profile.joinDate).toLocaleDateString('en-US', { year: 'numeric', month: 'short' })}
          </p>
          <p className="text-sm text-gray-600">Member Since</p>
        </div>
      </div>
    </div>
  );

  const NotificationSettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Notification Preferences</h3>
      
      <div className="space-y-4">
        {Object.entries(notifications).map(([key, value]) => (
          <div key={key} className="flex items-center justify-between py-3 border-b border-gray-200">
            <div>
              <h4 className="font-medium text-gray-900 capitalize">
                {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
              </h4>
              <p className="text-sm text-gray-600">
                {key === 'bookingUpdates' && 'Get notified about booking confirmations, changes, and completions'}
                {key === 'workerMessages' && 'Receive messages from service providers'}
                {key === 'promotions' && 'Get special offers and discounts'}
                {key === 'reminders' && 'Receive booking reminders and follow-ups'}
                {key === 'newsletter' && 'Stay updated with our latest news and features'}
              </p>
            </div>
            <button
              onClick={() => handleNotificationChange(key)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                value ? 'bg-primary-600' : 'bg-gray-200'
              }`}
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  value ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
          </div>
        ))}
      </div>
    </div>
  );

  const PaymentMethods = () => (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h3 className="text-lg font-semibold text-gray-900">Payment Methods</h3>
        <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
          Add New Card
        </button>
      </div>
      
      <div className="space-y-4">
        {paymentMethods.length === 0 ? (
          <div className="text-center py-8">
            <CreditCard className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No payment methods</h3>
            <p className="text-gray-600 mb-4">Add a payment method to make bookings easier</p>
            <button className="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors">
              Add Your First Card
            </button>
          </div>
        ) : (
          paymentMethods.map((method) => (
            <div key={method.id} className="flex items-center justify-between p-4 border border-gray-200 rounded-lg">
              <div className="flex items-center">
                <div className="w-12 h-8 bg-gray-100 rounded flex items-center justify-center mr-4">
                  <CreditCard className="h-5 w-5 text-gray-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900">
                    {method.brand} •••• {method.last4}
                  </p>
                  {method.isDefault && (
                    <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">
                      Default
                    </span>
                  )}
                </div>
              </div>
              <div className="flex space-x-2">
                {!method.isDefault && (
                  <button className="text-sm text-primary-600 hover:text-primary-700">
                    Set as Default
                  </button>
                )}
                <button className="text-sm text-red-600 hover:text-red-700">
                  Remove
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );

  const SecuritySettings = () => (
    <div className="space-y-6">
      <h3 className="text-lg font-semibold text-gray-900">Security Settings</h3>
      
      <div className="space-y-4">
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-900">Password</h4>
            <button className="text-sm text-primary-600 hover:text-primary-700">
              Change Password
            </button>
          </div>
          <p className="text-sm text-gray-600">Last updated 3 months ago</p>
        </div>
        
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-900">Two-Factor Authentication</h4>
            <button className="text-sm text-primary-600 hover:text-primary-700">
              Enable
            </button>
          </div>
          <p className="text-sm text-gray-600">Add an extra layer of security to your account</p>
        </div>
        
        <div className="p-4 border border-gray-200 rounded-lg">
          <div className="flex justify-between items-center mb-2">
            <h4 className="font-medium text-gray-900">Login Activity</h4>
            <button className="text-sm text-primary-600 hover:text-primary-700">
              View Details
            </button>
          </div>
          <p className="text-sm text-gray-600">Monitor your account access</p>
        </div>
      </div>
      
      <div className="pt-6 border-t border-gray-200">
        <button className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors">
          Delete Account
        </button>
        <p className="text-sm text-gray-600 mt-2">
          Permanently delete your account and all associated data
        </p>
      </div>
    </div>
  );

  return (
    <div className="p-6">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Profile Settings</h1>
        <p className="text-gray-600 mt-2">Manage your account information and preferences</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
        {/* Sidebar */}
        <div className="lg:col-span-1">
          <nav className="space-y-2">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-3 text-left rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-primary-100 text-primary-700 border border-primary-200'
                    : 'text-gray-600 hover:bg-gray-100'
                }`}
              >
                <tab.icon className="h-5 w-5 mr-3" />
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Content */}
        <div className="lg:col-span-3">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {activeTab === 'personal' && <PersonalInfo />}
            {activeTab === 'notifications' && <NotificationSettings />}
            {activeTab === 'payment' && <PaymentMethods />}
            {activeTab === 'security' && <SecuritySettings />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
