const config = require('../../server/config');
const settingsManager = require('../../server/settingsManager');

// Tournament state
let tournament = {
  active: false,
  state: 'lobby', // 'lobby' | 'bracket' | 'finished'
  settings: {
    format: 'bo3', // 'bo3' | 'bo5' | 'bo7'
    seeding: 'random', // 'random' | 'order'
    autoStart: false,
    readyTimeout: 0,
    roundTimeLimit: 10 // seconds
  },
  players: [], // [{ id, nickname, nameColor, ready, seed, eliminated, placement }]
  bracket: [], // [[match1, match2], [match3], [final]]
  currentRound: 0,
  champion: null
};

// Get current game ID for settings
const gameId = 'rps-tournament';

// Active matches
let matches = {}; // matchId -> match object

// Player stats (all-time)
let stats = {}; // userId -> stats object

let connectedUsers = new Map(); // userId -> user object

function onLoad() {
  console.log('[RPS Tournament] Game module loaded');

  // Load settings from settingsManager
  const format = settingsManager.getSetting(gameId, 'format') || 'bo3';
  const seeding = settingsManager.getSetting(gameId, 'seeding') || 'random';
  const autoStart = settingsManager.getSetting(gameId, 'autoStart') || false;
  const roundTimeLimit = settingsManager.getSetting(gameId, 'roundTimeLimit') || 10;

  tournament.settings.format = format;
  tournament.settings.seeding = seeding;
  tournament.settings.autoStart = autoStart;
  tournament.settings.roundTimeLimit = roundTimeLimit;

  console.log('[RPS Tournament] Loaded settings:', tournament.settings);
}

function onUnload() {
  console.log('[RPS Tournament] Game module unloaded');
  // Reset tournament state
  tournament = {
    active: false,
    state: 'lobby',
    settings: { format: 'bo3', seeding: 'random', autoStart: false, readyTimeout: 0 },
    players: [],
    bracket: [],
    currentRound: 0,
    champion: null
  };
  matches = {};
}

function handleConnection(socket, io, user) {
  console.log(`[RPS Tournament] User connected: ${user.nickname}`);

  connectedUsers.set(user.id, user);

  // Send current tournament state
  socket.emit('game-event', {
    event: 'tournament-state',
    data: getTournamentStateForClient()
  });

  // Handle game events
  socket.on('game-event', (eventData) => {
    const event = eventData.event;
    const data = eventData.data;

    switch (event) {
      case 'join-tournament':
        handleJoinTournament(socket, io, user);
        break;
      case 'leave-tournament':
        handleLeaveTournament(socket, io, user);
        break;
      case 'player-ready':
        handlePlayerReady(socket, io, user);
        break;
      case 'player-unready':
        handlePlayerUnready(socket, io, user);
        break;
      case 'make-choice':
        handleMakeChoice(socket, io, user, data);
        break;
      case 'new-tournament':
        handleNewTournament(socket, io, user);
        break;
    }
  });
}

function handleDisconnection(socket, io, user) {
  console.log(`[RPS Tournament] User disconnected: ${user.nickname}`);
  connectedUsers.delete(user.id);

  // If player was in lobby, remove them
  if (tournament.state === 'lobby') {
    const playerIndex = tournament.players.findIndex(p => p.id === user.id);
    if (playerIndex !== -1) {
      tournament.players.splice(playerIndex, 1);
      broadcastTournamentState(io);
    }
  }

  // If player was in active match, forfeit
  if (tournament.state === 'bracket') {
    for (const matchId in matches) {
      const match = matches[matchId];
      if (match.state !== 'finished') {
        if (match.player1 && match.player1.id === user.id) {
          forfeitMatch(io, matchId, user.id);
        } else if (match.player2 && match.player2.id === user.id) {
          forfeitMatch(io, matchId, user.id);
        }
      }
    }
  }
}

function handleJoinTournament(socket, io, user) {
  if (tournament.state !== 'lobby') {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Tournament has already started' }
    });
    return;
  }

  // Check if already in tournament
  const existingPlayer = tournament.players.find(p => p.id === user.id);
  if (existingPlayer) {
    console.log(`[RPS Tournament] ${user.nickname} already in tournament`);
    return;
  }

  // Add player to tournament
  const player = {
    id: user.id,
    nickname: user.nickname,
    nameColor: user.name_color,
    ready: false,
    seed: 0,
    eliminated: false,
    placement: null
  };
  tournament.players.push(player);

  console.log(`[RPS Tournament] ${user.nickname} joined tournament`);
  broadcastTournamentState(io);
}

function handleLeaveTournament(socket, io, user) {
  if (tournament.state !== 'lobby') {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Cannot leave after tournament has started' }
    });
    return;
  }

  // Remove player from tournament
  const playerIndex = tournament.players.findIndex(p => p.id === user.id);
  if (playerIndex !== -1) {
    tournament.players.splice(playerIndex, 1);
    console.log(`[RPS Tournament] ${user.nickname} left tournament`);
    broadcastTournamentState(io);
  }
}

function handlePlayerReady(socket, io, user) {
  if (tournament.state !== 'lobby') return;

  // Check if player is in tournament
  const player = tournament.players.find(p => p.id === user.id);
  if (!player) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'You must join the tournament first' }
    });
    return;
  }

  player.ready = true;

  console.log(`[RPS Tournament] Player ready: ${user.nickname}`);
  broadcastTournamentState(io);

  // Check if all players ready
  if (tournament.settings.autoStart && tournament.players.length >= 2) {
    const allReady = tournament.players.every(p => p.ready);
    if (allReady) {
      startTournament(io);
    }
  }
}

function handlePlayerUnready(socket, io, user) {
  if (tournament.state !== 'lobby') return;

  const player = tournament.players.find(p => p.id === user.id);
  if (player) {
    player.ready = false;
    console.log(`[RPS Tournament] Player unready: ${user.nickname}`);
    broadcastTournamentState(io);
  }
}

function startTournament(io) {
  console.log('[RPS Tournament] Starting tournament with', tournament.players.length, 'players');

  tournament.state = 'bracket';
  tournament.active = true;

  // Seed players
  if (tournament.settings.seeding === 'random') {
    // Shuffle players
    for (let i = tournament.players.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [tournament.players[i], tournament.players[j]] = [tournament.players[j], tournament.players[i]];
    }
  }

  // Assign seeds
  tournament.players.forEach((player, index) => {
    player.seed = index + 1;
  });

  // Generate bracket
  generateBracket();

  // Start first round matches
  startRoundMatches(io, 0);

  broadcastTournamentState(io);

  io.emit('game-event', {
    event: 'tournament-started',
    data: getTournamentStateForClient()
  });
}

function generateBracket() {
  tournament.bracket = [];
  tournament.currentRound = 0;

  const playerCount = tournament.players.length;

  // Calculate number of rounds needed
  const rounds = Math.ceil(Math.log2(playerCount));

  // First round: pair players
  const firstRound = [];
  let playersInRound = [...tournament.players];

  // Handle byes if odd number
  const firstRoundMatches = Math.pow(2, rounds - 1);
  const totalSlotsNeeded = firstRoundMatches * 2;
  const byes = totalSlotsNeeded - playerCount;

  // Create first round matches
  for (let i = 0; i < firstRoundMatches; i++) {
    const p1Index = i * 2;
    const p2Index = i * 2 + 1;

    const player1 = playersInRound[p1Index] || null;
    const player2 = playersInRound[p2Index] || null;

    if (player1 || player2) {
      firstRound.push({
        player1: player1,
        player2: player2,
        winner: player1 && !player2 ? player1 : null // Auto-win on bye
      });
    }
  }

  tournament.bracket.push(firstRound);

  // Generate subsequent rounds (empty, to be filled as tournament progresses)
  for (let r = 1; r < rounds; r++) {
    const roundMatches = Math.pow(2, rounds - r - 1);
    const round = [];
    for (let i = 0; i < roundMatches; i++) {
      round.push({
        player1: null,
        player2: null,
        winner: null
      });
    }
    tournament.bracket.push(round);
  }

  console.log('[RPS Tournament] Generated bracket with', rounds, 'rounds');
}

function startRoundMatches(io, roundIndex) {
  const round = tournament.bracket[roundIndex];

  console.log(`[RPS Tournament] Starting round ${roundIndex + 1} with ${round.length} matches`);

  round.forEach((bracketMatch, matchIndex) => {
    // Skip if already has winner (bye)
    if (bracketMatch.winner) {
      console.log(`[RPS Tournament] Match ${matchIndex + 1} auto-won by ${bracketMatch.winner.nickname} (bye)`);
      return;
    }

    if (!bracketMatch.player1 || !bracketMatch.player2) {
      console.log(`[RPS Tournament] Skipping match ${matchIndex + 1} - missing players`);
      return;
    }

    const matchId = `r${roundIndex}m${matchIndex}`;
    const format = tournament.settings.format;
    const targetWins = format === 'bo3' ? 2 : format === 'bo5' ? 3 : 4;

    const roundTimeLimit = tournament.settings.roundTimeLimit * 1000; // Convert to milliseconds

    matches[matchId] = {
      id: matchId,
      round: roundIndex,
      matchIndex: matchIndex,
      player1: {
        id: bracketMatch.player1.id,
        nickname: bracketMatch.player1.nickname,
        nameColor: bracketMatch.player1.nameColor,
        score: 0,
        choice: null,
        hasChosen: false
      },
      player2: {
        id: bracketMatch.player2.id,
        nickname: bracketMatch.player2.nickname,
        nameColor: bracketMatch.player2.nameColor,
        score: 0,
        choice: null,
        hasChosen: false
      },
      state: 'choosing', // 'choosing' | 'reveal' | 'finished'
      currentGame: 1,
      targetWins: targetWins,
      history: [],
      winner: null,
      choiceDeadline: Date.now() + roundTimeLimit,
      choiceTimer: null
    };

    // Start timer for auto-pick random choices when time runs out
    matches[matchId].choiceTimer = setTimeout(() => {
      if (matches[matchId] && matches[matchId].state === 'choosing') {
        const match = matches[matchId];

        // Auto-pick random choice for players who haven't chosen
        if (!match.player1.hasChosen) {
          const randomChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
          match.player1.choice = randomChoice;
          match.player1.hasChosen = true;
          console.log(`[RPS Tournament] Auto-picked ${randomChoice} for ${match.player1.nickname}`);
        }

        if (!match.player2.hasChosen) {
          const randomChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
          match.player2.choice = randomChoice;
          match.player2.hasChosen = true;
          console.log(`[RPS Tournament] Auto-picked ${randomChoice} for ${match.player2.nickname}`);
        }

        // Both players have choices now, resolve the round
        resolveMatchRound(io, matchId);
      }
    }, roundTimeLimit);
  });

  broadcastTournamentState(io);
}

function handleMakeChoice(socket, io, user, data) {
  const { matchId, choice } = data;

  if (!matchId || !choice || !['rock', 'paper', 'scissors'].includes(choice)) {
    return;
  }

  const match = matches[matchId];
  if (!match || match.state !== 'choosing') {
    return;
  }

  // Record choice
  if (match.player1.id === user.id && !match.player1.hasChosen) {
    match.player1.choice = choice;
    match.player1.hasChosen = true;
    console.log(`[RPS Tournament] ${user.nickname} chose ${choice}`);

    // Notify that player made choice (but don't reveal)
    io.emit('game-event', {
      event: 'choice-locked',
      data: { matchId: matchId, playerId: user.id }
    });
  } else if (match.player2.id === user.id && !match.player2.hasChosen) {
    match.player2.choice = choice;
    match.player2.hasChosen = true;
    console.log(`[RPS Tournament] ${user.nickname} chose ${choice}`);

    io.emit('game-event', {
      event: 'choice-locked',
      data: { matchId: matchId, playerId: user.id }
    });
  }

  // Check if both players made choice
  if (match.player1.hasChosen && match.player2.hasChosen) {
    // Cancel the auto-pick timer
    if (match.choiceTimer) {
      clearTimeout(match.choiceTimer);
      match.choiceTimer = null;
    }
    resolveMatchRound(io, matchId);
  }
}

function resolveMatchRound(io, matchId) {
  const match = matches[matchId];
  if (!match) return;

  const p1Choice = match.player1.choice;
  const p2Choice = match.player2.choice;

  const winner = determineWinner(p1Choice, p2Choice);

  match.history.push({
    game: match.currentGame,
    p1Choice: p1Choice,
    p2Choice: p2Choice,
    winner: winner
  });

  if (winner === 1) {
    match.player1.score++;
  } else if (winner === 2) {
    match.player2.score++;
  }
  // If tie (0), no score change

  match.state = 'reveal';

  console.log(`[RPS Tournament] Match ${matchId} round ${match.currentGame}: ${p1Choice} vs ${p2Choice} - Winner: ${winner === 1 ? match.player1.nickname : winner === 2 ? match.player2.nickname : 'Tie'}`);

  // Broadcast result
  io.emit('game-event', {
    event: 'match-result',
    data: {
      matchId: matchId,
      game: match.currentGame,
      p1Choice: p1Choice,
      p2Choice: p2Choice,
      winner: winner,
      p1Score: match.player1.score,
      p2Score: match.player2.score
    }
  });

  // Check if match is over
  if (match.player1.score >= match.targetWins || match.player2.score >= match.targetWins) {
    setTimeout(() => {
      finishMatch(io, matchId);
    }, 3000);
  } else {
    // Next game
    setTimeout(() => {
      if (!matches[matchId]) return;

      const roundTimeLimit = tournament.settings.roundTimeLimit * 1000;

      match.currentGame++;
      match.player1.choice = null;
      match.player1.hasChosen = false;
      match.player2.choice = null;
      match.player2.hasChosen = false;
      match.state = 'choosing';
      match.choiceDeadline = Date.now() + roundTimeLimit;

      broadcastTournamentState(io);

      // Start timer for auto-pick
      match.choiceTimer = setTimeout(() => {
        if (matches[matchId] && matches[matchId].state === 'choosing') {
          const m = matches[matchId];

          // Auto-pick random choice for players who haven't chosen
          if (!m.player1.hasChosen) {
            const randomChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
            m.player1.choice = randomChoice;
            m.player1.hasChosen = true;
            console.log(`[RPS Tournament] Auto-picked ${randomChoice} for ${m.player1.nickname}`);
          }

          if (!m.player2.hasChosen) {
            const randomChoice = ['rock', 'paper', 'scissors'][Math.floor(Math.random() * 3)];
            m.player2.choice = randomChoice;
            m.player2.hasChosen = true;
            console.log(`[RPS Tournament] Auto-picked ${randomChoice} for ${m.player2.nickname}`);
          }

          resolveMatchRound(io, matchId);
        }
      }, roundTimeLimit);
    }, 3000);
  }
}

function determineWinner(choice1, choice2) {
  if (choice1 === choice2) return 0; // Tie

  if (
    (choice1 === 'rock' && choice2 === 'scissors') ||
    (choice1 === 'paper' && choice2 === 'rock') ||
    (choice1 === 'scissors' && choice2 === 'paper')
  ) {
    return 1; // Player 1 wins
  }

  return 2; // Player 2 wins
}

function finishMatch(io, matchId) {
  const match = matches[matchId];
  if (!match) return;

  const winnerId = match.player1.score > match.player2.score ? match.player1.id : match.player2.id;
  const winnerData = match.player1.score > match.player2.score ? match.player1 : match.player2;
  const loserId = match.player1.score > match.player2.score ? match.player2.id : match.player1.id;

  match.state = 'finished';
  match.winner = winnerId;

  console.log(`[RPS Tournament] Match ${matchId} finished. Winner: ${winnerData.nickname}`);

  // Update bracket
  const bracketMatch = tournament.bracket[match.round][match.matchIndex];
  bracketMatch.winner = tournament.players.find(p => p.id === winnerId);

  // Mark loser as eliminated
  const loser = tournament.players.find(p => p.id === loserId);
  if (loser) {
    loser.eliminated = true;
  }

  io.emit('game-event', {
    event: 'match-complete',
    data: {
      matchId: matchId,
      winnerId: winnerId,
      winnerNickname: winnerData.nickname,
      finalScore: `${match.player1.score}-${match.player2.score}`
    }
  });

  // Check if round is complete
  checkRoundComplete(io, match.round);
}

function checkRoundComplete(io, roundIndex) {
  const round = tournament.bracket[roundIndex];
  const allFinished = round.every(m => m.winner !== null);

  if (allFinished) {
    console.log(`[RPS Tournament] Round ${roundIndex + 1} complete`);

    io.emit('game-event', {
      event: 'round-complete',
      data: { round: roundIndex + 1 }
    });

    // Check if tournament is over
    if (roundIndex === tournament.bracket.length - 1) {
      // Tournament finished
      setTimeout(() => {
        finishTournament(io);
      }, 2000);
    } else {
      // Start next round
      setTimeout(() => {
        advanceToNextRound(io, roundIndex);
      }, 5000);
    }
  }
}

function advanceToNextRound(io, completedRound) {
  const nextRoundIndex = completedRound + 1;
  const nextRound = tournament.bracket[nextRoundIndex];
  const completedRoundMatches = tournament.bracket[completedRound];

  console.log(`[RPS Tournament] Advancing to round ${nextRoundIndex + 1}`);

  // Populate next round with winners
  for (let i = 0; i < nextRound.length; i++) {
    const match1Winner = completedRoundMatches[i * 2]?.winner;
    const match2Winner = completedRoundMatches[i * 2 + 1]?.winner;

    nextRound[i].player1 = match1Winner;
    nextRound[i].player2 = match2Winner;
  }

  tournament.currentRound = nextRoundIndex;

  // Start matches for next round
  startRoundMatches(io, nextRoundIndex);
}

function finishTournament(io) {
  tournament.state = 'finished';
  tournament.active = false;

  const finalMatch = tournament.bracket[tournament.bracket.length - 1][0];
  const champion = finalMatch.winner;
  tournament.champion = champion;

  // Assign placements
  assignPlacements();

  console.log(`[RPS Tournament] Tournament finished! Champion: ${champion.nickname}`);

  // Update stats
  updateStats();

  io.emit('game-event', {
    event: 'tournament-complete',
    data: {
      champion: {
        id: champion.id,
        nickname: champion.nickname,
        nameColor: champion.nameColor
      },
      placements: tournament.players
        .filter(p => p.placement !== null)
        .sort((a, b) => a.placement - b.placement)
        .map(p => ({
          placement: p.placement,
          id: p.id,
          nickname: p.nickname,
          nameColor: p.nameColor
        }))
    }
  });

  broadcastTournamentState(io);
}

function assignPlacements() {
  // Champion gets 1st
  if (tournament.champion) {
    const champ = tournament.players.find(p => p.id === tournament.champion.id);
    if (champ) champ.placement = 1;
  }

  // Runner-up gets 2nd
  const finalMatch = tournament.bracket[tournament.bracket.length - 1][0];
  const runnerUp = finalMatch.player1.id === tournament.champion.id ? finalMatch.player2 : finalMatch.player1;
  const runnerUpPlayer = tournament.players.find(p => p.id === runnerUp.id);
  if (runnerUpPlayer) runnerUpPlayer.placement = 2;

  // Semi-finalists get 3rd
  if (tournament.bracket.length >= 2) {
    const semiFinals = tournament.bracket[tournament.bracket.length - 2];
    let thirdPlace = 3;
    semiFinals.forEach(match => {
      const loser = match.winner.id === match.player1.id ? match.player2 : match.player1;
      if (loser) {
        const player = tournament.players.find(p => p.id === loser.id);
        if (player && !player.placement) {
          player.placement = thirdPlace;
        }
      }
    });
  }

  // Everyone else gets participation placement
  let nextPlacement = tournament.bracket.length >= 2 ? 4 : 3;
  tournament.players.forEach(p => {
    if (!p.placement) {
      p.placement = nextPlacement++;
    }
  });
}

function updateStats() {
  tournament.players.forEach(player => {
    if (!stats[player.id]) {
      stats[player.id] = {
        tournamentsPlayed: 0,
        championships: 0,
        totalWins: 0,
        totalLosses: 0,
        rockCount: 0,
        paperCount: 0,
        scissorsCount: 0,
        currentStreak: 0
      };
    }

    const playerStats = stats[player.id];
    playerStats.tournamentsPlayed++;

    if (player.placement === 1) {
      playerStats.championships++;
      playerStats.currentStreak++;
    } else {
      playerStats.currentStreak = 0;
    }

    // Count choices and wins/losses from match history
    for (const matchId in matches) {
      const match = matches[matchId];
      if (match.player1.id === player.id || match.player2.id === player.id) {
        const isP1 = match.player1.id === player.id;
        match.history.forEach(round => {
          const choice = isP1 ? round.p1Choice : round.p2Choice;
          if (choice === 'rock') playerStats.rockCount++;
          else if (choice === 'paper') playerStats.paperCount++;
          else if (choice === 'scissors') playerStats.scissorsCount++;

          if ((isP1 && round.winner === 1) || (!isP1 && round.winner === 2)) {
            playerStats.totalWins++;
          } else if (round.winner !== 0) {
            playerStats.totalLosses++;
          }
        });
      }
    }
  });
}

function forfeitMatch(io, matchId, userId) {
  const match = matches[matchId];
  if (!match || match.state === 'finished') return;

  const isP1 = match.player1.id === userId;
  const winnerId = isP1 ? match.player2.id : match.player1.id;
  const winnerData = isP1 ? match.player2 : match.player1;

  match.state = 'finished';
  match.winner = winnerId;

  console.log(`[RPS Tournament] Match ${matchId} forfeited by disconnect. Winner: ${winnerData.nickname}`);

  // Update bracket
  const bracketMatch = tournament.bracket[match.round][match.matchIndex];
  bracketMatch.winner = tournament.players.find(p => p.id === winnerId);

  // Mark loser as eliminated
  const loser = tournament.players.find(p => p.id === userId);
  if (loser) {
    loser.eliminated = true;
  }

  io.emit('game-event', {
    event: 'match-forfeited',
    data: {
      matchId: matchId,
      winnerId: winnerId,
      winnerNickname: winnerData.nickname
    }
  });

  checkRoundComplete(io, match.round);
}

function handleNewTournament(socket, io, user) {
  if (tournament.state !== 'finished') return;

  console.log(`[RPS Tournament] ${user.nickname} requested new tournament`);

  // Reset tournament
  tournament = {
    active: false,
    state: 'lobby',
    settings: tournament.settings, // Keep settings
    players: [],
    bracket: [],
    currentRound: 0,
    champion: null
  };

  matches = {};

  io.emit('game-event', {
    event: 'tournament-reset',
    data: {}
  });

  broadcastTournamentState(io);
}

function getTournamentStateForClient() {
  return {
    tournament: {
      active: tournament.active,
      state: tournament.state,
      settings: tournament.settings,
      players: tournament.players.filter(p => p !== null).map(p => ({
        id: p.id,
        nickname: p.nickname,
        nameColor: p.nameColor,
        ready: p.ready,
        seed: p.seed,
        eliminated: p.eliminated,
        placement: p.placement
      })),
      bracket: tournament.bracket.map(round =>
        round.map(match => ({
          player1: match.player1 ? {
            id: match.player1.id,
            nickname: match.player1.nickname,
            nameColor: match.player1.nameColor
          } : null,
          player2: match.player2 ? {
            id: match.player2.id,
            nickname: match.player2.nickname,
            nameColor: match.player2.nameColor
          } : null,
          winner: match.winner ? {
            id: match.winner.id,
            nickname: match.winner.nickname,
            nameColor: match.winner.nameColor
          } : null
        }))
      ),
      currentRound: tournament.currentRound,
      champion: tournament.champion ? {
        id: tournament.champion.id,
        nickname: tournament.champion.nickname,
        nameColor: tournament.champion.nameColor
      } : null
    },
    matches: Object.keys(matches).reduce((acc, matchId) => {
      const match = matches[matchId];
      acc[matchId] = {
        id: match.id,
        round: match.round,
        matchIndex: match.matchIndex,
        player1: {
          id: match.player1.id,
          nickname: match.player1.nickname,
          nameColor: match.player1.nameColor,
          score: match.player1.score,
          hasChosen: match.player1.hasChosen
        },
        player2: {
          id: match.player2.id,
          nickname: match.player2.nickname,
          nameColor: match.player2.nameColor,
          score: match.player2.score,
          hasChosen: match.player2.hasChosen
        },
        state: match.state,
        currentGame: match.currentGame,
        targetWins: match.targetWins,
        history: match.history,
        winner: match.winner,
        choiceDeadline: match.choiceDeadline
      };
      return acc;
    }, {}),
    stats: stats
  };
}

function broadcastTournamentState(io) {
  io.emit('game-event', {
    event: 'tournament-state',
    data: getTournamentStateForClient()
  });
}

function getState() {
  return getTournamentStateForClient();
}

// ========== ADMIN FUNCTIONS ==========

/**
 * Get live stats for admin panel
 */
function getAdminStats() {
  const stateLabels = {
    'lobby': 'Lobby',
    'bracket': 'In Progress',
    'finished': 'Finished'
  };

  const readyCount = tournament.players.filter(p => p.ready).length;

  // Count active matches
  let activeMatchCount = 0;
  if (tournament.state === 'bracket') {
    for (const matchId in matches) {
      if (matches[matchId].state !== 'finished') {
        activeMatchCount++;
      }
    }
  }

  // Determine current round display
  let currentRoundDisplay = '-';
  if (tournament.state === 'bracket' && tournament.bracket.length > 0) {
    const totalRounds = tournament.bracket.length;
    const roundNum = tournament.currentRound + 1;

    if (totalRounds === 1) {
      currentRoundDisplay = 'Finals';
    } else if (roundNum === totalRounds) {
      currentRoundDisplay = 'Finals';
    } else if (roundNum === totalRounds - 1) {
      currentRoundDisplay = 'Semi-Finals';
    } else {
      currentRoundDisplay = `Round ${roundNum}/${totalRounds}`;
    }
  }

  return {
    tournamentState: stateLabels[tournament.state] || 'Unknown',
    playerCount: tournament.players.length,
    readyCount: `${readyCount}/${tournament.players.length}`,
    currentRound: currentRoundDisplay,
    activeMatches: activeMatchCount
  };
}

/**
 * Reset tournament (admin action)
 */
function resetTournament(io, params) {
  console.log('[RPS Tournament] Admin reset tournament');

  // Reset tournament state
  tournament = {
    active: false,
    state: 'lobby',
    settings: tournament.settings, // Keep settings
    players: [],
    bracket: [],
    currentRound: 0,
    champion: null
  };

  matches = {};

  // Notify all clients
  io.emit('game-event', {
    event: 'tournament-reset',
    data: {}
  });

  broadcastTournamentState(io);

  return { success: true, message: 'Tournament reset successfully' };
}

/**
 * Handle setting changes from admin panel
 */
function onSettingChanged(settingKey, value, io) {
  console.log(`[RPS Tournament] Setting changed: ${settingKey} = ${value}`);

  // Update tournament settings
  if (settingKey === 'format') {
    tournament.settings.format = value;
  } else if (settingKey === 'seeding') {
    tournament.settings.seeding = value;
  } else if (settingKey === 'autoStart') {
    tournament.settings.autoStart = value;
  }

  // Broadcast updated settings to all clients
  broadcastTournamentState(io);
}

module.exports = {
  onLoad,
  onUnload,
  handleConnection,
  handleDisconnection,
  getState,
  // Admin functions
  getAdminStats,
  resetTournament,
  onSettingChanged
};
