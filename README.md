# Local Game Hosting Service

A Node.js-based local network hosting service for HTML-based games with user profiles, authentication, stats tracking, and real-time multiplayer support.

## Features

- **User Authentication**: Registration, login, and persistent sessions
- **User Profiles**: Customizable nicknames, profile pictures, name colors, and player colors
- **Stats API**: Generic key-value storage for game statistics per user
- **Real-time Multiplayer**: Socket.IO integration for live game events
- **Admin Dashboard**: Manage users, switch games, and configure server settings
- **Modular Games**: Easy game swapping with self-contained game directories

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Start the Server

```bash
npm start
```

The server will start on `http://localhost:3000` (or the configured port).

### 3. Access the Services

- **Game Portal**: `http://localhost:3000`
- **Admin Dashboard**: `http://localhost:3000/admin.html`

### 4. Default Admin Credentials

```
Username: admin
Password: changeme123
```

**IMPORTANT**: Change these credentials in `config.json` after first run!

## Configuration

On first run, a `config.json` file is created from `config.default.json`. Edit this file to customize:

```json
{
  "server": {
    "port": 3000,           // Server port
    "host": "0.0.0.0"       // Bind to all interfaces
  },
  "admin": {
    "username": "admin",    // Change this!
    "password": "changeme123"  // Change this!
  },
  "security": {
    "jwtSecret": "CHANGE_THIS_TO_RANDOM_STRING",  // Generate a random secret
    "sessionExpiryDays": 30
  },
  "game": {
    "activeGame": "example-static",  // Current active game
    "gamesDirectory": "./games"
  }
}
```

### Security Notes

- Generate a strong random string for `jwtSecret`
- Change default admin credentials immediately
- This is designed for trusted local networks only

## Project Structure

```
net_framework/
├── server/
│   ├── index.js           # Main server entry point
│   ├── config.js          # Configuration manager
│   ├── database.js        # SQLite database manager
│   ├── auth.js            # Authentication service
│   └── routes/
│       ├── user.js        # User API endpoints
│       ├── admin.js       # Admin API endpoints
│       └── game.js        # Game stats API endpoints
├── public/
│   ├── index.html         # Main user interface
│   ├── admin.html         # Admin dashboard
│   ├── css/
│   │   └── styles.css     # Styling
│   └── js/
│       ├── gameapi.js     # Client-side game API library
│       ├── app.js         # Main app logic
│       └── admin.js       # Admin dashboard logic
├── games/
│   ├── example-static/    # Example single-player game
│   └── example-multiplayer/  # Example multiplayer game
├── data/
│   └── gamehost.db        # SQLite database (auto-created)
├── uploads/
│   └── profile-pictures/  # User profile pictures (auto-created)
├── package.json
├── config.json            # Server configuration (auto-created)
└── README.md
```

## Creating Your Own Games

### Game Structure

Each game lives in its own directory under `games/`:

```
games/
└── your-game/
    ├── game.json         # Game metadata
    ├── index.html        # Game entry point
    └── ... (other assets)
```

### game.json Example

```json
{
  "id": "your-game",
  "name": "Your Game Name",
  "description": "A short description of your game",
  "version": "1.0.0",
  "type": "static"
}
```

### Using the GameAPI

Include the GameAPI in your game's HTML:

```html
<script src="/socket.io/socket.io.js"></script>
<script src="/js/gameapi.js"></script>
```

#### Authentication

```javascript
// Check if user is logged in
if (gameAPI.isAuthenticated()) {
  // Get current user
  const user = gameAPI.getUser();
  console.log(user.nickname, user.nameColor, user.playerColor);
}
```

#### Stats API

```javascript
// Save a stat
await gameAPI.saveGameStat('score', 1000);
await gameAPI.saveGameStat('level', 5);

// Get a specific stat
const result = await gameAPI.getGameStat('score');
console.log(result.value); // 1000

// Get all stats for current game
const allStats = await gameAPI.getAllGameStats();
console.log(allStats); // { score: 1000, level: 5 }

// Get leaderboard
const leaderboard = await gameAPI.getLeaderboard('score', 10);
leaderboard.leaderboard.forEach(player => {
  console.log(player.nickname, player.stat_value);
});
```

#### Real-time Multiplayer

```javascript
// Send an event to all players
gameAPI.emit('player-moved', { x: 100, y: 200 });

// Send an event to a specific player
gameAPI.emitTo(userId, 'private-message', { text: 'Hello!' });

// Listen for events
gameAPI.on('player-moved', (data, user) => {
  console.log(`${user.nickname} moved to`, data.x, data.y);
});

// Listen for player connections
gameAPI.on('user-connected', (user) => {
  console.log(`${user.nickname} joined!`);
});

gameAPI.on('user-disconnected', (user) => {
  console.log(`${user.nickname} left`);
});

// Get all connected players
const players = await gameAPI.getConnectedUsers();
```

## Admin Dashboard

Access the admin dashboard at `/admin.html` to:

- View server statistics
- Manage users (view, delete)
- Switch between games
- Update server configuration
- Monitor connected players

## User Profile Customization

Users can customize their profiles with:

- **Nickname**: Display name shown in games
- **Profile Picture**: Upload a custom image
- **Name Color**: Color of their nickname text (hex color)
- **Player Color**: Color of their in-game character/avatar (hex color)

Games can access these colors via the GameAPI to render players with their chosen colors.

## API Reference

### User Endpoints

- `POST /api/user/register` - Register new user
- `POST /api/user/login` - Login user
- `GET /api/user/profile` - Get user profile (auth required)
- `PUT /api/user/profile` - Update profile (auth required)
- `POST /api/user/profile/picture` - Upload profile picture (auth required)
- `GET /api/user/:userId` - Get public user info

### Game Endpoints

- `GET /api/game/info` - Get current game info
- `POST /api/game/stats/save` - Save a stat (auth required)
- `GET /api/game/stats/:statKey` - Get a specific stat (auth required)
- `GET /api/game/stats` - Get all stats (auth required)
- `GET /api/game/leaderboard/:statKey` - Get leaderboard
- `GET /api/game/stats/user/:userId` - Get user stats

### Admin Endpoints (Auth Required)

- `POST /api/admin/login` - Admin login
- `POST /api/admin/logout` - Admin logout
- `GET /api/admin/users` - Get all users
- `DELETE /api/admin/users/:userId` - Delete user
- `GET /api/admin/config` - Get configuration
- `PUT /api/admin/config` - Update configuration
- `GET /api/admin/games` - List available games
- `POST /api/admin/games/switch` - Switch active game
- `GET /api/admin/stats` - Get server stats

## Local Network Access

To allow coworkers to access the server:

1. Find your local IP address:
   - Windows: `ipconfig` (look for IPv4 Address)
   - Mac/Linux: `ifconfig` or `ip addr`

2. Share the URL with coworkers:
   ```
   http://YOUR_IP_ADDRESS:3000
   ```

3. Make sure your firewall allows incoming connections on the configured port

## Troubleshooting

### Port Already in Use

Change the port in `config.json`:

```json
{
  "server": {
    "port": 8080
  }
}
```

### Cannot Connect from Other Computers

- Check your firewall settings
- Ensure `host` is set to `"0.0.0.0"` in config.json
- Verify you're on the same network

### Database Issues

Delete `data/gamehost.db` to reset the database (all users and stats will be lost)

## Example Games

### Number Guessing Game (Static)

A single-player game that demonstrates:
- Stats API usage
- Leaderboard integration
- Score tracking

### Multiplayer Drawing Canvas

A real-time collaborative drawing app that demonstrates:
- Socket.IO real-time events
- Connected users list
- Broadcasting to all players

## Development

### Adding New Features

The codebase is modular and easy to extend:

- **New API endpoints**: Add to `server/routes/`
- **Database changes**: Modify `server/database.js`
- **Client features**: Add to `public/js/gameapi.js`

### Database Schema

The SQLite database includes these tables:

- `users` - User accounts and profiles
- `game_stats` - Flexible key-value stats per user per game
- `admin_sessions` - Admin authentication sessions

## License

MIT

## Support

This is a self-hosted solution for local networks. For issues or questions, refer to the source code documentation.
