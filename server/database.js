const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');
const config = require('./config');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.init();
  }

  init() {
    const dbPath = config.get('database.path');
    const dbDir = path.dirname(dbPath);

    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Initialize database
    this.db = new Database(dbPath);
    this.db.pragma('journal_mode = WAL');

    // Create tables
    this.createTables();
  }

  createTables() {
    // Users table with profile customization
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password TEXT NOT NULL,
        nickname TEXT NOT NULL,
        profile_picture TEXT,
        name_color TEXT DEFAULT '#FFFFFF',
        player_color TEXT DEFAULT '#4A90E2',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_login DATETIME
      )
    `);

    // Game stats table (flexible key-value storage per user per game)
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS game_stats (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        user_id INTEGER NOT NULL,
        game_id TEXT NOT NULL,
        stat_key TEXT NOT NULL,
        stat_value TEXT NOT NULL,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
        UNIQUE(user_id, game_id, stat_key)
      )
    `);

    // Admin sessions table
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);

    // Create indexes for better performance
    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_game_stats_user_game
      ON game_stats(user_id, game_id);
    `);

    this.db.exec(`
      CREATE INDEX IF NOT EXISTS idx_users_username
      ON users(username);
    `);

    console.log('Database tables initialized');
  }

  // User methods
  createUser(username, hashedPassword, nickname) {
    const stmt = this.db.prepare(`
      INSERT INTO users (username, password, nickname)
      VALUES (?, ?, ?)
    `);
    return stmt.run(username, hashedPassword, nickname);
  }

  getUserByUsername(username) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE username = ?');
    return stmt.get(username);
  }

  getUserById(id) {
    const stmt = this.db.prepare('SELECT * FROM users WHERE id = ?');
    return stmt.get(id);
  }

  updateUserProfile(userId, updates) {
    const allowedFields = ['nickname', 'profile_picture', 'name_color', 'player_color'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) return false;

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(userId);

    const stmt = this.db.prepare(`UPDATE users SET ${setClause} WHERE id = ?`);
    return stmt.run(...values);
  }

  updateLastLogin(userId) {
    const stmt = this.db.prepare('UPDATE users SET last_login = CURRENT_TIMESTAMP WHERE id = ?');
    return stmt.run(userId);
  }

  getAllUsers() {
    const stmt = this.db.prepare('SELECT id, username, nickname, profile_picture, name_color, player_color, created_at, last_login FROM users');
    return stmt.all();
  }

  deleteUser(userId) {
    const stmt = this.db.prepare('DELETE FROM users WHERE id = ?');
    return stmt.run(userId);
  }

  // Game stats methods
  saveGameStat(userId, gameId, statKey, statValue) {
    const stmt = this.db.prepare(`
      INSERT INTO game_stats (user_id, game_id, stat_key, stat_value, updated_at)
      VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP)
      ON CONFLICT(user_id, game_id, stat_key)
      DO UPDATE SET stat_value = ?, updated_at = CURRENT_TIMESTAMP
    `);
    return stmt.run(userId, gameId, statKey, JSON.stringify(statValue), JSON.stringify(statValue));
  }

  getGameStat(userId, gameId, statKey) {
    const stmt = this.db.prepare(`
      SELECT stat_value FROM game_stats
      WHERE user_id = ? AND game_id = ? AND stat_key = ?
    `);
    const result = stmt.get(userId, gameId, statKey);
    return result ? JSON.parse(result.stat_value) : null;
  }

  getAllGameStats(userId, gameId) {
    const stmt = this.db.prepare(`
      SELECT stat_key, stat_value FROM game_stats
      WHERE user_id = ? AND game_id = ?
    `);
    const results = stmt.all(userId, gameId);
    const stats = {};
    results.forEach(row => {
      stats[row.stat_key] = JSON.parse(row.stat_value);
    });
    return stats;
  }

  getGameLeaderboard(gameId, statKey, limit = 10) {
    const stmt = this.db.prepare(`
      SELECT u.nickname, u.name_color, g.stat_value
      FROM game_stats g
      JOIN users u ON g.user_id = u.id
      WHERE g.game_id = ? AND g.stat_key = ?
      ORDER BY CAST(g.stat_value AS REAL) DESC
      LIMIT ?
    `);
    return stmt.all(gameId, statKey, limit);
  }

  // Admin session methods
  createAdminSession(token, expiresAt) {
    const stmt = this.db.prepare(`
      INSERT INTO admin_sessions (token, expires_at)
      VALUES (?, ?)
    `);
    return stmt.run(token, expiresAt);
  }

  validateAdminSession(token) {
    const stmt = this.db.prepare(`
      SELECT * FROM admin_sessions
      WHERE token = ? AND expires_at > CURRENT_TIMESTAMP
    `);
    return stmt.get(token);
  }

  deleteAdminSession(token) {
    const stmt = this.db.prepare('DELETE FROM admin_sessions WHERE token = ?');
    return stmt.run(token);
  }

  cleanExpiredSessions() {
    const stmt = this.db.prepare('DELETE FROM admin_sessions WHERE expires_at <= CURRENT_TIMESTAMP');
    return stmt.run();
  }
}

module.exports = new DatabaseManager();
