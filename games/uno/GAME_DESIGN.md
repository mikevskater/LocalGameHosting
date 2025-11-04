# Uno Game Design Document

## Game Overview

Uno is a classic card-matching game where players race to be the first to empty their hand by matching colors or numbers with the card on top of the discard pile.

---

## Card Set Definition

### Standard Deck Composition (108 cards total)

#### Number Cards (76 cards)
- **Red**: 0 (×1), 1-9 (×2 each) = 19 cards
- **Yellow**: 0 (×1), 1-9 (×2 each) = 19 cards
- **Green**: 0 (×1), 1-9 (×2 each) = 19 cards
- **Blue**: 0 (×1), 1-9 (×2 each) = 19 cards

#### Action Cards (24 cards)
- **Skip**: 2 per color (×4 colors) = 8 cards
- **Reverse**: 2 per color (×4 colors) = 8 cards
- **Draw Two**: 2 per color (×4 colors) = 8 cards

#### Wild Cards (8 cards)
- **Wild**: 4 cards
- **Wild Draw Four**: 4 cards

---

## Game Flow

### 1. Setup Phase
1. Shuffle the 108-card deck
2. Deal 7 cards to each player (face down, private)
3. Place remaining cards face down as the **draw pile**
4. Flip the top card to start the **discard pile**
   - If it's a Wild card, return it and flip another
   - If it's an action card, apply its effect immediately

### 2. Playing Phase

**Turn Order:**
- Play proceeds clockwise (or counter-clockwise after a Reverse)
- On your turn, you must do ONE of the following:
  1. **Play a card** that matches the discard pile's color OR number/type
  2. **Play a Wild card** (always playable)
  3. **Draw a card** from the draw pile
     - If playable, you MAY play it immediately (optional)
     - If not playable (or you choose not to), pass turn

**Valid Card Plays:**
- **Number card**: Matches color OR value
  - Example: Red 5 on Red 3 ✓
  - Example: Red 5 on Blue 5 ✓
- **Action card**: Matches color OR type
  - Example: Red Skip on Red 7 ✓
  - Example: Red Skip on Green Skip ✓
- **Wild cards**: Always playable
- **Wild Draw Four**: Only if you have NO other playable cards (challengeable)

### 3. Special Card Effects

#### Skip
- **Effect**: Next player in turn order loses their turn
- **With 2 players**: Acts like playing twice in a row

#### Reverse
- **Effect**: Reverses the direction of play (clockwise ↔ counter-clockwise)
- **With 2 players**: Acts like a Skip

#### Draw Two
- **Effect**: Next player draws 2 cards and loses their turn
- **Stacking** (house rule): If enabled, next player can play another Draw Two to pass the penalty (+2 more) to the following player

#### Wild
- **Effect**: Player chooses any color to continue play
- **No draw penalty**

#### Wild Draw Four
- **Effect**: Player chooses any color, next player draws 4 cards and loses their turn
- **Restriction**: Can only be played if you have NO other playable cards
- **Challenge** (house rule): If enabled, next player can challenge the play
  - If challenge succeeds (player had a playable card): Original player draws 4 cards
  - If challenge fails: Challenger draws 6 cards instead of 4

### 4. UNO Call

**Rule:**
- When a player has exactly **1 card left**, they must call "UNO!" before the next player takes their turn
- **Penalty**: If another player catches them not calling UNO, the player must draw 2 cards (configurable)

**Implementation:**
- UNO button becomes active when player has 1 card
- Other players can click "Catch UNO" on opponents with 1 card who didn't call it

### 5. Win Condition

**Winner**: First player to play their last card (hand is empty)

**Scoring** (optional, for tournament mode):
- Calculate points based on cards remaining in opponents' hands:
  - Number cards: Face value (0-9)
  - Skip/Reverse/Draw Two: 20 points each
  - Wild/Wild Draw Four: 50 points each
- First to 500 points wins the match (or just track wins/losses)

---

## House Rules (Configurable)

### 1. Draw Until Playable
- **Default**: OFF
- **Effect**: When drawing, keep drawing until you get a playable card (instead of just drawing 1)

### 2. Stacking Draw Cards
- **Default**: OFF
- **Effect**: Can play Draw Two on Draw Two (or Draw Four on Draw Four) to pass the penalty to the next player
- **Example**: Player A plays Draw Two → Player B plays Draw Two → Player C draws 4 cards

### 3. Jump-In
- **Default**: OFF
- **Effect**: Any player can play an **identical card** (same color AND value) out of turn
- **Example**: If Red 7 is played, anyone with another Red 7 can immediately play it
- **Turn order**: Continues from the jump-in player

### 4. Seven Swap
- **Default**: OFF
- **Effect**: When a 7 is played, the player chooses another player to swap hands with
- **UI**: Modal appears to select target player

### 5. Zero Rotate
- **Default**: OFF
- **Effect**: When a 0 is played, all players pass their hands to the next player (in current turn direction)

### 6. Forced Play
- **Default**: OFF
- **Effect**: If you have a playable card, you MUST play it (no drawing to bluff)
- **Implementation**: Draw button is disabled when player has playable cards

### 7. Challenge Wild Draw Four
- **Default**: ON
- **Effect**: Allows next player to challenge a Wild Draw Four
- **Validation**: Server checks if previous player had any playable cards
- **Penalty**: Loser of challenge draws extra cards

---

## Turn Timer

**Purpose**: Prevent players from stalling indefinitely

**Behavior:**
- Configurable per room (0 = disabled, or 10-300 seconds)
- Visual countdown displayed to all players
- Warning at 10 seconds remaining (color change: green → yellow → red)
- **On timeout**: Player automatically draws a card and turn passes

---

## Card Rendering System (Phase 3 CSS Placeholders)

### Number Cards
```css
<div class="card red">
  <span class="card-number">7</span>
</div>
```

### Action Cards
```css
<div class="card blue skip">
  <span class="card-icon">⊘</span>
</div>
```

### Wild Cards
```css
<div class="card wild">
  <span class="card-icon">🌈</span>
</div>
```

### Card Symbols
- **Skip**: ⊘ (Unicode 2298)
- **Reverse**: ⇄ (Unicode 21C4)
- **Draw Two**: +2 (text)
- **Wild**: 🌈 (emoji)
- **Wild Draw Four**: +4 (text)
- **Card Back**: "UNO" text on dark gradient

---

## Game State Machine

```
waiting (lobby)
  ↓ [Host starts game with 2+ players]
playing
  ↓ [Player empties hand]
finished
  ↓ [Rematch or leave]
waiting (lobby)
```

---

## Socket Events API

### Client → Server

| Event | Data | Description |
|-------|------|-------------|
| `create-room` | `{ name, maxPlayers, settings }` | Create new Uno room |
| `join-room` | `{ roomId }` | Join room as player |
| `spectate-room` | `{ roomId }` | Join room as spectator |
| `leave-room` | `{}` | Leave current room |
| `start-game` | `{}` | Start game (host only, 2+ players) |
| `play-card` | `{ cardId, chosenColor? }` | Play a card (Wild requires color) |
| `draw-card` | `{}` | Draw card from deck |
| `call-uno` | `{}` | Declare UNO (1 card left) |
| `catch-uno` | `{ targetUserId }` | Catch opponent who missed UNO |
| `challenge-wild` | `{}` | Challenge previous Wild Draw Four |
| `chat-message` | `{ message }` | Send chat message |
| `rematch` | `{}` | Request rematch after game ends |

### Server → Client

| Event | Data | Description |
|-------|------|-------------|
| `rooms-list` | `{ rooms[] }` | List of available rooms (lobby) |
| `room-created` | `{ roomId }` | Room successfully created |
| `room-joined` | `{ room, role, chatHistory, hand? }` | Joined room (includes private hand) |
| `game-started` | `{ room }` | Game has begun |
| `card-played` | `{ user, card, currentColor }` | Player played a card |
| `card-drawn` | `{ userId, cardCount }` | Player drew card(s) |
| `cards-drawn` | `{ cards[] }` | You drew cards (private) |
| `turn-changed` | `{ currentPlayer, turnDirection }` | Turn advanced |
| `uno-called` | `{ userId, user }` | Player called UNO |
| `uno-caught` | `{ accuserId, targetId, penalty }` | Player caught for missed UNO |
| `game-won` | `{ winner, score }` | Game ended |
| `player-joined` | `{ user, players }` | New player joined room |
| `player-left` | `{ userId, players }` | Player left room |
| `spectator-joined` | `{ user, spectators }` | New spectator |
| `chat-message` | `{ user, message, timestamp }` | Chat message |
| `error` | `{ message }` | Error occurred |

---

## Data Structures

### Card Object
```javascript
{
  id: string,              // Unique instance ID (e.g., "card-123")
  color: 'red' | 'yellow' | 'green' | 'blue' | 'wild',
  type: 'number' | 'skip' | 'reverse' | 'draw2' | 'wild' | 'wild-draw4',
  value: number | null     // 0-9 for number cards, null otherwise
}
```

### Room Object
```javascript
{
  id: string,
  name: string,
  host: userId,
  players: [user],         // 2-10 players (nulls for empty slots)
  spectators: [user],
  gameState: 'waiting' | 'playing' | 'finished',

  // Game state
  deck: [card],            // Draw pile
  discardPile: [card],     // Played cards (top = current card)
  hands: { userId: [card] }, // Private hands
  currentPlayer: userId,
  turnDirection: 1 | -1,   // 1 = clockwise, -1 = counter-clockwise
  currentColor: string,    // Current active color
  drawStack: number,       // Accumulated Draw 2/4 penalties

  // UNO tracking
  unoCalled: { userId: boolean },

  // Settings
  settings: {
    maxPlayers: number,
    turnTimer: number,
    drawUntilPlayable: boolean,
    stackingDraw: boolean,
    jumpIn: boolean,
    sevenSwap: boolean,
    zeroRotate: boolean,
    forcedPlay: boolean,
    challengeWildDraw4: boolean
  },

  // Chat
  chatHistory: [message],  // Last 50 messages

  // Timers
  turnTimerActive: timeoutId,
  turnStartTime: timestamp,

  createdAt: timestamp
}
```

---

## Implementation Priority

### Phase 2 (Server) - Must Have:
1. ✅ Core card deck generation
2. ✅ Room create/join/leave
3. ✅ Game start (deal cards, flip first)
4. ✅ Basic card play validation
5. ✅ Number cards
6. ✅ Skip, Reverse, Draw Two
7. ✅ Wild, Wild Draw Four
8. ✅ Turn advancement
9. ✅ Win detection
10. ✅ Chat system
11. ✅ UNO call system

### Phase 2 (Server) - Nice to Have:
- Turn timer
- Draw Until Playable rule
- Catch missed UNO
- Stats tracking

### Phase 2 (Server) - Advanced (v2):
- Stacking draw cards
- Jump-In
- Seven Swap
- Zero Rotate
- Wild Draw Four challenge

---

## Testing Checklist

### Basic Gameplay
- [ ] Create room with 2 players
- [ ] Deal 7 cards to each player
- [ ] Play number cards (match color)
- [ ] Play number cards (match value)
- [ ] Play Skip card
- [ ] Play Reverse card
- [ ] Play Draw Two card
- [ ] Play Wild card (choose color)
- [ ] Play Wild Draw Four
- [ ] Draw card when no playable cards
- [ ] Call UNO with 1 card
- [ ] Win by playing last card

### Edge Cases
- [ ] Deck runs out (reshuffle discard pile)
- [ ] Reverse with 2 players (acts as Skip)
- [ ] Draw Two while deck has < 2 cards
- [ ] Multiple Skip cards in a row
- [ ] Starting game with action card on discard

### Multiplayer
- [ ] 3+ players in one room
- [ ] Player disconnect/reconnect
- [ ] Spectator watching game
- [ ] Spectator switching to player
- [ ] Chat messages visible to all

---

## Design Decisions & Rationale

### Why CSS Cards Instead of Images?
1. **Faster development** - No waiting for art assets
2. **Flexible** - Easy to tweak colors, sizes, styles
3. **Accessible** - Text-based content for screen readers
4. **Lightweight** - No image loading delays
5. **Upgradeable** - Can swap to icons later (Phase 4)

### Why Server-Authoritative?
- **Prevents cheating** - Players can't see opponent hands via client inspection
- **Validates moves** - Server checks card legality before accepting
- **Consistent state** - Single source of truth for all clients

### Why Configurable House Rules?
- **Flexibility** - Different groups have different preferences
- **Engagement** - Players can customize experience
- **Scalability** - Easy to add new rules without breaking core logic

### Why Room-Based?
- **Scalability** - Multiple games can run simultaneously
- **Privacy** - Groups can play together without interference
- **Spectators** - Friends can watch without joining

---

**Phase 1 Complete!** Ready to proceed to Phase 2 (Server Logic).
