const express = require('express');
const router  = express.Router();
const User    = require('../models/User');

const bp = req => req.app.locals.basePath || '';

// GET /login
router.get('/login', (req, res) => {
  if (req.session.userId) return res.redirect(bp(req) + '/');
  res.render('auth/login', {
    title: 'Login',
    error: req.query.error || null,
    root:  req.app.locals.root
  });
});

// POST /login
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    if (!username || !password) throw new Error('Username and password are required.');

    const user = await User.findOne({ username: username.trim().toLowerCase() });
    if (!user) throw new Error('Invalid username or password.');

    const ok = await user.verifyPassword(password);
    if (!ok)  throw new Error('Invalid username or password.');

    req.session.userId      = user._id.toString();
    req.session.username    = user.displayName || user.username;
    req.session.rawUsername = user.username;
    res.redirect(bp(req) + '/');
  } catch (err) {
    res.redirect(bp(req) + '/login?error=' + encodeURIComponent(err.message));
  }
});

// GET /register
router.get('/register', (req, res) => {
  if (req.session.userId) return res.redirect(bp(req) + '/');
  res.render('auth/register', {
    title: 'Create Account',
    error: req.query.error || null,
    root:  req.app.locals.root
  });
});

// POST /register
router.post('/register', async (req, res) => {
  try {
    const { username, displayName, password, confirm } = req.body;
    if (!username || !password)     throw new Error('Username and password are required.');
    if (password !== confirm)       throw new Error('Passwords do not match.');
    if (password.length < 6)        throw new Error('Password must be at least 6 characters.');
    if (username.length < 3)        throw new Error('Username must be at least 3 characters.');
    if (!/^[a-z0-9_]+$/i.test(username)) throw new Error('Username can only contain letters, numbers and underscores.');

    const exists = await User.findOne({ username: username.trim().toLowerCase() });
    if (exists) throw new Error('That username is already taken.');

    const user = await User.create({
      username:    username.trim().toLowerCase(),
      displayName: (displayName || username).trim(),
      password
    });

    req.session.userId      = user._id.toString();
    req.session.username    = user.displayName || user.username;
    req.session.rawUsername = user.username;
    res.redirect(bp(req) + '/');
  } catch (err) {
    res.redirect(bp(req) + '/register?error=' + encodeURIComponent(err.message));
  }
});

// POST /logout
router.post('/logout', (req, res) => {
  const base = bp(req);
  req.session.destroy(() => res.redirect(base + '/login'));
});

module.exports = router;
