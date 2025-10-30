// RPS Tournament Client-Side Logic

let currentUser = null;
let tournamentState = null;
let matchesState = {};
let currentMatchId = null;
let myChoice = null;

// Screen references
const lobbyScreen = document.getElementById('lobby-screen');
const bracketScreen = document.getElementById('bracket-screen');
const matchScreen = document.getElementById('match-screen');
const resultsScreen = document.getElementById('results-screen');

// Initialize
window.addEventListener('load', async () => {
  if (!gameAPI || !gameAPI.isAuthenticated()) {
    alert('Please log in to play');
    window.location.href = '/';
    return;
  }

  const profileResult = await gameAPI.getProfile();
  if (!profileResult.success) {
    window.location.href = '/';
    return;
  }

  console.log('[RPS Tournament] Connected to server');
  currentUser = profileResult.user;
  document.getElementById('user-info').textContent = `Playing as ${currentUser.nickname}`;
});

gameAPI.on('tournament-state', (data) => {
  console.log('[RPS Tournament] Tournament state updated:', data);
  tournamentState = data.tournament;
  matchesState = data.matches;

  updateUI();
});

gameAPI.on('tournament-started', (data) => {
  console.log('[RPS Tournament] Tournament started!');
  tournamentState = data.tournament;
  updateUI();
});

gameAPI.on('choice-locked', (data) => {
  console.log('[RPS Tournament] Choice locked:', data);

  if (matchesState[data.matchId]) {
    if (matchesState[data.matchId].player1.id === data.playerId) {
      matchesState[data.matchId].player1.hasChosen = true;
    } else if (matchesState[data.matchId].player2.id === data.playerId) {
      matchesState[data.matchId].player2.hasChosen = true;
    }
    updateMatchDisplay();
  }
});

gameAPI.on('match-result', (data) => {
  console.log('[RPS Tournament] Match result:', data);

  const match = matchesState[data.matchId];
  if (!match) return;

  match.player1.score = data.p1Score;
  match.player2.score = data.p2Score;

  if (currentMatchId === data.matchId) {
    showRevealPhase(data);
  }
});

gameAPI.on('match-complete', (data) => {
  console.log('[RPS Tournament] Match complete:', data.matchId);
  setTimeout(() => {
    currentMatchId = null;
    myChoice = null;
    checkMyNextMatch();
  }, 3000);
});

gameAPI.on('match-forfeited', (data) => {
  console.log('[RPS Tournament] Match forfeited:', data);
  currentMatchId = null;
  myChoice = null;
  checkMyNextMatch();
});

gameAPI.on('round-complete', (data) => {
  console.log('[RPS Tournament] Round complete:', data.round);
  setTimeout(() => {
    checkMyNextMatch();
  }, 1000);
});

gameAPI.on('tournament-complete', (data) => {
  console.log('[RPS Tournament] Tournament complete!', data);
  tournamentState.champion = data.champion;
  tournamentState.state = 'finished';

  setTimeout(() => {
    showResultsScreen();
  }, 2000);
});

gameAPI.on('time-added', (data) => {
  // Future: show notification
  console.log('[RPS Tournament] Time added:', data);
});

gameAPI.on('error', (data) => {
  console.error('[RPS Tournament] Error:', data.message);
  alert(data.message);
});

// UI Update Functions

function updateUI() {
  if (!tournamentState) return;

  if (tournamentState.state === 'lobby') {
    showLobbyScreen();
  } else if (tournamentState.state === 'bracket') {
    checkMyNextMatch();
  } else if (tournamentState.state === 'finished') {
    showResultsScreen();
  }
}

function showLobbyScreen() {
  hideAllScreens();
  lobbyScreen.classList.add('active');

  updateLobbyDisplay();
}

function updateLobbyDisplay() {
  if (!tournamentState || !currentUser) {
    return;
  }

  // Update players list
  const playersContainer = document.getElementById('players-container');

  // Filter out null/undefined players with extra safety
  const activePlayers = (tournamentState.players || []).filter(p => p != null);

  // Update player count
  document.getElementById('player-count').textContent = activePlayers.length;

  if (activePlayers.length === 0) {
    playersContainer.innerHTML = '<p style="text-align: center; opacity: 0.6;">Waiting for players to join...</p>';
  } else {
    playersContainer.innerHTML = activePlayers.map((player, index) => {
      const isReady = player.ready;
      const isHost = index === 0;
      const isMe = player.id === currentUser.id;

      return `
        <div class="player-item">
          <div class="player-name" style="color: ${player.nameColor};">
            ${player.nickname}
            ${isHost ? '<span class="player-status host">HOST</span>' : ''}
            ${isMe ? ' (You)' : ''}
          </div>
          <div class="player-status ${isReady ? 'ready' : 'waiting'}">
            ${isReady ? '✓ Ready' : 'Not Ready'}
          </div>
        </div>
      `;
    }).join('');
  }

  // Determine if current user is in tournament
  const myPlayer = activePlayers.find(p => p.id === currentUser.id);
  const isInTournament = myPlayer !== undefined;

  // Update button visibility
  const joinBtn = document.getElementById('join-btn');
  const readyBtn = document.getElementById('ready-btn');
  const spectateBtn = document.getElementById('spectate-btn');

  if (isInTournament) {
    // User is in tournament - show ready/spectate buttons
    joinBtn.classList.add('hidden');
    readyBtn.classList.remove('hidden');
    spectateBtn.classList.remove('hidden');

    // Update ready button state
    if (myPlayer.ready) {
      readyBtn.textContent = 'Unready';
      readyBtn.classList.remove('btn-primary');
      readyBtn.classList.add('btn-danger');
    } else {
      readyBtn.textContent = 'Ready Up!';
      readyBtn.classList.remove('btn-danger');
      readyBtn.classList.add('btn-primary');
    }
  } else {
    // User is not in tournament - show join button
    joinBtn.classList.remove('hidden');
    readyBtn.classList.add('hidden');
    spectateBtn.classList.add('hidden');
  }

  // Update settings display
  const formatLabels = {
    'bo3': 'Best of 3',
    'bo5': 'Best of 5',
    'bo7': 'Best of 7'
  };
  const seedingLabels = {
    'random': 'Random',
    'order': 'Join Order'
  };

  document.getElementById('format-display').textContent = formatLabels[tournamentState.settings.format] || 'Best of 3';
  document.getElementById('seeding-display').textContent = seedingLabels[tournamentState.settings.seeding] || 'Random';
  document.getElementById('autostart-display').textContent = tournamentState.settings.autoStart ? 'Yes' : 'No';
}

function showBracketScreen() {
  hideAllScreens();
  bracketScreen.classList.add('active');

  // Hide back button by default (only shown when explicitly viewing from results)
  const backBtn = document.getElementById('back-to-results-btn');
  if (tournamentState.state !== 'finished') {
    backBtn.classList.add('hidden');
  }

  updateBracketDisplay();
}

function updateBracketDisplay() {
  if (!tournamentState) return;

  // Update round info
  const roundInfo = document.getElementById('bracket-round-info');
  if (tournamentState.bracket.length === 0) {
    roundInfo.textContent = 'Generating bracket...';
    return;
  }

  const totalRounds = tournamentState.bracket.length;
  const currentRoundDisplay = tournamentState.currentRound + 1;

  if (totalRounds === 1) {
    roundInfo.textContent = 'Finals';
  } else if (currentRoundDisplay === totalRounds) {
    roundInfo.textContent = 'Finals';
  } else if (currentRoundDisplay === totalRounds - 1) {
    roundInfo.textContent = 'Semi-Finals';
  } else {
    roundInfo.textContent = `Round ${currentRoundDisplay} of ${totalRounds}`;
  }

  // Render bracket visual
  const bracketVisual = document.getElementById('bracket-visual');
  bracketVisual.innerHTML = '';

  tournamentState.bracket.forEach((round, roundIndex) => {
    const roundDiv = document.createElement('div');
    roundDiv.className = 'bracket-round';

    const roundTitle = document.createElement('div');
    roundTitle.className = 'bracket-round-title';
    if (tournamentState.bracket.length === 1) {
      roundTitle.textContent = 'Finals';
    } else if (roundIndex === tournamentState.bracket.length - 1) {
      roundTitle.textContent = 'Finals';
    } else if (roundIndex === tournamentState.bracket.length - 2) {
      roundTitle.textContent = 'Semi-Finals';
    } else {
      roundTitle.textContent = `Round ${roundIndex + 1}`;
    }
    roundDiv.appendChild(roundTitle);

    round.forEach((match, matchIndex) => {
      const matchDiv = document.createElement('div');
      matchDiv.className = 'bracket-match';

      const matchId = `r${roundIndex}m${matchIndex}`;
      const activeMatch = matchesState[matchId];

      if (activeMatch && activeMatch.state !== 'finished') {
        matchDiv.classList.add('active');
      }

      const p1Div = document.createElement('div');
      p1Div.className = 'bracket-player';
      if (match.player1) {
        if (match.winner && match.winner.id === match.player1.id) {
          p1Div.classList.add('winner');
        } else if (match.winner && match.winner.id !== match.player1.id) {
          p1Div.classList.add('loser');
        }
        p1Div.innerHTML = `
          <span class="seed">#${match.player1.seed}</span>
          <span style="color: ${match.player1.nameColor};">${match.player1.nickname}</span>
        `;
      } else {
        p1Div.innerHTML = '<span style="opacity: 0.5;">TBD</span>';
      }

      const p2Div = document.createElement('div');
      p2Div.className = 'bracket-player';
      if (match.player2) {
        if (match.winner && match.winner.id === match.player2.id) {
          p2Div.classList.add('winner');
        } else if (match.winner && match.winner.id !== match.player2.id) {
          p2Div.classList.add('loser');
        }
        p2Div.innerHTML = `
          <span class="seed">#${match.player2.seed}</span>
          <span style="color: ${match.player2.nameColor};">${match.player2.nickname}</span>
        `;
      } else {
        p2Div.innerHTML = '<span style="opacity: 0.5;">TBD</span>';
      }

      matchDiv.appendChild(p1Div);
      matchDiv.appendChild(p2Div);
      roundDiv.appendChild(matchDiv);
    });

    bracketVisual.appendChild(roundDiv);
  });
}

function checkMyNextMatch() {
  if (!tournamentState || !matchesState) {
    showBracketScreen();
    return;
  }

  // Check if I'm in any active match
  for (const matchId in matchesState) {
    const match = matchesState[matchId];
    if (match.state !== 'finished') {
      if (match.player1.id === currentUser.id || match.player2.id === currentUser.id) {
        currentMatchId = matchId;
        showMatchScreen();
        return;
      }
    }
  }

  // Not in active match, show bracket
  showBracketScreen();
}

function showMatchScreen() {
  hideAllScreens();
  matchScreen.classList.add('active');

  updateMatchDisplay();
}

function updateMatchDisplay() {
  const match = matchesState[currentMatchId];
  if (!match) return;

  const isSpectator = match.player1.id !== currentUser.id && match.player2.id !== currentUser.id;

  // Show/hide spectator banner
  const spectatorBanner = document.getElementById('spectator-banner');
  if (isSpectator) {
    spectatorBanner.classList.remove('hidden');
  } else {
    spectatorBanner.classList.add('hidden');
  }

  // Update match title
  const matchTitle = document.getElementById('match-title');
  if (tournamentState.bracket.length === 1) {
    matchTitle.textContent = 'Finals';
  } else if (match.round === tournamentState.bracket.length - 1) {
    matchTitle.textContent = 'Finals';
  } else if (match.round === tournamentState.bracket.length - 2) {
    matchTitle.textContent = 'Semi-Finals';
  } else {
    matchTitle.textContent = `Round ${match.round + 1} - Match ${match.matchIndex + 1}`;
  }

  // Update format info
  const matchFormat = document.getElementById('match-format');
  const formatName = match.targetWins === 2 ? 'Best of 3' : match.targetWins === 3 ? 'Best of 5' : 'Best of 7';
  matchFormat.textContent = `${formatName} - First to ${match.targetWins}`;

  // Update players
  const p1Info = document.getElementById('player1-info');
  const p2Info = document.getElementById('player2-info');

  if (match.player1.id === currentUser.id) {
    p1Info.classList.add('current-user');
    p2Info.classList.remove('current-user');
  } else if (match.player2.id === currentUser.id) {
    p2Info.classList.add('current-user');
    p1Info.classList.remove('current-user');
  }

  document.getElementById('p1-name').textContent = match.player1.nickname;
  document.getElementById('p1-name').style.color = match.player1.nameColor;
  document.getElementById('p1-score').textContent = match.player1.score;

  document.getElementById('p2-name').textContent = match.player2.nickname;
  document.getElementById('p2-name').style.color = match.player2.nameColor;
  document.getElementById('p2-score').textContent = match.player2.score;

  // Update status
  const p1Status = document.getElementById('p1-status');
  const p2Status = document.getElementById('p2-status');

  if (match.state === 'choosing') {
    p1Status.textContent = match.player1.hasChosen ? '✓ Locked In' : 'Choosing...';
    p2Status.textContent = match.player2.hasChosen ? '✓ Locked In' : 'Choosing...';
  } else {
    p1Status.textContent = '';
    p2Status.textContent = '';
  }

  // Update game counter - count only non-tie rounds
  const completedRounds = match.history.filter(r => r.winner !== 0).length;
  const currentRoundDisplay = completedRounds + 1; // +1 for the current round being played
  const maxGames = match.targetWins * 2 - 1;

  // Show current round only if we're still playing
  if (match.state === 'choosing' || match.state === 'reveal') {
    document.getElementById('current-game').textContent = currentRoundDisplay;
  } else {
    document.getElementById('current-game').textContent = completedRounds;
  }
  document.getElementById('max-games').textContent = maxGames;

  // Update match history
  updateMatchHistory(match);

  // Handle match state
  if (match.state === 'choosing') {
    showChoicesPhase(match);
  } else if (match.state === 'reveal') {
    // Reveal handled by event
  }
}

let choiceTimerInterval = null;

function showChoicesPhase(match) {
  hideMatchPhases();

  if (!match) {
    match = matchesState[currentMatchId];
  }
  if (!match) return;

  const isSpectator = match.player1.id !== currentUser.id && match.player2.id !== currentUser.id;

  if (!isSpectator) {
    const choicesContainer = document.getElementById('choices-container');
    choicesContainer.classList.remove('hidden');

    // Show countdown timer
    const countdownContainer = document.getElementById('countdown-container');
    const countdownEl = document.getElementById('countdown');

    const hasChosen = (match.player1.id === currentUser.id && match.player1.hasChosen) ||
                      (match.player2.id === currentUser.id && match.player2.hasChosen);

    // Only show timer if user hasn't chosen yet
    if (!hasChosen && match.choiceDeadline) {
      countdownContainer.classList.remove('hidden');

      // Clear any existing timer
      if (choiceTimerInterval) {
        clearInterval(choiceTimerInterval);
      }

      // Update countdown every 100ms
      choiceTimerInterval = setInterval(() => {
        const remaining = Math.max(0, match.choiceDeadline - Date.now());
        const seconds = Math.ceil(remaining / 1000);
        countdownEl.textContent = seconds;

        if (remaining <= 0) {
          clearInterval(choiceTimerInterval);
          choiceTimerInterval = null;
        }
      }, 100);
    } else {
      countdownContainer.classList.add('hidden');
      if (choiceTimerInterval) {
        clearInterval(choiceTimerInterval);
        choiceTimerInterval = null;
      }
    }

    // Enable/disable choice buttons
    const choiceButtons = document.querySelectorAll('.choice-btn');

    choiceButtons.forEach(btn => {
      btn.disabled = hasChosen;
      if (hasChosen && btn.dataset.choice === myChoice) {
        btn.classList.add('selected');
      } else {
        btn.classList.remove('selected');
      }
    });
  }
}

function showRevealPhase(data) {
  hideMatchPhases();

  const revealContainer = document.getElementById('reveal-container');
  revealContainer.classList.remove('hidden');

  const match = matchesState[currentMatchId];

  // Show choices
  const choiceIcons = {
    'rock': '🪨',
    'paper': '📄',
    'scissors': '✂️'
  };

  document.getElementById('reveal-p1-choice').textContent = choiceIcons[data.p1Choice];
  document.getElementById('reveal-p1-name').textContent = match.player1.nickname;
  document.getElementById('reveal-p1-name').style.color = match.player1.nameColor;

  document.getElementById('reveal-p2-choice').textContent = choiceIcons[data.p2Choice];
  document.getElementById('reveal-p2-name').textContent = match.player2.nickname;
  document.getElementById('reveal-p2-name').style.color = match.player2.nameColor;

  // Show result
  const revealResult = document.getElementById('reveal-result');
  if (data.winner === 0) {
    revealResult.textContent = "It's a Tie!";
    revealResult.className = 'reveal-result tie';
  } else if (data.winner === 1) {
    revealResult.textContent = `${match.player1.nickname} Wins!`;
    if (match.player1.id === currentUser.id) {
      revealResult.className = 'reveal-result win';
    } else {
      revealResult.className = 'reveal-result lose';
    }
  } else {
    revealResult.textContent = `${match.player2.nickname} Wins!`;
    if (match.player2.id === currentUser.id) {
      revealResult.className = 'reveal-result win';
    } else {
      revealResult.className = 'reveal-result lose';
    }
  }

  // Reset choice
  myChoice = null;
}

function hideMatchPhases() {
  document.getElementById('countdown-container').classList.add('hidden');
  document.getElementById('choices-container').classList.add('hidden');
  document.getElementById('reveal-container').classList.add('hidden');
}

function updateMatchHistory(match) {
  const historyContainer = document.getElementById('match-history-container');

  if (match.history.length === 0) {
    historyContainer.innerHTML = '<p style="opacity: 0.6;">No rounds played yet</p>';
    return;
  }

  const choiceIcons = {
    'rock': '🪨',
    'paper': '📄',
    'scissors': '✂️'
  };

  historyContainer.innerHTML = match.history.map(round => {
    const winnerText = round.winner === 0 ? 'Tie' :
                       round.winner === 1 ? match.player1.nickname :
                       match.player2.nickname;

    return `
      <div class="history-round">
        <span>Game ${round.game}:</span>
        <span>${choiceIcons[round.p1Choice]} vs ${choiceIcons[round.p2Choice]}</span>
        <span><strong>${winnerText}</strong></span>
      </div>
    `;
  }).join('');
}

function showResultsScreen() {
  hideAllScreens();
  resultsScreen.classList.add('active');

  updateResultsDisplay();
}

function updateResultsDisplay() {
  if (!tournamentState || !tournamentState.champion) return;

  // Show champion
  const championName = document.getElementById('champion-name');
  championName.textContent = tournamentState.champion.nickname;
  championName.style.color = tournamentState.champion.nameColor;

  // Show placements
  const placementsContainer = document.getElementById('placements-container');
  const placements = tournamentState.players
    .filter(p => p.placement !== null)
    .sort((a, b) => a.placement - b.placement);

  const medals = { 1: '🥇', 2: '🥈', 3: '🥉' };
  const placementClasses = { 1: 'first', 2: 'second', 3: 'third' };

  placementsContainer.innerHTML = placements.map(player => {
    return `
      <div class="placement-item ${placementClasses[player.placement] || ''}">
        <div class="placement-rank">${medals[player.placement] || player.placement + 'th'}</div>
        <div class="placement-name" style="color: ${player.nameColor};">${player.nickname}</div>
      </div>
    `;
  }).join('');
}

function hideAllScreens() {
  lobbyScreen.classList.remove('active');
  bracketScreen.classList.remove('active');
  matchScreen.classList.remove('active');
  resultsScreen.classList.remove('active');
}

// Button Actions

function joinTournament() {
  console.log('[RPS Tournament Client] Joining tournament...');
  gameAPI.emit('join-tournament', {});
}

function spectate() {
  gameAPI.emit('leave-tournament', {});
}

function toggleReady() {
  const myPlayer = tournamentState.players.find(p => p.id === currentUser.id);

  if (myPlayer && myPlayer.ready) {
    gameAPI.emit('player-unready', {});
  } else {
    gameAPI.emit('player-ready', {});
  }
}

function makeChoice(choice) {
  if (!currentMatchId || myChoice) return;

  myChoice = choice;

  gameAPI.emit('make-choice', {
    matchId: currentMatchId,
    choice: choice
  });

  // Hide the countdown timer
  const countdownContainer = document.getElementById('countdown-container');
  countdownContainer.classList.add('hidden');

  // Clear the timer interval
  if (choiceTimerInterval) {
    clearInterval(choiceTimerInterval);
    choiceTimerInterval = null;
  }

  // Update UI immediately
  const choiceButtons = document.querySelectorAll('.choice-btn');
  choiceButtons.forEach(btn => {
    btn.disabled = true;
    if (btn.dataset.choice === choice) {
      btn.classList.add('selected');
    }
  });
}

function newTournament() {
  gameAPI.emit('new-tournament', {});
}

function viewBracket() {
  // Show back button when viewing from results
  const backBtn = document.getElementById('back-to-results-btn');
  backBtn.classList.remove('hidden');

  showBracketScreen();
}

function backToResults() {
  // Hide back button
  const backBtn = document.getElementById('back-to-results-btn');
  backBtn.classList.add('hidden');

  showResultsScreen();
}
