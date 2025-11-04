# Uno Game - Implementation Roadmap

## Overview

Implementation of a fully-featured Uno card game following the established framework patterns with rooms, real-time multiplayer, chat with history, spectator support, and account system integration.

---

## Architecture Summary

### Technology Stack
- **Server**: Node.js + Socket.IO (room-based architecture)
- **Client**: Vanilla JavaScript + HTML5/CSS3
- **Authentication**: JWT-based (existing framework)
- **Real-time Events**: Socket.IO with gameAPI
- **Stats**: Existing stats API for wins/losses/leaderboards

### Patterns to Follow
- **Room System**: Copy from `games/tictactoe/` (multi-room, join/spectate/leave)
- **Turn Management**: Similar to TicTacToe but with more complex state
- **State Machine**: Use RPS-Tournament pattern (lobby → playing → finished)
- **Chat**: Integrate existing room-based chat with 50-message history
- **Settings**: Use dynamic settings system from `settingsManager.js`

---

## Phase 1: Planning & Game Design (Day 1, 2-3 hours)

### 1.1 Game Design Document
- [x] Review Uno official rules
- [ ] Define card set (108 cards: 4 colors × 25 cards each + 8 Wild cards)
- [ ] Specify game flow (draw → play → challenge → UNO call → win)
- [ ] Define special card behaviors:
  - Skip (next player loses turn)
  - Reverse (change turn direction)
  - Draw Two (+2 cards, skip turn)
  - Wild (choose color)
  - Wild Draw Four (+4 cards, color choice, challengeable)
- [ ] Define win conditions and scoring
- [ ] Define house rules to support (configurable via settings.json)

### 1.2 Define Card Visual System (CSS-Based)

**Approach**: Use CSS-generated cards with reusable icons and programmatic coloring.

**Card Rendering Strategy:**
- **Number Cards (0-9)**: CSS colored background + text number
- **Action Cards**: CSS colored background + reusable icon (programmatically colored)
- **Wild Cards**: Multi-color CSS gradient + icon
- **Card Back**: CSS pattern or simple solid color

**No image assets required for Phase 1-3!** All cards will be CSS/DOM-based with placeholder styling.

### 1.3 Create Basic Game Metadata
- [ ] Create `game.json` with Uno metadata
- [ ] Define `settings.json` for admin controls (house rules, timers, etc.)
- [ ] Document API in this roadmap

---

## Phase 2: Core Server Logic (Day 2-3, 6-8 hours)

### 2.1 Game State Structure (`server.js`)

**Room Object Schema:**
```javascript
{
  id: string,                    // Unique room ID
  name: string,                  // Room name
  host: userId,                  // Room creator
  players: [user],               // 2-10 players
  spectators: [user],            // Unlimited spectators
  gameState: 'waiting' | 'playing' | 'finished',

  // Game-specific state
  deck: [card],                  // Draw pile
  discardPile: [card],           // Played cards
  hands: { userId: [card] },     // Private hands
  currentPlayer: userId,         // Whose turn
  turnDirection: 1 | -1,         // Clockwise or counter
  currentColor: 'red' | 'yellow' | 'green' | 'blue' | null,
  lastCard: card,                // Top of discard pile
  drawStack: number,             // Accumulated Draw 2/4 penalty

  // UNO tracking
  unoCalled: { userId: boolean },  // Who called UNO

  // Settings (from settings.json)
  settings: {
    maxPlayers: 2-10,
    drawUntilPlayable: boolean,    // House rule
    stackingDraw: boolean,         // Can stack +2 on +2?
    jumpIn: boolean,               // Can play identical card out of turn?
    sevenSwap: boolean,            // 7 = swap hands?
    zeroRotate: boolean,           // 0 = rotate all hands?
    forcedPlay: boolean,           // Must play if able?
    turnTimer: number,             // Seconds per turn (0 = no limit)
    challengeWildDraw4: boolean    // Allow challenging Wild +4?
  },

  // Chat
  chatHistory: [message],        // Last 50 messages

  // Timers
  turnTimerActive: timeoutId,
  turnStartTime: timestamp,

  createdAt: timestamp
}
```

**Card Object Schema:**
```javascript
{
  id: string,                    // Unique card instance ID
  color: 'red' | 'yellow' | 'green' | 'blue' | 'wild',
  type: 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild-draw4',
  value: 0-9 | null              // Only for number cards
}
```

### 2.2 Core Functions to Implement

#### Room Management
- [ ] `createRoom(socket, io, user, config)` - Create new Uno room
- [ ] `joinRoom(socket, io, user, roomId)` - Join as player
- [ ] `spectateRoom(socket, io, user, roomId)` - Join as spectator
- [ ] `leaveRoom(socket, io, user)` - Handle leaving/disconnection
- [ ] `startGame(roomId)` - Begin game (requires 2+ players)
- [ ] `rematch(roomId)` - Reset for same players

#### Deck Management
- [ ] `createDeck()` - Generate standard 108-card deck
- [ ] `shuffleDeck(deck)` - Fisher-Yates shuffle
- [ ] `dealCards(room)` - Deal 7 cards to each player, flip first card
- [ ] `drawCard(room, userId, count)` - Draw N cards from deck
- [ ] `reshuffleDeck(room)` - When deck empty, reshuffle discard pile

#### Game Logic
- [ ] `playCard(socket, io, room, userId, cardId, chosenColor)` - Main play action
  - Validate: Is it player's turn?
  - Validate: Does player have this card?
  - Validate: Is card playable on current discard?
  - Execute: Remove from hand, add to discard
  - Execute: Apply card effects (skip, reverse, draw, wild)
  - Execute: Check for win condition
  - Execute: Advance turn
  - Broadcast: Update all clients

- [ ] `isCardPlayable(card, lastCard, currentColor, drawStack)` - Validate play
  - Number: matches color or value
  - Action: matches color or type
  - Wild: always playable
  - Wild Draw Four: only if no other playable cards (challengeable)

- [ ] `applyCardEffect(room, card, chosenColor)` - Execute special effects
  - Skip: advance turn by 2 positions
  - Reverse: flip turnDirection
  - Draw Two: drawStack += 2, next player draws (unless stacking enabled)
  - Wild: set currentColor
  - Wild Draw Four: drawStack += 4, set currentColor

- [ ] `advanceTurn(room)` - Move to next player
  - Calculate next index based on turnDirection
  - Handle draw stack penalties
  - Start turn timer if enabled

- [ ] `callUno(socket, io, room, userId)` - Player declares UNO
  - Validate: Player has exactly 1 card
  - Mark: unoCalled[userId] = true
  - Broadcast: "{Player} called UNO!"

- [ ] `catchMissedUno(socket, io, room, accuserId, targetId)` - Catch player who didn't call UNO
  - Validate: Target has 1 card and didn't call UNO
  - Penalty: Target draws 2 cards (configurable)
  - Broadcast: Penalty notification

- [ ] `challengeWildDraw4(socket, io, room, challengerId)` - Challenge previous player's Wild +4
  - Check: Did previous player have playable card?
  - If valid: Challenger draws 6 instead of 4
  - If invalid: Previous player draws 4, challenger plays normal turn
  - Advanced rule: Only if enabled in settings

- [ ] `checkWin(room, userId)` - Detect winner
  - Condition: Player's hand is empty
  - Calculate: Score based on opponent cards
  - Update: Stats API (wins, games played)
  - Broadcast: Winner announcement
  - Transition: gameState = 'finished'

#### Turn Timer System
- [ ] `startTurnTimer(room)` - Start countdown for current player
- [ ] `cancelTurnTimer(room)` - Clear timer on play
- [ ] `onTurnTimeout(room)` - Auto-draw card if time expires

#### House Rules (Optional, based on settings)
- [ ] `handleSevenSwap(room, playerId, targetId)` - Swap hands when 7 played
- [ ] `handleZeroRotate(room)` - Rotate all hands when 0 played
- [ ] `handleJumpIn(room, userId, cardId)` - Play identical card out of turn
- [ ] `handleDrawStacking(room, userId, cardId)` - Stack Draw 2 on Draw 2

### 2.3 Socket Event Handlers

**Incoming Events (Client → Server):**
```javascript
socket.on('game-event', (eventData) => {
  switch (eventData.event) {
    case 'create-room': handleCreateRoom(socket, io, user, eventData.data);
    case 'join-room': handleJoinRoom(socket, io, user, eventData.data);
    case 'spectate-room': handleSpectateRoom(socket, io, user, eventData.data);
    case 'leave-room': handleLeaveRoom(socket, io, user);
    case 'start-game': handleStartGame(socket, io, user, eventData.data);
    case 'play-card': handlePlayCard(socket, io, user, eventData.data);
    case 'draw-card': handleDrawCard(socket, io, user);
    case 'call-uno': handleCallUno(socket, io, user);
    case 'catch-uno': handleCatchMissedUno(socket, io, user, eventData.data);
    case 'challenge-wild': handleChallengeWildDraw4(socket, io, user);
    case 'chat-message': handleChatMessage(socket, io, user, eventData.data);
    case 'rematch': handleRematch(socket, io, user);
  }
});
```

**Outgoing Events (Server → Client):**
```javascript
// Broadcast these to all players/spectators in room
emit('game-event', {
  event: 'room-created' | 'room-joined' | 'game-started' | 'card-played' |
         'card-drawn' | 'turn-changed' | 'uno-called' | 'uno-caught' |
         'game-won' | 'chat-message' | 'player-left' | 'settings-changed',
  data: { ... }
});
```

### 2.4 Admin Settings Integration

Create `games/uno/settings.json`:
```json
{
  "sections": [
    {
      "id": "uno-stats",
      "title": "Live Game Stats",
      "controls": [
        {
          "type": "stat",
          "id": "total-rooms",
          "label": "Total Rooms",
          "statKey": "totalRooms"
        },
        {
          "type": "stat",
          "id": "active-games",
          "label": "Active Games",
          "statKey": "activeGames"
        },
        {
          "type": "stat",
          "id": "total-players",
          "label": "Total Players",
          "statKey": "totalPlayers"
        }
      ]
    },
    {
      "id": "default-settings",
      "title": "Default Room Settings",
      "description": "These are defaults for new rooms. Players can override in room creation.",
      "controls": [
        {
          "type": "number",
          "id": "max-players",
          "label": "Max Players",
          "settingKey": "defaultMaxPlayers",
          "min": 2,
          "max": 10,
          "default": 4
        },
        {
          "type": "number",
          "id": "turn-timer",
          "label": "Turn Timer (seconds, 0 = disabled)",
          "settingKey": "defaultTurnTimer",
          "min": 0,
          "max": 300,
          "default": 30
        },
        {
          "type": "checkbox",
          "id": "draw-until-playable",
          "label": "Draw Until Playable",
          "settingKey": "defaultDrawUntilPlayable",
          "default": false
        },
        {
          "type": "checkbox",
          "id": "stacking-draw",
          "label": "Allow Stacking Draw Cards",
          "settingKey": "defaultStackingDraw",
          "default": false
        },
        {
          "type": "checkbox",
          "id": "jump-in",
          "label": "Allow Jump-In (identical card)",
          "settingKey": "defaultJumpIn",
          "default": false
        },
        {
          "type": "checkbox",
          "id": "seven-swap",
          "label": "7 = Swap Hands",
          "settingKey": "defaultSevenSwap",
          "default": false
        },
        {
          "type": "checkbox",
          "id": "zero-rotate",
          "label": "0 = Rotate All Hands",
          "settingKey": "defaultZeroRotate",
          "default": false
        },
        {
          "type": "checkbox",
          "id": "forced-play",
          "label": "Forced Play (no bluffing)",
          "settingKey": "defaultForcedPlay",
          "default": false
        },
        {
          "type": "checkbox",
          "id": "challenge-wild-draw4",
          "label": "Allow Challenging Wild Draw Four",
          "settingKey": "defaultChallengeWildDraw4",
          "default": true
        }
      ]
    }
  ]
}
```

### 2.5 Export Admin Functions

Add to `server.js`:
```javascript
module.exports = {
  onLoad,
  onUnload,
  handleConnection,
  handleDisconnection,
  getState,

  // Admin stats
  getAdminStats() {
    return {
      totalRooms: rooms.size,
      activeGames: Array.from(rooms.values()).filter(r => r.gameState === 'playing').length,
      totalPlayers: Array.from(rooms.values()).reduce((sum, r) => sum + r.players.length, 0)
    };
  }
};
```

---

## Phase 3: Client UI with Placeholder Graphics (Day 4-5, 8-10 hours)

**Note**: This phase uses CSS-based placeholder cards. No image assets required yet.

### 3.1 HTML Structure (`index.html`)

**Screen Layout:**
```html
<!-- Lobby Screen -->
<div id="lobby-screen" class="screen active">
  <div class="lobby-header">
    <h1>🎴 Uno Rooms</h1>
    <button id="create-room-btn">Create Room</button>
    <button id="refresh-rooms-btn">Refresh</button>
  </div>

  <div id="rooms-container">
    <!-- Dynamically populated room cards -->
  </div>
</div>

<!-- Game Screen -->
<div id="game-screen" class="screen">
  <div class="game-container">
    <!-- Main Game Area -->
    <div class="game-main">
      <!-- Opponent Hands (visual representation) -->
      <div class="opponents-area">
        <!-- Dynamically show each opponent with card count -->
      </div>

      <!-- Game Board Center -->
      <div class="game-board">
        <div class="deck-area">
          <div class="draw-pile" id="draw-pile">
            <img src="assets/card-back.png" alt="Draw Pile">
            <span class="pile-count">0</span>
          </div>

          <div class="discard-pile" id="discard-pile">
            <!-- Current card image -->
          </div>

          <div class="game-info">
            <div class="current-color" id="current-color"></div>
            <div class="turn-direction" id="turn-direction">
              <img src="assets/arrow-clockwise.png" alt="Direction">
            </div>
            <div class="turn-indicator">
              <span id="current-turn-text">Waiting...</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Player's Hand -->
      <div class="player-hand-area">
        <div id="player-hand" class="player-hand">
          <!-- Player's cards (clickable) -->
        </div>

        <div class="player-actions">
          <button id="draw-btn" disabled>Draw Card</button>
          <button id="uno-btn" disabled>Call UNO!</button>
          <button id="pass-btn" disabled>Pass Turn</button>
        </div>
      </div>
    </div>

    <!-- Sidebar -->
    <div class="game-sidebar">
      <!-- Room Info -->
      <div class="room-info-panel">
        <h3 id="room-name">Room Name</h3>
        <div id="room-settings">
          <!-- Display active house rules -->
        </div>
      </div>

      <!-- Players List -->
      <div class="players-panel">
        <h3>Players (<span id="player-count">0</span>)</h3>
        <div id="players-list">
          <!-- Player avatars, names, card counts, UNO status -->
        </div>
      </div>

      <!-- Spectators List -->
      <div class="spectators-panel">
        <h3>Spectators (<span id="spectator-count">0</span>)</h3>
        <div id="spectators-list">
          <!-- Spectator avatars and names -->
        </div>
        <button id="switch-to-player-btn">Join as Player</button>
      </div>

      <!-- Chat -->
      <div class="chat-panel">
        <h3>Chat</h3>
        <div id="chat-messages"></div>
        <div class="chat-input">
          <input type="text" id="chat-input" placeholder="Type message...">
          <button id="chat-send">Send</button>
        </div>
      </div>

      <!-- Game Controls -->
      <div class="game-controls">
        <button id="leave-room-btn">Leave Room</button>
        <button id="rematch-btn" style="display: none;">Rematch</button>
      </div>
    </div>
  </div>
</div>

<!-- Modal: Create Room -->
<div id="create-room-modal" class="modal">
  <div class="modal-content">
    <h2>Create Uno Room</h2>
    <form id="create-room-form">
      <label>Room Name</label>
      <input type="text" id="room-name-input" required>

      <label>Max Players (2-10)</label>
      <input type="number" id="max-players-input" min="2" max="10" value="4">

      <label>Turn Timer (seconds, 0 = no limit)</label>
      <input type="number" id="turn-timer-input" min="0" max="300" value="30">

      <h3>House Rules</h3>
      <label><input type="checkbox" id="draw-until-playable"> Draw Until Playable</label>
      <label><input type="checkbox" id="stacking-draw"> Stack Draw Cards</label>
      <label><input type="checkbox" id="jump-in"> Allow Jump-In</label>
      <label><input type="checkbox" id="seven-swap"> 7 = Swap Hands</label>
      <label><input type="checkbox" id="zero-rotate"> 0 = Rotate Hands</label>
      <label><input type="checkbox" id="forced-play"> Forced Play</label>
      <label><input type="checkbox" id="challenge-wild" checked> Allow Wild +4 Challenge</label>

      <button type="submit">Create Room</button>
      <button type="button" id="cancel-create-room">Cancel</button>
    </form>
  </div>
</div>

<!-- Modal: Choose Wild Color -->
<div id="color-picker-modal" class="modal">
  <div class="modal-content">
    <h2>Choose Color</h2>
    <div class="color-buttons">
      <button class="color-btn red" data-color="red">Red</button>
      <button class="color-btn yellow" data-color="yellow">Yellow</button>
      <button class="color-btn green" data-color="green">Green</button>
      <button class="color-btn blue" data-color="blue">Blue</button>
    </div>
  </div>
</div>

<!-- Modal: Winner Announcement -->
<div id="winner-modal" class="modal">
  <div class="modal-content">
    <h2>Game Over!</h2>
    <div id="winner-info">
      <!-- Winner name, score, stats -->
    </div>
    <button id="close-winner-modal">Close</button>
  </div>
</div>
```

### 3.2 Client JavaScript (`game.js`)

**Core Client Functions:**
- [ ] `init()` - Initialize gameAPI, load lobby
- [ ] `loadRoomList()` - Fetch and display available rooms
- [ ] `renderRoomCard(room)` - Create room list item
- [ ] `createRoom()` - Send create-room event with form data
- [ ] `joinRoom(roomId)` - Send join-room event
- [ ] `spectateRoom(roomId)` - Send spectate-room event
- [ ] `leaveRoom()` - Send leave-room event, return to lobby
- [ ] `startGame()` - Host starts game (requires 2+ players)

**Game State Management:**
- [ ] `updateGameState(data)` - Sync server state to client
- [ ] `renderGameBoard()` - Update discard pile, draw pile, direction
- [ ] `renderPlayerHand(cards)` - Display player's cards
- [ ] `renderOpponents(players)` - Show opponent card counts
- [ ] `renderPlayersList(players)` - Update sidebar player list
- [ ] `renderSpectatorsList(spectators)` - Update sidebar spectator list

**Game Actions:**
- [ ] `playCard(cardId)` - Click handler for card
  - Check if playable
  - If wild, show color picker modal
  - Send play-card event with chosen color
- [ ] `drawCard()` - Click handler for draw button
- [ ] `callUno()` - Click handler for UNO button
- [ ] `passTurn()` - Click handler for pass button (if applicable)
- [ ] `catchUno(targetPlayerId)` - Click opponent to catch missed UNO

**UI Helpers:**
- [ ] `highlightCurrentPlayer(userId)` - Visual indicator of whose turn
- [ ] `showColorPicker(cardId)` - Modal for wild card color selection
- [ ] `showWinnerModal(winnerData)` - Display winner and stats
- [ ] `animateCardPlay(cardId)` - Smooth transition from hand to discard
- [ ] `animateCardDraw(count)` - Show cards moving from deck to hand
- [ ] `showNotification(message, type)` - Toast notifications for events
- [ ] `updateTurnTimer(seconds)` - Countdown display

**Event Listeners:**
```javascript
// Lobby events
gameAPI.on('rooms-list', (data) => { renderRoomList(data.rooms); });
gameAPI.on('room-created', (data) => { joinRoom(data.roomId); });

// Room events
gameAPI.on('room-joined', (data) => {
  currentRoom = data.room;
  showGameScreen();
  renderGameState();
  loadChatHistory(data.chatHistory);
});

gameAPI.on('player-joined', (data) => {
  updatePlayersList(data.players);
  addChatMessage('System', `${data.user.nickname} joined`);
});

gameAPI.on('player-left', (data) => {
  updatePlayersList(data.players);
  addChatMessage('System', `${data.user.nickname} left`);
});

gameAPI.on('spectator-joined', (data) => {
  updateSpectatorsList(data.spectators);
});

// Game events
gameAPI.on('game-started', (data) => {
  currentRoom = data.room;
  renderGameBoard();
  renderPlayerHand(data.hand);
  showNotification('Game started!', 'success');
});

gameAPI.on('card-played', (data) => {
  updateGameState(data);
  animateCardPlay(data.card);
  if (data.user.id !== myUserId) {
    showNotification(`${data.user.nickname} played ${data.card.color} ${data.card.type}`);
  }
});

gameAPI.on('card-drawn', (data) => {
  if (data.userId === myUserId) {
    addCardToHand(data.card);
  } else {
    updateOpponentCardCount(data.userId, data.cardCount);
  }
  animateCardDraw(data.count);
});

gameAPI.on('turn-changed', (data) => {
  currentRoom.currentPlayer = data.currentPlayer;
  highlightCurrentPlayer(data.currentPlayer);
  updateTurnTimer(data.turnTimer);
});

gameAPI.on('uno-called', (data) => {
  markPlayerUno(data.userId);
  showNotification(`${data.user.nickname} called UNO!`, 'warning');
});

gameAPI.on('uno-caught', (data) => {
  showNotification(`${data.accuser.nickname} caught ${data.target.nickname}!`, 'error');
  updateOpponentCardCount(data.target.id, data.newCardCount);
});

gameAPI.on('game-won', (data) => {
  showWinnerModal(data.winner, data.score);
  updateStats();
});

// Chat events
gameAPI.on('chat-message', (data) => {
  addChatMessage(data.user, data.message);
});

// Settings events
gameAPI.on('settings-changed', (data) => {
  currentRoom.settings = data.settings;
  renderRoomSettings();
});
```

### 3.3 CSS Styling with Placeholder Cards (`style.css`)

**Placeholder Card Design:**
```css
.card {
  width: 100px;
  height: 140px;
  border-radius: 10px;
  border: 2px solid #333;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  position: relative;
  background: white;
}

.card.red { background: linear-gradient(135deg, #ff5252, #ff1744); }
.card.yellow { background: linear-gradient(135deg, #ffeb3b, #ffc107); }
.card.green { background: linear-gradient(135deg, #4caf50, #388e3c); }
.card.blue { background: linear-gradient(135deg, #2196f3, #1565c0); }
.card.wild { background: linear-gradient(135deg, #f44336, #ffeb3b, #4caf50, #2196f3); }

.card-number {
  font-size: 48px;
  font-weight: bold;
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

.card-icon {
  font-size: 36px;
  color: white;
  text-shadow: 2px 2px 4px rgba(0,0,0,0.5);
}

/* Use Unicode/Emoji for placeholder icons */
.card.skip .card-icon::before { content: '⊘'; }
.card.reverse .card-icon::before { content: '⇄'; }
.card.draw2 .card-icon::before { content: '+2'; }
.card.wild .card-icon::before { content: '🌈'; }
.card.wild-draw4 .card-icon::before { content: '+4'; }

.card-back {
  background: linear-gradient(135deg, #424242, #212121);
  color: #fff;
}
.card-back::after { content: 'UNO'; font-size: 24px; font-weight: bold; }
```

**Key Visual Elements:**
- [ ] Lobby screen with room grid layout
- [ ] Game board with centered discard/draw piles
- [ ] Player hand as horizontal card fan at bottom
- [ ] Opponent hands around top/sides
- [ ] Sidebar with collapsible sections
- [ ] CSS-based placeholder cards (colored divs with text/emoji)
- [ ] Card hover effects (slight lift, glow if playable)
- [ ] Animations for card play/draw
- [ ] Modal overlays with backdrop blur
- [ ] Color indicator for current color
- [ ] Turn direction arrow (CSS arrow or emoji: ↻ ↺)
- [ ] UNO badge on player with 1 card
- [ ] Timer countdown with color change (green → yellow → red)
- [ ] Responsive layout (desktop-first, optional mobile)

**Theme Integration:**
- [ ] Use player colors from profile for avatars/borders
- [ ] Use name colors for nicknames
- [ ] Match existing framework styling (consistent with TicTacToe/RPS)

---

## Phase 4: Art Asset Creation (Day 6-7, 4-8 hours)

**Note**: This phase can be done in parallel or after core functionality is working. Game will be fully playable with placeholder CSS cards from Phase 3.

### 4.1 Art Asset Requirements

**User to create these assets. Place in `games/uno/assets/`:**

#### Icon-Based Card System
Instead of 55 individual card images, create **reusable icons** that are programmatically colored:

**Required Icon Assets (SVG or PNG with transparency):**
- [ ] `icon-skip.svg` - Skip symbol (⊘ styled)
- [ ] `icon-reverse.svg` - Reverse arrows (⇄ styled)
- [ ] `icon-draw2.svg` - +2 symbol
- [ ] `icon-wild.svg` - Wild card symbol (rainbow/star)
- [ ] `icon-wild-draw4.svg` - +4 symbol with wild indicator
- [ ] `card-back.png` - Card back design
- [ ] `icon-uno-logo.png` - Game logo for room list (256×256)

**Total Icon Assets**: 7 files (instead of 55!)

**CSS Implementation:**
```css
.card {
  /* Base card with CSS background color */
  background: var(--card-color);
}

.card-icon {
  /* Icon is overlaid and colored via CSS filter or SVG fill */
  background-image: url('assets/icon-skip.svg');
  filter: brightness(0) invert(1); /* Make icon white */
}
```

**Benefits:**
- Minimal asset creation (7 icons vs 55 images)
- Consistent styling across all cards
- Easy to update/modify
- Smaller file size
- Scalable (SVG preferred)

### 4.2 Update Card Rendering System

**Client-side changes:**
- [ ] Update `renderCard()` function to use image assets instead of CSS-only
- [ ] Load icon based on card type
- [ ] Apply color filter/tint for colored cards
- [ ] Keep number text rendering (no number images needed)

**Example Implementation:**
```javascript
function renderCard(card) {
  const cardDiv = document.createElement('div');
  cardDiv.className = `card ${card.color}`;

  if (card.type === 'number') {
    // Number cards: colored background + text
    cardDiv.innerHTML = `<span class="card-number">${card.value}</span>`;
  } else {
    // Action cards: colored background + icon
    const icon = document.createElement('img');
    icon.src = `assets/icon-${card.type}.svg`;
    icon.className = 'card-icon';
    cardDiv.appendChild(icon);
  }

  return cardDiv;
}
```

### 4.3 Optional Enhancements
- [ ] Add card shadow effects
- [ ] Improve icon designs with professional graphics
- [ ] Add subtle card textures
- [ ] Create animated icon variants (e.g., spinning wild card)
- [ ] Add sound effect assets (if desired)

---

## Phase 5: Testing & Refinement (Day 8, 4-6 hours)

### 4.1 Core Functionality Testing
- [ ] Create room with various settings
- [ ] Join as 2nd, 3rd, 4th player
- [ ] Start game with 2 players
- [ ] Play full game to completion
- [ ] Test all card types:
  - [ ] Number cards
  - [ ] Skip cards
  - [ ] Reverse cards
  - [ ] Draw Two cards
  - [ ] Wild cards
  - [ ] Wild Draw Four cards
- [ ] Test UNO call (correct and missed)
- [ ] Test win condition
- [ ] Test rematch functionality

### 4.2 Edge Case Testing
- [ ] Deck reshuffling when draw pile empty
- [ ] Multiple Draw 2 stacking (if enabled)
- [ ] Reverse with 2 players (acts as skip)
- [ ] Wild Draw Four challenge (if enabled)
- [ ] Jump-In rule (if enabled)
- [ ] Seven swap hands (if enabled)
- [ ] Zero rotate hands (if enabled)
- [ ] Turn timer expiration
- [ ] Player disconnect during game
- [ ] Player reconnect to ongoing game
- [ ] Host leaves room
- [ ] Last player leaves (room cleanup)

### 4.3 Spectator Testing
- [ ] Join as spectator
- [ ] View game state (all except player hands)
- [ ] Participate in chat
- [ ] Switch from spectator to player
- [ ] Spectator sees all game events

### 4.4 Chat Testing
- [ ] Send messages as player
- [ ] Send messages as spectator
- [ ] Chat history preserved on rejoin
- [ ] XSS protection (HTML escaping)
- [ ] 50-message limit enforced

### 4.5 Multi-Room Testing
- [ ] Create 3+ simultaneous rooms
- [ ] Players in different rooms don't see each other's events
- [ ] Chat is room-scoped
- [ ] Switching between rooms works correctly

### 4.6 Stats Integration Testing
- [ ] Wins recorded to stats API
- [ ] Games played incremented
- [ ] Leaderboard updates correctly
- [ ] Stats persist across sessions

### 4.7 Admin Panel Testing
- [ ] Settings.json loads correctly
- [ ] Live stats update (room count, player count)
- [ ] Changing default settings reflects in new rooms
- [ ] Admin can monitor active games

### 4.8 Performance Testing
- [ ] 10 players in one room
- [ ] Multiple rooms with spectators
- [ ] Rapid card plays
- [ ] Chat spam handling
- [ ] Memory leaks (long-running rooms)

### 4.9 Cross-Browser Testing
- [ ] Chrome/Edge (primary)
- [ ] Firefox
- [ ] Safari (if available)
- [ ] Mobile browsers (bonus)

---

## Phase 6: Polish & Documentation (Day 9, 2-4 hours)

### 6.1 Visual Polish
- [ ] Smooth animations for all card movements
- [ ] Particle effects for special cards (optional)
- [ ] Loading states for async operations
- [ ] Tooltips for game rules/buttons
- [ ] Error message styling
- [ ] Integrate art assets from Phase 4 (if completed)
- [ ] Add sound effects (optional):
  - Card play sound
  - Card draw sound
  - UNO call sound
  - Win fanfare

### 6.2 UX Improvements
- [ ] Keyboard shortcuts (Enter to send chat, Escape to close modals)
- [ ] Auto-scroll chat to bottom on new message
- [ ] Confirm before leaving room during game
- [ ] Visual feedback for card playability (highlight/disable)
- [ ] Show remaining cards in deck counter
- [ ] Display house rules in room info
- [ ] "How to Play" modal with rules

### 6.3 Accessibility
- [ ] Alt text for all card images
- [ ] ARIA labels for buttons
- [ ] Keyboard navigation support
- [ ] High contrast mode compatibility
- [ ] Screen reader announcements for game events

### 6.4 Code Quality
- [ ] Add JSDoc comments to all functions
- [ ] Consistent code style (match existing games)
- [ ] Error handling for all socket events
- [ ] Logging for debugging (console.log in dev, remove in prod)
- [ ] No hardcoded values (use constants)

### 6.5 Documentation
- [ ] Update `README.md` in `games/uno/` with:
  - Game rules overview
  - House rules explanations
  - Admin settings guide
  - Known issues/limitations
- [ ] Code comments for complex logic
- [ ] API documentation for socket events
- [ ] Settings.json schema documentation

### 6.6 Final Metadata
- [ ] Complete `game.json` with accurate info
- [ ] Create game icon/thumbnail (256x256 PNG)
- [ ] Set correct version number
- [ ] Add credits/attribution if using external assets

---

## Implementation Timeline Summary

| Phase | Duration | Focus | Dependencies |
|-------|----------|-------|--------------|
| **Phase 1** | 2-3 hours | Planning & Design | None |
| **Phase 2** | 6-8 hours | Server Logic | Phase 1 complete |
| **Phase 3** | 8-10 hours | Client UI (CSS Placeholders) | Phase 1, 2 complete |
| **Phase 4** | 4-8 hours | Art Asset Creation | Can be parallel to Phase 5 |
| **Phase 5** | 4-6 hours | Testing | Phase 2, 3 complete |
| **Phase 6** | 2-4 hours | Polish & Docs | All phases complete |
| **Total** | **26-39 hours** | ~5-8 days (part-time) | - |

**Note**: Game is **fully playable** after Phase 3 with placeholder CSS cards. Phase 4 (art) can be completed later to replace placeholders with polished graphics.

---

## Critical Success Factors

### Must-Have Features (MVP)
- ✅ 2-10 player support
- ✅ All standard Uno cards working correctly
- ✅ Turn-based gameplay with validation
- ✅ UNO call system
- ✅ Win detection and scoring
- ✅ Room-based architecture
- ✅ Spectator support
- ✅ Chat with history
- ✅ Basic house rules (configurable)

### Nice-to-Have Features
- Advanced house rules (Seven Swap, Zero Rotate, Jump-In)
- Turn timer with visual countdown
- Wild Draw Four challenge system
- Sound effects and animations
- Mobile-responsive design
- In-game tutorial overlay
- Replay system (save game history)

### Future Enhancements (Post-MVP)
- AI opponent for single-player
- Tournament mode (similar to RPS)
- Custom card backs (user profiles)
- Achievements system
- Match history and detailed stats
- Voice chat integration
- Custom rule sets (save/load)

---

## Technical Decisions & Rationale

### Why Room-Based Architecture?
- Allows multiple simultaneous games
- Scales better than single-game instance
- Matches existing TicTacToe pattern
- Easier to add tournament mode later

### Why Server-Authoritative State?
- Prevents cheating (player can't see opponent hands)
- Validates all moves server-side
- Ensures consistent state across all clients
- Required for turn-based gameplay

### Why Socket.IO Events?
- Real-time updates for multiplayer
- Existing framework support (gameAPI)
- Efficient for frequent state changes
- Built-in reconnection handling

### Why Not Use Canvas?
- DOM-based cards are easier to style and animate
- Better accessibility (screen readers)
- Easier click handling for card selection
- CSS animations are performant enough

### Why Settings.json for House Rules?
- Admin can change defaults without code changes
- Follows framework pattern
- Easy to add new rules later
- Separates config from logic

---

## Risk Mitigation

### Risk: Complex State Synchronization
**Mitigation:**
- Server is single source of truth
- Clients only render what server sends
- Use sanitization to hide private data (hands)
- Extensive logging for debugging

### Risk: Card Art Assets Delay
**Mitigation:**
- ✅ Using CSS-based placeholder cards for Phases 1-3
- ✅ Game fully playable without any image assets
- ✅ Art creation moved to Phase 4 (can be done after testing)
- ✅ Icon-based system reduces asset count from 55 to 7 files
- ✅ Easy swap from CSS to images without logic changes

### Risk: House Rules Complexity
**Mitigation:**
- Implement core rules first (MVP)
- Add house rules incrementally
- Make all optional (settings flags)
- Test each rule in isolation

### Risk: Performance with Many Players
**Mitigation:**
- Limit to 10 players per room
- Optimize hand rendering (only re-render changed cards)
- Use efficient data structures (Maps over Objects)
- Debounce rapid events (if needed)

### Risk: Disconnect/Reconnect Issues
**Mitigation:**
- Copy TicTacToe reconnection pattern (proven)
- Store socket.currentRoom on server
- Allow rejoin with same userId
- Send full state on reconnect

---

## Code Structure Summary

```
games/uno/
├── game.json                 # Game metadata (required by framework)
├── settings.json             # Admin settings schema
├── server.js                 # Server-side game logic (Node.js)
├── index.html                # Game UI structure
├── game.js                   # Client-side logic
├── style.css                 # Game-specific styles (includes CSS placeholder cards)
├── assets/                   # Art assets (optional, created in Phase 4)
│   ├── icon-skip.svg        # Skip icon (reusable, programmatically colored)
│   ├── icon-reverse.svg     # Reverse icon
│   ├── icon-draw2.svg       # Draw Two icon
│   ├── icon-wild.svg        # Wild card icon
│   ├── icon-wild-draw4.svg  # Wild Draw Four icon
│   ├── card-back.png        # Card back design
│   └── icon-uno-logo.png    # Game logo (256×256)
├── ROADMAP.md               # This file
└── README.md                # Game documentation (to be created)
```

---

## Next Steps

1. **Phase 1: Planning (NOW):**
   - [x] Review this roadmap
   - [ ] Finalize game design decisions
   - [ ] Create `game.json` and `settings.json`
   - [ ] Ready to proceed to Phase 2

2. **Phase 2-3: Core Development (6-8 days):**
   - Implement server logic (6-8 hours)
   - Build client UI with CSS placeholder cards (8-10 hours)
   - **Game will be fully playable at this point!**

3. **Phase 4: Art Creation (Optional, can be done later):**
   - Create 7 icon assets (4-8 hours)
   - Update rendering code to use icons
   - Replace CSS placeholders with polished graphics

4. **Phase 5-6: Testing & Polish (2-4 days):**
   - Test thoroughly (4-6 hours)
   - Polish and document (2-4 hours)

5. **Deployment:**
   - Switch active game via admin panel
   - Announce to users
   - Monitor for bugs
   - Iterate based on feedback

---

## Questions for Clarification

Before starting Phase 2, please confirm:

1. ✅ **Art Assets:** Using CSS placeholders initially, 7 icon assets in Phase 4 (minimal art required)
2. **House Rules:** Which house rules are priority? (All optional, but affects implementation order)
3. **Player Count:** Is 2-10 players acceptable, or different range?
4. **Turn Timer:** Should this be mandatory or optional? Default time?
5. **Scoring System:** Use standard Uno scoring (card points) or just track wins/losses?
6. **Tournament Mode:** Priority for initial release, or save for v2?
7. **Mobile Support:** Is mobile-responsive layout required, or desktop-only acceptable?

---

## Resources & References

### Official Uno Rules
- [Mattel Official Rules](https://www.unorules.com/)
- Standard deck: 108 cards (76 numbered, 24 action, 8 wild)
- Win condition: First to empty hand
- Scoring: Sum of cards in opponents' hands

### Framework Files to Reference
- `games/tictactoe/server.js` - Room system, chat, spectators
- `games/tictactoe/index.html` - UI layout, modals
- `games/tictactoe/game.js` - Event handling, state management
- `games/rps-tournament/server.js` - Complex state machine
- `games/rps-tournament/settings.json` - Settings schema
- `public/js/gameapi.js` - Client API documentation
- `server/settingsManager.js` - Admin settings system

### Helpful Libraries (if needed)
- None required (vanilla JS preferred)
- Socket.IO client (already included via framework)
- CSS animations (no library needed)

---

## Summary of Changes (Updated Roadmap)

### Key Updates:
1. ✅ **No art assets required for initial development** (Phases 1-3)
2. ✅ **CSS-based placeholder cards** with colored backgrounds and text/emoji icons
3. ✅ **Art phase moved to Phase 4** (between old Phase 3 and 4)
4. ✅ **Reduced asset count** from 55 images to 7 reusable icons
5. ✅ **Icon-based system** where icons are programmatically colored for each card color
6. ✅ **Game fully playable** after Phase 3 without any image assets
7. ✅ **Phase 4 can be done in parallel** or after testing/deployment

### Development Flow:
```
Phase 1: Planning (2-3h)
  ↓
Phase 2: Server Logic (6-8h)
  ↓
Phase 3: Client UI with CSS Placeholders (8-10h)
  ↓
[GAME IS PLAYABLE - DEPLOY IF DESIRED]
  ↓
Phase 4: Art Asset Creation (4-8h) ← Can be done anytime
  ↓
Phase 5: Testing (4-6h)
  ↓
Phase 6: Polish & Docs (2-4h)
```

**This roadmap is now complete and ready for implementation. No art assets required to start development!**
