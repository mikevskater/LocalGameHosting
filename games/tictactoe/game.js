// Tic-Tac-Toe Game Client

let currentUser = null;
let currentRoom = null;
let playerRole = null; // 'player' or 'spectator'
let playerIndex = -1; // 0 or 1

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

  currentUser = profileResult.user;

  // Set up event listeners
  setupEventListeners();

  // Request room list
  gameAPI.emit('get-rooms', {});
});

function setupEventListeners() {
  // Room list
  gameAPI.on('room-list', (data) => {
    renderRoomList(data.rooms);
  });

  // Room created
  gameAPI.on('room-created', (data) => {
    currentRoom = data.room;
    playerRole = 'player';
    playerIndex = 0;
    showGameScreen();
  });

  // Room joined
  gameAPI.on('room-joined', (data) => {
    currentRoom = data.room;
    playerRole = data.role;
    playerIndex = data.playerIndex !== undefined ? data.playerIndex : -1;

    // Load chat history if provided
    if (data.chatHistory && data.chatHistory.length > 0) {
      data.chatHistory.forEach(msg => {
        addChatMessage(msg.user, msg.message);
      });
    }

    showGameScreen();
  });

  // Player joined
  gameAPI.on('player-joined', (data) => {
    currentRoom = data.room;
    renderPlayers();
  });

  // Player left
  gameAPI.on('player-left', (data) => {
    currentRoom = data.room;
    renderPlayers();
    updateTurnIndicator();
  });

  // Spectator joined
  gameAPI.on('spectator-joined', (data) => {
    if (currentRoom) {
      currentRoom.spectators.push(data.user);
      renderSpectators();
    }
  });

  // Game started
  gameAPI.on('game-started', (data) => {
    currentRoom = data.room;
    renderGameBoard();
    renderPlayers();
    updateTurnIndicator();
  });

  // Move made
  gameAPI.on('move-made', (data) => {
    currentRoom = data.room;
    renderGameBoard();
    updateTurnIndicator();
  });

  // Game over
  gameAPI.on('game-over', (data) => {
    currentRoom = data.room;
    renderGameBoard();
    showGameOver(data.winner, data.winningLine);
  });

  // Game ended (player left)
  gameAPI.on('game-ended', (data) => {
    alert(data.reason);
    leaveGame();
  });

  // Chat message
  gameAPI.on('chat-message', (data) => {
    addChatMessage(data.user, data.message);
  });

  // Error
  gameAPI.on('error', (data) => {
    alert(data.message);
  });

  // Chat input
  document.getElementById('chat-input').addEventListener('keypress', (e) => {
    if (e.key === 'Enter') {
      const message = e.target.value.trim();
      if (message) {
        gameAPI.emit('chat-message', { message });
        e.target.value = '';
      }
    }
  });
}

// UI Functions

function renderRoomList(rooms) {
  const container = document.getElementById('rooms-container');

  if (rooms.length === 0) {
    container.innerHTML = '<div class="empty-message">No rooms available. Create one to start playing!</div>';
    return;
  }

  container.innerHTML = rooms.map(room => {
    const statusClass = `status-${room.gameState}`;
    const statusText = room.gameState === 'waiting' ? 'Waiting' :
                       room.gameState === 'playing' ? 'In Progress' : 'Finished';

    const canJoin = room.playerCount < 2 && room.gameState === 'waiting';

    return `
      <div class="room-card">
        <div class="room-header">
          <div class="room-name">${escapeHtml(room.name)}</div>
          <div class="room-status ${statusClass}">${statusText}</div>
        </div>
        <div class="room-info">
          <div>📐 Board: ${room.boardSize}x${room.boardSize}</div>
          <div>🎯 Win: ${room.winCondition} in a row</div>
          <div>👥 Players: ${room.playerCount}/2</div>
          <div>👀 Spectators: ${room.spectatorCount}</div>
        </div>
        <div class="room-actions">
          ${canJoin ? `
            <button class="btn btn-primary btn-small" onclick="joinRoom('${room.id}')">
              Join Game
            </button>
          ` : ''}
          <button class="btn btn-secondary btn-small" onclick="spectateRoom('${room.id}')">
            Spectate
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function showGameScreen() {
  document.getElementById('lobby-screen').classList.remove('active');
  document.getElementById('game-screen').classList.add('active');

  document.getElementById('room-title').textContent = currentRoom.name;

  renderGameBoard();
  renderPlayers();
  renderSpectators();
  updateTurnIndicator();
}

function renderGameBoard() {
  const board = document.getElementById('board');
  const size = currentRoom.boardSize;
  const cellSize = Math.min(60, Math.floor(500 / size));

  board.style.gridTemplateColumns = `repeat(${size}, ${cellSize}px)`;
  board.style.gridTemplateRows = `repeat(${size}, ${cellSize}px)`;

  board.innerHTML = '';

  for (let row = 0; row < size; row++) {
    for (let col = 0; col < size; col++) {
      const cell = document.createElement('button');
      cell.className = 'cell';
      cell.style.width = cellSize + 'px';
      cell.style.height = cellSize + 'px';
      cell.style.fontSize = (cellSize * 0.6) + 'px';

      const value = currentRoom.board[row][col];

      if (value === 0) {
        cell.textContent = 'X';
        cell.style.color = '#e74c3c';
      } else if (value === 1) {
        cell.textContent = 'O';
        cell.style.color = '#3498db';
      }

      // Check if this cell is part of winning line
      if (currentRoom.winningLine) {
        const isWinning = currentRoom.winningLine.some(([r, c]) => r === row && c === col);
        if (isWinning) {
          cell.classList.add('winning');
        }
      }

      // Disable if not player's turn or game over
      const isMyTurn = playerRole === 'player' &&
                       playerIndex === currentRoom.currentTurn &&
                       currentRoom.gameState === 'playing';
      const isEmpty = value === null;

      cell.disabled = !isMyTurn || !isEmpty;

      cell.onclick = () => makeMove(row, col);

      board.appendChild(cell);
    }
  }
}

function renderPlayers() {
  const container = document.getElementById('players-list');

  // Filter out null players (disconnected)
  const activePlayers = currentRoom.players.filter(p => p !== null);

  if (activePlayers.length === 0) {
    container.innerHTML = '<div class="empty-message">Waiting for players...</div>';
    return;
  }

  container.innerHTML = currentRoom.players.map((player, index) => {
    const marker = index === 0 ? 'X' : 'O';
    const markerClass = index === 0 ? 'player-x' : 'player-o';

    if (player === null) {
      // Empty slot
      return `
        <div class="player-item" style="opacity: 0.5;">
          <div class="player-marker ${markerClass}">${marker}</div>
          <div>
            <div style="font-weight: bold; color: #999;">
              Empty Slot
            </div>
          </div>
        </div>
      `;
    }

    const isYou = player.id === currentUser.id;

    return `
      <div class="player-item">
        <div class="player-marker ${markerClass}">${marker}</div>
        <div>
          <div style="font-weight: bold; color: ${player.nameColor}">
            ${escapeHtml(player.nickname)} ${isYou ? '(You)' : ''}
          </div>
        </div>
      </div>
    `;
  }).join('');

  updateRoleSwitchButtons();
}

function renderSpectators() {
  const container = document.getElementById('spectators-list');
  const count = document.getElementById('spectator-count');

  count.textContent = currentRoom.spectators.length;

  if (currentRoom.spectators.length === 0) {
    container.innerHTML = '<div class="empty-message">No spectators</div>';
    updateRoleSwitchButtons();
    return;
  }

  container.innerHTML = currentRoom.spectators.map(spec => {
    const isYou = spec.id === currentUser.id;
    return `
      <div style="padding: 5px; color: ${spec.nameColor}">
        ${escapeHtml(spec.nickname)} ${isYou ? '(You)' : ''}
      </div>
    `;
  }).join('');

  updateRoleSwitchButtons();
}

function updateTurnIndicator() {
  const indicator = document.getElementById('turn-indicator');

  if (currentRoom.gameState === 'waiting') {
    indicator.textContent = 'Waiting for opponent...';
    indicator.className = 'turn-indicator';
  } else if (currentRoom.gameState === 'playing') {
    const currentPlayer = currentRoom.players[currentRoom.currentTurn];

    // Handle case where player disconnected
    if (!currentPlayer) {
      indicator.textContent = 'Waiting for player to rejoin...';
      indicator.className = 'turn-indicator';
      return;
    }

    if (playerRole === 'spectator') {
      indicator.textContent = `${currentPlayer.nickname}'s turn`;
      indicator.className = 'turn-indicator';
    } else if (currentRoom.currentTurn === playerIndex) {
      indicator.textContent = 'Your Turn!';
      indicator.className = 'turn-indicator your-turn';
    } else {
      indicator.textContent = `${currentPlayer.nickname}'s turn`;
      indicator.className = 'turn-indicator opponent-turn';
    }
  } else if (currentRoom.gameState === 'finished') {
    indicator.textContent = 'Game Over';
    indicator.className = 'turn-indicator';
  }
}

function showGameOver(winner, winningLine) {
  const modal = document.getElementById('game-over-modal');
  const icon = document.getElementById('winner-icon');
  const text = document.getElementById('winner-text');

  if (winner === 'draw') {
    icon.textContent = '🤝';
    text.textContent = "It's a Draw!";
  } else if (winner === currentUser.id) {
    icon.textContent = '🏆';
    text.textContent = 'You Won!';
  } else {
    const winnerPlayer = currentRoom.players.find(p => p && p.id === winner);
    icon.textContent = '😔';
    text.textContent = winnerPlayer ? `${winnerPlayer.nickname} Won!` : 'Game Over';
  }

  // Show appropriate controls based on if user is host
  const isHost = currentRoom.host === currentUser.id;
  const isPlayer = playerRole === 'player';

  document.getElementById('game-over-host-controls').style.display = (isHost && isPlayer) ? 'block' : 'none';
  document.getElementById('game-over-player-controls').style.display = (!isHost && isPlayer) ? 'block' : 'none';

  modal.classList.add('active');
}

function addChatMessage(user, message) {
  const container = document.getElementById('chat-messages');

  const msgDiv = document.createElement('div');
  msgDiv.className = 'chat-message';
  msgDiv.innerHTML = `
    <span class="chat-user" style="color: ${user.nameColor}">
      ${escapeHtml(user.nickname)}:
    </span>
    <span>${escapeHtml(message)}</span>
  `;

  container.appendChild(msgDiv);
  container.scrollTop = container.scrollHeight;
}

// Action Functions

function showCreateRoomModal() {
  document.getElementById('create-room-modal').classList.add('active');
  document.getElementById('room-name').value = `${currentUser.nickname}'s Game`;
}

function hideCreateRoomModal() {
  document.getElementById('create-room-modal').classList.remove('active');
}

function createRoom() {
  const name = document.getElementById('room-name').value.trim();
  const boardSize = parseInt(document.getElementById('board-size').value);
  const winCondition = parseInt(document.getElementById('win-condition').value);

  if (!name) {
    alert('Please enter a room name');
    return;
  }

  if (winCondition > boardSize) {
    alert('Win condition cannot be greater than board size');
    return;
  }

  gameAPI.emit('create-room', {
    name,
    boardSize,
    winCondition
  });

  hideCreateRoomModal();
}

function joinRoom(roomId) {
  gameAPI.emit('join-room', { roomId });
}

function spectateRoom(roomId) {
  gameAPI.emit('spectate-room', { roomId });
}

function leaveGame() {
  gameAPI.emit('leave-room', {});

  currentRoom = null;
  playerRole = null;
  playerIndex = -1;

  document.getElementById('game-screen').classList.remove('active');
  document.getElementById('lobby-screen').classList.add('active');
  document.getElementById('game-over-modal').classList.remove('active');

  // Request updated room list
  gameAPI.emit('get-rooms', {});
}

function makeMove(row, col) {
  if (playerRole !== 'player' || currentRoom.gameState !== 'playing') {
    return;
  }

  gameAPI.emit('make-move', { row, col });
}

function requestRematch() {
  document.getElementById('game-over-modal').classList.remove('active');
  gameAPI.emit('rematch', {});
}

function showNewGameModal() {
  // Pre-fill with current settings
  document.getElementById('new-board-size').value = currentRoom.boardSize;
  document.getElementById('new-win-condition').value = currentRoom.winCondition;

  document.getElementById('game-over-modal').classList.remove('active');
  document.getElementById('new-game-modal').classList.add('active');
}

function hideNewGameModal() {
  document.getElementById('new-game-modal').classList.remove('active');
}

function startNewGame() {
  const boardSize = parseInt(document.getElementById('new-board-size').value);
  const winCondition = parseInt(document.getElementById('new-win-condition').value);

  if (winCondition > boardSize) {
    alert('Win condition cannot be greater than board size');
    return;
  }

  gameAPI.emit('new-game', {
    boardSize,
    winCondition
  });

  hideNewGameModal();
}

function switchToSpectator() {
  if (!currentRoom || playerRole !== 'player') return;

  // Use the spectate-room event to switch to spectator
  gameAPI.emit('spectate-room', { roomId: currentRoom.id });
}

function switchToPlayer() {
  if (!currentRoom || playerRole !== 'spectator') return;

  // Check if there's an empty slot
  const hasEmptySlot = currentRoom.players.some(p => p === null);
  const activePlayers = currentRoom.players.filter(p => p !== null);

  if (!hasEmptySlot && activePlayers.length >= 2) {
    alert('No player slots available');
    return;
  }

  // Use the join-room event to switch to player
  gameAPI.emit('join-room', { roomId: currentRoom.id });
}

function updateRoleSwitchButtons() {
  const switchToSpectatorBtn = document.getElementById('switch-to-spectator-btn');
  const switchToPlayerBtn = document.getElementById('switch-to-player-btn');

  if (!currentRoom) {
    switchToSpectatorBtn.style.display = 'none';
    switchToPlayerBtn.style.display = 'none';
    return;
  }

  // Show "Become Spectator" if user is a player
  if (playerRole === 'player') {
    switchToSpectatorBtn.style.display = 'block';
    switchToPlayerBtn.style.display = 'none';
  }
  // Show "Join as Player" if user is spectator and there's room
  else if (playerRole === 'spectator') {
    const hasEmptySlot = currentRoom.players.some(p => p === null);
    const activePlayers = currentRoom.players.filter(p => p !== null);
    const canJoin = hasEmptySlot || activePlayers.length < 2;

    switchToSpectatorBtn.style.display = 'none';
    switchToPlayerBtn.style.display = canJoin ? 'block' : 'none';
  }
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
