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
  addMediaItem: (mediaData) => 
    apiCall('/media', {
      method: 'POST',
      body: JSON.stringify(mediaData),
    }),

  // Update media tracking
  updateTracking: (mediaId, trackingData) =>
    apiCall(`/media/${mediaId}/tracking`, {
      method: 'PUT',
      body: JSON.stringify(trackingData),
    }),

  // Get statistics
  getStats: () => apiCall('/stats'),

  // Health check
  healthCheck: () => apiCall('/health'),
};