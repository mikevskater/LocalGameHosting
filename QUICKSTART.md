# Quick Start Guide

## Installation & Setup (5 minutes)

### 1. Install Node.js Dependencies
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```

You should see:
```
==================================================
Local Game Hosting Service
==================================================
Server running on http://0.0.0.0:3000
Active game: example-static
Admin panel: http://0.0.0.0:3000/admin.html
==================================================
```

### 3. Create Your First User Account

1. Open `http://localhost:3000` in your browser
2. Click the "Register" tab
3. Create an account:
   - Username: `player1`
   - Password: `password123`
   - Nickname: `Player One`
4. Click "Register"
5. Switch to "Login" tab and log in

### 4. Customize Your Profile

1. After logging in, click "Edit Profile"
2. Choose your name color and player color
3. Optionally upload a profile picture
4. Click "Save Changes"

### 5. Try the Example Games

**Number Guessing Game** (already active):
- The game loads automatically after login
- Guess numbers between 1-100
- Your stats and leaderboard position are tracked

**Switch to Multiplayer Drawing**:
1. Open `http://localhost:3000/admin.html` in a new tab
2. Login with:
   - Username: `admin`
   - Password: `changeme123`
3. Under "Game Management", click "Switch To" on "Multiplayer Drawing Game"
4. Return to the main tab and refresh
5. Open the same URL on another device or browser window to draw together!

## Sharing with Coworkers

### Find Your IP Address

**Windows:**
```bash
ipconfig
```
Look for "IPv4 Address" under your active network adapter (e.g., `192.168.1.100`)

**Mac/Linux:**
```bash
ifconfig
# or
ip addr
```

### Share the URL

Give your coworkers:
```
http://YOUR_IP_ADDRESS:3000
```

Example: `http://192.168.1.100:3000`

## Common Tasks

### Change Server Port

Edit `config.json`:
```json
{
  "server": {
    "port": 8080
  }
}
```
Then restart the server.

### Add a New Game

1. Create a folder in `games/` directory:
   ```
   games/my-awesome-game/
   ```

2. Add `game.json`:
   ```json
   {
     "id": "my-awesome-game",
     "name": "My Awesome Game",
     "description": "A fun game!",
     "version": "1.0.0"
   }
   ```

3. Add `index.html` with your game code

4. Switch to it in the admin panel

### Reset Everything

Delete these files/folders to start fresh:
- `config.json` (regenerates with defaults)
- `data/gamehost.db` (clears all users and stats)
- `uploads/` (removes profile pictures)

## Next Steps

- Read the full README.md for API documentation
- Customize the example games
- Build your own game using the GameAPI
- Configure the server for your network

## Troubleshooting

**"Port already in use"** → Change port in config.json

**Can't connect from other computers** → Check firewall, ensure host is "0.0.0.0"

**Login issues** → Delete data/gamehost.db to reset database

**Games not loading** → Check browser console for errors, ensure you're logged in
