/**
 * Multiplayer Drawing Game - Server Module
 *
 * This server-side module handles:
 * - Canvas state storage and synchronization
 * - Chat message history
 * - Player cursor positions
 */

// Game state
let canvasHistory = [];
let chatHistory = [];
let playerCursors = new Map(); // userId -> cursor position

/**
 * Called when the game module is loaded
 */
function onLoad() {
  console.log('[Drawing Game] Server module loaded');
  // Reset state when game loads
  canvasHistory = [];
  chatHistory = [];
  playerCursors.clear();
}

/**
 * Called when the game module is unloaded (game switched)
 */
function onUnload() {
  console.log('[Drawing Game] Server module unloaded');
  // Clean up if needed
  canvasHistory = [];
  chatHistory = [];
  playerCursors.clear();
}

/**
 * Called when a player connects
 */
function handleConnection(socket, io, user) {
  console.log(`[Drawing Game] Player connected: ${user.nickname}`);

  // Send current canvas state to the new player
  if (canvasHistory.length > 0) {
    socket.emit('game-event', {
      event: 'canvas-state',
      data: { history: canvasHistory }
    });
  }

  // Send chat history to the new player
  if (chatHistory.length > 0) {
    chatHistory.forEach(msg => {
      socket.emit('game-event', {
        event: 'chat-message',
        data: msg.data,
        user: msg.user
      });
    });
  }

  // Handle drawing events
  socket.on('game-event', (eventData) => {
    if (eventData.event === 'draw') {
      // Store drawing data
      canvasHistory.push(eventData.data);

      // Broadcast to all other players
      socket.broadcast.emit('game-event', {
        event: 'draw',
        data: eventData.data,
        user: user
      });
    }

    else if (eventData.event === 'clear-canvas') {
      // Clear canvas history
      canvasHistory = [];

      // Broadcast to all players
      socket.broadcast.emit('game-event', {
        event: 'clear-canvas',
        data: {},
        user: user
      });
    }

    else if (eventData.event === 'cursor-move') {
      // Update player cursor position
      playerCursors.set(user.id, eventData.data);

      // Broadcast to all other players
      socket.broadcast.emit('game-event', {
        event: 'cursor-move',
        data: eventData.data,
        user: user
      });
    }

    else if (eventData.event === 'chat-message') {
      // Store chat message
      const chatMessage = {
        user: user,
        data: eventData.data
      };
      chatHistory.push(chatMessage);

      // Limit chat history to last 100 messages
      if (chatHistory.length > 100) {
        chatHistory.shift();
      }

      // Broadcast to all other players
      socket.broadcast.emit('game-event', {
        event: 'chat-message',
        data: eventData.data,
        user: user
      });
    }

    else if (eventData.event === 'request-canvas-state') {
      // Send current canvas state (redundant now, but keeping for compatibility)
      if (canvasHistory.length > 0) {
        socket.emit('game-event', {
          event: 'canvas-state',
          data: { history: canvasHistory }
        });
      }
    }
  });
}

/**
 * Called when a player disconnects
 */
function handleDisconnection(socket, io, user) {
  console.log(`[Drawing Game] Player disconnected: ${user.nickname}`);

  // Remove player cursor
  playerCursors.delete(user.id);
}

/**
 * Get current game state (for admin or debugging)
 */
function getState() {
  return {
    canvasHistory: canvasHistory.length,
    chatHistory: chatHistory.length,
    activePlayers: playerCursors.size
  };
}

// Export the module interface
module.exports = {
  onLoad,
  onUnload,
  handleConnection,
  handleDisconnection,
  getState
};
