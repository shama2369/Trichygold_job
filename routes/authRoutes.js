const express = require('express');
const router = express.Router();
const { ObjectId } = require('mongodb');
const bcrypt = require('bcryptjs');

// POST: Login user
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    
    if (!username || !password) {
      return res.status(400).json({ error: 'Username and password are required' });
    }

    const db = req.app.locals.db;
    const user = await db.collection('users').findOne({ username: username });
    
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password using bcrypt
    const isValidPassword = await bcrypt.compare(password, user.password);
    
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Get user roles and permissions
    let userWithRoles = { ...user };
    if (user.roles && user.roles.length > 0) {
      const roles = await db.collection('roles').find({
        _id: { $in: user.roles.map(roleId => new ObjectId(roleId)) }
      }).toArray();
      
      userWithRoles.roleNames = roles.map(role => role.name);
    }

    // Create a simple token (in production, use JWT)
    const token = Buffer.from(`${user._id}:${Date.now()}`).toString('base64');

    const responseData = {
      token: token,
      user: {
        _id: user._id,
        username: user.username,
        email: user.email,
        roles: user.roles || [],
        roleNames: userWithRoles.roleNames || []
      }
    };
    
    res.json(responseData);
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// GET: Get current user info
router.get('/me', async (req, res) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'No token provided' });
    }

    const token = authHeader.substring(7);
    const decoded = Buffer.from(token, 'base64').toString();
    const [userId] = decoded.split(':');

    if (!userId) {
      return res.status(401).json({ error: 'Invalid token' });
    }

    const db = req.app.locals.db;
    const user = await db.collection('users').findOne({ _id: new ObjectId(userId) });
    
    if (!user) {
      return res.status(401).json({ error: 'User not found' });
    }

    // Get user roles and permissions
    let userWithRoles = { ...user };
    if (user.roles && user.roles.length > 0) {
      const roles = await db.collection('roles').find({
        _id: { $in: user.roles.map(roleId => new ObjectId(roleId)) }
      }).toArray();
      
      userWithRoles.roleNames = roles.map(role => role.name);
    }

    res.json({
      _id: user._id,
      username: user.username,
      email: user.email,
      roles: user.roles || [],
      roleNames: userWithRoles.roleNames || []
    });
  } catch (error) {
    console.error('Auth error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router; 