const API_BASE = '/api';

// Helper function for API calls
const apiCall = async (endpoint, options = {}) => {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    headers: {
      'Content-Type': 'application/json',
    },
    ...options,
  };

  try {
    const response = await fetch(url, config);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('API call failed:', error);
    throw error;
  }
};

// Media API methods
export const mediaAPI = {
  // Get all media items
  getMediaItems: () => apiCall('/media'),

  // Add new media item
  addMediaItem: (mediaData) => {
    // Fix rating validation: remove empty/null ratings completely
    const cleanedData = { ...mediaData };
    if (cleanedData.rating == null || cleanedData.rating === '') {
      delete cleanedData.rating;
    }
    if (cleanedData.notes == null || cleanedData.notes === '') {
      delete cleanedData.notes;
    }
    
    return apiCall('/media', {
      method: 'POST',
      body: JSON.stringify(cleanedData),
    });
  },

  // Update media tracking
  updateTracking: (mediaId, trackingData) => {
    // Fix rating validation: remove empty/null ratings completely
    const cleanedData = { ...trackingData };
    if (cleanedData.rating == null || cleanedData.rating === '') {
      delete cleanedData.rating;
    }
    if (cleanedData.notes == null || cleanedData.notes === '') {
      delete cleanedData.notes;
    }
    
    return apiCall(`/media/${mediaId}/tracking`, {
      method: 'PUT',
      body: JSON.stringify(cleanedData),
    });
  },

  // Get statistics
  getStats: () => apiCall('/stats'),

  // Health check
  healthCheck: () => apiCall('/health'),
};