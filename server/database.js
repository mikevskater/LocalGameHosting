const initSqlJs = require('sql.js');
const path = require('path');
const fs = require('fs');
const config = require('./config');

class DatabaseManager {
  constructor() {
    this.db = null;
    this.SQL = null;
    this.dbPath = null;
    this.initPromise = this.init();
  }

  async init() {
    this.SQL = await initSqlJs();

    const dbPath = config.get('database.path');
    this.dbPath = dbPath;
    const dbDir = path.dirname(dbPath);

    // Create data directory if it doesn't exist
    if (!fs.existsSync(dbDir)) {
      fs.mkdirSync(dbDir, { recursive: true });
    }

    // Load or create database
    if (fs.existsSync(dbPath)) {
      const buffer = fs.readFileSync(dbPath);
      this.db = new this.SQL.Database(buffer);
    } else {
      this.db = new this.SQL.Database();
    }

    // Create tables
    this.createTables();
    this.saveDatabase();
  }

  saveDatabase() {
    if (!this.db || !this.dbPath) return;
    const data = this.db.export();
    const buffer = Buffer.from(data);
    fs.writeFileSync(this.dbPath, buffer);
  }

  createTables() {
    // Users table with profile customization
    this.db.run(`
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
    this.db.run(`
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
    this.db.run(`
      CREATE TABLE IF NOT EXISTS admin_sessions (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        token TEXT UNIQUE NOT NULL,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        expires_at DATETIME NOT NULL
      )
    `);

    // Create indexes for better performance
    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_game_stats_user_game
      ON game_stats(user_id, game_id)
    `);

    this.db.run(`
      CREATE INDEX IF NOT EXISTS idx_users_username
      ON users(username)
    `);

    this.saveDatabase();
    console.log('Database tables initialized');
  }

  // User methods
  createUser(username, hashedPassword, nickname) {
    this.db.run(`
      INSERT INTO users (username, password, nickname)
      VALUES (?, ?, ?)
    `, [username, hashedPassword, nickname]);

    const result = this.db.exec('SELECT last_insert_rowid() as id');
    this.saveDatabase();
    return { lastInsertRowid: result[0].values[0][0] };
  }

  getUserByUsername(username) {
    const result = this.db.exec('SELECT * FROM users WHERE username = ?', [username]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};
    columns.forEach((col, i) => {
      user[col] = values[i];
    });
    return user;
  }

  getUserById(id) {
    const result = this.db.exec('SELECT * FROM users WHERE id = ?', [id]);
    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];
    const user = {};
    columns.forEach((col, i) => {
      user[col] = values[i];
    });
    return user;
  }

  updateUserProfile(userId, updates) {
    const allowedFields = ['nickname', 'profile_picture', 'name_color', 'player_color'];
    const fields = Object.keys(updates).filter(key => allowedFields.includes(key));

    if (fields.length === 0) return { changes: 0 };

    const setClause = fields.map(field => `${field} = ?`).join(', ');
    const values = fields.map(field => updates[field]);
    values.push(userId);

    this.db.run(`UPDATE users SET ${setClause} WHERE id = ?`, values);
    this.saveDatabase();
    return { changes: 1 };
  }

  updateLastLogin(userId) {
    this.db.run("UPDATE users SET last_login = datetime('now') WHERE id = ?", [userId]);
    this.saveDatabase();
    return { changes: 1 };
  }

  getAllUsers() {
    const result = this.db.exec('SELECT id, username, nickname, profile_picture, name_color, player_color, created_at, last_login FROM users');
    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(values => {
      const user = {};
      columns.forEach((col, i) => {
        user[col] = values[i];
      });
      return user;
    });
  }

  deleteUser(userId) {
    this.db.run('DELETE FROM users WHERE id = ?', [userId]);
    this.saveDatabase();
    return { changes: 1 };
  }

  // Game stats methods
  saveGameStat(userId, gameId, statKey, statValue) {
    try {
      // Try to update first
      this.db.run(`
        UPDATE game_stats
        SET stat_value = ?, updated_at = datetime('now')
        WHERE user_id = ? AND game_id = ? AND stat_key = ?
      `, [JSON.stringify(statValue), userId, gameId, statKey]);

      // Check if any rows were affected
      const checkResult = this.db.exec(
        'SELECT COUNT(*) as count FROM game_stats WHERE user_id = ? AND game_id = ? AND stat_key = ?',
        [userId, gameId, statKey]
      );

      if (checkResult.length === 0 || checkResult[0].values[0][0] === 0) {
        // Insert if no existing record
        this.db.run(`
          INSERT INTO game_stats (user_id, game_id, stat_key, stat_value, updated_at)
          VALUES (?, ?, ?, ?, datetime('now'))
        `, [userId, gameId, statKey, JSON.stringify(statValue)]);
      }

      this.saveDatabase();
      return { changes: 1 };
    } catch (error) {
      console.error('Error saving game stat:', error);
      return { changes: 0 };
    }
  }

  getGameStat(userId, gameId, statKey) {
    const result = this.db.exec(`
      SELECT stat_value FROM game_stats
      WHERE user_id = ? AND game_id = ? AND stat_key = ?
    `, [userId, gameId, statKey]);

    if (result.length === 0 || result[0].values.length === 0) return null;
    return JSON.parse(result[0].values[0][0]);
  }

  getAllGameStats(userId, gameId) {
    const result = this.db.exec(`
      SELECT stat_key, stat_value FROM game_stats
      WHERE user_id = ? AND game_id = ?
    `, [userId, gameId]);

    if (result.length === 0) return {};

    const stats = {};
    result[0].values.forEach(row => {
      stats[row[0]] = JSON.parse(row[1]);
    });
    return stats;
  }

  getGameLeaderboard(gameId, statKey, limit = 10) {
    const result = this.db.exec(`
      SELECT u.nickname, u.name_color, g.stat_value
      FROM game_stats g
      JOIN users u ON g.user_id = u.id
      WHERE g.game_id = ? AND g.stat_key = ?
      ORDER BY CAST(g.stat_value AS REAL) DESC
      LIMIT ?
    `, [gameId, statKey, limit]);

    if (result.length === 0) return [];

    const columns = result[0].columns;
    return result[0].values.map(values => {
      const row = {};
      columns.forEach((col, i) => {
        row[col] = values[i];
      });
      return row;
    });
  }

  // Admin session methods
  createAdminSession(token, expiresAt) {
    this.db.run(`
      INSERT INTO admin_sessions (token, expires_at)
      VALUES (?, ?)
    `, [token, expiresAt]);
    this.saveDatabase();
    return { lastInsertRowid: 1 };
  }

  validateAdminSession(token) {
    const result = this.db.exec(`
      SELECT * FROM admin_sessions
      WHERE token = ? AND expires_at > datetime('now')
    `, [token]);

    if (result.length === 0 || result[0].values.length === 0) return null;

    const columns = result[0].columns;
    const values = result[0].values[0];
    const session = {};
    columns.forEach((col, i) => {
      session[col] = values[i];
    });
    return session;
  }

  deleteAdminSession(token) {
    this.db.run('DELETE FROM admin_sessions WHERE token = ?', [token]);
    this.saveDatabase();
    return { changes: 1 };
  }

  cleanExpiredSessions() {
    this.db.run("DELETE FROM admin_sessions WHERE expires_at <= datetime('now')");
    this.saveDatabase();
    return { changes: 1 };
  }
}

// Create and export a promise that resolves to the database manager
let dbInstance = null;

async function getDatabase() {
  if (!dbInstance) {
    dbInstance = new DatabaseManager();
    await dbInstance.initPromise;
  }
  return dbInstance;
}

// Create a proxy object that waits for initialization
const dbProxy = new Proxy({}, {
  get: function(target, prop) {
    return async function(...args) {
      const db = await getDatabase();
      if (typeof db[prop] === 'function') {
        return db[prop](...args);
      }
      return db[prop];
    };
  }
});

// For synchronous initialization at startup
let syncDb = null;
(async () => {
  syncDb = await getDatabase();
})();

// Export both async and sync access
module.exports = new Proxy(dbProxy, {
  get: function(target, prop) {
    // If database is initialized, use it synchronously
    if (syncDb && typeof syncDb[prop] === 'function') {
      return syncDb[prop].bind(syncDb);
    }
    // Otherwise, return async wrapper
    return target[prop];
  }
});
