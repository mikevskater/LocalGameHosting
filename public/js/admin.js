// Admin API wrapper
class AdminAPI {
  constructor() {
    this.token = localStorage.getItem('adminToken');
  }

  async login(username, password) {
    try {
      const response = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed');
      }

      this.token = data.token;
      localStorage.setItem('adminToken', this.token);

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  logout() {
    this.token = null;
    localStorage.removeItem('adminToken');
  }

  async getStats() {
    try {
      const response = await fetch('/api/admin/stats', {
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

  async getUsers() {
    try {
      const response = await fetch('/api/admin/users', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get users');
      }

      return { success: true, users: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async deleteUser(userId) {
    try {
      const response = await fetch(`/api/admin/users/${userId}`, {
        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete user');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getConfig() {
    try {
      const response = await fetch('/api/admin/config', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get config');
      }

      return { success: true, config: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateConfig(config) {
    try {
      const response = await fetch('/api/admin/config', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(config)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update config');
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async getGames() {
    try {
      const response = await fetch('/api/admin/games', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get games');
      }

      return { success: true, games: data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async switchGame(gameId) {
    try {
      const response = await fetch('/api/admin/games/switch', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ gameId })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to switch game');
      }

      return { success: true, message: data.message };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const adminAPI = new AdminAPI();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  if (adminAPI.token) {
    // Try to load dashboard
    const statsResult = await adminAPI.getStats();
    if (statsResult.success) {
      showDashboard();
    } else {
      showLogin();
    }
  } else {
    showLogin();
  }

  setupEventHandlers();
});

function setupEventHandlers() {
  document.getElementById('admin-login-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const username = document.getElementById('admin-username').value;
    const password = document.getElementById('admin-password').value;

    const result = await adminAPI.login(username, password);

    if (result.success) {
      showDashboard();
    } else {
      showError('admin-login-error', result.error);
    }
  });
}

function showLogin() {
  document.getElementById('admin-login-screen').classList.remove('hidden');
  document.getElementById('admin-dashboard').classList.add('hidden');
}

function showDashboard() {
  document.getElementById('admin-login-screen').classList.add('hidden');
  document.getElementById('admin-dashboard').classList.remove('hidden');

  loadDashboardData();
}

async function loadDashboardData() {
  // Load stats
  const statsResult = await adminAPI.getStats();
  if (statsResult.success) {
    const stats = statsResult.stats;
    document.getElementById('stat-users').textContent = stats.totalUsers;
    document.getElementById('stat-game').textContent = stats.activeGame || 'None';
    document.getElementById('stat-uptime').textContent = formatUptime(stats.serverUptime);
  }

  // Load config
  const configResult = await adminAPI.getConfig();
  if (configResult.success) {
    const config = configResult.config;
    document.getElementById('config-port').value = config.server.port;
    document.getElementById('config-host').value = config.server.host;
  }

  // Load games
  loadGames();

  // Load users
  loadUsers();
}

async function loadGames() {
  const result = await adminAPI.getGames();

  if (result.success) {
    const gamesList = document.getElementById('games-list');

    if (result.games.length === 0) {
      gamesList.innerHTML = '<p>No games found. Add games to the games/ directory.</p>';
      return;
    }

    // Get current active game
    const statsResult = await adminAPI.getStats();
    const activeGame = statsResult.success ? statsResult.stats.activeGame : null;

    gamesList.innerHTML = result.games.map(game => {
      const isActive = game.id === activeGame;
      return `
        <div class="game-item ${isActive ? 'active' : ''}">
          <div class="game-info">
            <h3>${game.name || game.id} ${isActive ? '<span class="badge badge-success">ACTIVE</span>' : ''}</h3>
            <p>${game.description || 'No description'}</p>
          </div>
          <button class="btn btn-small btn-primary" onclick="switchGame('${game.id}')" ${isActive ? 'disabled' : ''}>
            ${isActive ? 'Current' : 'Switch To'}
          </button>
        </div>
      `;
    }).join('');
  } else {
    showError('game-error', result.error);
  }
}

async function loadUsers() {
  const result = await adminAPI.getUsers();

  if (result.success) {
    const usersList = document.getElementById('users-list');

    if (result.users.length === 0) {
      usersList.innerHTML = '<tr><td colspan="5" style="text-align: center;">No users yet</td></tr>';
      return;
    }

    usersList.innerHTML = result.users.map(user => `
      <tr>
        <td>${user.username}</td>
        <td style="color: ${user.name_color}">${user.nickname}</td>
        <td>${new Date(user.created_at).toLocaleDateString()}</td>
        <td>${user.last_login ? new Date(user.last_login).toLocaleDateString() : 'Never'}</td>
        <td>
          <button class="btn btn-small btn-danger" onclick="deleteUser(${user.id}, '${user.username}')">Delete</button>
        </td>
      </tr>
    `).join('');
  } else {
    showError('users-error', result.error);
  }
}

async function saveConfig() {
  const port = parseInt(document.getElementById('config-port').value);
  const host = document.getElementById('config-host').value;

  const result = await adminAPI.updateConfig({
    server: { port, host }
  });

  if (result.success) {
    showSuccess('config-success', result.message);
  } else {
    showError('config-error', result.error);
  }
}

async function switchGame(gameId) {
  const result = await adminAPI.switchGame(gameId);

  if (result.success) {
    showSuccess('game-success', result.message);
    loadGames();
    loadDashboardData();
  } else {
    showError('game-error', result.error);
  }
}

async function deleteUser(userId, username) {
  if (!confirm(`Are you sure you want to delete user "${username}"? This cannot be undone.`)) {
    return;
  }

  const result = await adminAPI.deleteUser(userId);

  if (result.success) {
    loadUsers();
    loadDashboardData();
  } else {
    showError('users-error', result.error);
  }
}

function adminLogout() {
  adminAPI.logout();
  showLogin();
}

// Utility functions
function formatUptime(seconds) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours}h ${minutes}m`;
  } else if (minutes > 0) {
    return `${minutes}m`;
  } else {
    return `${Math.floor(seconds)}s`;
  }
}

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');

  setTimeout(() => {
    element.classList.add('hidden');
  }, 5000);
}

function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');

  setTimeout(() => {
    element.classList.add('hidden');
  }, 5000);
}
