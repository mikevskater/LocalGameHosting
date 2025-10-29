const path = require('path');
const fs = require('fs');
const config = require('./config');

class GameLoader {
  constructor() {
    this.activeGameModule = null;
    this.activeGameId = null;
  }

  // Load a game's server-side module
  loadGame(gameId) {
    try {
      // Unload previous game module if exists
      if (this.activeGameModule && this.activeGameModule.onUnload) {
        console.log(`Unloading game module: ${this.activeGameId}`);
        this.activeGameModule.onUnload();
      }

      const gamesDir = config.get('game.gamesDirectory');
      const gameModulePath = path.join(__dirname, '..', gamesDir, gameId, 'server.js');

      // Check if game has a server module
      if (fs.existsSync(gameModulePath)) {
        // Clear require cache to allow hot-reloading
        delete require.cache[require.resolve(gameModulePath)];

        // Load the module
        this.activeGameModule = require(gameModulePath);
        this.activeGameId = gameId;

        console.log(`Loaded game module: ${gameId}`);

        // Initialize the module if it has an init function
        if (this.activeGameModule.onLoad) {
          this.activeGameModule.onLoad();
        }

        return true;
      } else {
        console.log(`No server module found for game: ${gameId}`);
        this.activeGameModule = null;
        this.activeGameId = gameId;
        return false;
      }
    } catch (error) {
      console.error(`Error loading game module for ${gameId}:`, error);
      this.activeGameModule = null;
      return false;
    }
  }

  // Handle socket connection for the active game
  handleSocketConnection(socket, io, user) {
    if (this.activeGameModule && this.activeGameModule.handleConnection) {
      this.activeGameModule.handleConnection(socket, io, user);
    }
  }

  // Handle socket disconnection
  handleSocketDisconnection(socket, io, user) {
    if (this.activeGameModule && this.activeGameModule.handleDisconnection) {
      this.activeGameModule.handleDisconnection(socket, io, user);
    }
  }

  // Get game state (for new connections)
  getGameState() {
    if (this.activeGameModule && this.activeGameModule.getState) {
      return this.activeGameModule.getState();
    }
    return null;
  }

  // Get current active game ID
  getActiveGameId() {
    return this.activeGameId;
  }

  // Check if current game has a server module
  hasServerModule() {
    return this.activeGameModule !== null;
  }
}

module.exports = new GameLoader();
