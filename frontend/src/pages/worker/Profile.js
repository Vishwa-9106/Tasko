import React, { useState, useEffect } from 'react';
import { 
  User, 
  Camera, 
  MapPin, 
  Phone, 
  Mail, 
  Star,
  Edit3,
  Save,
  X
} from 'lucide-react';
import { authAPI, usersAPI } from '../../services/api';

const Profile = () => {
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [newSkill, setNewSkill] = useState('');
  const [profileData, setProfileData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    location: '',
    bio: '',
    skills: [],
    experience: '',
    rating: 0,
    completedJobs: 0,
    services: [],
    profilePhoto: ''
  });

  // Load user profile data on component mount
  useEffect(() => {
    const loadProfile = async () => {
      try {
        const user = JSON.parse(localStorage.getItem('user') || '{}');
        if (user) {
          setProfileData({
            firstName: user.firstName || '',
            lastName: user.lastName || '',
            email: user.email || '',
            phone: user.phone || '',
            location: user.location || '',
            bio: user.bio || '',
            skills: user.skills || [],
            experience: user.experience || 'New',
            profilePhoto: user.profilePhoto || '',
            rating: user.rating || 0,
            completedJobs: user.completedJobs || 0,
            services: user.services || []
          });
        }
      } catch (err) {
        setError('Failed to load profile data');
        console.error('Profile load error:', err);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleInputChange = (field, value) => {
    setProfileData(prev => ({
      ...prev,
      [field]: value
    }));
  };

  const handleSave = async () => {
    try {
      setLoading(true);
      
      // Create FormData for file upload
      const formData = new FormData();
      
      // Add basic profile fields
      formData.append('firstName', profileData.firstName);
      formData.append('lastName', profileData.lastName);
      formData.append('bio', profileData.bio);
      formData.append('location', profileData.location);
      formData.append('phone', profileData.phone);
      
      // Handle profile photo upload
      const fileInput = document.querySelector('input[type="file"]');
      if (fileInput && fileInput.files[0]) {
        formData.append('profilePhoto', fileInput.files[0]);
      }
      
      // Update backend with file upload support
      try {
        const response = await usersAPI.updateProfileWithPhoto(formData);
        
        // Update localStorage with response data
        const currentUser = JSON.parse(localStorage.getItem('user') || '{}');
        const updatedUser = { ...currentUser, ...response.user };
        localStorage.setItem('user', JSON.stringify(updatedUser));
        
        // Update local state with backend response
        setProfileData(prev => ({
          ...prev,
          profileImage: response.user.profileImage || prev.profilePhoto
        }));
        
      } catch (apiErr) {
        console.error('Backend update failed:', apiErr);
        setError('Failed to update profile on server');
        return;
      }
      
      setIsEditing(false);
      setNewSkill('');
    } catch (err) {
      setError('Failed to update profile');
      console.error('Profile update error:', err);
    } finally {
      setLoading(false);
    }
  };

  const addSkill = () => {
    if (newSkill.trim() && !profileData.skills.includes(newSkill.trim())) {
      handleInputChange('skills', [...profileData.skills, newSkill.trim()]);
      setNewSkill('');
    }
  };

  const removeSkill = (index) => {
    const newSkills = profileData.skills.filter((_, i) => i !== index);
    handleInputChange('skills', newSkills);
  };

  const handlePhotoUpload = (event) => {
    const file = event.target.files[0];
    if (file) {
      // Validate file type
      const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedTypes.includes(file.type)) {
        setError('Please select a valid image file (JPEG, PNG, GIF, or WebP)');
        return;
      }
      
      // Validate file size (5MB limit)
      if (file.size > 5 * 1024 * 1024) {
        setError('File size must be less than 5MB');
        return;
      }
      
      // Show preview
      const reader = new FileReader();
      reader.onload = (e) => {
        handleInputChange('profilePhoto', e.target.result);
      };
      reader.readAsDataURL(file);
      
      setError(''); // Clear any previous errors
    }
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        <span className="ml-2">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="p-6">
      {error && (
        <div className="mb-4 bg-red-50 border border-red-200 rounded-lg p-3">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}
      
      {/* Header */}
      <div className="flex justify-between items-center mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Profile</h1>
          <p className="text-gray-600 mt-2">Manage your professional profile and settings</p>
        </div>
        <button
          onClick={() => isEditing ? handleSave() : setIsEditing(true)}
          className="flex items-center px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
        >
          {isEditing ? (
            <>
              <Save className="h-4 w-4 mr-2" />
              Save Changes
            </>
          ) : (
            <>
              <Edit3 className="h-4 w-4 mr-2" />
              Edit Profile
            </>
          )}
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Profile Card */}
        <div className="lg:col-span-1">
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            {/* Profile Picture */}
            <div className="flex flex-col items-center mb-6">
              <div className="relative">
                {(profileData.profilePhoto || profileData.profileImage) ? (
                  <img
                    src={profileData.profilePhoto || (profileData.profileImage ? `http://localhost:5000${profileData.profileImage}` : '')}
                    alt="Profile"
                    className="w-24 h-24 rounded-full object-cover border-4 border-primary-100"
                  />
                ) : (
                  <div className="w-24 h-24 bg-primary-100 rounded-full flex items-center justify-center">
                    <User className="h-12 w-12 text-primary-600" />
                  </div>
                )}
                {isEditing && (
                  <label className="absolute bottom-0 right-0 bg-primary-600 text-white p-2 rounded-full hover:bg-primary-700 cursor-pointer">
                    <Camera className="h-4 w-4" />
                    <input
                      type="file"
                      accept="image/*"
                      onChange={handlePhotoUpload}
                      className="hidden"
                    />
                  </label>
                )}
              </div>
              <h2 className="text-xl font-semibold text-gray-900 mt-4">{profileData.firstName} {profileData.lastName}</h2>
              <p className="text-gray-600">Professional Worker</p>
            </div>

            {/* Stats */}
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Rating</span>
                <div className="flex items-center">
                  <Star className="h-4 w-4 text-yellow-500 mr-1" />
                  <span className="font-semibold">{profileData.rating}</span>
                </div>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Completed Jobs</span>
                <span className="font-semibold">{profileData.completedJobs}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-gray-600">Experience</span>
                <span className="font-semibold">{profileData.experience}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Profile Details */}
        <div className="lg:col-span-2 space-y-6">
          {/* Contact Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Contact Information</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Mail className="h-4 w-4 inline mr-2" />
                  Email
                </label>
                {isEditing ? (
                  <input
                    type="email"
                    value={profileData.email}
                    onChange={(e) => handleInputChange('email', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.email}</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <Phone className="h-4 w-4 inline mr-2" />
                  Phone
                </label>
                {isEditing ? (
                  <input
                    type="tel"
                    value={profileData.phone}
                    onChange={(e) => handleInputChange('phone', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.phone}</p>
                )}
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  <MapPin className="h-4 w-4 inline mr-2" />
                  Location
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    value={profileData.location}
                    onChange={(e) => handleInputChange('location', e.target.value)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.location}</p>
                )}
              </div>
            </div>
          </div>

          {/* Professional Information */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Professional Information</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Bio</label>
                {isEditing ? (
                  <textarea
                    value={profileData.bio}
                    onChange={(e) => handleInputChange('bio', e.target.value)}
                    rows={4}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                ) : (
                  <p className="text-gray-900">{profileData.bio}</p>
                )}
              </div>
            </div>
          </div>

          {/* Skills */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Skills & Services</h3>
            <div className="flex flex-wrap gap-2">
              {profileData.skills.map((skill, index) => (
                <span
                  key={index}
                  className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-100 text-primary-800"
                >
                  {skill}
                  {isEditing && (
                    <button
                      onClick={() => removeSkill(index)}
                      className="ml-2 text-primary-600 hover:text-primary-800"
                    >
                      <X className="h-3 w-3" />
                    </button>
                  )}
                </span>
              ))}
              {isEditing && (
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={newSkill}
                    onChange={(e) => setNewSkill(e.target.value)}
                    onKeyPress={(e) => e.key === 'Enter' && addSkill()}
                    placeholder="Enter skill"
                    className="px-3 py-1 border border-gray-300 rounded-full text-sm focus:ring-2 focus:ring-primary-500 focus:border-primary-500"
                  />
                  <button
                    onClick={addSkill}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm font-medium bg-primary-600 text-white hover:bg-primary-700"
                  >
                    + Add
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Profile;
