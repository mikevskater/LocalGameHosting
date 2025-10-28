/**
 * GameAPI - Client-side library for interacting with the game hosting service
 * Provides authentication, stats, and real-time multiplayer features
 */

class GameAPI {
  constructor() {
    this.token = null;
    this.user = null;
    this.socket = null;
    this.gameId = null;
    this.eventHandlers = new Map();

    // Load token from localStorage
    this.token = localStorage.getItem('gameToken');

    // Initialize socket connection
    this.initSocket();
  }

  // ==================== Authentication ====================

  async register(username, password, nickname) {
    try {
      const response = await fetch('/api/user/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password, nickname: nickname || username })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Registration failed');
      }

      return { success: true, userId: data.userId };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async login(username, password) {
    try {
      const response = await fetch('/api/user/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      // Store token and user data
      this.token = data.token;
      this.user = data.user;
      localStorage.setItem('gameToken', this.token);

      // Authenticate socket connection
      if (this.socket && this.socket.connected) {
        this.socket.emit('authenticate', this.token);
      }

      return { success: true, user: this.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  logout() {
    this.token = null;
    this.user = null;
    localStorage.removeItem('gameToken');

    if (this.socket) {
      this.socket.disconnect();
    }

    return { success: true };
  }

  async getProfile() {
    try {
      const response = await fetch('/api/user/profile', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get profile');
      }

      this.user = data;
      return { success: true, user: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateProfile(updates) {
    try {
      const response = await fetch('/api/user/profile', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(updates)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update profile');
      }

      this.user = data.user;
      return { success: true, user: data.user };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async uploadProfilePicture(file) {
    try {
      const formData = new FormData();
      formData.append('picture', file);

      const response = await fetch('/api/user/profile/picture', {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${this.token}` },
        body: formData
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to upload picture');
      }

      return { success: true, picturePath: data.picturePath };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  getUser() {
    return this.user;
  }

  isAuthenticated() {
    return this.token !== null;
  }

  // ==================== Game Stats ====================

  async saveGameStat(key, value) {
    try {
      const response = await fetch('/api/game/stats/save', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ statKey: key, statValue: value })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to save stat');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getGameStat(key) {
    try {
      const response = await fetch(`/api/game/stats/${key}`, {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get stat');
      }

      return { success: true, value: data.value };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getAllGameStats() {
    try {
      const response = await fetch('/api/game/stats', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get stats');
      }

      return { success: true, stats: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getLeaderboard(statKey, limit = 10) {
    try {
      const response = await fetch(`/api/game/leaderboard/${statKey}?limit=${limit}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get leaderboard');
      }

      return { success: true, leaderboard: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getUserStats(userId) {
    try {
      const response = await fetch(`/api/game/stats/user/${userId}`);
      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get user stats');
      }

      return { success: true, user: data.user, stats: data.stats };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  // ==================== Real-time Multiplayer ====================

  initSocket() {
    this.socket = io();

    this.socket.on('connect', () => {
      console.log('Connected to server');

      // Authenticate if we have a token
      if (this.token) {
        this.socket.emit('authenticate', this.token);
      }
    });

    this.socket.on('authenticated', (data) => {
      if (data.success) {
        console.log('Socket authenticated');
        this.user = data.user;
      } else {
        console.error('Socket authentication failed:', data.error);
      }
    });

    this.socket.on('game-event', (data) => {
      // Trigger registered event handlers
      const handlers = this.eventHandlers.get(data.event) || [];
      handlers.forEach(handler => handler(data.data, data.user));
    });

    this.socket.on('user-connected', (user) => {
      const handlers = this.eventHandlers.get('user-connected') || [];
      handlers.forEach(handler => handler(user));
    });

    this.socket.on('user-disconnected', (user) => {
      const handlers = this.eventHandlers.get('user-disconnected') || [];
      handlers.forEach(handler => handler(user));
    });

    this.socket.on('disconnect', () => {
      console.log('Disconnected from server');
    });
  }

  emit(event, data) {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('game-event', { event, data });
    return true;
  }

  emitTo(userId, event, data) {
    if (!this.socket || !this.socket.connected) {
      console.error('Socket not connected');
      return false;
    }

    this.socket.emit('game-event-to', { userId, event, data });
    return true;
  }

  on(event, callback) {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event).push(callback);
  }

  off(event, callback) {
    if (!this.eventHandlers.has(event)) return;

    const handlers = this.eventHandlers.get(event);
    const index = handlers.indexOf(callback);
    if (index !== -1) {
      handlers.splice(index, 1);
    }
  }

  async getConnectedUsers() {
    return new Promise((resolve) => {
      if (!this.socket || !this.socket.connected) {
        resolve([]);
        return;
      }

      this.socket.emit('get-connected-users');
      this.socket.once('connected-users', (users) => {
        resolve(users);
      });
    });
  }
}

// Create global instance
const gameAPI = new GameAPI();
