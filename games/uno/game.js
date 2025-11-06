/**
 * Uno Game - Client Logic
 * Handles all UI interactions and server communication
 */

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

let currentRoom = null;
let myUserId = null;
let myHand = [];
let pendingWildCard = null; // Card waiting for color selection
let turnTimerInterval = null; // Countdown interval
let turnEndTime = null; // When the current turn ends

// ============================================================================
// INITIALIZATION
// ============================================================================

/**
 * Initialize game when page loads
 */
async function init() {
  console.log('[Uno Client] Initializing...');

  // Check authentication
  if (!gameAPI.isAuthenticated()) {
    window.location.href = '/';
    return;
  }

  // Fetch user profile
  const profileResult = await gameAPI.getProfile();
  if (!profileResult.success) {
    console.error('[Uno Client] Failed to get profile:', profileResult.error);
    window.location.href = '/';
    return;
  }

  const user = gameAPI.getUser();
  myUserId = user.id;

  // Show lobby
  showLobbyScreen();
  requestRoomList();

  // Setup event listeners
  setupEventListeners();
  setupSocketListeners();

  console.log('[Uno Client] Ready');
}

/**
 * Setup DOM event listeners
 */
function setupEventListeners() {
  // Lobby
  document.getElementById('create-room-btn').addEventListener('click', showCreateRoomModal);
  document.getElementById('refresh-rooms-btn').addEventListener('click', requestRoomList);

  // Create Room Modal
  document.getElementById('create-room-form').addEventListener('submit', handleCreateRoom);
  document.getElementById('cancel-create-room').addEventListener('click', hideCreateRoomModal);

  // Game Actions
  document.getElementById('draw-btn').addEventListener('click', handleDrawCard);
  document.getElementById('uno-btn').addEventListener('click', handleCallUno);
  document.getElementById('start-game-btn').addEventListener('click', handleStartGame);
  document.getElementById('leave-room-btn').addEventListener('click', handleLeaveRoom);

  // Chat
  document.getElementById('chat-send').addEventListener('click', handleSendChat);
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      handleSendChat();
    }
  });

  // Winner Modal
  document.getElementById('close-winner-modal').addEventListener('click', hideWinnerModal);

  // Color Picker Modal
  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.addEventListener('click', () => handleColorChoice(btn.dataset.color));
  });
}

/**
 * Setup Socket.IO event listeners
 */
function setupSocketListeners() {
  // Lobby events
  gameAPI.on('rooms-list', handleRoomsList);
  gameAPI.on('room-created', handleRoomCreated);

  // Room events
  gameAPI.on('room-joined', handleRoomJoined);
  gameAPI.on('player-joined', handlePlayerJoined);
  gameAPI.on('player-left', handlePlayerLeft);
  gameAPI.on('spectator-joined', handleSpectatorJoined);
  gameAPI.on('spectator-left', handleSpectatorLeft);

  // Game events
  gameAPI.on('game-started', handleGameStarted);
  gameAPI.on('card-played', handleCardPlayed);
  gameAPI.on('card-drawn', handleCardDrawn);
  gameAPI.on('cards-drawn', handleCardsDrawn);
  gameAPI.on('turn-changed', handleTurnChanged);
  gameAPI.on('turn-timeout', handleTurnTimeout);
  gameAPI.on('uno-called', handleUnoCalled);
  gameAPI.on('uno-caught', handleUnoCaught);
  gameAPI.on('game-won', handleGameWon);

  // Chat events
  gameAPI.on('chat-message', handleChatMessage);

  // Error events
  gameAPI.on('error', handleError);
}

// ============================================================================
// SCREEN MANAGEMENT
// ============================================================================

/**
 * Show lobby screen
 */
function showLobbyScreen() {
  document.getElementById('lobby-screen').classList.add('active');
  document.getElementById('game-screen').classList.remove('active');
}

/**
 * Show game screen
 */
function showGameScreen() {
  document.getElementById('lobby-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');
}

// ============================================================================
// LOBBY - ROOM LIST
// ============================================================================

/**
 * Request room list from server
 */
function requestRoomList() {
  // Server automatically sends room list on connect
  // This can be called to manually refresh
  console.log('[Uno Client] Requesting room list...');
}

/**
 * Handle rooms list update
 */
function handleRoomsList(data) {
  const container = document.getElementById('rooms-container');
  container.innerHTML = '';

  if (data.rooms.length === 0) {
    container.innerHTML = '<div class="no-rooms"><p>No rooms available. Create one to get started!</p></div>';
    return;
  }

  data.rooms.forEach(room => {
    const roomCard = createRoomCard(room);
    container.appendChild(roomCard);
  });
}

/**
 * Create room card element
 */
function createRoomCard(room) {
  const card = document.createElement('div');
  card.className = 'room-card';

  const statusClass = room.gameState === 'playing' ? 'in-progress' : 'waiting';

  card.innerHTML = `
    <div class="room-header">
      <h3>${escapeHtml(room.name)}</h3>
      <span class="room-status ${statusClass}">${room.gameState}</span>
    </div>
    <div class="room-info">
      <div class="room-stat">
        <span class="stat-icon">👥</span>
        <span>${room.playerCount}/${room.maxPlayers}</span>
      </div>
      <div class="room-stat">
        <span class="stat-icon">👁️</span>
        <span>${room.spectatorCount}</span>
      </div>
    </div>
    <div class="room-actions">
      <button class="btn btn-small btn-primary" onclick="joinRoom('${room.id}')">
        Join
      </button>
      <button class="btn btn-small btn-secondary" onclick="spectateRoom('${room.id}')">
        Spectate
      </button>
    </div>
  `;

  return card;
}

// ============================================================================
// LOBBY - CREATE ROOM
// ============================================================================

/**
 * Show create room modal
 */
function showCreateRoomModal() {
  const user = gameAPI.getUser();
  document.getElementById('room-name-input').value = `${user.nickname}'s Room`;
  document.getElementById('create-room-modal').classList.add('active');
}

/**
 * Hide create room modal
 */
function hideCreateRoomModal() {
  document.getElementById('create-room-modal').classList.remove('active');
}

/**
 * Handle create room form submission
 */
function handleCreateRoom(e) {
  e.preventDefault();

  const config = {
    name: document.getElementById('room-name-input').value,
    maxPlayers: parseInt(document.getElementById('max-players-input').value),
    turnTimer: parseInt(document.getElementById('turn-timer-input').value),
    drawUntilPlayable: document.getElementById('draw-until-playable').checked,
    stackingDraw: document.getElementById('stacking-draw').checked,
    jumpIn: document.getElementById('jump-in').checked,
    sevenSwap: document.getElementById('seven-swap').checked,
    zeroRotate: document.getElementById('zero-rotate').checked,
    forcedPlay: document.getElementById('forced-play').checked,
    challengeWildDraw4: document.getElementById('challenge-wild').checked
  };

  gameAPI.emit('create-room', config);
  hideCreateRoomModal();
}

/**
 * Handle room created confirmation
 */
function handleRoomCreated(data) {
  console.log('[Uno Client] Room created:', data.roomId);
  showNotification('Room created!', 'success');
}

// ============================================================================
// ROOM - JOIN / LEAVE
// ============================================================================

/**
 * Join room as player
 */
function joinRoom(roomId) {
  gameAPI.emit('join-room', { roomId });
}

/**
 * Spectate room
 */
function spectateRoom(roomId) {
  gameAPI.emit('spectate-room', { roomId });
}

/**
 * Leave current room
 */
function handleLeaveRoom() {
  if (currentRoom && currentRoom.gameState === 'playing') {
    if (!confirm('Leave game in progress? You can rejoin later.')) {
      return;
    }
  }

  gameAPI.emit('leave-room', {});
  currentRoom = null;
  myHand = [];
  showLobbyScreen();
  requestRoomList();
}

/**
 * Handle room joined
 */
function handleRoomJoined(data) {
  currentRoom = data.room;
  myHand = data.hand || [];

  showGameScreen();
  renderRoomInfo();
  renderPlayers();
  renderSpectators();
  loadChatHistory(data.chatHistory);

  if (data.room.gameState === 'playing') {
    renderGameBoard();
    renderPlayerHand();
    updateGameState();
  }

  // Show start button if host and in lobby
  if (data.room.host === myUserId && data.room.gameState === 'waiting') {
    document.getElementById('start-game-btn').style.display = 'block';
  }

  showNotification(`Joined ${data.room.name}`, 'success');
  console.log('[Uno Client] Joined room:', data.room.id);
}

/**
 * Handle player joined
 */
function handlePlayerJoined(data) {
  if (currentRoom) {
    currentRoom.players = data.players;
    renderPlayers();
    addSystemMessage(`${data.user.nickname} joined the room`);
  }
}

/**
 * Handle player left
 */
function handlePlayerLeft(data) {
  if (currentRoom) {
    currentRoom.players = data.players;
    renderPlayers();
    addSystemMessage(`Player left the room`);
  }
}

/**
 * Handle spectator joined
 */
function handleSpectatorJoined(data) {
  if (currentRoom) {
    currentRoom.spectators = data.spectators;
    renderSpectators();
  }
}

/**
 * Handle spectator left
 */
function handleSpectatorLeft(data) {
  if (currentRoom) {
    currentRoom.spectators = data.spectators;
    renderSpectators();
  }
}

// ============================================================================
// GAME - START
// ============================================================================

/**
 * Start the game (host only)
 */
function handleStartGame() {
  gameAPI.emit('start-game', {});
}

/**
 * Handle game started
 */
function handleGameStarted(data) {
  currentRoom = data.room;
  myHand = data.hand || [];

  document.getElementById('start-game-btn').style.display = 'none';

  // Update button states
  const isMyTurn = currentRoom.currentPlayer === myUserId;
  document.getElementById('draw-btn').disabled = !isMyTurn;

  renderGameBoard();
  renderPlayerHand();
  updateGameState();
  highlightCurrentPlayer();

  // Start turn timer if it's enabled and it's someone's turn
  if (currentRoom.settings && currentRoom.settings.turnTimer > 0) {
    startTurnTimer(currentRoom.settings.turnTimer);
  }

  showNotification('Game started!', 'success');
  console.log('[Uno Client] Game started', {
    topCard: currentRoom.topCard,
    currentColor: currentRoom.currentColor,
    currentPlayer: currentRoom.currentPlayer,
    myUserId: myUserId,
    isMyTurn: isMyTurn
  });
}

// ============================================================================
// GAME - PLAY CARD
// ============================================================================

/**
 * Handle card click
 */
function handleCardClick(cardId) {
  if (!currentRoom || currentRoom.gameState !== 'playing') return;
  if (currentRoom.currentPlayer !== myUserId) {
    showNotification('Not your turn!', 'error');
    return;
  }

  const card = myHand.find(c => c.id === cardId);
  if (!card) return;

  // Check if card is playable
  if (!isCardPlayable(card)) {
    showNotification('Cannot play this card', 'error');
    return;
  }

  // Wild cards need color selection
  if (card.type === 'wild' || card.type === 'wild-draw4') {
    pendingWildCard = card;
    showColorPicker();
  } else {
    // Play card immediately
    gameAPI.emit('play-card', { cardId: card.id });
  }
}

/**
 * Check if card is playable
 */
function isCardPlayable(card) {
  if (!currentRoom || !currentRoom.topCard) {
    if (!currentRoom) {
      console.warn('[Uno Client] isCardPlayable: currentRoom is null');
    } else if (!currentRoom.topCard) {
      console.warn('[Uno Client] isCardPlayable: topCard is null', { currentRoom });
    }
    return false;
  }

  const topCard = currentRoom.topCard;
  const currentColor = currentRoom.currentColor;

  // Wild cards always playable
  if (card.type === 'wild' || card.type === 'wild-draw4') {
    return true;
  }

  // If there's a draw stack, can only play matching draw card
  if (currentRoom.drawStack > 0) {
    if (topCard.type === 'draw2' && card.type === 'draw2') {
      return true;
    }
    if (topCard.type === 'wild-draw4' && card.type === 'wild-draw4') {
      return true;
    }
    return false;
  }

  // Match color
  if (card.color === currentColor) {
    return true;
  }

  // Match number/type
  if (card.type === 'number' && topCard.type === 'number' && card.value === topCard.value) {
    return true;
  }

  // Match action type
  if (card.type === topCard.type && card.type !== 'number') {
    return true;
  }

  return false;
}

/**
 * Handle card played by any player
 */
function handleCardPlayed(data) {
  if (!currentRoom) return;

  // Update room state
  currentRoom.topCard = data.card;
  currentRoom.currentColor = data.currentColor;

  // Remove card from hand if it was mine
  if (data.user.id === myUserId) {
    myHand = myHand.filter(c => c.id !== data.card.id);
  } else {
    // Update opponent card count
    if (currentRoom.handSizes) {
      currentRoom.handSizes[data.user.id] = data.handSize;
    }
  }

  renderGameBoard();
  renderOpponents();
  renderPlayerHand(); // Re-render to update playable highlights

  const cardName = getCardName(data.card);
  if (data.user.id !== myUserId) {
    showNotification(`${data.user.nickname} played ${cardName}`, 'info');
  }
}

// ============================================================================
// GAME - DRAW CARD
// ============================================================================

/**
 * Draw card button handler
 */
function handleDrawCard() {
  if (!currentRoom || currentRoom.gameState !== 'playing') return;
  if (currentRoom.currentPlayer !== myUserId) {
    showNotification('Not your turn!', 'error');
    return;
  }

  gameAPI.emit('draw-card', {});
}

/**
 * Handle card drawn (public event)
 */
function handleCardDrawn(data) {
  if (!currentRoom) return;

  // Update hand sizes
  if (currentRoom.handSizes) {
    currentRoom.handSizes[data.userId] = data.handSize;
  }

  // Update UNO called status
  if (currentRoom.unoCalled && data.unoCalled !== undefined) {
    currentRoom.unoCalled[data.userId] = data.unoCalled;
  }

  renderPlayers();
  renderOpponents();

  if (data.userId !== myUserId) {
    const message = data.penalty ?
      `${data.user.nickname} drew ${data.cardCount} cards (penalty)` :
      `${data.user.nickname} drew ${data.cardCount} card(s)`;
    showNotification(message, 'info');
  }
}

/**
 * Handle cards drawn (private event - my cards)
 */
function handleCardsDrawn(data) {
  // Add cards to my hand
  data.cards.forEach(card => {
    myHand.push(card);
  });

  renderPlayerHand();

  // Show appropriate notification based on draw result
  if (data.mustDrawMore) {
    showNotification(`Drew 1 card (not playable) - Draw again!`, 'warning');
  } else if (data.isPlayable) {
    showNotification(`Drew 1 playable card - You can play it or pass`, 'success');
  } else {
    showNotification(`You drew ${data.cards.length} card(s)`, 'info');
  }
}

// ============================================================================
// GAME - TURN MANAGEMENT
// ============================================================================

/**
 * Handle turn changed
 */
function handleTurnChanged(data) {
  if (!currentRoom) return;

  currentRoom.currentPlayer = data.currentPlayer;
  currentRoom.currentPlayerIndex = data.currentPlayerIndex;
  currentRoom.turnDirection = data.turnDirection;

  // Update additional state for card validation
  if (data.drawStack !== undefined) currentRoom.drawStack = data.drawStack;
  if (data.currentColor) currentRoom.currentColor = data.currentColor;
  if (data.topCard) currentRoom.topCard = data.topCard;

  updateGameState();
  highlightCurrentPlayer();

  const isMyTurn = data.currentPlayer === myUserId;
  document.getElementById('draw-btn').disabled = !isMyTurn;

  // Update direction arrow
  const arrow = data.turnDirection === 1 ? '↻' : '↺';
  document.getElementById('turn-direction').textContent = arrow;

  // Re-render player hand to update playable card highlights
  renderPlayerHand();

  // Start turn timer if enabled
  if (currentRoom.settings && currentRoom.settings.turnTimer > 0) {
    startTurnTimer(currentRoom.settings.turnTimer);
  } else {
    stopTurnTimer();
  }
}

/**
 * Handle turn timeout
 */
function handleTurnTimeout(data) {
  if (!currentRoom) return;

  // Update hand sizes
  if (currentRoom.handSizes) {
    currentRoom.handSizes[data.userId] = data.handSize;
  }

  // Update UNO called status
  if (currentRoom.unoCalled && data.unoCalled !== undefined) {
    currentRoom.unoCalled[data.userId] = data.unoCalled;
  }

  renderPlayers();
  renderOpponents();

  if (data.userId === myUserId) {
    showNotification('Turn timed out - drew a card', 'warning');
  } else {
    showNotification(`${data.user.nickname}'s turn timed out`, 'info');
  }
}

// ============================================================================
// GAME - UNO SYSTEM
// ============================================================================

/**
 * Call UNO
 */
function handleCallUno() {
  if (!currentRoom || currentRoom.gameState !== 'playing') return;
  if (myHand.length !== 1) {
    showNotification('Can only call UNO with 1 card!', 'error');
    return;
  }

  gameAPI.emit('call-uno', {});
}

/**
 * Handle UNO called
 */
function handleUnoCalled(data) {
  if (!currentRoom) return;

  if (currentRoom.unoCalled) {
    currentRoom.unoCalled[data.userId] = true;
  }

  renderPlayers();
  renderOpponents();

  showNotification(`${data.user.nickname} called UNO!`, 'warning');
}

/**
 * Catch UNO (click opponent to catch)
 */
function catchUno(userId) {
  if (!currentRoom || currentRoom.gameState !== 'playing') return;

  gameAPI.emit('catch-uno', { targetUserId: userId });
}

/**
 * Handle UNO caught
 */
function handleUnoCaught(data) {
  if (!currentRoom) return;

  // Reset UNO flag
  if (currentRoom.unoCalled) {
    currentRoom.unoCalled[data.targetId] = false;
  }

  // Update hand size
  if (currentRoom.handSizes) {
    currentRoom.handSizes[data.targetId] = data.newHandSize;
  }

  renderPlayers();
  renderOpponents();

  showNotification(
    `${data.accuser.nickname} caught ${data.target.nickname}! +${data.penalty} cards`,
    'success'
  );
}

// ============================================================================
// GAME - WIN
// ============================================================================

/**
 * Handle game won
 */
function handleGameWon(data) {
  if (!currentRoom) return;

  currentRoom.gameState = 'finished';

  // Show winner modal
  showWinnerModal(data.winner, data.score);

  showNotification(`${data.winner.nickname} wins!`, 'success');
}

/**
 * Show winner modal
 */
function showWinnerModal(winner, score) {
  const modal = document.getElementById('winner-modal');
  const infoDiv = document.getElementById('winner-info');

  infoDiv.innerHTML = `
    <div class="winner-avatar" style="background: ${winner.playerColor}">
      ${winner.profilePicture ?
        `<img src="${winner.profilePicture}" alt="${winner.nickname}">` :
        `<span class="initial">${winner.nickname[0].toUpperCase()}</span>`
      }
    </div>
    <h3 style="color: ${winner.nameColor}">${escapeHtml(winner.nickname)}</h3>
    <p class="winner-score">Score: ${score} points</p>
  `;

  modal.classList.add('active');
}

/**
 * Hide winner modal
 */
function hideWinnerModal() {
  document.getElementById('winner-modal').classList.remove('active');
}

// ============================================================================
// COLOR PICKER
// ============================================================================

/**
 * Show color picker modal
 */
function showColorPicker() {
  document.getElementById('color-picker-modal').classList.add('active');
}

/**
 * Hide color picker modal
 */
function hideColorPicker() {
  document.getElementById('color-picker-modal').classList.remove('active');
}

/**
 * Handle color choice
 */
function handleColorChoice(color) {
  if (!pendingWildCard) return;

  gameAPI.emit('play-card', {
    cardId: pendingWildCard.id,
    chosenColor: color
  });

  pendingWildCard = null;
  hideColorPicker();
}

// ============================================================================
// CHAT SYSTEM
// ============================================================================

/**
 * Send chat message
 */
function handleSendChat() {
  const input = document.getElementById('chat-input');
  const message = input.value.trim();

  if (message.length === 0) return;

  gameAPI.emit('chat-message', { message });
  input.value = '';
}

/**
 * Handle incoming chat message
 */
function handleChatMessage(data) {
  addChatMessage(data.user, data.message);
}

/**
 * Load chat history
 */
function loadChatHistory(history) {
  const container = document.getElementById('chat-messages');
  container.innerHTML = '';

  history.forEach(msg => {
    addChatMessage(msg.user, msg.message, false);
  });
}

/**
 * Add chat message to UI
 */
function addChatMessage(user, message, scroll = true) {
  const container = document.getElementById('chat-messages');

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';

  msgDiv.innerHTML = `
    <span class="chat-user" style="color: ${user.nameColor}">
      ${escapeHtml(user.nickname)}:
    </span>
    <span class="chat-text">${escapeHtml(message)}</span>
  `;

  container.appendChild(msgDiv);

  if (scroll) {
    container.scrollTop = container.scrollHeight;
  }
}

/**
 * Add system message
 */
function addSystemMessage(message) {
  const container = document.getElementById('chat-messages');

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message system';
  msgDiv.innerHTML = `<span class="chat-text">${escapeHtml(message)}</span>`;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// ============================================================================
// RENDERING
// ============================================================================

/**
 * Render room info panel
 */
function renderRoomInfo() {
  if (!currentRoom) return;

  document.getElementById('room-name').textContent = currentRoom.name;

  const settingsDiv = document.getElementById('room-settings');
  const settings = currentRoom.settings;

  const activeRules = [];
  if (settings.drawUntilPlayable) activeRules.push('Draw Until Playable');
  if (settings.stackingDraw) activeRules.push('Stack Draw');
  if (settings.jumpIn) activeRules.push('Jump-In');
  if (settings.sevenSwap) activeRules.push('Seven Swap');
  if (settings.zeroRotate) activeRules.push('Zero Rotate');
  if (settings.forcedPlay) activeRules.push('Forced Play');
  if (settings.challengeWildDraw4) activeRules.push('Challenge Wild +4');

  settingsDiv.innerHTML = `
    <div class="setting-item">
      <strong>Timer:</strong> ${settings.turnTimer > 0 ? `${settings.turnTimer}s` : 'None'}
    </div>
    ${activeRules.length > 0 ? `
      <div class="setting-item">
        <strong>Rules:</strong> ${activeRules.join(', ')}
      </div>
    ` : ''}
  `;
}

/**
 * Render players list
 */
function renderPlayers() {
  if (!currentRoom) return;

  const container = document.getElementById('players-list');
  const countSpan = document.getElementById('player-count');

  const activePlayers = currentRoom.players.filter(p => p !== null);
  countSpan.textContent = activePlayers.length;

  container.innerHTML = '';

  currentRoom.players.forEach((player, index) => {
    if (!player) return;

    const playerDiv = document.createElement('div');
    playerDiv.className = 'player-item';
    if (player.id === myUserId) {
      playerDiv.classList.add('me');
    }
    if (currentRoom.currentPlayer === player.id) {
      playerDiv.classList.add('current-turn');
    }

    const handSize = currentRoom.handSizes ? currentRoom.handSizes[player.id] : 0;
    const hasUno = currentRoom.unoCalled && currentRoom.unoCalled[player.id];

    playerDiv.innerHTML = `
      <div class="player-avatar" style="background: ${player.playerColor}">
        ${player.profilePicture ?
          `<img src="${player.profilePicture}" alt="${player.nickname}">` :
          `<span class="initial">${player.nickname[0].toUpperCase()}</span>`
        }
      </div>
      <div class="player-info">
        <div class="player-name" style="color: ${player.nameColor}">
          ${escapeHtml(player.nickname)}
          ${player.id === currentRoom.host ? ' 👑' : ''}
          ${hasUno ? ' <span class="uno-badge">UNO</span>' : ''}
        </div>
        ${currentRoom.gameState === 'playing' ? `<div class="player-cards">${handSize} cards</div>` : ''}
      </div>
    `;

    // Add catch UNO button
    if (currentRoom.gameState === 'playing' && player.id !== myUserId && handSize === 1 && !hasUno) {
      const catchBtn = document.createElement('button');
      catchBtn.className = 'btn btn-tiny';
      catchBtn.textContent = 'Catch';
      catchBtn.onclick = () => catchUno(player.id);
      playerDiv.appendChild(catchBtn);
    }

    container.appendChild(playerDiv);
  });
}

/**
 * Render spectators list
 */
function renderSpectators() {
  if (!currentRoom) return;

  const container = document.getElementById('spectators-list');
  const countSpan = document.getElementById('spectator-count');

  countSpan.textContent = currentRoom.spectators.length;

  container.innerHTML = '';

  if (currentRoom.spectators.length === 0) {
    container.innerHTML = '<p class="empty-list">No spectators</p>';
    return;
  }

  currentRoom.spectators.forEach(spectator => {
    const specDiv = document.createElement('div');
    specDiv.className = 'spectator-item';

    specDiv.innerHTML = `
      <div class="spectator-avatar" style="background: ${spectator.playerColor}">
        ${spectator.profilePicture ?
          `<img src="${spectator.profilePicture}" alt="${spectator.nickname}">` :
          `<span class="initial">${spectator.nickname[0].toUpperCase()}</span>`
        }
      </div>
      <div class="spectator-name" style="color: ${spectator.nameColor}">
        ${escapeHtml(spectator.nickname)}
      </div>
    `;

    container.appendChild(specDiv);
  });
}

/**
 * Render game board (discard pile, deck, current color)
 */
function renderGameBoard() {
  if (!currentRoom) return;

  // Update deck count
  document.getElementById('deck-count').textContent = currentRoom.deckSize || 0;

  // Update discard pile (top card)
  const discardPile = document.getElementById('discard-pile');
  if (currentRoom.topCard) {
    discardPile.innerHTML = '';
    const cardEl = createCardElement(currentRoom.topCard);
    discardPile.appendChild(cardEl);
  }

  // Update current color indicator
  const colorCircle = document.getElementById('current-color');
  if (currentRoom.currentColor) {
    colorCircle.className = `color-circle ${currentRoom.currentColor}`;
  }

  // Update turn indicator
  updateTurnIndicator();

  // Render opponents
  renderOpponents();
}

/**
 * Render opponent hands (card backs with counts)
 */
function renderOpponents() {
  if (!currentRoom || currentRoom.gameState !== 'playing') return;

  const container = document.getElementById('opponents-area');
  container.innerHTML = '';

  currentRoom.players.forEach(player => {
    if (!player || player.id === myUserId) return;

    const handSize = currentRoom.handSizes ? currentRoom.handSizes[player.id] : 0;
    const hasUno = currentRoom.unoCalled && currentRoom.unoCalled[player.id];
    const isCurrent = currentRoom.currentPlayer === player.id;

    const oppDiv = document.createElement('div');
    oppDiv.className = `opponent ${isCurrent ? 'current-turn' : ''}`;

    oppDiv.innerHTML = `
      <div class="opponent-info">
        <span class="opponent-name" style="color: ${player.nameColor}">
          ${escapeHtml(player.nickname)}
          ${hasUno ? ' <span class="uno-badge">UNO</span>' : ''}
        </span>
        <span class="opponent-card-count">${handSize} cards</span>
      </div>
      <div class="opponent-cards">
        ${Array(Math.min(handSize, 10)).fill('').map(() =>
          '<div class="card card-back small"><span class="card-text">UNO</span></div>'
        ).join('')}
        ${handSize > 10 ? `<span class="more-cards">+${handSize - 10}</span>` : ''}
      </div>
    `;

    container.appendChild(oppDiv);
  });
}

/**
 * Render player's hand
 */
function renderPlayerHand() {
  const container = document.getElementById('player-hand');
  container.innerHTML = '';

  myHand.forEach(card => {
    const cardEl = createCardElement(card, true);
    cardEl.addEventListener('click', () => handleCardClick(card.id));

    // Highlight playable cards or dim non-playable cards
    if (currentRoom && currentRoom.currentPlayer === myUserId) {
      if (isCardPlayable(card)) {
        cardEl.classList.add('playable');
      } else {
        cardEl.classList.add('not-playable');
      }
    }

    container.appendChild(cardEl);
  });

  // Update UNO button
  const unoBtn = document.getElementById('uno-btn');
  unoBtn.disabled = myHand.length !== 1 || (currentRoom && currentRoom.unoCalled && currentRoom.unoCalled[myUserId]);
}

/**
 * Create card DOM element
 */
function createCardElement(card, interactive = false) {
  const cardDiv = document.createElement('div');
  cardDiv.className = `card ${card.color}`;
  if (interactive) {
    cardDiv.classList.add('interactive');
  }

  if (card.type === 'number') {
    cardDiv.innerHTML = `<span class="card-number">${card.value}</span>`;
  } else {
    const icon = getCardIcon(card.type);
    cardDiv.innerHTML = `<span class="card-icon">${icon}</span>`;
  }

  return cardDiv;
}

/**
 * Get icon for card type
 */
function getCardIcon(type) {
  switch (type) {
    case 'skip': return '⊘';
    case 'reverse': return '⇄';
    case 'draw2': return '+2';
    case 'wild': return '🌈';
    case 'wild-draw4': return '+4';
    default: return '?';
  }
}

/**
 * Get human-readable card name
 */
function getCardName(card) {
  if (card.type === 'number') {
    return `${card.color} ${card.value}`;
  }

  const typeNames = {
    'skip': 'Skip',
    'reverse': 'Reverse',
    'draw2': 'Draw Two',
    'wild': 'Wild',
    'wild-draw4': 'Wild Draw Four'
  };

  const typeName = typeNames[card.type] || card.type;
  return card.color === 'wild' ? typeName : `${card.color} ${typeName}`;
}

/**
 * Update game state UI
 */
function updateGameState() {
  if (!currentRoom) return;

  updateTurnIndicator();
  renderPlayers();
  renderOpponents();
}

/**
 * Update turn indicator text
 */
function updateTurnIndicator() {
  if (!currentRoom || currentRoom.gameState !== 'playing') {
    document.getElementById('current-turn-text').textContent = 'Waiting for players...';
    return;
  }

  const currentPlayer = currentRoom.players.find(p => p && p.id === currentRoom.currentPlayer);
  if (!currentPlayer) return;

  const text = currentPlayer.id === myUserId ? 'Your turn!' : `${currentPlayer.nickname}'s turn`;
  document.getElementById('current-turn-text').textContent = text;
}

/**
 * Highlight current player
 */
function highlightCurrentPlayer() {
  // Already handled in renderPlayers() with 'current-turn' class
  renderPlayers();
}

// ============================================================================
// NOTIFICATIONS
// ============================================================================

/**
 * Show notification toast
 */
function showNotification(message, type = 'info') {
  const toast = document.getElementById('notification-toast');
  const text = document.getElementById('notification-text');

  toast.className = `notification-toast ${type}`;
  text.textContent = message;
  toast.classList.add('show');

  setTimeout(() => {
    toast.classList.remove('show');
  }, 3000);
}

// ============================================================================
// ERROR HANDLING
// ============================================================================

/**
 * Handle server errors
 */
function handleError(data) {
  console.error('[Uno Client] Error:', data.message);
  showNotification(data.message, 'error');
}

// ============================================================================
// UTILITIES
// ============================================================================

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// ============================================================================
// TURN TIMER
// ============================================================================

/**
 * Start the turn timer countdown
 */
function startTurnTimer(seconds) {
  // Stop any existing timer
  stopTurnTimer();

  // Show timer container
  const container = document.getElementById('turn-timer-container');
  const timerText = document.getElementById('turn-timer-text');
  container.style.display = 'flex';

  // Calculate end time
  turnEndTime = Date.now() + (seconds * 1000);

  // Update immediately
  updateTurnTimer();

  // Update every 100ms
  turnTimerInterval = setInterval(updateTurnTimer, 100);
}

/**
 * Stop the turn timer
 */
function stopTurnTimer() {
  if (turnTimerInterval) {
    clearInterval(turnTimerInterval);
    turnTimerInterval = null;
  }

  // Hide timer container
  const container = document.getElementById('turn-timer-container');
  if (container) {
    container.style.display = 'none';
  }

  turnEndTime = null;
}

/**
 * Update the turn timer display
 */
function updateTurnTimer() {
  if (!turnEndTime) {
    stopTurnTimer();
    return;
  }

  const remaining = Math.max(0, Math.ceil((turnEndTime - Date.now()) / 1000));
  const timerText = document.getElementById('turn-timer-text');

  if (!timerText) return;

  timerText.textContent = `${remaining}s`;

  // Update color based on remaining time
  timerText.className = 'timer-text';
  if (remaining <= 5) {
    timerText.classList.add('danger');
  } else if (remaining <= 10) {
    timerText.classList.add('warning');
  }

  // Stop when time's up
  if (remaining <= 0) {
    stopTurnTimer();
  }
}

// ============================================================================
// INITIALIZE ON LOAD
// ============================================================================

// Wait for gameAPI to be ready
if (typeof gameAPI !== 'undefined') {
  init();
} else {
  window.addEventListener('load', init);
}
