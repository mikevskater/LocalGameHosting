# Game Server Module Template

Each game can have its own `server.js` file that runs server-side code to manage game state, handle events, and more.

## File Structure

```
games/
└── your-game/
    ├── game.json           # Game metadata
    ├── index.html          # Client-side game
    ├── server.js           # Server-side module (optional)
    └── ... (other assets)
```

## Server Module API

Your `server.js` should export an object with these optional functions:

### `onLoad()`
Called when the game module is first loaded (server startup or when admin switches to this game).

```javascript
function onLoad() {
  console.log('Game loaded');
  // Initialize game state
}
```

### `onUnload()`
Called when switching away from this game or server shutdown.

```javascript
function onUnload() {
  console.log('Game unloaded');
  // Clean up resources, save state, etc.
}
```

### `handleConnection(socket, io, user)`
Called when a player connects and authenticates.

**Parameters:**
- `socket` - The Socket.IO socket for this player
- `io` - The Socket.IO server instance (for broadcasting)
- `user` - Player profile object:
  ```javascript
  {
    id: 1,
    username: "player1",
    nickname: "Player One",
    nameColor: "#FF0000",
    playerColor: "#0000FF",
    profilePicture: "/uploads/..."
  }
  ```

**Example:**
```javascript
function handleConnection(socket, io, user) {
  console.log(`${user.nickname} connected`);

  // Send current game state to new player
  socket.emit('game-event', {
    event: 'game-state',
    data: currentGameState
  });

  // Listen for game events from this player
  socket.on('game-event', (eventData) => {
    if (eventData.event === 'player-action') {
      // Handle the event
      // Broadcast to others
      socket.broadcast.emit('game-event', {
        event: 'player-action',
        data: eventData.data,
        user: user
      });
    }
  });
}
```

### `handleDisconnection(socket, io, user)`
Called when a player disconnects.

```javascript
function handleDisconnection(socket, io, user) {
  console.log(`${user.nickname} disconnected`);
  // Clean up player data
}
```

### `getState()`
Optional function that returns current game state (useful for debugging/admin).

```javascript
function getState() {
  return {
    activePlayers: players.length,
    gameRound: currentRound
  };
}
```

## Complete Example

```javascript
// game-state.js - Example server module

let gameState = {
  players: [],
  score: 0
};

function onLoad() {
  console.log('Game module loaded');
  gameState = { players: [], score: 0 };
}

function onUnload() {
  console.log('Game module unloaded');
}

function handleConnection(socket, io, user) {
  // Add player to game
  gameState.players.push(user);

  // Send current state to new player
  socket.emit('game-event', {
    event: 'game-state',
    data: gameState
  });

  // Handle player actions
  socket.on('game-event', (eventData) => {
    if (eventData.event === 'increase-score') {
      gameState.score += eventData.data.amount;

      // Broadcast to all players
      io.emit('game-event', {
        event: 'score-updated',
        data: { score: gameState.score },
        user: user
      });
    }
  });
}

function handleDisconnection(socket, io, user) {
  // Remove player
  gameState.players = gameState.players.filter(p => p.id !== user.id);
}

function getState() {
  return gameState;
}

module.exports = {
  onLoad,
  onUnload,
  handleConnection,
  handleDisconnection,
  getState
};
```

## Client-Side Communication

From your game's client code, use the GameAPI:

```javascript
// Send event to server
gameAPI.emit('player-action', { x: 10, y: 20 });

// Listen for events from server
gameAPI.on('player-action', (data, user) => {
  console.log(`${user.nickname} did something at`, data);
});
```

## Best Practices

1. **Store game state server-side** - Don't rely on clients to share data
2. **Validate all client input** - Never trust data from clients
3. **Broadcast state changes** - Keep all clients synchronized
4. **Clean up on disconnect** - Remove player data when they leave
5. **Limit history size** - Don't let arrays grow unbounded
6. **Log important events** - Use `console.log` for debugging

## Common Use Cases

### Storing Chat History
```javascript
let chatHistory = [];

socket.on('game-event', (eventData) => {
  if (eventData.event === 'chat-message') {
    chatHistory.push({ user, message: eventData.data.message });
    socket.broadcast.emit('game-event', {
      event: 'chat-message',
      data: eventData.data,
      user: user
    });
  }
});
```

### Persistent Canvas/Drawing
```javascript
let drawingHistory = [];

socket.on('game-event', (eventData) => {
  if (eventData.event === 'draw') {
    drawingHistory.push(eventData.data);
    socket.broadcast.emit('game-event', {
      event: 'draw',
      data: eventData.data,
      user: user
    });
  }
});
```

### Turn-Based Game Logic
```javascript
let currentTurn = 0;
let players = [];

function nextTurn() {
  currentTurn = (currentTurn + 1) % players.length;
  io.emit('game-event', {
    event: 'turn-change',
    data: { playerId: players[currentTurn].id }
  });
}
```

### Synchronized Game Timer
```javascript
let gameTimer = null;
let timeLeft = 60;

function startTimer() {
  gameTimer = setInterval(() => {
    timeLeft--;
    io.emit('game-event', {
      event: 'timer-update',
      data: { timeLeft }
    });

    if (timeLeft <= 0) {
      endGame();
    }
  }, 1000);
}
```

## Notes

- Server modules are optional - games can work without them
- The module is shared across all connected players
- Use `io.emit()` to broadcast to all players
- Use `socket.broadcast.emit()` to send to all except the sender
- Use `socket.emit()` to send to just one player
