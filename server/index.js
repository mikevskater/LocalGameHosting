const express = require('express');
const http = require('http');
const socketIO = require('socket.io');
const path = require('path');
const cors = require('cors');
const config = require('./config');
const db = require('./database');
const auth = require('./auth');
const gameLoader = require('./gameLoader');

// Import routes
const userRoutes = require('./routes/user');
const adminRoutes = require('./routes/admin');
const gameRoutes = require('./routes/game');

// Initialize Express app
const app = express();
const server = http.createServer(app);
const io = socketIO(server, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST']
  }
});

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes(io)); // Pass io instance
app.use('/api/game', gameRoutes);

// Serve active game at /play route
app.get('/play', (req, res) => {
  const activeGame = config.get('game.activeGame');
  const gamesDir = config.get('game.gamesDirectory');
  const gameIndexPath = path.join(__dirname, '..', gamesDir, activeGame, 'index.html');

  // Check if game exists
  if (!require('fs').existsSync(gameIndexPath)) {
    return res.status(404).send('Game not found. Please contact administrator.');
  }

  // Read the game HTML
  let gameHTML = require('fs').readFileSync(gameIndexPath, 'utf8');

  // Inject the required scripts in the <head> section so they load before inline scripts
  const headScripts = `
  <script src="/socket.io/socket.io.js"></script>
  <script src="/js/gameapi.js"></script>
</head>`;

  // Inject the overlay script before </body>
  const overlayScript = `
  <script src="/js/game-overlay.js"></script>
</body>`;

  gameHTML = gameHTML.replace('</head>', headScripts);
  gameHTML = gameHTML.replace('</body>', overlayScript);

  res.send(gameHTML);
});

// Serve static game assets (CSS, JS, images, etc.)
app.use('/game', (req, res, next) => {
  const activeGame = config.get('game.activeGame');
  const gamesDir = config.get('game.gamesDirectory');
  const gamePath = path.join(__dirname, '..', gamesDir, activeGame);

  express.static(gamePath)(req, res, next);
});

// Socket.IO connection handling
const connectedUsers = new Map(); // socketId -> userId mapping

io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);

  // Authenticate socket connection
  socket.on('authenticate', (token) => {
    const decoded = auth.verifyUserToken(token);

    if (decoded) {
      connectedUsers.set(socket.id, decoded.userId);
      socket.userId = decoded.userId;
      socket.username = decoded.username;

      // Get user profile
      const user = db.getUserById(decoded.userId);
      socket.userProfile = {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        nameColor: user.name_color,
        playerColor: user.player_color,
        profilePicture: user.profile_picture
      };

      socket.emit('authenticated', { success: true, user: socket.userProfile });
      socket.broadcast.emit('user-connected', socket.userProfile);

      console.log(`User authenticated: ${socket.username} (${socket.userId})`);

      // Let game module handle connection
      gameLoader.handleSocketConnection(socket, io, socket.userProfile);
    } else {
      socket.emit('authenticated', { success: false, error: 'Invalid token' });
    }
  });

  // Game event forwarding
  socket.on('game-event', (data) => {
    if (!socket.userId) {
      return socket.emit('error', { message: 'Not authenticated' });
    }

    // Attach user info to the event
    const eventData = {
      ...data,
      user: socket.userProfile
    };

    // Broadcast to all other clients
    socket.broadcast.emit('game-event', eventData);
  });

  // Send game event to specific user
  socket.on('game-event-to', ({ userId, event, data }) => {
    if (!socket.userId) {
      return socket.emit('error', { message: 'Not authenticated' });
    }

    // Find target user's socket
    for (const [socketId, targetUserId] of connectedUsers.entries()) {
      if (targetUserId === userId) {
        io.to(socketId).emit('game-event', {
          event,
          data,
          from: socket.userProfile
        });
        break;
      }
    }
  });

  // Get list of connected users
  socket.on('get-connected-users', () => {
    const users = [];
    for (const [socketId, userId] of connectedUsers.entries()) {
      const socketInstance = io.sockets.sockets.get(socketId);
      if (socketInstance && socketInstance.userProfile) {
        users.push(socketInstance.userProfile);
      }
    }
    socket.emit('connected-users', users);
  });

  // Handle disconnection
  socket.on('disconnect', () => {
    if (socket.userId) {
      console.log(`User disconnected: ${socket.username} (${socket.userId})`);
      socket.broadcast.emit('user-disconnected', socket.userProfile);

      // Let game module handle disconnection
      gameLoader.handleSocketDisconnection(socket, io, socket.userProfile);
    }
    connectedUsers.delete(socket.id);
    console.log('Client disconnected:', socket.id);
  });
});

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', activeGame: config.get('game.activeGame') });
});

// Serve main page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Start server
const PORT = config.get('server.port') || 3000;
const HOST = config.get('server.host') || '0.0.0.0';

// Wait a bit for database to initialize, then start server
setTimeout(() => {
  server.listen(PORT, HOST, () => {
    console.log('='.repeat(50));
    console.log('Local Game Hosting Service');
    console.log('='.repeat(50));
    console.log(`Server running on http://${HOST}:${PORT}`);
    console.log(`Active game: ${config.get('game.activeGame')}`);
    console.log(`Admin panel: http://${HOST}:${PORT}/admin.html`);
    console.log('='.repeat(50));

    // Clean expired sessions on startup
    try {
      db.cleanExpiredSessions();
      console.log('Cleaned expired admin sessions');
    } catch (error) {
      console.error('Error cleaning sessions:', error.message);
    }

    // Clean expired sessions every hour
    setInterval(() => {
      try {
        db.cleanExpiredSessions();
        console.log('Cleaned expired admin sessions');
      } catch (error) {
        console.error('Error cleaning sessions:', error.message);
      }
    }, 60 * 60 * 1000); // 1 hour

    // Load active game module
    const activeGame = config.get('game.activeGame');
    gameLoader.loadGame(activeGame);
  });
}, 1000);

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM signal received: closing server');
  server.close(() => {
    console.log('Server closed');
    process.exit(0);
  });
});

module.exports = { app, server, io };
