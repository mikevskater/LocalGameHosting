// Authentication page logic - handles login/register and auto-redirect

// Check for auto-login on page load
document.addEventListener('DOMContentLoaded', async () => {
  // If user is already logged in, redirect to game
  if (gameAPI.isAuthenticated()) {
    const result = await gameAPI.getProfile();
    if (result.success) {
      // Redirect to game
      window.location.href = '/play';
      return;
    } else {
      // Token invalid, clear it
      gameAPI.logout();
    }
  }

  // Show auth screen
  setupEventHandlers();
});

// Setup event handlers
function setupEventHandlers() {
  // Login form
  document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('login-username').value;
    const password = document.getElementById('login-password').value;

    const result = await gameAPI.login(username, password);

    if (result.success) {
      // Redirect to game
      window.location.href = '/play';
    } else {
      showError('login-error', result.error);
    }
  });

  // Register form
  document.getElementById('register-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const username = document.getElementById('register-username').value;
    const password = document.getElementById('register-password').value;
    const nickname = document.getElementById('register-nickname').value;

    const result = await gameAPI.register(username, password, nickname);

    if (result.success) {
      showSuccess('register-success', 'Registration successful! Please login.');
      // Clear form
      document.getElementById('register-form').reset();
      // Switch to login tab
      setTimeout(() => switchTab('login'), 1500);
    } else {
      showError('register-error', result.error);
    }
  });
}

// Tab switching
function switchTab(tab) {
  // Update buttons
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  event.target.classList.add('active');

  // Update content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });
  document.getElementById(`${tab}-tab`).classList.add('active');

  // Clear any error messages
  hideMessage('login-error');
  hideMessage('register-error');
  hideMessage('register-success');
}

// Error/Success message helpers
function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');

  setTimeout(() => {
    hideMessage(elementId);
  }, 5000);
}

function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');

  setTimeout(() => {
    hideMessage(elementId);
  }, 5000);
}

function hideMessage(elementId) {
  const element = document.getElementById(elementId);
  element.classList.add('hidden');
}
