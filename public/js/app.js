// UI State Management
let currentScreen = 'auth';

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
  // Check if user is already logged in
  if (gameAPI.isAuthenticated()) {
    const result = await gameAPI.getProfile();
    if (result.success) {
      showGameScreen(result.user);
    } else {
      showAuthScreen();
    }
  } else {
    showAuthScreen();
  }

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
      showGameScreen(result.user);
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

  // Profile form
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nickname = document.getElementById('edit-nickname').value;
    const nameColor = document.getElementById('edit-name-color').value;
    const playerColor = document.getElementById('edit-player-color').value;

    // Update profile
    const result = await gameAPI.updateProfile({ nickname, nameColor, playerColor });

    if (result.success) {
      // Upload picture if selected
      const pictureFile = document.getElementById('edit-picture').files[0];
      if (pictureFile) {
        const uploadResult = await gameAPI.uploadProfilePicture(pictureFile);
        if (uploadResult.success) {
          result.user.profilePicture = uploadResult.picturePath;
        }
      }

      showSuccess('profile-success', 'Profile updated successfully!');
      setTimeout(() => {
        hideProfileEdit();
        showGameScreen(result.user);
      }, 1500);
    } else {
      showError('profile-error', result.error);
    }
  });
}

// Screen switching functions
function showAuthScreen() {
  document.getElementById('auth-screen').classList.remove('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('profile-edit-screen').classList.add('hidden');
  currentScreen = 'auth';
}

function showGameScreen(user) {
  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.remove('hidden');
  document.getElementById('profile-edit-screen').classList.add('hidden');
  currentScreen = 'game';

  // Update profile display
  document.getElementById('welcome-message').textContent = `Welcome back, ${user.nickname}!`;
  document.getElementById('profile-nickname').textContent = user.nickname;
  document.getElementById('profile-nickname').style.color = user.nameColor;
  document.getElementById('profile-username').textContent = `@${user.username}`;

  // Update profile picture
  const profilePic = document.getElementById('profile-pic');
  if (user.profilePicture) {
    profilePic.innerHTML = `<img src="${user.profilePicture}" alt="Profile">`;
  } else {
    const initial = user.nickname.charAt(0).toUpperCase();
    profilePic.innerHTML = `<span id="profile-initial">${initial}</span>`;
    profilePic.style.background = user.playerColor;
  }
}

function showProfileEdit() {
  const user = gameAPI.getUser();

  document.getElementById('auth-screen').classList.add('hidden');
  document.getElementById('game-screen').classList.add('hidden');
  document.getElementById('profile-edit-screen').classList.remove('hidden');
  currentScreen = 'profile-edit';

  // Populate form with current values
  document.getElementById('edit-nickname').value = user.nickname;
  document.getElementById('edit-name-color').value = user.nameColor;
  document.getElementById('edit-player-color').value = user.playerColor;

  // Clear any previous messages
  hideMessage('profile-error');
  hideMessage('profile-success');
}

function hideProfileEdit() {
  const user = gameAPI.getUser();
  showGameScreen(user);
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

// Logout
function logout() {
  gameAPI.logout();
  showAuthScreen();
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
