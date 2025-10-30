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
        // If unauthorized, clear token
        if (response.status === 401) {
          this.logout();
        }
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
        // If unauthorized, clear token
        if (response.status === 401) {
          this.logout();
        }
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
        // If unauthorized, clear token
        if (response.status === 401) {
          this.logout();
        }
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

  async getGameSettings() {
    try {
      const response = await fetch('/api/admin/game-settings', {
        headers: { 'Authorization': `Bearer ${this.token}` }
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to get game settings');
      }

      return { success: true, ...data };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async updateGameSetting(settingKey, value) {
    try {
      const response = await fetch(`/api/admin/game-settings/${settingKey}`, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify({ value })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update setting');
      }

      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }

  async executeGameAction(action, params = {}) {
    try {
      const response = await fetch(`/api/admin/game-action/${action}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${this.token}`
        },
        body: JSON.stringify(params)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to execute action');
      }

      return { success: true, result: data.result };
    } catch (error) {
      return { success: false, error: error.message };
    }
  }
}

const adminAPI = new AdminAPI();

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  if (adminAPI.token) {
    // Try to validate token by getting stats
    const statsResult = await adminAPI.getStats();
    if (statsResult.success) {
      showDashboard();
    } else {
      // Token is invalid or expired, clear it and show login
      adminAPI.logout();
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

  // Load dynamic game settings
  loadGameSettings();

  // Start stats polling
  startStatsPolling();
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

    // Reload game settings for new game
    setTimeout(() => loadGameSettings(), 1500);
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

// ========== DYNAMIC GAME SETTINGS ==========

async function loadGameSettings() {
  const result = await adminAPI.getGameSettings();

  const container = document.getElementById('game-settings-container');
  if (!container) return;

  if (!result.success || !result.schema) {
    // No settings for this game
    container.innerHTML = '<p style="opacity: 0.6; text-align: center;">This game has no admin settings.</p>';
    return;
  }

  renderGameSettings(result.schema, result.state, result.stats);
}

function renderGameSettings(schema, state, stats) {
  const container = document.getElementById('game-settings-container');
  container.innerHTML = '';

  schema.sections.forEach(section => {
    const sectionDiv = document.createElement('div');
    sectionDiv.className = 'settings-section';
    sectionDiv.innerHTML = `
      <h3>${section.title}</h3>
      ${section.description ? `<p class="section-description">${section.description}</p>` : ''}
      <div class="controls-container" id="section-${section.id}"></div>
    `;
    container.appendChild(sectionDiv);

    const controlsContainer = document.getElementById(`section-${section.id}`);

    section.controls.forEach(control => {
      const controlElement = renderControl(control, state, stats);
      controlsContainer.appendChild(controlElement);
    });
  });
}

function renderControl(control, state, stats) {
  const wrapper = document.createElement('div');
  wrapper.className = 'control-item';

  switch (control.type) {
    case 'button':
      wrapper.innerHTML = `
        <button
          class="btn btn-${control.style || 'primary'}"
          onclick="executeGameAction('${control.action}', ${control.requiresConfirm || false}, '${control.confirmMessage || ''}')"
          style="width: auto; padding: 12px 24px;"
        >
          ${control.label}
        </button>
      `;
      break;

    case 'number':
      const numValue = state[control.settingKey] ?? control.default;
      wrapper.innerHTML = `
        <label>${control.label}</label>
        <input
          type="number"
          value="${numValue}"
          min="${control.min ?? ''}"
          max="${control.max ?? ''}"
          onchange="updateGameSetting('${control.settingKey}', parseInt(this.value))"
        />
      `;
      break;

    case 'text':
      const textValue = state[control.settingKey] ?? control.default ?? '';
      wrapper.innerHTML = `
        <label>${control.label}</label>
        <input
          type="text"
          value="${textValue}"
          onchange="updateGameSetting('${control.settingKey}', this.value)"
        />
      `;
      break;

    case 'checkbox':
      const checked = state[control.settingKey] ?? control.default ?? false;
      wrapper.innerHTML = `
        <label style="display: flex; align-items: center; gap: 10px;">
          <input
            type="checkbox"
            ${checked ? 'checked' : ''}
            onchange="updateGameSetting('${control.settingKey}', this.checked)"
          />
          <span>${control.label}</span>
        </label>
      `;
      break;

    case 'select':
      const selectValue = state[control.settingKey] ?? control.default;
      wrapper.innerHTML = `
        <label>${control.label}</label>
        <select onchange="updateGameSetting('${control.settingKey}', this.value)">
          ${control.options.map(opt =>
            `<option value="${opt.value}" ${opt.value === selectValue ? 'selected' : ''}>${opt.label}</option>`
          ).join('')}
        </select>
      `;
      break;

    case 'range':
      const rangeValue = state[control.settingKey] ?? control.default;
      wrapper.innerHTML = `
        <label>${control.label}: <span id="range-${control.id}" style="font-weight: 700; color: #667eea;">${rangeValue}</span></label>
        <input
          type="range"
          value="${rangeValue}"
          min="${control.min ?? 0}"
          max="${control.max ?? 100}"
          step="${control.step || 1}"
          oninput="document.getElementById('range-${control.id}').textContent = this.value"
          onchange="updateGameSetting('${control.settingKey}', parseInt(this.value))"
          style="width: 100%;"
        />
      `;
      break;

    case 'stat':
      const statValue = stats[control.statKey] ?? 'N/A';
      wrapper.innerHTML = `
        <div class="stat-display">
          <span class="stat-label">${control.label}:</span>
          <span class="stat-value" id="stat-${control.id}" data-key="${control.statKey}">${statValue}</span>
        </div>
      `;
      break;

    default:
      wrapper.innerHTML = `<p style="color: red;">Unknown control type: ${control.type}</p>`;
  }

  return wrapper;
}

async function updateGameSetting(settingKey, value) {
  const result = await adminAPI.updateGameSetting(settingKey, value);
  if (result.success) {
    console.log('Setting updated:', settingKey, value);
  } else {
    alert('Error updating setting: ' + result.error);
  }
}

async function executeGameAction(action, requiresConfirm, confirmMessage) {
  if (requiresConfirm && !confirm(confirmMessage || 'Are you sure?')) {
    return;
  }

  const result = await adminAPI.executeGameAction(action);
  if (result.success) {
    console.log('Action executed:', action);
    // Refresh settings to update stats
    setTimeout(() => loadGameSettings(), 500);
  } else {
    alert('Error executing action: ' + result.error);
  }
}

// Real-time stats polling
let statsPollingInterval = null;

function startStatsPolling() {
  // Clear any existing interval
  if (statsPollingInterval) {
    clearInterval(statsPollingInterval);
  }

  // Poll every 2 seconds
  statsPollingInterval = setInterval(async () => {
    const container = document.getElementById('game-settings-container');
    if (!container || container.children.length === 0) {
      return; // No settings loaded
    }

    const result = await adminAPI.getGameSettings();
    if (result.success && result.stats) {
      updateStatsDisplay(result.stats);
    }
  }, 2000);
}

function stopStatsPolling() {
  if (statsPollingInterval) {
    clearInterval(statsPollingInterval);
    statsPollingInterval = null;
  }
}

function updateStatsDisplay(stats) {
  Object.keys(stats).forEach(statKey => {
    const statElements = document.querySelectorAll(`[data-key="${statKey}"]`);
    statElements.forEach(el => {
      el.textContent = stats[statKey];
    });
  });
}
