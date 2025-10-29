// Profile editing page logic

document.addEventListener('DOMContentLoaded', async () => {
  // Check authentication
  if (!gameAPI.isAuthenticated()) {
    window.location.href = '/';
    return;
  }

  // Load current profile
  const result = await gameAPI.getProfile();
  if (!result.success) {
    window.location.href = '/';
    return;
  }

  const user = result.user;

  // Populate form
  document.getElementById('edit-nickname').value = user.nickname;
  document.getElementById('edit-name-color').value = user.nameColor;
  document.getElementById('edit-player-color').value = user.playerColor;

  // Show current picture if exists
  if (user.profilePicture) {
    document.getElementById('current-picture').innerHTML = `
      <p>Current picture:</p>
      <img src="${user.profilePicture}" alt="Profile" style="max-width: 150px; border-radius: 8px;">
    `;
  }

  // Setup form handler
  document.getElementById('profile-form').addEventListener('submit', async (e) => {
    e.preventDefault();

    const nickname = document.getElementById('edit-nickname').value;
    const nameColor = document.getElementById('edit-name-color').value;
    const playerColor = document.getElementById('edit-player-color').value;

    // Update profile
    const updateResult = await gameAPI.updateProfile({ nickname, nameColor, playerColor });

    if (updateResult.success) {
      // Upload picture if selected
      const pictureFile = document.getElementById('edit-picture').files[0];
      if (pictureFile) {
        const uploadResult = await gameAPI.uploadProfilePicture(pictureFile);
        if (!uploadResult.success) {
          showError('profile-error', 'Profile updated but picture upload failed: ' + uploadResult.error);
          return;
        }
      }

      showSuccess('profile-success', 'Profile updated successfully!');
      setTimeout(() => {
        window.location.href = '/play';
      }, 1500);
    } else {
      showError('profile-error', updateResult.error);
    }
  });
});

function showError(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');
}

function showSuccess(elementId, message) {
  const element = document.getElementById(elementId);
  element.textContent = message;
  element.classList.remove('hidden');
}
