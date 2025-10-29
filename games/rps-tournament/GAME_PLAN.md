# Rock Paper Scissors Tournament - Game Plan

## 🎯 Game Overview

A competitive multiplayer Rock Paper Scissors tournament with bracket elimination, real-time matches, spectator mode, and comprehensive statistics tracking.

---

## 🎮 Core Gameplay Loop

### **Lobby Phase**
1. Players join and see list of waiting players
2. Minimum 2 players required, supports up to 16 players
3. Ready system - players mark themselves ready
4. Host/Admin can configure tournament settings
5. When all ready (or timer expires), tournament starts

### **Tournament Bracket Phase**
1. Auto-generate single-elimination bracket
2. Display visual bracket showing all matchups
3. Pair players for Round 1 matches
4. Highlight current active matches
5. Winners advance, losers become spectators

### **Match Phase** (Best of 3 or 5)
1. Two players face off
2. Countdown timer (3... 2... 1... SHOOT!)
3. Simultaneous selection (Rock/Paper/Scissors)
4. Reveal animations with result
5. Best of X format - first to win majority
6. Winner advances to next bracket round

### **Grand Finals**
1. Special "Grand Finals" banner
2. All eliminated players spectate
3. Champion crowned with trophy animation
4. Stats displayed
5. Option to start new tournament

---

## ✨ Core Features

### **1. Tournament System**
- **Single Elimination Bracket**
  - Auto-generate bracket from player list
  - Visual bracket display
  - Handle odd numbers (bye rounds)
  - Semi-finals, finals visualization

- **Match Format Options**
  - Best of 3 (first to 2)
  - Best of 5 (first to 3)
  - Best of 7 (first to 4)
  - Configurable by admin

- **Seeding Options**
  - Random seeding
  - By join order
  - By past stats (wins/losses)
  - By custom admin ordering

### **2. Match Mechanics**
- **Simultaneous Selection**
  - Both players choose at same time
  - Locked choices (can't change after selection)
  - Server validates no cheating
  - Countdown timer synchronization

- **Result Determination**
  - Rock beats Scissors
  - Paper beats Rock
  - Scissors beats Paper
  - Tie handling with rematch

- **Visual Feedback**
  - Choice animations (rock smashing, paper covering, scissors cutting)
  - Winner highlight
  - Score updates
  - Sound effects (optional)

### **3. Player Experience**
- **Lobby**
  - Player list with ready status
  - Settings panel (if host)
  - Tournament bracket preview
  - Chat system

- **Active Match**
  - Large choice buttons (Rock/Paper/Scissors)
  - Countdown timer
  - Opponent info
  - Current score (2-1, etc.)
  - Match number (Match 1/4)

- **Waiting/Spectating**
  - View current matches
  - Bracket overview
  - Chat with other spectators
  - Player stats

### **4. Spectator Mode**
- Watch any active match
- Switch between concurrent matches
- See bracket progress
- Chat with other spectators
- Eliminated players auto-spectate

### **5. Stats & Progression**
- **Per-Tournament Stats**
  - Placement (1st, 2nd, 3rd, etc.)
  - Total wins/losses
  - Win rate
  - Favorite choice
  - Longest win streak

- **All-Time Stats** (saved to database)
  - Tournaments played
  - Championships won
  - Total matches won/lost
  - Rock/Paper/Scissors distribution
  - Head-to-head records

- **Leaderboard**
  - Championship count
  - Win rate
  - Total wins
  - Current streak

---

## 🎨 Enhanced Features

### **1. Visual Polish**
- **Animations**
  - Hand gesture animations
  - Rock crushing scissors animation
  - Paper wrapping rock animation
  - Scissors cutting paper animation
  - Confetti on tournament win
  - Bracket line animations

- **Emotes/Reactions**
  - Quick chat emotes (GG, Nice!, Oops!)
  - Emoji reactions during matches
  - Victory poses

- **Themes**
  - Different visual styles
  - Color customization
  - Tournament brackets styling

### **2. Game Modes**
- **Classic Tournament** (Single Elimination)
- **Double Elimination** (Losers bracket)
- **Round Robin** (Everyone plays everyone)
- **Team Tournament** (2v2 or 3v3 teams)
- **Time Attack** (Most wins in 5 minutes)
- **Sudden Death** (Single round, no best-of)

### **3. Special Mechanics**
- **Power-Ups** (Optional, fun mode)
  - Shield (block one loss)
  - Double-or-Nothing (risk/reward)
  - Spy (see opponent's last choice)
  - Time Freeze (extra time to decide)

- **Variations**
  - Rock Paper Scissors Lizard Spock (5 choices)
  - Mystery Choice (random selection)
  - Reverse Mode (lose to win)

### **4. Social Features**
- **Achievements**
  - "Undefeated" - Win without losing a round
  - "Comeback Kid" - Win from 0-2 deficit
  - "Rock Solid" - Win 10 matches with only rock
  - "Paper Trail" - Win tournament using only paper
  - "Sharp Plays" - Win 5 matches in a row

- **Profiles**
  - Avatar display
  - Stats showcase
  - Achievement badges
  - Titles earned

- **Rivalries**
  - Track head-to-head records
  - Rivalry badges (nemesis/victim)
  - Revenge match notifications

### **5. Quality of Life**
- **Auto-Ready System**
  - Auto-start when all ready
  - Kick inactive players
  - Ready timer (30s to ready or spectate)

- **Reconnection**
  - Rejoin if disconnected mid-match
  - Grace period (30 seconds)
  - Auto-forfeit if not returned

- **Practice Mode**
  - Play against AI
  - Practice timing
  - Learn strategy

- **Tournament History**
  - Replay bracket
  - See past champions
  - Export results

---

## 🏗️ Technical Architecture

### **Server-Side (`server.js`)**

#### **Data Structures**
```javascript
{
  tournament: {
    active: boolean,
    state: 'lobby' | 'bracket' | 'finished',
    settings: {
      format: 'bo3' | 'bo5' | 'bo7',
      seeding: 'random' | 'order' | 'ranked',
      autoStart: boolean,
      readyTimeout: number
    },
    players: [{ id, nickname, ready, seed, eliminated }],
    bracket: [[match1, match2], [match3], [final]],
    currentRound: number,
    champion: userId
  },

  matches: {
    matchId: {
      id: string,
      round: number,
      player1: { id, nickname, score, choice },
      player2: { id, nickname, score, choice },
      state: 'waiting' | 'countdown' | 'choosing' | 'reveal' | 'finished',
      currentGame: number,
      history: [{ p1Choice, p2Choice, winner }],
      winner: userId
    }
  },

  stats: {
    userId: {
      tournamentsPlayed: number,
      championships: number,
      totalWins: number,
      totalLosses: number,
      rockCount: number,
      paperCount: number,
      scissorsCount: number,
      currentStreak: number
    }
  }
}
```

#### **Key Functions**
- `createTournament()` - Initialize tournament
- `playerReady(userId)` - Mark player ready
- `startTournament()` - Generate bracket, start matches
- `generateBracket(players)` - Create bracket structure
- `startMatch(matchId)` - Begin countdown for match
- `makeChoice(matchId, userId, choice)` - Record player choice
- `determineWinner(choice1, choice2)` - Game logic
- `advanceWinner(matchId, winnerId)` - Progress bracket
- `endTournament(championId)` - Award stats, crown champion

#### **Real-Time Events**
- `tournament-created` - Lobby opened
- `player-ready` - Player marked ready
- `tournament-started` - Bracket generated
- `match-starting` - Countdown beginning
- `choice-locked` - Player made choice
- `match-result` - Round winner revealed
- `match-complete` - Best-of-X winner
- `round-complete` - Bracket round finished
- `tournament-complete` - Champion crowned

### **Client-Side (`game.js` + `index.html`)**

#### **Screens**
1. **Lobby Screen**
   - Player list with ready indicators
   - Settings panel
   - Ready button
   - Chat

2. **Bracket Screen**
   - Visual tournament bracket
   - Current match highlights
   - Player info cards
   - Spectator count

3. **Match Screen**
   - Choice buttons (Rock/Paper/Scissors)
   - Countdown timer
   - Opponent display
   - Score tracker
   - Match history

4. **Results Screen**
   - Champion announcement
   - Final bracket
   - Stats summary
   - New tournament button

#### **Key Components**
- Choice selection buttons with hover effects
- Countdown timer (3-2-1-SHOOT animation)
- Result reveal with animations
- Bracket tree visualization
- Stats dashboard
- Leaderboard table

---

## 🎯 MVP Features (Phase 1)

### **Must Have**
✅ Lobby with player list and ready system
✅ Best of 3 matches
✅ Single elimination bracket (2-8 players)
✅ Simultaneous choice selection
✅ Basic win/loss determination
✅ Visual bracket display
✅ Champion announcement
✅ Basic stats (placement, wins/losses)
✅ Spectator mode for eliminated players

### **Should Have** (Phase 2)
- Best of 5/7 options
- Support 9-16 players
- Animated reveals
- Chat system
- All-time stats saved to database
- Leaderboard
- Ready timer with auto-start
- Reconnection handling

### **Nice to Have** (Phase 3)
- Emotes/reactions
- Achievements
- Different game modes
- Practice mode
- Tournament history
- Sound effects
- Themes

---

## 📊 User Flow Example

### **4 Player Tournament**

```
1. LOBBY
   - Alice joins (waiting)
   - Bob joins (waiting)
   - Charlie joins (waiting)
   - Diana joins (waiting)
   - All click "Ready"
   - Tournament starts!

2. BRACKET GENERATION
   Bracket:
   ┌─────────┐
   │ Alice   │─┐
   └─────────┘ │  ┌─────────┐
               ├──│ Match 3 │──> Champion
   ┌─────────┐ │  └─────────┘
   │ Bob     │─┘
   └─────────┘

   ┌─────────┐
   │ Charlie │─┐
   └─────────┘ │
               ├──┘
   ┌─────────┐ │
   │ Diana   │─┘
   └─────────┘

3. ROUND 1 - MATCH 1 (Alice vs Bob)
   - 3... 2... 1... SHOOT!
   - Alice: Rock, Bob: Scissors
   - Alice wins! (1-0)

   - 3... 2... 1... SHOOT!
   - Alice: Paper, Bob: Paper
   - Tie! Rematch!

   - 3... 2... 1... SHOOT!
   - Alice: Rock, Bob: Paper
   - Bob wins! (1-1)

   - 3... 2... 1... SHOOT!
   - Alice: Scissors, Bob: Rock
   - Bob wins! (1-2)

   Bob advances! Alice spectates.

4. ROUND 1 - MATCH 2 (Charlie vs Diana)
   - Best of 3 happens
   - Charlie wins 2-1
   - Diana spectates

5. FINALS (Bob vs Charlie)
   - All spectators watching
   - Best of 3
   - Charlie wins 2-0
   - 🏆 CHARLIE IS THE CHAMPION! 🏆

6. RESULTS
   - 1st: Charlie
   - 2nd: Bob
   - 3rd: Alice & Diana (tied)
   - Stats saved
   - "Play Again" button
```

---

## 🎨 UI/UX Design Notes

### **Color Scheme**
- **Rock:** Red/Orange (#E74C3C)
- **Paper:** Blue (#3498DB)
- **Scissors:** Green (#2ECC71)
- **Background:** Purple gradient (match existing theme)
- **Brackets:** Clean white cards with shadows

### **Animations**
- **Choice buttons:** Scale on hover, pulse on click
- **Countdown:** Zoom in with each number
- **Reveal:** Flip cards or slide reveal
- **Winner:** Glow effect, confetti burst
- **Bracket advancement:** Line drawing animation

### **Responsive Design**
- Mobile: Stacked vertical layout
- Desktop: Side-by-side bracket view
- Touch-friendly large buttons
- Clear typography at all sizes

---

## 📈 Success Metrics

### **Engagement**
- Average tournament completion rate
- Player retention (play multiple tournaments)
- Match completion time
- Re-match rate

### **Balance**
- Rock/Paper/Scissors distribution (should be ~33% each)
- Win rate variation (fair seeding)
- Match duration consistency

### **Technical**
- Input lag < 50ms
- Countdown sync accuracy
- Reconnection success rate
- No choice submission errors

---

## 🚀 Implementation Order

### **Day 1: Core Mechanics** (2-3 hours)
1. Create game structure files
2. Lobby system with player list
3. Ready system
4. Basic match logic (RPS winner determination)
5. Single best-of-3 match flow

### **Day 2: Tournament Bracket** (2-3 hours)
6. Bracket generation algorithm
7. Match pairing system
8. Winner advancement logic
9. Visual bracket display
10. Tournament state management

### **Day 3: Polish & Features** (2-3 hours)
11. Countdown timer with animations
12. Result reveals with visual effects
13. Spectator mode
14. Stats tracking
15. Champion announcement

### **Day 4: Testing & Refinement** (1-2 hours)
16. Multi-device testing
17. Edge case handling (disconnects, odd numbers)
18. Performance optimization
19. Bug fixes
20. Documentation

---

## 🎯 Ready to Build?

This plan covers:
- ✅ Core gameplay loop
- ✅ Tournament bracket system
- ✅ Match mechanics
- ✅ Visual design
- ✅ Stats & progression
- ✅ Technical architecture
- ✅ Implementation roadmap

**Next Steps:**
1. Review this plan
2. Confirm features you want in MVP
3. Start implementation with game structure
4. Build incrementally with testing

Let me know if you want to proceed or if you'd like to adjust any features! 🎮
