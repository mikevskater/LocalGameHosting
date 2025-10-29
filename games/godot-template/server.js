/**
 * Godot Game - Server Module Template
 *
 * This handles server-side game logic for your Godot game
 */

// Game state storage
let gameState = {
  players: new Map(),
  // Add your game-specific state here
};

/**
 * Called when the game module is loaded
 */
function onLoad() {
  console.log('[Godot Game] Server module loaded');
  gameState.players.clear();
}

/**
 * Called when the game module is unloaded
 */
function onUnload() {
  console.log('[Godot Game] Server module unloaded');
  gameState.players.clear();
}

/**
 * Called when a player connects
 */
function handleConnection(socket, io, user) {
  console.log(`[Godot Game] ${user.nickname} connected`);

  // Add player to game
  gameState.players.set(user.id, {
    user: user,
    socketId: socket.id,
    // Add player-specific data here
    position: { x: 0, y: 0 },
    health: 100
  });

  // Send current game state to new player
  socket.emit('game-event', {
    event: 'game-state',
    data: {
      players: Array.from(gameState.players.values()).map(p => ({
        id: p.user.id,
        nickname: p.user.nickname,
        nameColor: p.user.nameColor,
        playerColor: p.user.playerColor,
        position: p.position,
        health: p.health
      }))
    }
  });

  // Notify others of new player
  socket.broadcast.emit('game-event', {
    event: 'player-joined',
    data: {
      id: user.id,
      nickname: user.nickname,
      nameColor: user.nameColor,
      playerColor: user.playerColor
    },
    user: user
  });

  // Handle game events from this player
  socket.on('game-event', (eventData) => {
    handleGameEvent(socket, io, user, eventData);
  });
}

/**
 * Handle specific game events
 */
function handleGameEvent(socket, io, user, eventData) {
  const event = eventData.event;
  const data = eventData.data;

  switch (event) {
    case 'player-moved':
      handlePlayerMove(socket, io, user, data);
      break;

    case 'player-action':
      handlePlayerAction(socket, io, user, data);
      break;

    case 'chat-message':
      handleChatMessage(socket, io, user, data);
      break;

    // Add your game-specific events here
    default:
      console.log(`[Godot Game] Unknown event: ${event}`);
  }
}

/**
 * Handle player movement
 */
function handlePlayerMove(socket, io, user, data) {
  const player = gameState.players.get(user.id);
  if (!player) return;

  // Update player position
  player.position = {
    x: data.x || 0,
    y: data.y || 0
  };

  // Broadcast to all other players
  socket.broadcast.emit('game-event', {
    event: 'player-moved',
    data: {
      x: player.position.x,
      y: player.position.y
    },
    user: user
  });
}

/**
 * Handle player actions (shooting, jumping, etc.)
 */
function handlePlayerAction(socket, io, user, data) {
  console.log(`[Godot Game] ${user.nickname} performed action:`, data.action);

  // Validate action on server if needed
  // Process game logic here

  // Broadcast to all other players
  socket.broadcast.emit('game-event', {
    event: 'player-action',
    data: data,
    user: user
  });
}

/**
 * Handle chat messages
 */
function handleChatMessage(socket, io, user, data) {
  // Broadcast chat message to all players
  io.emit('game-event', {
    event: 'chat-message',
    data: {
      message: data.message,
      timestamp: Date.now()
    },
    user: user
  });
}

/**
 * Called when a player disconnects
 */
function handleDisconnection(socket, io, user) {
  console.log(`[Godot Game] ${user.nickname} disconnected`);

  // Remove player from game
  gameState.players.delete(user.id);

  // Notify others
  io.emit('game-event', {
    event: 'player-left',
    data: {
      id: user.id
    },
    user: user
  });
}

/**
 * Get current game state (for debugging/admin)
 */
function getState() {
  return {
    activePlayers: gameState.players.size,
    players: Array.from(gameState.players.keys())
  };
}

// Export module interface
module.exports = {
  onLoad,
  onUnload,
  handleConnection,
  handleDisconnection,
  getState
};
