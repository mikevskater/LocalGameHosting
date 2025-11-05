/**
 * Uno Game - Server Module
 * Handles all server-side game logic for multiplayer Uno
 */

const crypto = require('crypto');

// ============================================================================
// STATE MANAGEMENT
// ============================================================================

const rooms = new Map(); // roomId -> room object
const socketToRoom = new Map(); // socketId -> roomId
const userToSocket = new Map(); // userId -> socketId

// ============================================================================
// DECK GENERATION
// ============================================================================

/**
 * Creates a standard 108-card Uno deck
 */
function createDeck() {
  const deck = [];
  const colors = ['red', 'yellow', 'green', 'blue'];
  const actionTypes = ['skip', 'reverse', 'draw2'];

  let cardIdCounter = 0;

  // Number cards: 0 (×1 per color), 1-9 (×2 per color)
  colors.forEach(color => {
    // Zero (only one per color)
    deck.push({
      id: `card-${cardIdCounter++}`,
      color,
      type: 'number',
      value: 0
    });

    // 1-9 (two of each per color)
    for (let value = 1; value <= 9; value++) {
      deck.push({
        id: `card-${cardIdCounter++}`,
        color,
        type: 'number',
        value
      });
      deck.push({
        id: `card-${cardIdCounter++}`,
        color,
        type: 'number',
        value
      });
    }
  });

  // Action cards: Skip, Reverse, Draw Two (×2 per color)
  colors.forEach(color => {
    actionTypes.forEach(actionType => {
      deck.push({
        id: `card-${cardIdCounter++}`,
        color,
        type: actionType,
        value: null
      });
      deck.push({
        id: `card-${cardIdCounter++}`,
        color,
        type: actionType,
        value: null
      });
    });
  });

  // Wild cards (×4)
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `card-${cardIdCounter++}`,
      color: 'wild',
      type: 'wild',
      value: null
    });
  }

  // Wild Draw Four cards (×4)
  for (let i = 0; i < 4; i++) {
    deck.push({
      id: `card-${cardIdCounter++}`,
      color: 'wild',
      type: 'wild-draw4',
      value: null
    });
  }

  return deck;
}

/**
 * Fisher-Yates shuffle algorithm
 */
function shuffleDeck(deck) {
  const shuffled = [...deck];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled;
}

// ============================================================================
// ROOM MANAGEMENT
// ============================================================================

/**
 * Generate unique room ID
 */
function generateRoomId() {
  return `room-${crypto.randomBytes(6).toString('hex')}`;
}

/**
 * Create a new Uno room
 */
function createRoom(socket, io, user, config) {
  const roomId = generateRoomId();

  const room = {
    id: roomId,
    name: config.name || `${user.nickname}'s Room`,
    host: user.id,
    players: [user],
    spectators: [],
    gameState: 'waiting',

    // Game state (initialized when game starts)
    deck: [],
    discardPile: [],
    hands: {},
    currentPlayer: null,
    currentPlayerIndex: 0,
    turnDirection: 1, // 1 = clockwise, -1 = counter-clockwise
    currentColor: null,
    drawStack: 0, // Accumulated Draw 2/4 penalties

    // UNO tracking
    unoCalled: {},

    // Settings
    settings: {
      maxPlayers: config.maxPlayers || 4,
      turnTimer: config.turnTimer !== undefined ? config.turnTimer : 30,
      drawUntilPlayable: config.drawUntilPlayable === true,
      stackingDraw: config.stackingDraw === true,
      jumpIn: config.jumpIn === true,
      sevenSwap: config.sevenSwap === true,
      zeroRotate: config.zeroRotate === true,
      forcedPlay: config.forcedPlay === true,
      challengeWildDraw4: config.challengeWildDraw4 !== false
    },

    // Chat
    chatHistory: [],

    // Timers
    turnTimerActive: null,
    turnStartTime: null,

    createdAt: Date.now()
  };

  rooms.set(roomId, room);
  socketToRoom.set(socket.id, roomId);
  socket.currentRoom = roomId;
  socket.isSpectator = false;

  // Send success to creator
  socket.emit('game-event', {
    event: 'room-created',
    data: { roomId }
  });

  // Send room data
  socket.emit('game-event', {
    event: 'room-joined',
    data: {
      room: sanitizeRoomForPlayer(room, user.id),
      role: 'player',
      chatHistory: room.chatHistory
    }
  });

  // Broadcast updated room list to lobby
  broadcastRoomList(io);

  console.log(`[Uno] Room created: ${roomId} by ${user.nickname}`);
}

/**
 * Join existing room as player
 */
function joinRoom(socket, io, user, data) {
  const room = rooms.get(data.roomId);

  if (!room) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Room not found' }
    });
  }

  // Check if already in room
  const existingPlayer = room.players.find(p => p && p.id === user.id);
  if (existingPlayer) {
    // Reconnection
    socketToRoom.set(socket.id, room.id);
    socket.currentRoom = room.id;
    socket.isSpectator = false;

    socket.emit('game-event', {
      event: 'room-joined',
      data: {
        room: sanitizeRoomForPlayer(room, user.id),
        role: 'player',
        chatHistory: room.chatHistory,
        hand: room.hands[user.id] || []
      }
    });

    console.log(`[Uno] Player reconnected: ${user.nickname} to ${room.id}`);
    return;
  }

  // Check if room is full
  if (room.players.length >= room.settings.maxPlayers) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Room is full' }
    });
  }

  // Check if game already started
  if (room.gameState === 'playing') {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Game already in progress' }
    });
  }

  // Add player
  room.players.push(user);
  socketToRoom.set(socket.id, room.id);
  socket.currentRoom = room.id;
  socket.isSpectator = false;

  // Send room data to new player
  socket.emit('game-event', {
    event: 'room-joined',
    data: {
      room: sanitizeRoomForPlayer(room, user.id),
      role: 'player',
      chatHistory: room.chatHistory
    }
  });

  // Broadcast to room
  broadcastToRoom(io, room.id, {
    event: 'player-joined',
    data: {
      user: user,
      players: room.players
    }
  });

  // Update lobby
  broadcastRoomList(io);

  console.log(`[Uno] Player joined: ${user.nickname} to ${room.id}`);
}

/**
 * Join room as spectator
 */
function spectateRoom(socket, io, user, data) {
  const room = rooms.get(data.roomId);

  if (!room) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Room not found' }
    });
  }

  // Check if already spectating
  const existingSpectator = room.spectators.find(s => s.id === user.id);
  if (existingSpectator) {
    return;
  }

  // Add spectator
  room.spectators.push(user);
  socketToRoom.set(socket.id, room.id);
  socket.currentRoom = room.id;
  socket.isSpectator = true;

  // Send room data (no private hand)
  socket.emit('game-event', {
    event: 'room-joined',
    data: {
      room: sanitizeRoomForSpectator(room),
      role: 'spectator',
      chatHistory: room.chatHistory
    }
  });

  // Broadcast to room
  broadcastToRoom(io, room.id, {
    event: 'spectator-joined',
    data: {
      user: user,
      spectators: room.spectators
    }
  });

  console.log(`[Uno] Spectator joined: ${user.nickname} to ${room.id}`);
}

/**
 * Leave current room
 */
function leaveRoom(socket, io, user) {
  const roomId = socketToRoom.get(socket.id);
  if (!roomId) return;

  const room = rooms.get(roomId);
  if (!room) return;

  if (socket.isSpectator) {
    // Remove spectator
    room.spectators = room.spectators.filter(s => s.id !== user.id);

    broadcastToRoom(io, room.id, {
      event: 'spectator-left',
      data: {
        userId: user.id,
        spectators: room.spectators
      }
    });
  } else {
    // Remove player
    const playerIndex = room.players.findIndex(p => p && p.id === user.id);

    if (room.gameState === 'playing') {
      // During game: set to null (allow reconnection)
      room.players[playerIndex] = null;

      // Check if game should end
      const activePlayers = room.players.filter(p => p !== null);
      if (activePlayers.length < 2) {
        endGame(io, room, null); // No winner
      }
    } else {
      // In lobby: remove completely
      room.players.splice(playerIndex, 1);

      // Transfer host if needed
      if (room.host === user.id && room.players.length > 0) {
        room.host = room.players[0].id;
      }
    }

    broadcastToRoom(io, room.id, {
      event: 'player-left',
      data: {
        userId: user.id,
        players: room.players
      }
    });
  }

  // Cleanup
  socketToRoom.delete(socket.id);
  delete socket.currentRoom;
  delete socket.isSpectator;

  // Delete room if empty
  if (room.players.length === 0 && room.spectators.length === 0) {
    rooms.delete(roomId);
    console.log(`[Uno] Room deleted: ${roomId}`);
  }

  // Update lobby
  broadcastRoomList(io);

  console.log(`[Uno] User left: ${user.nickname} from ${roomId}`);
}

// ============================================================================
// GAME FLOW
// ============================================================================

/**
 * Start the game (deal cards, flip first card)
 */
function startGame(socket, io, user) {
  const roomId = socketToRoom.get(socket.id);
  const room = rooms.get(roomId);

  if (!room) return;

  // Validate
  if (room.host !== user.id) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Only the host can start the game' }
    });
  }

  if (room.players.length < 2) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Need at least 2 players to start' }
    });
  }

  if (room.gameState === 'playing') {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Game already started' }
    });
  }

  // Initialize game
  room.gameState = 'playing';
  room.deck = shuffleDeck(createDeck());
  room.discardPile = [];
  room.hands = {};
  room.unoCalled = {};
  room.drawStack = 0;
  room.currentPlayerIndex = 0;
  room.turnDirection = 1;

  // Deal 7 cards to each player
  room.players.forEach(player => {
    room.hands[player.id] = [];
    for (let i = 0; i < 7; i++) {
      room.hands[player.id].push(room.deck.pop());
    }
    room.unoCalled[player.id] = false;
  });

  // Flip first card (avoid Wild cards)
  let firstCard;
  do {
    firstCard = room.deck.pop();
  } while (firstCard.type === 'wild' || firstCard.type === 'wild-draw4');

  room.discardPile.push(firstCard);
  room.currentColor = firstCard.color;

  // Apply first card effect if it's an action card
  if (firstCard.type === 'skip') {
    room.currentPlayerIndex = 1 % room.players.length;
  } else if (firstCard.type === 'reverse') {
    room.turnDirection = -1;
    room.currentPlayerIndex = room.players.length - 1;
  } else if (firstCard.type === 'draw2') {
    // First player draws 2
    const firstPlayer = room.players[0];
    for (let i = 0; i < 2; i++) {
      room.hands[firstPlayer.id].push(room.deck.pop());
    }
    room.currentPlayerIndex = 1 % room.players.length;
  }

  room.currentPlayer = room.players[room.currentPlayerIndex].id;
  room.turnStartTime = Date.now();

  // Start turn timer if enabled
  if (room.settings.turnTimer > 0) {
    startTurnTimer(io, room);
  }

  // Send game state to all players (with private hands)
  room.players.forEach(player => {
    const playerSocket = getUserSocket(io, player.id);
    if (playerSocket) {
      playerSocket.emit('game-event', {
        event: 'game-started',
        data: {
          room: sanitizeRoomForPlayer(room, player.id),
          hand: room.hands[player.id]
        }
      });
    }
  });

  // Send game state to spectators (no hands)
  room.spectators.forEach(spectator => {
    const spectatorSocket = getUserSocket(io, spectator.id);
    if (spectatorSocket) {
      spectatorSocket.emit('game-event', {
        event: 'game-started',
        data: {
          room: sanitizeRoomForSpectator(room)
        }
      });
    }
  });

  console.log(`[Uno] Game started in room ${roomId}`);
}

/**
 * Play a card
 */
function playCard(socket, io, user, data) {
  const roomId = socketToRoom.get(socket.id);
  const room = rooms.get(roomId);

  if (!room || room.gameState !== 'playing') return;

  // Validate turn
  if (room.currentPlayer !== user.id) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Not your turn' }
    });
  }

  const hand = room.hands[user.id];
  const card = hand.find(c => c.id === data.cardId);

  if (!card) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Card not in your hand' }
    });
  }

  const topCard = room.discardPile[room.discardPile.length - 1];

  // Validate card playability
  if (!isCardPlayable(card, topCard, room.currentColor, room.drawStack)) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Card cannot be played' }
    });
  }

  // Handle Wild cards requiring color choice
  if ((card.type === 'wild' || card.type === 'wild-draw4') && !data.chosenColor) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Must choose a color for Wild card' }
    });
  }

  // Remove card from hand
  room.hands[user.id] = hand.filter(c => c.id !== card.id);

  // Add to discard pile
  room.discardPile.push(card);

  // Update current color
  if (card.type === 'wild' || card.type === 'wild-draw4') {
    room.currentColor = data.chosenColor;
  } else {
    room.currentColor = card.color;
  }

  // Clear turn timer
  if (room.turnTimerActive) {
    clearTimeout(room.turnTimerActive);
    room.turnTimerActive = null;
  }

  // Broadcast card played
  broadcastToRoom(io, room.id, {
    event: 'card-played',
    data: {
      user: user,
      card: { ...card, color: room.currentColor }, // Show chosen color for wild
      currentColor: room.currentColor,
      handSize: room.hands[user.id].length
    }
  });

  // Check for win
  if (room.hands[user.id].length === 0) {
    endGame(io, room, user);
    return;
  }

  // Reset UNO call if player now has more than 1 card
  if (room.hands[user.id].length > 1) {
    room.unoCalled[user.id] = false;
  }

  // Apply card effects and advance turn
  applyCardEffect(io, room, card, user);
}

/**
 * Draw card from deck
 */
function drawCard(socket, io, user) {
  const roomId = socketToRoom.get(socket.id);
  const room = rooms.get(roomId);

  if (!room || room.gameState !== 'playing') return;

  // Validate turn
  if (room.currentPlayer !== user.id) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Not your turn' }
    });
  }

  // Check if deck needs reshuffling
  if (room.deck.length === 0) {
    reshuffleDeck(room);
  }

  // Draw card
  const drawnCard = room.deck.pop();
  room.hands[user.id].push(drawnCard);

  // Reset UNO flag if player now has more than 1 card
  if (room.hands[user.id].length > 1) {
    room.unoCalled[user.id] = false;
  }

  // Send drawn card to player (private)
  socket.emit('game-event', {
    event: 'cards-drawn',
    data: {
      cards: [drawnCard]
    }
  });

  // Broadcast draw event (public - no card details)
  broadcastToRoom(io, room.id, {
    event: 'card-drawn',
    data: {
      userId: user.id,
      user: user,
      cardCount: 1,
      handSize: room.hands[user.id].length,
      unoCalled: room.unoCalled[user.id]
    }
  });

  // Clear turn timer
  if (room.turnTimerActive) {
    clearTimeout(room.turnTimerActive);
    room.turnTimerActive = null;
  }

  // Advance turn (player cannot play drawn card in this implementation)
  advanceTurn(io, room);

  console.log(`[Uno] ${user.nickname} drew a card`);
}

// ============================================================================
// CARD LOGIC
// ============================================================================

/**
 * Check if a card can be played
 */
function isCardPlayable(card, topCard, currentColor, drawStack) {
  // Wild cards always playable (unless there's a draw stack and stacking is enabled)
  if (card.type === 'wild' || card.type === 'wild-draw4') {
    return true;
  }

  // If there's a draw stack, can only play matching draw card
  if (drawStack > 0) {
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
  if (card.type === topCard.type && card.type === 'number' && card.value === topCard.value) {
    return true;
  }

  // Match action type (skip on skip, reverse on reverse, etc.)
  if (card.type === topCard.type && card.type !== 'number') {
    return true;
  }

  return false;
}

/**
 * Apply special card effects
 */
function applyCardEffect(io, room, card, user) {
  switch (card.type) {
    case 'skip':
      // Skip next player
      advanceTurn(io, room);
      advanceTurn(io, room);
      break;

    case 'reverse':
      // Reverse direction
      room.turnDirection *= -1;

      // With 2 players, reverse acts like skip
      if (room.players.length === 2) {
        advanceTurn(io, room);
      }

      advanceTurn(io, room);
      break;

    case 'draw2':
      // Next player draws 2 (or adds to stack)
      room.drawStack += 2;
      advanceTurn(io, room);

      // Check if next player can stack
      const nextPlayer = room.players[room.currentPlayerIndex];
      if (nextPlayer && room.hands[nextPlayer.id]) {
        const canStack = room.settings.stackingDraw &&
                        room.hands[nextPlayer.id].some(c => c.type === 'draw2');

        if (!canStack) {
          // Force draw
          drawPenaltyCards(io, room, nextPlayer.id);
        }
      }
      break;

    case 'wild-draw4':
      // Next player draws 4 (or adds to stack)
      room.drawStack += 4;
      advanceTurn(io, room);

      // Check if next player can stack
      const nextPlayer2 = room.players[room.currentPlayerIndex];
      if (nextPlayer2 && room.hands[nextPlayer2.id]) {
        const canStack2 = room.settings.stackingDraw &&
                         room.hands[nextPlayer2.id].some(c => c.type === 'wild-draw4');

        if (!canStack2) {
          // Force draw
          drawPenaltyCards(io, room, nextPlayer2.id);
        }
      }
      break;

    default:
      // Regular card - just advance turn
      advanceTurn(io, room);
  }
}

/**
 * Draw penalty cards (from draw stack)
 */
function drawPenaltyCards(io, room, userId) {
  const count = room.drawStack;
  room.drawStack = 0;

  const drawnCards = [];
  for (let i = 0; i < count; i++) {
    if (room.deck.length === 0) {
      reshuffleDeck(room);
    }
    const card = room.deck.pop();
    room.hands[userId].push(card);
    drawnCards.push(card);
  }

  // Reset UNO flag if player now has more than 1 card
  if (room.hands[userId].length > 1) {
    room.unoCalled[userId] = false;
  }

  // Send to affected player
  const playerSocket = getUserSocket(io, userId);
  if (playerSocket) {
    playerSocket.emit('game-event', {
      event: 'cards-drawn',
      data: { cards: drawnCards }
    });
  }

  // Broadcast to room
  const player = room.players.find(p => p && p.id === userId);
  broadcastToRoom(io, room.id, {
    event: 'card-drawn',
    data: {
      userId: userId,
      user: player,
      cardCount: count,
      handSize: room.hands[userId].length,
      penalty: true,
      unoCalled: room.unoCalled[userId]
    }
  });

  // Skip their turn
  advanceTurn(io, room);
}

/**
 * Advance to next player's turn
 */
function advanceTurn(io, room) {
  // Calculate next player index
  room.currentPlayerIndex += room.turnDirection;

  // Wrap around
  if (room.currentPlayerIndex >= room.players.length) {
    room.currentPlayerIndex = 0;
  } else if (room.currentPlayerIndex < 0) {
    room.currentPlayerIndex = room.players.length - 1;
  }

  // Skip null players (disconnected)
  let attempts = 0;
  while (room.players[room.currentPlayerIndex] === null && attempts < room.players.length) {
    room.currentPlayerIndex += room.turnDirection;
    if (room.currentPlayerIndex >= room.players.length) {
      room.currentPlayerIndex = 0;
    } else if (room.currentPlayerIndex < 0) {
      room.currentPlayerIndex = room.players.length - 1;
    }
    attempts++;
  }

  room.currentPlayer = room.players[room.currentPlayerIndex].id;
  room.turnStartTime = Date.now();

  // Start turn timer
  if (room.settings.turnTimer > 0) {
    startTurnTimer(io, room);
  }

  // Broadcast turn change
  broadcastToRoom(io, room.id, {
    event: 'turn-changed',
    data: {
      currentPlayer: room.currentPlayer,
      currentPlayerIndex: room.currentPlayerIndex,
      turnDirection: room.turnDirection,
      drawStack: room.drawStack,
      currentColor: room.currentColor,
      topCard: room.discardPile[room.discardPile.length - 1] || null
    }
  });
}

/**
 * Reshuffle discard pile into deck
 */
function reshuffleDeck(room) {
  if (room.discardPile.length <= 1) {
    console.log('[Uno] Cannot reshuffle - not enough cards');
    return;
  }

  // Keep top card, shuffle rest back into deck
  const topCard = room.discardPile.pop();
  room.deck = shuffleDeck(room.discardPile);
  room.discardPile = [topCard];

  console.log(`[Uno] Deck reshuffled - ${room.deck.length} cards`);
}

// ============================================================================
// UNO SYSTEM
// ============================================================================

/**
 * Player calls UNO
 */
function callUno(socket, io, user) {
  const roomId = socketToRoom.get(socket.id);
  const room = rooms.get(roomId);

  if (!room || room.gameState !== 'playing') return;

  // Validate player has 1 card
  if (room.hands[user.id].length !== 1) {
    return socket.emit('game-event', {
      event: 'error',
      data: { message: 'Can only call UNO with 1 card remaining' }
    });
  }

  room.unoCalled[user.id] = true;

  broadcastToRoom(io, room.id, {
    event: 'uno-called',
    data: {
      userId: user.id,
      user: user
    }
  });

  console.log(`[Uno] ${user.nickname} called UNO!`);
}

/**
 * Catch player who didn't call UNO
 */
function catchUno(socket, io, user, data) {
  const roomId = socketToRoom.get(socket.id);
  const room = rooms.get(roomId);

  if (!room || room.gameState !== 'playing') return;

  const targetPlayer = room.players.find(p => p && p.id === data.targetUserId);
  if (!targetPlayer) return;

  // Check if target has 1 card and didn't call UNO
  if (room.hands[targetPlayer.id].length === 1 && !room.unoCalled[targetPlayer.id]) {
    // Penalty: draw 2 cards
    const penalty = 2;
    for (let i = 0; i < penalty; i++) {
      if (room.deck.length === 0) {
        reshuffleDeck(room);
      }
      room.hands[targetPlayer.id].push(room.deck.pop());
    }

    // Reset UNO flag
    room.unoCalled[targetPlayer.id] = false;

    // Notify target player of new cards
    const targetSocket = getUserSocket(io, targetPlayer.id);
    if (targetSocket) {
      targetSocket.emit('game-event', {
        event: 'cards-drawn',
        data: {
          cards: room.hands[targetPlayer.id].slice(-penalty)
        }
      });
    }

    // Broadcast catch
    broadcastToRoom(io, room.id, {
      event: 'uno-caught',
      data: {
        accuserId: user.id,
        accuser: user,
        targetId: targetPlayer.id,
        target: targetPlayer,
        penalty: penalty,
        newHandSize: room.hands[targetPlayer.id].length
      }
    });

    console.log(`[Uno] ${targetPlayer.nickname} caught by ${user.nickname}!`);
  } else {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Cannot catch this player' }
    });
  }
}

// ============================================================================
// TURN TIMER
// ============================================================================

/**
 * Start turn timer countdown
 */
function startTurnTimer(io, room) {
  if (room.turnTimerActive) {
    clearTimeout(room.turnTimerActive);
  }

  const timeLimit = room.settings.turnTimer * 1000; // Convert to ms

  room.turnTimerActive = setTimeout(() => {
    // Auto-draw card and pass turn
    const currentPlayer = room.players[room.currentPlayerIndex];
    if (currentPlayer && room.gameState === 'playing') {
      console.log(`[Uno] Turn timeout for ${currentPlayer.nickname}`);

      // Draw a card
      if (room.deck.length === 0) {
        reshuffleDeck(room);
      }
      const drawnCard = room.deck.pop();
      room.hands[currentPlayer.id].push(drawnCard);

      // Reset UNO flag if player now has more than 1 card
      if (room.hands[currentPlayer.id].length > 1) {
        room.unoCalled[currentPlayer.id] = false;
      }

      // Notify player
      const playerSocket = getUserSocket(io, currentPlayer.id);
      if (playerSocket) {
        playerSocket.emit('game-event', {
          event: 'cards-drawn',
          data: { cards: [drawnCard] }
        });
      }

      // Broadcast
      broadcastToRoom(io, room.id, {
        event: 'turn-timeout',
        data: {
          userId: currentPlayer.id,
          user: currentPlayer,
          handSize: room.hands[currentPlayer.id].length,
          unoCalled: room.unoCalled[currentPlayer.id]
        }
      });

      // Advance turn
      advanceTurn(io, room);
    }
  }, timeLimit);
}

// ============================================================================
// GAME END
// ============================================================================

/**
 * End game and declare winner
 */
function endGame(io, room, winner) {
  room.gameState = 'finished';

  // Clear timer
  if (room.turnTimerActive) {
    clearTimeout(room.turnTimerActive);
    room.turnTimerActive = null;
  }

  // Calculate score (sum of opponent cards)
  let score = 0;
  if (winner) {
    room.players.forEach(player => {
      if (player && player.id !== winner.id) {
        room.hands[player.id].forEach(card => {
          if (card.type === 'number') {
            score += card.value;
          } else if (card.type === 'skip' || card.type === 'reverse' || card.type === 'draw2') {
            score += 20;
          } else if (card.type === 'wild' || card.type === 'wild-draw4') {
            score += 50;
          }
        });
      }
    });
  }

  broadcastToRoom(io, room.id, {
    event: 'game-won',
    data: {
      winner: winner,
      score: score
    }
  });

  console.log(`[Uno] Game ended in room ${room.id} - Winner: ${winner ? winner.nickname : 'None'}`);
}

// ============================================================================
// CHAT SYSTEM
// ============================================================================

/**
 * Handle chat messages
 */
function handleChat(socket, io, user, data) {
  const roomId = socketToRoom.get(socket.id);
  const room = rooms.get(roomId);

  if (!room) return;

  const message = {
    user: user,
    message: data.message.substring(0, 200), // Limit length
    timestamp: Date.now()
  };

  // Add to history (limit 50)
  room.chatHistory.push(message);
  if (room.chatHistory.length > 50) {
    room.chatHistory.shift();
  }

  // Broadcast
  broadcastToRoom(io, room.id, {
    event: 'chat-message',
    data: message
  });
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

/**
 * Sanitize room data for a specific player (includes their hand)
 */
function sanitizeRoomForPlayer(room, userId) {
  return {
    id: room.id,
    name: room.name,
    host: room.host,
    players: room.players,
    spectators: room.spectators,
    gameState: room.gameState,
    currentPlayer: room.currentPlayer,
    currentPlayerIndex: room.currentPlayerIndex,
    turnDirection: room.turnDirection,
    currentColor: room.currentColor,
    topCard: room.discardPile[room.discardPile.length - 1] || null,
    deckSize: room.deck.length,
    drawStack: room.drawStack,
    handSizes: Object.keys(room.hands).reduce((acc, uid) => {
      acc[uid] = room.hands[uid].length;
      return acc;
    }, {}),
    unoCalled: room.unoCalled,
    settings: room.settings,
    turnStartTime: room.turnStartTime
  };
}

/**
 * Sanitize room data for spectators (no hands)
 */
function sanitizeRoomForSpectator(room) {
  return sanitizeRoomForPlayer(room, null);
}

/**
 * Broadcast event to all users in a room
 */
function broadcastToRoom(io, roomId, eventData) {
  io.sockets.sockets.forEach(socket => {
    if (socket.currentRoom === roomId) {
      socket.emit('game-event', eventData);
    }
  });
}

/**
 * Broadcast room list to lobby
 */
function broadcastRoomList(io) {
  const roomList = Array.from(rooms.values()).map(room => ({
    id: room.id,
    name: room.name,
    host: room.host,
    playerCount: room.players.filter(p => p !== null).length,
    maxPlayers: room.settings.maxPlayers,
    spectatorCount: room.spectators.length,
    gameState: room.gameState
  }));

  io.emit('game-event', {
    event: 'rooms-list',
    data: { rooms: roomList }
  });
}

/**
 * Get socket for a user ID
 */
function getUserSocket(io, userId) {
  let targetSocket = null;
  io.sockets.sockets.forEach(socket => {
    if (socket.userProfile && socket.userProfile.id === userId) {
      targetSocket = socket;
    }
  });
  return targetSocket;
}

// ============================================================================
// MODULE EXPORTS (Framework Interface)
// ============================================================================

module.exports = {
  /**
   * Called when game module is loaded
   */
  onLoad() {
    console.log('[Uno] Game module loaded');
  },

  /**
   * Called when game module is unloaded
   */
  onUnload() {
    console.log('[Uno] Game module unloaded');

    // Clear all timers
    rooms.forEach(room => {
      if (room.turnTimerActive) {
        clearTimeout(room.turnTimerActive);
      }
    });

    rooms.clear();
    socketToRoom.clear();
    userToSocket.clear();
  },

  /**
   * Handle new socket connection
   */
  handleConnection(socket, io, user) {
    console.log(`[Uno] User connected: ${user.nickname}`);

    // Send room list
    broadcastRoomList(io);

    // Handle events
    socket.on('game-event', (data) => {
      try {
        switch (data.event) {
          case 'create-room':
            createRoom(socket, io, user, data.data);
            break;
          case 'join-room':
            joinRoom(socket, io, user, data.data);
            break;
          case 'spectate-room':
            spectateRoom(socket, io, user, data.data);
            break;
          case 'leave-room':
            leaveRoom(socket, io, user);
            break;
          case 'start-game':
            startGame(socket, io, user);
            break;
          case 'play-card':
            playCard(socket, io, user, data.data);
            break;
          case 'draw-card':
            drawCard(socket, io, user);
            break;
          case 'call-uno':
            callUno(socket, io, user);
            break;
          case 'catch-uno':
            catchUno(socket, io, user, data.data);
            break;
          case 'chat-message':
            handleChat(socket, io, user, data.data);
            break;
        }
      } catch (error) {
        console.error('[Uno] Error handling event:', error);
        socket.emit('game-event', {
          event: 'error',
          data: { message: 'Server error occurred' }
        });
      }
    });
  },

  /**
   * Handle socket disconnection
   */
  handleDisconnection(socket, io, user) {
    console.log(`[Uno] User disconnected: ${user.nickname}`);

    // Note: We don't auto-remove players on disconnect
    // They can reconnect during the game
    // Only remove if they explicitly leave or game ends
  },

  /**
   * Get current game state (for admin panel)
   */
  getState() {
    return {
      rooms: Array.from(rooms.values()),
      totalRooms: rooms.size,
      activeGames: Array.from(rooms.values()).filter(r => r.gameState === 'playing').length
    };
  },

  /**
   * Get stats for admin panel
   */
  getAdminStats() {
    const totalPlayers = Array.from(rooms.values()).reduce((sum, room) => {
      return sum + room.players.filter(p => p !== null).length;
    }, 0);

    const totalSpectators = Array.from(rooms.values()).reduce((sum, room) => {
      return sum + room.spectators.length;
    }, 0);

    return {
      totalRooms: rooms.size,
      activeGames: Array.from(rooms.values()).filter(r => r.gameState === 'playing').length,
      totalPlayers: totalPlayers,
      totalSpectators: totalSpectators
    };
  }
};
