let currentUser = null;
let voteState = null;
let countdownInterval = null;

// Initialize
document.addEventListener('DOMContentLoaded', async () => {
  // Get user profile
  const profileResult = await gameAPI.getProfile();
  if (!profileResult.success) {
    window.location.href = '/';
    return;
  }

  currentUser = profileResult.user;

  // Listen for vote state updates
  gameAPI.on('vote-state', (data) => {
    voteState = data;
    renderVoteState();
  });

  gameAPI.on('timer-update', (data) => {
    if (voteState) {
      voteState.timeRemaining = data.timeRemaining;
      updateTimer();
    }
  });

  gameAPI.on('time-added', (data) => {
    showTimeAddedNotification(data.addedTime);
  });

  gameAPI.on('tie-breaker', (data) => {
    voteState.round = data.round;
    voteState.timeRemaining = data.timeRemaining;
    voteState.gameOptions = data.tiedGames;
    showTieBreakerScreen();
    renderVoteState();
  });

  gameAPI.on('vote-complete', (data) => {
    showResultsScreen(data.winner);
  });

  gameAPI.on('vote-cancelled', (data) => {
    alert(data.reason);
    showWaitingScreen();
  });

  gameAPI.on('game-switched', (data) => {
    // Auto-refresh to new game
    console.log(`Game switching to: ${data.newGame}`);
    setTimeout(() => {
      window.location.reload();
    }, 500);
  });

  console.log('Democracy vote initialized');
});

function renderVoteState() {
  if (!voteState || !voteState.active) {
    showWaitingScreen();
    return;
  }

  showVotingScreen();
  updateRoundInfo();
  updateTimer();
  updateStats();
  renderGameCards();
}

function showWaitingScreen() {
  document.getElementById('waiting-screen').style.display = 'block';
  document.getElementById('voting-screen').style.display = 'none';
  document.getElementById('results-screen').style.display = 'none';
}

function showVotingScreen() {
  document.getElementById('waiting-screen').style.display = 'none';
  document.getElementById('voting-screen').style.display = 'block';
  document.getElementById('results-screen').style.display = 'none';
}

function showTieBreakerScreen() {
  document.getElementById('tie-breaker-banner').style.display = 'block';
}

function showResultsScreen(winnerGameId) {
  document.getElementById('waiting-screen').style.display = 'none';
  document.getElementById('voting-screen').style.display = 'none';
  document.getElementById('results-screen').style.display = 'block';

  document.getElementById('winner-name').textContent = formatGameName(winnerGameId);

  // Countdown timer
  let countdown = 5;
  document.getElementById('countdown').textContent = countdown;

  if (countdownInterval) clearInterval(countdownInterval);
  countdownInterval = setInterval(() => {
    countdown--;
    document.getElementById('countdown').textContent = countdown;
    if (countdown <= 0) {
      clearInterval(countdownInterval);
    }
  }, 1000);
}

function updateRoundInfo() {
  const roundText = voteState.round > 1
    ? `Tie-Breaker Round ${voteState.round}`
    : 'Round 1';
  document.getElementById('round-info').textContent = roundText;
}

function updateTimer() {
  const timerEl = document.getElementById('timer');
  const timeRemaining = voteState.timeRemaining;

  const minutes = Math.floor(timeRemaining / 60);
  const seconds = timeRemaining % 60;
  timerEl.textContent = `${minutes}:${seconds.toString().padStart(2, '0')}`;

  // Apply warning/critical classes
  timerEl.classList.remove('warning', 'critical');
  if (timeRemaining <= 10) {
    timerEl.classList.add('critical');
  } else if (timeRemaining <= 30) {
    timerEl.classList.add('warning');
  }
}

function updateStats() {
  document.getElementById('voters-count').textContent = voteState.totalVoters || 0;
  document.getElementById('votes-count').textContent = voteState.totalVotesCast || 0;
}

function renderGameCards() {
  const grid = document.getElementById('games-grid');
  grid.innerHTML = '';

  voteState.gameOptions.forEach(gameId => {
    const card = document.createElement('div');
    card.className = 'game-card';

    if (voteState.userVote === gameId) {
      card.classList.add('selected');
    }

    const voteCount = voteState.results[gameId] || 0;
    const showVotes = voteState.showLiveResults;

    card.innerHTML = `
      <h3>${formatGameName(gameId)}</h3>
      <div class="game-id">${gameId}</div>
      <div class="vote-count ${showVotes ? '' : 'hidden'}">
        <span>🗳️</span>
        <span>${voteCount} ${voteCount === 1 ? 'vote' : 'votes'}</span>
      </div>
    `;

    card.onclick = () => castVote(gameId);
    grid.appendChild(card);
  });
}

function castVote(gameId) {
  gameAPI.emit('cast-vote', { gameId });
}

function formatGameName(gameId) {
  // Convert game-id to Game Name
  return gameId
    .split('-')
    .map(word => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}

function showTimeAddedNotification(seconds) {
  // Create floating notification
  const notification = document.createElement('div');
  notification.style.cssText = `
    position: fixed;
    top: 50%;
    left: 50%;
    transform: translate(-50%, -50%);
    background: linear-gradient(135deg, #f39c12 0%, #e67e22 100%);
    color: white;
    padding: 20px 40px;
    border-radius: 12px;
    font-size: 1.5rem;
    font-weight: bold;
    box-shadow: 0 8px 30px rgba(0,0,0,0.3);
    z-index: 9999;
    animation: fadeInOut 2s ease;
  `;
  notification.textContent = `+${seconds}s added!`;
  document.body.appendChild(notification);

  setTimeout(() => {
    document.body.removeChild(notification);
  }, 2000);
}

// Add CSS animation for notification
const style = document.createElement('style');
style.textContent = `
  @keyframes fadeInOut {
    0% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
    20% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    80% { opacity: 1; transform: translate(-50%, -50%) scale(1); }
    100% { opacity: 0; transform: translate(-50%, -50%) scale(0.8); }
  }
`;
document.head.appendChild(style);
