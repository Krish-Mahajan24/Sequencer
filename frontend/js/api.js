/**
 * Sequencer REST API Client
 * Connects Frontend with Backend & MongoDB Atlas
 */
(function () {
  'use strict';

  const TOKEN_KEY = 'sequencer_token';

  function getBaseUrl() {
    if (window.SEQUENCER_CONFIG && typeof window.SEQUENCER_CONFIG.getBaseUrl === 'function') {
      return window.SEQUENCER_CONFIG.getBaseUrl();
    }
    return 'http://localhost:5050/api';
  }

  function getToken() {
    try {
      return localStorage.getItem(TOKEN_KEY) || null;
    } catch {
      return null;
    }
  }

  function setToken(token) {
    try {
      if (token) {
        localStorage.setItem(TOKEN_KEY, token);
      } else {
        localStorage.removeItem(TOKEN_KEY);
      }
    } catch (e) {
      console.warn('Failed to save token to localStorage:', e);
    }
  }

  async function request(endpoint, options = {}) {
    const url = `${getBaseUrl()}${endpoint}`;
    const token = getToken();

    const headers = {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const error = new Error(data.message || `Request failed with status ${response.status}`);
        error.status = response.status;
        error.data = data;
        throw error;
      }

      return data;
    } catch (err) {
      // Don't crash caller on network failure; log and propagate error
      if (!err.status) {
        console.warn(`[Sequencer API] Network error when connecting to ${url}:`, err.message);
      }
      throw err;
    }
  }

  window.SequencerAPI = {
    getBaseUrl,
    getToken,
    setToken,

    // Authentication Endpoints
    auth: {
      async linkProvider(provider, challenge) {
        return request('/auth/' + provider + '/link', { method: 'POST', body: JSON.stringify({ challenge }) });
      },
      async exchangeOAuth(data) {
        const result = await request('/auth/oauth/exchange', { method: 'POST', body: JSON.stringify(data) });
        if (result.token) setToken(result.token);
        return result;
      },
      async signup(data) {
        const res = await request('/auth/signup', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.token) setToken(res.token);
        return res;
      },

      async login(data) {
        const res = await request('/auth/login', {
          method: 'POST',
          body: JSON.stringify(data),
        });
        if (res.token) setToken(res.token);
        return res;
      },

      async getMe() {
        return await request('/auth/me', { method: 'GET' });
      },

      async updateProfile(data) {
        return await request('/auth/profile', {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      },

      async changePassword(data) {
        return await request('/auth/password', {
          method: 'PUT',
          body: JSON.stringify(data),
        });
      },

      async deleteAccount() {
        const res = await request('/auth/account', { method: 'DELETE' });
        setToken(null);
        return res;
      },

      logout() {
        setToken(null);
      },
    },

    // Tracks Endpoints
    tracks: {
      async getAll() {
        const res = await request('/tracks', { method: 'GET' });
        return res.data || [];
      },

      async create(track) {
        return await request('/tracks', {
          method: 'POST',
          body: JSON.stringify(track),
        });
      },

      async update(id, track) {
        return await request(`/tracks/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(track),
        });
      },

      async toggleLike(id, trackData) {
        return await request(`/tracks/${encodeURIComponent(id)}/like`, {
          method: 'PATCH',
          body: JSON.stringify(trackData || {}),
        });
      },

      async delete(id) {
        return await request(`/tracks/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      },

      async batchSync(tracks) {
        return await request('/tracks/batch', {
          method: 'POST',
          body: JSON.stringify({ tracks }),
        });
      },
    },

    // Playlists Endpoints
    playlists: {
      async getAll() {
        const res = await request('/playlists', { method: 'GET' });
        return res.data || [];
      },

      async create(playlist) {
        return await request('/playlists', {
          method: 'POST',
          body: JSON.stringify(playlist),
        });
      },

      async update(id, playlist) {
        return await request(`/playlists/${encodeURIComponent(id)}`, {
          method: 'PUT',
          body: JSON.stringify(playlist),
        });
      },

      async delete(id) {
        return await request(`/playlists/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      },

      async batchSync(playlists) {
        return await request('/playlists/batch', {
          method: 'POST',
          body: JSON.stringify({ playlists }),
        });
      },
    },

    // Sequences Endpoints
    sequences: {
      async getAll() {
        const res = await request('/sequences', { method: 'GET' });
        return res.data || [];
      },

      async create(sequence) {
        return await request('/sequences', {
          method: 'POST',
          body: JSON.stringify(sequence),
        });
      },

      async delete(id) {
        return await request(`/sequences/${encodeURIComponent(id)}`, {
          method: 'DELETE',
        });
      },

      async batchSync(sequences) {
        return await request('/sequences/batch', {
          method: 'POST',
          body: JSON.stringify({ sequences }),
        });
      },
    },

    // History Endpoints
    history: {
      async getAll() {
        const res = await request('/history', { method: 'GET' });
        return res.data || [];
      },

      async add(entry) {
        return await request('/history', {
          method: 'POST',
          body: JSON.stringify(entry),
        });
      },

      async clear() {
        return await request('/history', { method: 'DELETE' });
      },

      async batchSync(history) {
        return await request('/history/batch', {
          method: 'POST',
          body: JSON.stringify({ history }),
        });
      },
    },

    // Sync helper to dispatch cloud writes based on resource key
    async syncToCloud(resourceName, data) {
      if (!getToken()) throw new Error('Please sign in to save your data.');
      const resources = { library: this.tracks, playlists: this.playlists, sequences: this.sequences, history: this.history };
      if (resources[resourceName]) return resources[resourceName].batchSync(data);
    },

    // Load initial data from MongoDB Atlas into local store
    async pullFromCloud() {
      if (!getToken()) throw new Error('Please sign in to load your data.');
      const [library, playlists, sequences, history] = await Promise.all([
        this.tracks.getAll(), this.playlists.getAll(), this.sequences.getAll(), this.history.getAll(),
      ]);
      return { library, playlists, sequences, history };
    },
  };
})();
