const express = require('express');
const db = require('../database');
const auth = require('../auth');
const config = require('../config');

const router = express.Router();

// Get current game info
router.get('/info', (req, res) => {
  const activeGame = config.get('game.activeGame');
  res.json({ gameId: activeGame });
});

// Save a game stat for current user (protected)
router.post('/stats/save', auth.userAuthMiddleware, (req, res) => {
  const { statKey, statValue } = req.body;
  const gameId = config.get('game.activeGame');

  if (!statKey || statValue === undefined) {
    return res.status(400).json({ error: 'statKey and statValue are required' });
  }

  try {
    db.saveGameStat(req.userId, gameId, statKey, statValue);
    res.json({ message: 'Stat saved successfully' });
  } catch (error) {
    console.error('Error saving stat:', error);
    res.status(500).json({ error: 'Failed to save stat' });
  }
});

// Get a specific stat for current user (protected)
router.get('/stats/:statKey', auth.userAuthMiddleware, (req, res) => {
  const gameId = config.get('game.activeGame');
  const statKey = req.params.statKey;

  try {
    const value = db.getGameStat(req.userId, gameId, statKey);
    res.json({ statKey, value });
  } catch (error) {
    console.error('Error getting stat:', error);
    res.status(500).json({ error: 'Failed to get stat' });
  }
});

// Get all stats for current user (protected)
router.get('/stats', auth.userAuthMiddleware, (req, res) => {
  const gameId = config.get('game.activeGame');

  try {
    const stats = db.getAllGameStats(req.userId, gameId);
    res.json(stats);
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

// Get leaderboard for a specific stat
router.get('/leaderboard/:statKey', (req, res) => {
  const gameId = config.get('game.activeGame');
  const statKey = req.params.statKey;
  const limit = parseInt(req.query.limit) || 10;

  try {
    const leaderboard = db.getGameLeaderboard(gameId, statKey, limit);
    res.json(leaderboard);
  } catch (error) {
    console.error('Error getting leaderboard:', error);
    res.status(500).json({ error: 'Failed to get leaderboard' });
  }
});

// Get stats for a specific user (for viewing other players)
router.get('/stats/user/:userId', (req, res) => {
  const gameId = config.get('game.activeGame');
  const userId = req.params.userId;

  try {
    const stats = db.getAllGameStats(userId, gameId);
    const user = db.getUserById(userId);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({
      user: {
        id: user.id,
        nickname: user.nickname,
        nameColor: user.name_color,
        playerColor: user.player_color
      },
      stats
    });
  } catch (error) {
    console.error('Error getting user stats:', error);
    res.status(500).json({ error: 'Failed to get user stats' });
  }
});

module.exports = router;
