// Game overlay - Floating profile menu injected into all game pages

(function() {
  // Only inject if user is authenticated
  if (!gameAPI || !gameAPI.isAuthenticated()) {
    return;
  }

  // Create overlay HTML
  const overlayHTML = `
    <div id="game-overlay" style="position: fixed; top: 20px; right: 20px; z-index: 999999;">
      <button id="profile-button" style="
        width: 50px;
        height: 50px;
        border-radius: 50%;
        border: 3px solid white;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        color: white;
        font-size: 24px;
        cursor: pointer;
        box-shadow: 0 4px 15px rgba(0, 0, 0, 0.3);
        transition: all 0.3s;
        display: flex;
        align-items: center;
        justify-content: center;
        overflow: hidden;
        padding: 0;
      ">
        <span id="profile-initial" style="font-weight: bold;">?</span>
      </button>

      <div id="profile-menu" style="
        display: none;
        position: absolute;
        top: 60px;
        right: 0;
        background: white;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.3);
        min-width: 250px;
        overflow: hidden;
      ">
        <div style="
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          padding: 20px;
          text-align: center;
        ">
          <div id="menu-profile-pic" style="
            width: 60px;
            height: 60px;
            border-radius: 50%;
            margin: 0 auto 10px;
            background: rgba(255, 255, 255, 0.2);
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 1.5rem;
            font-weight: bold;
            overflow: hidden;
          ">
            <span id="menu-profile-initial">?</span>
          </div>
          <div id="menu-nickname" style="font-weight: bold; font-size: 1.1rem; margin-bottom: 5px;">Loading...</div>
          <div id="menu-username" style="opacity: 0.9; font-size: 0.9rem;">@username</div>
        </div>

        <div style="padding: 10px;">
          <button onclick="window.gameOverlay.editProfile()" style="
            width: 100%;
            padding: 12px;
            border: none;
            background: #f0f0f0;
            border-radius: 6px;
            cursor: pointer;
            margin-bottom: 8px;
            font-size: 1rem;
            transition: background 0.3s;
          " onmouseover="this.style.background='#e0e0e0'" onmouseout="this.style.background='#f0f0f0'">
            Edit Profile
          </button>

          <button onclick="window.gameOverlay.logout()" style="
            width: 100%;
            padding: 12px;
            border: none;
            background: #fee;
            color: #c33;
            border-radius: 6px;
            cursor: pointer;
            font-size: 1rem;
            font-weight: 600;
            transition: background 0.3s;
          " onmouseover="this.style.background='#fdd'" onmouseout="this.style.background='#fee'">
            Logout
          </button>
        </div>
      </div>
    </div>
  `;

  // Inject into page
  document.addEventListener('DOMContentLoaded', async () => {
    document.body.insertAdjacentHTML('beforeend', overlayHTML);

    // Load user profile
    const result = await gameAPI.getProfile();
    if (result.success) {
      const user = result.user;

      // Update profile button
      const profileButton = document.getElementById('profile-button');
      if (user.profilePicture) {
        profileButton.innerHTML = `<img src="${user.profilePicture}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        const initial = user.nickname.charAt(0).toUpperCase();
        document.getElementById('profile-initial').textContent = initial;
        profileButton.style.background = user.playerColor;
      }

      // Update menu
      if (user.profilePicture) {
        document.getElementById('menu-profile-pic').innerHTML = `<img src="${user.profilePicture}" alt="Profile" style="width: 100%; height: 100%; object-fit: cover;">`;
      } else {
        const initial = user.nickname.charAt(0).toUpperCase();
        document.getElementById('menu-profile-initial').textContent = initial;
        document.getElementById('menu-profile-pic').style.background = user.playerColor;
      }

      document.getElementById('menu-nickname').textContent = user.nickname;
      document.getElementById('menu-nickname').style.color = user.nameColor;
      document.getElementById('menu-username').textContent = `@${user.username}`;
    }

    // Toggle menu on button click
    document.getElementById('profile-button').addEventListener('click', (e) => {
      e.stopPropagation();
      const menu = document.getElementById('profile-menu');
      menu.style.display = menu.style.display === 'none' ? 'block' : 'none';
    });

    // Close menu when clicking outside
    document.addEventListener('click', (e) => {
      const overlay = document.getElementById('game-overlay');
      const menu = document.getElementById('profile-menu');
      if (overlay && !overlay.contains(e.target)) {
        menu.style.display = 'none';
      }
    });
  });

  // Global functions for menu actions
  window.gameOverlay = {
    editProfile: function() {
      window.location.href = '/profile.html';
    },
    logout: function() {
      if (confirm('Are you sure you want to logout?')) {
        gameAPI.logout();
        window.location.href = '/';
      }
    }
  };
})();
