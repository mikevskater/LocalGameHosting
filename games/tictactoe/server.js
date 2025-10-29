/**
 * Tic-Tac-Toe - Server Module
 *
 * Features:
 * - Multiple game rooms
 * - Custom board sizes (3x3 to 10x10)
 * - Custom win conditions (3-5 in a row)
 * - Spectator support
 * - Turn validation
 */

// Game state
const rooms = new Map();

function onLoad() {
  console.log('[Tic-Tac-Toe] Server module loaded');
  rooms.clear();
}

function onUnload() {
  console.log('[Tic-Tac-Toe] Server module unloaded');
  rooms.clear();
}

function handleConnection(socket, io, user) {
  console.log(`[Tic-Tac-Toe] ${user.nickname} connected`);

  // Send list of available rooms
  sendRoomList(socket);

  // Handle game events
  socket.on('game-event', (eventData) => {
    const event = eventData.event;
    const data = eventData.data;

    switch (event) {
      case 'get-rooms':
        sendRoomList(socket);
        break;

      case 'create-room':
        createRoom(socket, io, user, data);
        break;

      case 'join-room':
        joinRoom(socket, io, user, data.roomId, false);
        break;

      case 'spectate-room':
        joinRoom(socket, io, user, data.roomId, true);
        break;

      case 'leave-room':
        leaveRoom(socket, io, user);
        break;

      case 'make-move':
        makeMove(socket, io, user, data);
        break;

      case 'rematch':
        handleRematch(socket, io, user);
        break;

      case 'new-game':
        handleNewGame(socket, io, user, data);
        break;

      case 'chat-message':
        handleChat(socket, io, user, data);
        break;
    }
  });
}

function handleDisconnection(socket, io, user) {
  console.log(`[Tic-Tac-Toe] ${user.nickname} disconnected`);
  leaveRoom(socket, io, user);
}

// Room management

function createRoom(socket, io, user, config) {
  const roomId = generateRoomId();

  const room = {
    id: roomId,
    name: config.name || `${user.nickname}'s Game`,
    host: user.id,
    boardSize: Math.min(Math.max(config.boardSize || 3, 3), 10),
    winCondition: Math.min(Math.max(config.winCondition || 3, 3), 5),
    players: [user],
    spectators: [],
    board: [],
    currentTurn: 0,
    gameState: 'waiting', // waiting, playing, finished
    winner: null,
    winningLine: null,
    createdAt: Date.now(),
    chatHistory: []
  };

  // Initialize empty board
  room.board = Array(room.boardSize).fill(null).map(() =>
    Array(room.boardSize).fill(null)
  );

  rooms.set(roomId, room);
  socket.currentRoom = roomId;

  // Send room created event
  socket.emit('game-event', {
    event: 'room-created',
    data: { roomId, room: sanitizeRoom(room) }
  });

  // Broadcast room list update
  broadcastRoomList(io);

  console.log(`[Tic-Tac-Toe] Room created: ${roomId} by ${user.nickname}`);
}

function joinRoom(socket, io, user, roomId, asSpectator) {
  const room = rooms.get(roomId);

  if (!room) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Room not found' }
    });
    return;
  }

  // Remove from current room if in one
  leaveRoom(socket, io, user, false);

  if (asSpectator) {
    // Join as spectator
    // Remove from spectators list if already there
    room.spectators = room.spectators.filter(s => s.id !== user.id);
    room.spectators.push(user);

    socket.currentRoom = roomId;
    socket.isSpectator = true;

    // Send chat history to new spectator
    socket.emit('game-event', {
      event: 'room-joined',
      data: { room: sanitizeRoom(room), role: 'spectator', chatHistory: room.chatHistory }
    });

    // Notify others
    broadcastToRoom(io, roomId, {
      event: 'spectator-joined',
      data: { user }
    });
  } else {
    // Join as player
    // Check if user was previously a player (rejoin scenario)
    let playerIndex = room.players.findIndex(p => p && p.id === user.id);

    if (playerIndex === -1) {
      // Not rejoining, find empty slot or add new player
      const emptySlot = room.players.findIndex(p => p === null);

      if (emptySlot !== -1) {
        // Fill empty slot
        room.players[emptySlot] = user;
        playerIndex = emptySlot;
      } else {
        // Add new player
        if (room.players.length >= 2) {
          socket.emit('game-event', {
            event: 'error',
            data: { message: 'Room is full' }
          });
          return;
        }

        if (room.gameState !== 'waiting') {
          socket.emit('game-event', {
            event: 'error',
            data: { message: 'Game already in progress' }
          });
          return;
        }

        room.players.push(user);
        playerIndex = room.players.length - 1;
      }
    }
    // else: playerIndex already set (rejoining)

    socket.currentRoom = roomId;
    socket.isSpectator = false;

    // Send room state with chat history
    socket.emit('game-event', {
      event: 'room-joined',
      data: { room: sanitizeRoom(room), role: 'player', playerIndex, chatHistory: room.chatHistory }
    });

    // Count non-null players
    const activePlayers = room.players.filter(p => p !== null);

    // Start game if 2 players and in waiting state
    if (activePlayers.length === 2 && room.gameState === 'waiting') {
      room.gameState = 'playing';
      broadcastToRoom(io, roomId, {
        event: 'game-started',
        data: { room: sanitizeRoom(room) }
      });
    } else {
      // Notify player joined/rejoined
      broadcastToRoom(io, roomId, {
        event: 'player-joined',
        data: { user, room: sanitizeRoom(room) }
      });
    }
  }

  // Update room list
  broadcastRoomList(io);

  console.log(`[Tic-Tac-Toe] ${user.nickname} joined room ${roomId} as ${asSpectator ? 'spectator' : 'player'}`);
}

function leaveRoom(socket, io, user, broadcast = true) {
  const roomId = socket.currentRoom;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const wasSpectator = socket.isSpectator;

  if (wasSpectator) {
    // Remove from spectators
    room.spectators = room.spectators.filter(s => s.id !== user.id);
  } else {
    // Remove from players - keep slot open for potential rejoin
    const playerIndex = room.players.findIndex(p => p.id === user.id);
    if (playerIndex !== -1) {
      room.players[playerIndex] = null; // Leave slot empty for rejoin
    }

    // If a player left during active game, notify others
    if (room.gameState === 'playing') {
      if (broadcast) {
        broadcastToRoom(io, roomId, {
          event: 'player-left',
          data: {
            userId: user.id,
            room: sanitizeRoom(room)
          }
        });
      }
    } else if (room.gameState === 'waiting') {
      // In waiting state, actually remove the player
      room.players = room.players.filter(p => p !== null && p.id !== user.id);

      if (broadcast) {
        broadcastToRoom(io, roomId, {
          event: 'player-left',
          data: {
            userId: user.id,
            room: sanitizeRoom(room)
          }
        });
      }
    }
  }

  // Delete room if all player slots are empty and no spectators
  const activePlayers = room.players.filter(p => p !== null);
  if (activePlayers.length === 0 && room.spectators.length === 0) {
    rooms.delete(roomId);
    console.log(`[Tic-Tac-Toe] Room ${roomId} deleted (empty)`);
  }

  socket.currentRoom = null;
  socket.isSpectator = false;

  if (broadcast) {
    broadcastRoomList(io);
  }
}

function makeMove(socket, io, user, data) {
  const roomId = socket.currentRoom;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room || room.gameState !== 'playing') return;

  const { row, col } = data;
  const playerIndex = room.players.findIndex(p => p.id === user.id);

  // Validate move
  if (playerIndex === -1) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'You are not a player in this game' }
    });
    return;
  }

  if (playerIndex !== room.currentTurn) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Not your turn' }
    });
    return;
  }

  if (row < 0 || row >= room.boardSize || col < 0 || col >= room.boardSize) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Invalid move position' }
    });
    return;
  }

  if (room.board[row][col] !== null) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Cell already occupied' }
    });
    return;
  }

  // Make the move
  room.board[row][col] = playerIndex;

  // Check for win
  const winResult = checkWin(room, row, col, playerIndex);

  if (winResult.won) {
    room.gameState = 'finished';
    room.winner = user.id;
    room.winningLine = winResult.line;

    broadcastToRoom(io, roomId, {
      event: 'game-over',
      data: {
        winner: user,
        winningLine: winResult.line,
        room: sanitizeRoom(room)
      }
    });
  } else if (isBoardFull(room)) {
    // Draw
    room.gameState = 'finished';
    room.winner = 'draw';

    broadcastToRoom(io, roomId, {
      event: 'game-over',
      data: {
        winner: 'draw',
        room: sanitizeRoom(room)
      }
    });
  } else {
    // Next turn
    room.currentTurn = (room.currentTurn + 1) % 2;

    broadcastToRoom(io, roomId, {
      event: 'move-made',
      data: {
        row,
        col,
        player: playerIndex,
        nextTurn: room.currentTurn,
        room: sanitizeRoom(room)
      }
    });
  }
}

function handleRematch(socket, io, user) {
  const roomId = socket.currentRoom;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room || room.gameState !== 'finished') return;

  const playerIndex = room.players.findIndex(p => p.id === user.id);
  if (playerIndex === -1) return;

  // Reset game
  room.board = Array(room.boardSize).fill(null).map(() =>
    Array(room.boardSize).fill(null)
  );
  room.currentTurn = 0;
  room.gameState = 'playing';
  room.winner = null;
  room.winningLine = null;

  broadcastToRoom(io, roomId, {
    event: 'game-started',
    data: { room: sanitizeRoom(room) }
  });

  console.log(`[Tic-Tac-Toe] Rematch started in room ${roomId}`);
}

function handleNewGame(socket, io, user, data) {
  const roomId = socket.currentRoom;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room || room.gameState !== 'finished') return;

  // Only host can start new game with new settings
  if (room.host !== user.id) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Only the host can change game settings' }
    });
    return;
  }

  // Validate new settings
  const boardSize = Math.min(Math.max(data.boardSize || room.boardSize, 3), 10);
  const winCondition = Math.min(Math.max(data.winCondition || room.winCondition, 3), 5);

  if (winCondition > boardSize) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Win condition cannot be greater than board size' }
    });
    return;
  }

  // Update room settings
  room.boardSize = boardSize;
  room.winCondition = winCondition;

  // Reset board with new size
  room.board = Array(boardSize).fill(null).map(() =>
    Array(boardSize).fill(null)
  );
  room.currentTurn = 0;
  room.gameState = 'playing';
  room.winner = null;
  room.winningLine = null;

  broadcastToRoom(io, roomId, {
    event: 'game-started',
    data: { room: sanitizeRoom(room) }
  });

  console.log(`[Tic-Tac-Toe] New game started in room ${roomId} with ${boardSize}x${boardSize} board`);
}

function handleChat(socket, io, user, data) {
  const roomId = socket.currentRoom;
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  const message = {
    user,
    message: data.message,
    timestamp: Date.now()
  };

  room.chatHistory.push(message);

  // Limit history to 50 messages
  if (room.chatHistory.length > 50) {
    room.chatHistory.shift();
  }

  broadcastToRoom(io, roomId, {
    event: 'chat-message',
    data: message
  });
}

// Helper functions

function checkWin(room, row, col, player) {
  const size = room.boardSize;
  const win = room.winCondition;
  const board = room.board;

  // Directions: horizontal, vertical, diagonal-right, diagonal-left
  const directions = [
    [0, 1],  // horizontal
    [1, 0],  // vertical
    [1, 1],  // diagonal right
    [1, -1]  // diagonal left
  ];

  for (const [dx, dy] of directions) {
    let count = 1;
    const line = [[row, col]];

    // Check positive direction
    for (let i = 1; i < win; i++) {
      const newRow = row + dx * i;
      const newCol = col + dy * i;

      if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size &&
          board[newRow][newCol] === player) {
        count++;
        line.push([newRow, newCol]);
      } else {
        break;
      }
    }

    // Check negative direction
    for (let i = 1; i < win; i++) {
      const newRow = row - dx * i;
      const newCol = col - dy * i;

      if (newRow >= 0 && newRow < size && newCol >= 0 && newCol < size &&
          board[newRow][newCol] === player) {
        count++;
        line.unshift([newRow, newCol]);
      } else {
        break;
      }
    }

    if (count >= win) {
      return { won: true, line };
    }
  }

  return { won: false };
}

function isBoardFull(room) {
  for (let row of room.board) {
    for (let cell of row) {
      if (cell === null) return false;
    }
  }
  return true;
}

function generateRoomId() {
  return 'room_' + Math.random().toString(36).substr(2, 9);
}

function sanitizeRoom(room) {
  // Filter out null players for accurate count
  const activePlayers = room.players.filter(p => p !== null);

  return {
    id: room.id,
    name: room.name,
    host: room.host,
    boardSize: room.boardSize,
    winCondition: room.winCondition,
    players: room.players, // Keep nulls so client knows which slots are open
    spectators: room.spectators,
    board: room.board,
    currentTurn: room.currentTurn,
    gameState: room.gameState,
    winner: room.winner,
    winningLine: room.winningLine,
    playerCount: activePlayers.length,
    spectatorCount: room.spectators.length
  };
}

function sendRoomList(socket) {
  const roomList = Array.from(rooms.values()).map(room => {
    // Filter out null players for room list
    const activePlayers = room.players.filter(p => p !== null);

    return {
      id: room.id,
      name: room.name,
      host: room.host,
      boardSize: room.boardSize,
      winCondition: room.winCondition,
      playerCount: activePlayers.length,
      spectatorCount: room.spectators.length,
      gameState: room.gameState,
      players: activePlayers.map(p => ({ id: p.id, nickname: p.nickname }))
    };
  });

  socket.emit('game-event', {
    event: 'room-list',
    data: { rooms: roomList }
  });
}

function broadcastRoomList(io) {
  const roomList = Array.from(rooms.values()).map(room => {
    // Filter out null players for room list
    const activePlayers = room.players.filter(p => p !== null);

    return {
      id: room.id,
      name: room.name,
      host: room.host,
      boardSize: room.boardSize,
      winCondition: room.winCondition,
      playerCount: activePlayers.length,
      spectatorCount: room.spectators.length,
      gameState: room.gameState,
      players: activePlayers.map(p => ({ id: p.id, nickname: p.nickname }))
    };
  });

  io.emit('game-event', {
    event: 'room-list',
    data: { rooms: roomList }
  });
}

function broadcastToRoom(io, roomId, eventData) {
  // Send to all sockets in the room
  io.sockets.sockets.forEach(socket => {
    if (socket.currentRoom === roomId) {
      socket.emit('game-event', eventData);
    }
  });
}

function getState() {
  return {
    activeRooms: rooms.size,
    totalPlayers: Array.from(rooms.values()).reduce((sum, room) => sum + room.players.length, 0),
    totalSpectators: Array.from(rooms.values()).reduce((sum, room) => sum + room.spectators.length, 0)
  };
}

module.exports = {
  onLoad,
  onUnload,
  handleConnection,
  handleDisconnection,
  getState
};
