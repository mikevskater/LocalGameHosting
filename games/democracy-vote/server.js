const fs = require('fs');
const path = require('path');

// Vote state
let voteState = {
  active: false,
  round: 0,
  startTime: null,
  endTime: null,
  timeRemaining: 0,
  votes: {}, // { userId: gameId }
  gameOptions: [], // Available games to vote for
  results: {}, // { gameId: voteCount }
  tieHistory: [], // Track tie rounds
  timerInterval: null
};

let connectedVoters = new Set(); // Track all connected users

function onLoad() {
  console.log('[Democracy Vote] Module loaded');
}

function onUnload() {
  console.log('[Democracy Vote] Module unloading');
  stopVote();
}

function handleConnection(socket, io, user) {
  console.log(`[Democracy Vote] ${user.nickname} connected`);
  connectedVoters.add(user.id);

  // Send current vote state
  socket.emit('game-event', {
    event: 'vote-state',
    data: getVoteStateForClient(user.id)
  });

  // Listen for game events
  socket.on('game-event', ({ event, data }) => {
    switch (event) {
      case 'cast-vote':
        handleVote(socket, io, user, data);
        break;
      case 'start-vote':
        // Only admin should start votes, but this is handled via admin panel
        break;
    }
  });
}

function handleDisconnection(socket, io, user) {
  console.log(`[Democracy Vote] ${user.nickname} disconnected`);
  connectedVoters.delete(user.id);

  // Remove their vote if they disconnect
  if (voteState.active && voteState.votes[user.id]) {
    delete voteState.votes[user.id];
    recalculateResults(io);
  }
}

function handleVote(socket, io, user, data) {
  if (!voteState.active) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'No active vote' }
    });
    return;
  }

  const { gameId } = data;

  // Validate game is in options
  if (!voteState.gameOptions.includes(gameId)) {
    socket.emit('game-event', {
      event: 'error',
      data: { message: 'Invalid game selection' }
    });
    return;
  }

  // Check if vote is within last 10 seconds
  const config = require('../../config');
  const addTime = config.get('voting.newVoteTimeAddAmount') || 15;

  if (voteState.timeRemaining <= 10 && voteState.timeRemaining > 0) {
    voteState.timeRemaining += addTime;
    voteState.endTime = Date.now() + (voteState.timeRemaining * 1000);

    io.emit('game-event', {
      event: 'time-added',
      data: {
        addedTime: addTime,
        newTimeRemaining: voteState.timeRemaining
      }
    });
  }

  // Cast/change vote
  voteState.votes[user.id] = gameId;

  // Recalculate results
  recalculateResults(io);

  // Broadcast updated state
  broadcastVoteState(io);

  // Check for auto-win
  const autoWinCount = config.get('voting.autoWinCount') || 0;
  if (autoWinCount > 0 && voteState.results[gameId] >= autoWinCount) {
    console.log(`[Democracy Vote] Auto-win triggered for ${gameId} with ${voteState.results[gameId]} votes`);
    endVote(io, gameId);
  }
}

function recalculateResults(io) {
  // Count votes
  voteState.results = {};
  for (const gameId of Object.values(voteState.votes)) {
    voteState.results[gameId] = (voteState.results[gameId] || 0) + 1;
  }
}

function startVote(io) {
  if (voteState.active) {
    console.log('[Democracy Vote] Vote already in progress');
    return;
  }

  const config = require('../../config');
  const gamesDir = config.get('game.gamesDirectory');
  const excludedGames = config.get('voting.excludedGames') || [];
  const voteTime = config.get('voting.voteTime') || 60;

  // Get all available games
  const gamesDirPath = path.join(__dirname, '../..');
  const allGames = fs.readdirSync(path.join(gamesDirPath, gamesDir))
    .filter(dir => {
      const gameJsonPath = path.join(gamesDirPath, gamesDir, dir, 'game.json');
      return fs.existsSync(gameJsonPath);
    })
    .filter(dir => dir !== 'democracy-vote' && !excludedGames.includes(dir));

  if (allGames.length === 0) {
    console.log('[Democracy Vote] No games available to vote on');
    return;
  }

  // Initialize vote
  voteState = {
    active: true,
    round: 1,
    startTime: Date.now(),
    endTime: Date.now() + (voteTime * 1000),
    timeRemaining: voteTime,
    votes: {},
    gameOptions: allGames,
    results: {},
    tieHistory: [],
    timerInterval: null
  };

  // Start timer
  startTimer(io);

  // Broadcast vote started
  broadcastVoteState(io);

  console.log(`[Democracy Vote] Vote started with ${allGames.length} games for ${voteTime} seconds`);
}

function startTimer(io) {
  if (voteState.timerInterval) {
    clearInterval(voteState.timerInterval);
  }

  voteState.timerInterval = setInterval(() => {
    voteState.timeRemaining = Math.max(0, Math.ceil((voteState.endTime - Date.now()) / 1000));

    // Broadcast time update
    io.emit('game-event', {
      event: 'timer-update',
      data: { timeRemaining: voteState.timeRemaining }
    });

    // Check if time is up
    if (voteState.timeRemaining <= 0) {
      clearInterval(voteState.timerInterval);
      voteState.timerInterval = null;
      processVoteResults(io);
    }
  }, 1000);
}

function processVoteResults(io) {
  if (Object.keys(voteState.results).length === 0) {
    // No votes cast - cancel vote
    io.emit('game-event', {
      event: 'vote-cancelled',
      data: { reason: 'No votes were cast' }
    });
    stopVote();
    return;
  }

  // Find winner(s)
  const maxVotes = Math.max(...Object.values(voteState.results));
  const winners = Object.keys(voteState.results).filter(
    gameId => voteState.results[gameId] === maxVotes
  );

  if (winners.length === 1) {
    // Clear winner
    endVote(io, winners[0]);
  } else {
    // Tie - check if we should do tie-breaker or random pick
    const config = require('../../config');
    const maxTieRounds = config.get('voting.maxTieRounds') || 3;

    // Check if same tie as last round
    const lastTie = voteState.tieHistory[voteState.tieHistory.length - 1];
    const sameTie = lastTie &&
      lastTie.length === winners.length &&
      lastTie.every(id => winners.includes(id));

    if (sameTie) {
      // Same tie - increment counter
      const sameCount = voteState.tieHistory.filter(tie =>
        tie.length === winners.length &&
        tie.every(id => winners.includes(id))
      ).length;

      if (sameCount >= maxTieRounds) {
        // Pick random winner
        const randomWinner = winners[Math.floor(Math.random() * winners.length)];
        console.log(`[Democracy Vote] Random winner selected after ${sameCount} identical ties: ${randomWinner}`);
        endVote(io, randomWinner);
        return;
      }
    }

    // Start tie-breaker round
    voteState.tieHistory.push([...winners]);
    startTieBreakerRound(io, winners);
  }
}

function startTieBreakerRound(io, tiedGames) {
  const config = require('../../config');
  const voteTime = config.get('voting.voteTime') || 60;

  voteState.round++;
  voteState.gameOptions = tiedGames;
  voteState.votes = {};
  voteState.results = {};
  voteState.startTime = Date.now();
  voteState.endTime = Date.now() + (voteTime * 1000);
  voteState.timeRemaining = voteTime;

  // Start timer
  startTimer(io);

  // Broadcast tie-breaker
  io.emit('game-event', {
    event: 'tie-breaker',
    data: {
      round: voteState.round,
      tiedGames,
      timeRemaining: voteState.timeRemaining
    }
  });

  broadcastVoteState(io);

  console.log(`[Democracy Vote] Tie-breaker round ${voteState.round} started with games:`, tiedGames);
}

function endVote(io, winnerGameId) {
  stopVote();

  // Broadcast winner
  io.emit('game-event', {
    event: 'vote-complete',
    data: {
      winner: winnerGameId,
      finalResults: voteState.results
    }
  });

  console.log(`[Democracy Vote] Vote complete - Winner: ${winnerGameId}`);

  // Switch game after 5 second delay
  setTimeout(() => {
    switchToGame(io, winnerGameId);
  }, 5000);
}

function switchToGame(io, gameId) {
  const config = require('../../config');

  // Update active game
  config.set('game.activeGame', gameId);

  console.log(`[Democracy Vote] Switching to game: ${gameId}`);

  // Notify all clients to refresh
  io.emit('game-event', {
    event: 'game-switched',
    data: { newGame: gameId }
  });

  // The client will handle the refresh
}

function stopVote() {
  if (voteState.timerInterval) {
    clearInterval(voteState.timerInterval);
  }

  voteState = {
    active: false,
    round: 0,
    startTime: null,
    endTime: null,
    timeRemaining: 0,
    votes: {},
    gameOptions: [],
    results: {},
    tieHistory: [],
    timerInterval: null
  };
}

function getVoteStateForClient(userId) {
  const config = require('../../config');
  const showLiveResults = config.get('voting.showLiveResults') !== false;

  return {
    active: voteState.active,
    round: voteState.round,
    timeRemaining: voteState.timeRemaining,
    gameOptions: voteState.gameOptions,
    userVote: voteState.votes[userId] || null,
    results: showLiveResults ? voteState.results : {},
    showLiveResults,
    totalVoters: connectedVoters.size,
    totalVotesCast: Object.keys(voteState.votes).length
  };
}

function broadcastVoteState(io) {
  // Send personalized state to each connected voter
  io.sockets.sockets.forEach(socket => {
    if (socket.userId) {
      socket.emit('game-event', {
        event: 'vote-state',
        data: getVoteStateForClient(socket.userId)
      });
    }
  });
}

function getState() {
  return {
    voteActive: voteState.active,
    round: voteState.round,
    totalVotes: Object.keys(voteState.votes).length
  };
}

// Export module interface
module.exports = {
  onLoad,
  onUnload,
  handleConnection,
  handleDisconnection,
  getState,
  // Additional exports for admin panel to trigger votes
  startVote,
  stopVote
};
