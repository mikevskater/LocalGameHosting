const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const db = require('./database');
const config = require('./config');

const SALT_ROUNDS = 10;

class AuthService {
  // User authentication
  async registerUser(username, password, nickname) {
    try {
      // Check if user already exists
      const existingUser = db.getUserByUsername(username);
      if (existingUser) {
        return { success: false, error: 'Username already exists' };
      }

      // Hash password
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);

      // Create user
      const result = db.createUser(username, hashedPassword, nickname || username);

      return { success: true, userId: result.lastInsertRowid };
    } catch (error) {
      console.error('Registration error:', error);
      return { success: false, error: 'Registration failed' };
    }
  }

  async loginUser(username, password) {
    try {
      // Get user from database
      const user = db.getUserByUsername(username);
      if (!user) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Verify password
      const passwordMatch = await bcrypt.compare(password, user.password);
      if (!passwordMatch) {
        return { success: false, error: 'Invalid username or password' };
      }

      // Update last login
      db.updateLastLogin(user.id);

      // Generate JWT token
      const token = this.generateUserToken(user.id, username);

      // Return user data (without password)
      const userData = {
        id: user.id,
        username: user.username,
        nickname: user.nickname,
        profilePicture: user.profile_picture,
        nameColor: user.name_color,
        playerColor: user.player_color
      };

      return { success: true, token, user: userData };
    } catch (error) {
      console.error('Login error:', error);
      return { success: false, error: 'Login failed' };
    }
  }

  generateUserToken(userId, username) {
    const secret = config.get('security.jwtSecret');
    const expiryDays = config.get('security.sessionExpiryDays') || 30;

    return jwt.sign(
      { userId, username, type: 'user' },
      secret,
      { expiresIn: `${expiryDays}d` }
    );
  }

  verifyUserToken(token) {
    try {
      const secret = config.get('security.jwtSecret');
      const decoded = jwt.verify(token, secret);

      if (decoded.type !== 'user') {
        return null;
      }

      return decoded;
    } catch (error) {
      return null;
    }
  }

  // Admin authentication
  async loginAdmin(username, password) {
    try {
      const adminUsername = config.get('admin.username');
      const adminPassword = config.get('admin.password');

      if (username !== adminUsername || password !== adminPassword) {
        return { success: false, error: 'Invalid admin credentials' };
      }

      // Generate admin token
      const token = this.generateAdminToken(username);

      // Store session in database
      const expiresAt = new Date();
      expiresAt.setHours(expiresAt.getHours() + 24); // 24 hour expiry
      db.createAdminSession(token, expiresAt.toISOString());

      return { success: true, token };
    } catch (error) {
      console.error('Admin login error:', error);
      return { success: false, error: 'Admin login failed' };
    }
  }

  generateAdminToken(username) {
    const secret = config.get('security.jwtSecret');
    return jwt.sign(
      { username, type: 'admin' },
      secret,
      { expiresIn: '24h' }
    );
  }

  verifyAdminToken(token) {
    try {
      const secret = config.get('security.jwtSecret');
      const decoded = jwt.verify(token, secret);

      if (decoded.type !== 'admin') {
        return false;
      }

      // Check if session exists in database
      const session = db.validateAdminSession(token);
      return !!session;
    } catch (error) {
      return false;
    }
  }

  logoutAdmin(token) {
    try {
      db.deleteAdminSession(token);
      return { success: true };
    } catch (error) {
      console.error('Admin logout error:', error);
      return { success: false, error: 'Logout failed' };
    }
  }

  // Middleware for protecting routes
  userAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = authService.verifyUserToken(token);

    if (!decoded) {
      return res.status(401).json({ error: 'Invalid or expired token' });
    }

    // Attach user info to request
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  }

  adminAuthMiddleware(req, res, next) {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const isValid = authService.verifyAdminToken(token);

    if (!isValid) {
      return res.status(401).json({ error: 'Invalid or expired admin token' });
    }

    next();
  }
}

const authService = new AuthService();
module.exports = authService;
