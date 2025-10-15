const API_BASE = '/api';

interface MediaData {
  title: string;
  mediaType: 'movie' | 'tv_show' | 'book';
  description?: string;
  author?: string;
  director?: string;
  genres?: string;
  status?: 'to_watch' | 'watching' | 'completed' | 'on_hold' | 'dropped';
  rating?: number | null | '';
  notes?: string;
  progress?: number;
}

interface TrackingData {
  status?: 'to_watch' | 'watching' | 'completed' | 'on_hold' | 'dropped';
  rating?: number | null | '';
  notes?: string;
  progress?: number;
}

const apiCall = async <T>(endpoint: string, options: RequestInit = {}): Promise<T> => {
  const url = `${API_BASE}${endpoint}`;
  const config: RequestInit = {
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

export const mediaAPI = {
  getMediaItems: () => apiCall<unknown[]>('/media'),

  addMediaItem: (mediaData: MediaData) => {
    const cleanedData = { ...mediaData };
    if (cleanedData.rating === '') {
      cleanedData.rating = null;
    }
    if (cleanedData.notes == null || cleanedData.notes === '') {
      delete cleanedData.notes;
    }
    
    return apiCall<unknown>('/media', {
      method: 'POST',
      body: JSON.stringify(cleanedData),
    });
  },

  updateTracking: (mediaId: number, trackingData: TrackingData) => {
    const cleanedData = { ...trackingData };
    if (cleanedData.rating === '') {
      cleanedData.rating = null;
    }
    if (cleanedData.notes == null || cleanedData.notes === '') {
      delete cleanedData.notes;
    }
    
    return apiCall<unknown>(`/media/${mediaId}/tracking`, {
      method: 'PUT',
      body: JSON.stringify(cleanedData),
    });
  },

  getStats: () => apiCall<unknown>('/stats'),

  healthCheck: () => apiCall<{ status: string; timestamp: string }>('/health'),
};
