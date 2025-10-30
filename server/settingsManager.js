const path = require('path');
const fs = require('fs');

/**
 * Settings Manager - Handles dynamic game settings loaded from settings.json
 *
 * Each game can optionally have a settings.json file that defines:
 * - Admin panel controls (buttons, inputs, checkboxes, etc.)
 * - Setting values and defaults
 * - Live stats to display
 * - Actions that can be triggered
 */
class SettingsManager {
  constructor() {
    this.gameSettings = {};  // { gameId: { settings schema from settings.json } }
    this.gameStates = {};    // { gameId: { settingKey: value } }
  }

  /**
   * Load settings.json for a game
   * @param {string} gameId - The game ID
   * @param {string} gamesDirectory - Path to games directory
   * @returns {object|null} Settings schema or null if no settings file
   */
  loadGameSettings(gameId, gamesDirectory = 'games') {
    try {
      const settingsPath = path.join(__dirname, '..', gamesDirectory, gameId, 'settings.json');

      if (!fs.existsSync(settingsPath)) {
        console.log(`[SettingsManager] No settings.json found for game: ${gameId}`);
        this.gameSettings[gameId] = null;
        this.gameStates[gameId] = {};
        return null;
      }

      const settingsContent = fs.readFileSync(settingsPath, 'utf8');
      const schema = JSON.parse(settingsContent);

      this.gameSettings[gameId] = schema;

      // Initialize default values from schema
      this.initializeDefaults(gameId, schema);

      console.log(`[SettingsManager] Loaded settings for game: ${gameId}`);
      return schema;
    } catch (error) {
      console.error(`[SettingsManager] Error loading settings for ${gameId}:`, error);
      this.gameSettings[gameId] = null;
      this.gameStates[gameId] = {};
      return null;
    }
  }

  /**
   * Extract default values from schema and initialize state
   * @param {string} gameId
   * @param {object} schema
   */
  initializeDefaults(gameId, schema) {
    const defaults = {};

    if (schema.sections && Array.isArray(schema.sections)) {
      schema.sections.forEach(section => {
        if (section.controls && Array.isArray(section.controls)) {
          section.controls.forEach(control => {
            // Only initialize controls that have a settingKey and default value
            if (control.settingKey && control.default !== undefined) {
              defaults[control.settingKey] = control.default;
            }
          });
        }
      });
    }

    this.gameStates[gameId] = defaults;
    console.log(`[SettingsManager] Initialized defaults for ${gameId}:`, defaults);
  }

  /**
   * Get settings schema for a game
   * @param {string} gameId
   * @returns {object|null}
   */
  getGameSettings(gameId) {
    return this.gameSettings[gameId] || null;
  }

  /**
   * Get current state/values for a game
   * @param {string} gameId
   * @returns {object}
   */
  getGameState(gameId) {
    return this.gameStates[gameId] || {};
  }

  /**
   * Update a setting value
   * @param {string} gameId
   * @param {string} settingKey
   * @param {any} value
   */
  updateSetting(gameId, settingKey, value) {
    if (!this.gameStates[gameId]) {
      this.gameStates[gameId] = {};
    }

    const oldValue = this.gameStates[gameId][settingKey];
    this.gameStates[gameId][settingKey] = value;

    console.log(`[SettingsManager] Setting updated for ${gameId}: ${settingKey} = ${value} (was: ${oldValue})`);
  }

  /**
   * Get a specific setting value
   * @param {string} gameId
   * @param {string} settingKey
   * @returns {any}
   */
  getSetting(gameId, settingKey) {
    return this.gameStates[gameId]?.[settingKey];
  }

  /**
   * Get live stats from game module
   * @param {string} gameId
   * @param {object} gameModule
   * @returns {object}
   */
  getLiveStats(gameId, gameModule) {
    if (!gameModule) {
      return {};
    }

    // Check if game module exports getAdminStats function
    if (typeof gameModule.getAdminStats === 'function') {
      try {
        return gameModule.getAdminStats();
      } catch (error) {
        console.error(`[SettingsManager] Error getting stats for ${gameId}:`, error);
        return {};
      }
    }

    return {};
  }

  /**
   * Execute an action (call game module function)
   * @param {string} gameId
   * @param {string} action - The action name (function name to call)
   * @param {object} gameModule - The game's server module
   * @param {object} io - Socket.IO instance
   * @param {object} params - Parameters to pass to the action
   * @returns {any} Result from the action
   */
  executeAction(gameId, action, gameModule, io, params = {}) {
    if (!gameModule) {
      throw new Error('Game module not loaded');
    }

    // Check if action function exists
    if (typeof gameModule[action] !== 'function') {
      throw new Error(`Action '${action}' not found in game module for ${gameId}`);
    }

    try {
      console.log(`[SettingsManager] Executing action '${action}' for ${gameId}`);
      const result = gameModule[action](io, params);
      console.log(`[SettingsManager] Action '${action}' completed for ${gameId}`);
      return result;
    } catch (error) {
      console.error(`[SettingsManager] Error executing action '${action}' for ${gameId}:`, error);
      throw error;
    }
  }

  /**
   * Check if a game has settings
   * @param {string} gameId
   * @returns {boolean}
   */
  hasSettings(gameId) {
    return this.gameSettings[gameId] !== null && this.gameSettings[gameId] !== undefined;
  }

  /**
   * Clear settings for a game (when unloading)
   * @param {string} gameId
   */
  clearGameSettings(gameId) {
    delete this.gameSettings[gameId];
    delete this.gameStates[gameId];
    console.log(`[SettingsManager] Cleared settings for ${gameId}`);
  }

  /**
   * Get all available settings (for debugging)
   * @returns {object}
   */
  getAllSettings() {
    return {
      schemas: this.gameSettings,
      states: this.gameStates
    };
  }
}

// Export singleton instance
module.exports = new SettingsManager();
