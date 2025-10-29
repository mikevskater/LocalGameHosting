const express = require('express');
const db = require('../database');
const auth = require('../auth');
const config = require('../config');
const gameLoader = require('../gameLoader');
const fs = require('fs');
const path = require('path');

const router = express.Router();

// Admin login
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = await auth.loginAdmin(username, password);

  if (result.success) {
    res.json({ token: result.token });
  } else {
    res.status(401).json({ error: result.error });
  }
});

// Admin logout
router.post('/logout', auth.adminAuthMiddleware, (req, res) => {
  const token = req.headers.authorization.substring(7);
  const result = auth.logoutAdmin(token);

  if (result.success) {
    res.json({ message: 'Logged out successfully' });
  } else {
    res.status(500).json({ error: result.error });
  }
});

// Get all users (admin only)
router.get('/users', auth.adminAuthMiddleware, (req, res) => {
  const users = db.getAllUsers();
  res.json(users);
});

// Delete user (admin only)
router.delete('/users/:userId', auth.adminAuthMiddleware, (req, res) => {
  const result = db.deleteUser(req.params.userId);

  if (result.changes > 0) {
    res.json({ message: 'User deleted successfully' });
  } else {
    res.status(404).json({ error: 'User not found' });
  }
});

// Get current configuration (admin only)
router.get('/config', auth.adminAuthMiddleware, (req, res) => {
  const currentConfig = config.getAll();
  // Hide sensitive data
  const safeConfig = { ...currentConfig };
  if (safeConfig.admin) {
    safeConfig.admin.password = '********';
  }
  if (safeConfig.security) {
    safeConfig.security.jwtSecret = '********';
  }
  res.json(safeConfig);
});

// Update configuration (admin only)
router.put('/config', auth.adminAuthMiddleware, (req, res) => {
  const { server, game, uploads } = req.body;

  try {
    if (server) {
      if (server.port) config.set('server.port', server.port);
      if (server.host) config.set('server.host', server.host);
    }

    if (game) {
      if (game.activeGame) config.set('game.activeGame', game.activeGame);
    }

    if (uploads) {
      if (uploads.maxFileSize) config.set('uploads.maxFileSize', uploads.maxFileSize);
    }

    res.json({ message: 'Configuration updated successfully. Restart server for changes to take effect.' });
  } catch (error) {
    console.error('Config update error:', error);
    res.status(500).json({ error: 'Failed to update configuration' });
  }
});

// Get list of available games (admin only)
router.get('/games', auth.adminAuthMiddleware, (req, res) => {
  const gamesDir = config.get('game.gamesDirectory');
  const gamesPath = path.join(__dirname, '../../', gamesDir);

  try {
    if (!fs.existsSync(gamesPath)) {
      return res.json([]);
    }

    const games = fs.readdirSync(gamesPath, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => {
        const gamePath = path.join(gamesPath, dirent.name);
        const configPath = path.join(gamePath, 'game.json');

        let gameInfo = { id: dirent.name, name: dirent.name };

        if (fs.existsSync(configPath)) {
          try {
            const gameConfig = JSON.parse(fs.readFileSync(configPath, 'utf8'));
            gameInfo = { ...gameInfo, ...gameConfig };
          } catch (e) {
            console.error(`Error reading game config for ${dirent.name}:`, e);
          }
        }

        return gameInfo;
      });

    res.json(games);
  } catch (error) {
    console.error('Error listing games:', error);
    res.status(500).json({ error: 'Failed to list games' });
  }
});

// Switch active game (admin only)
router.post('/games/switch', auth.adminAuthMiddleware, (req, res) => {
  const { gameId } = req.body;

  if (!gameId) {
    return res.status(400).json({ error: 'Game ID is required' });
  }

  const gamesDir = config.get('game.gamesDirectory');
  const gamePath = path.join(__dirname, '../../', gamesDir, gameId);

  if (!fs.existsSync(gamePath)) {
    return res.status(404).json({ error: 'Game not found' });
  }

  config.set('game.activeGame', gameId);

  // Load the new game module
  gameLoader.loadGame(gameId);

  res.json({ message: `Switched to game: ${gameId}` });
});

// Get server stats (admin only)
router.get('/stats', auth.adminAuthMiddleware, (req, res) => {
  const users = db.getAllUsers();
  const activeGame = config.get('game.activeGame');

  res.json({
    totalUsers: users.length,
    activeGame: activeGame,
    serverUptime: process.uptime(),
    nodeVersion: process.version
  });
});

module.exports = router;
