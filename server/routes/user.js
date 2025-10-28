const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const db = require('../database');
const auth = require('../auth');
const config = require('../config');

const router = express.Router();

// Configure multer for profile picture uploads
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const uploadPath = config.get('uploads.profilePictures');
    if (!fs.existsSync(uploadPath)) {
      fs.mkdirSync(uploadPath, { recursive: true });
    }
    cb(null, uploadPath);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, 'profile-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { fileSize: config.get('uploads.maxFileSize') },
  fileFilter: function (req, file, cb) {
    const allowedTypes = /jpeg|jpg|png|gif|webp/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only image files are allowed'));
    }
  }
});

// Register new user
router.post('/register', async (req, res) => {
  const { username, password, nickname } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = await auth.registerUser(username, password, nickname);

  if (result.success) {
    res.status(201).json({ message: 'User registered successfully', userId: result.userId });
  } else {
    res.status(400).json({ error: result.error });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password are required' });
  }

  const result = await auth.loginUser(username, password);

  if (result.success) {
    res.json({ token: result.token, user: result.user });
  } else {
    res.status(401).json({ error: result.error });
  }
});

// Get current user profile (protected)
router.get('/profile', auth.userAuthMiddleware, (req, res) => {
  const user = db.getUserById(req.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return user without password
  const userData = {
    id: user.id,
    username: user.username,
    nickname: user.nickname,
    profilePicture: user.profile_picture,
    nameColor: user.name_color,
    playerColor: user.player_color,
    createdAt: user.created_at,
    lastLogin: user.last_login
  };

  res.json(userData);
});

// Update user profile (protected)
router.put('/profile', auth.userAuthMiddleware, (req, res) => {
  const { nickname, nameColor, playerColor } = req.body;

  const updates = {};
  if (nickname !== undefined) updates.nickname = nickname;
  if (nameColor !== undefined) updates.name_color = nameColor;
  if (playerColor !== undefined) updates.player_color = playerColor;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No valid fields to update' });
  }

  const result = db.updateUserProfile(req.userId, updates);

  if (result.changes > 0) {
    const updatedUser = db.getUserById(req.userId);
    const userData = {
      id: updatedUser.id,
      username: updatedUser.username,
      nickname: updatedUser.nickname,
      profilePicture: updatedUser.profile_picture,
      nameColor: updatedUser.name_color,
      playerColor: updatedUser.player_color
    };
    res.json({ message: 'Profile updated successfully', user: userData });
  } else {
    res.status(500).json({ error: 'Failed to update profile' });
  }
});

// Upload profile picture (protected)
router.post('/profile/picture', auth.userAuthMiddleware, upload.single('picture'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  const picturePath = `/uploads/profile-pictures/${req.file.filename}`;

  // Delete old profile picture if it exists
  const user = db.getUserById(req.userId);
  if (user.profile_picture) {
    const oldPath = path.join(__dirname, '../../', user.profile_picture);
    if (fs.existsSync(oldPath)) {
      fs.unlinkSync(oldPath);
    }
  }

  const result = db.updateUserProfile(req.userId, { profile_picture: picturePath });

  if (result.changes > 0) {
    res.json({ message: 'Profile picture updated successfully', picturePath });
  } else {
    res.status(500).json({ error: 'Failed to update profile picture' });
  }
});

// Get user by ID (for other players to see)
router.get('/:userId', (req, res) => {
  const user = db.getUserById(req.params.userId);

  if (!user) {
    return res.status(404).json({ error: 'User not found' });
  }

  // Return public user data only
  const userData = {
    id: user.id,
    nickname: user.nickname,
    profilePicture: user.profile_picture,
    nameColor: user.name_color,
    playerColor: user.player_color
  };

  res.json(userData);
});

module.exports = router;
