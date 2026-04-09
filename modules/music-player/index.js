/**
 * Music Player Module
 * ─────────────────────
 * Local-file player — audio never leaves the user's device.
 * The server only stores display preferences (showSongName, showJacket,
 * showPlaylist). All playback is handled entirely in the browser.
 *
 * Exports:
 *   getDashboardData()  – display settings for the widget
 *   adminRouter         – Express router for /admin/music-player
 *   viewPath            – absolute path to dashboard EJS partial
 */

const express = require('express');
const path    = require('path');

// ── Dashboard data ─────────────────────────────────────────
// Only returns the display-preference flags; no song data from the server.
const getDashboardData = async () => {
  const Settings = require('../../models/Settings');
  const settings = await Settings.getSettings();
  const ms = (settings.modules && settings.modules.musicPlayer) || {};

  return {
    showSongName: ms.showSongName !== false,
    showJacket:   ms.showJacket   !== false,
    showPlaylist: ms.showPlaylist  !== false
  };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

// GET /admin/music-player
router.get('/', async (req, res) => {
  const Settings = require('../../models/Settings');
  const settings = await Settings.getSettings();
  const ms = (settings.modules && settings.modules.musicPlayer) || {};

  res.render(path.join(__dirname, 'views', 'admin'), {
    ms,
    title:      'Music Player',
    activePage: 'music-player',
    root:       req.app.locals.root,
    error:      req.query.error || null,
    saved:      req.query.saved || null
  });
});

// POST /admin/music-player/settings
router.post('/settings', async (req, res) => {
  try {
    const Settings = require('../../models/Settings');
    const settings = await Settings.getSettings();
    if (!settings.modules.musicPlayer) settings.modules.musicPlayer = {};
    const mp = settings.modules.musicPlayer;
    mp.enabled      = req.body.musicPlayerEnabled === 'on';
    mp.showSongName = req.body.showSongName        === 'on';
    mp.showJacket   = req.body.showJacket          === 'on';
    mp.showPlaylist = req.body.showPlaylist         === 'on';
    settings.markModified('modules');
    await settings.save();
    res.redirect('/admin/music-player?saved=1');
  } catch (err) {
    res.redirect('/admin/music-player?error=' + encodeURIComponent(err.message));
  }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath:    path.join(__dirname, 'views', 'view.ejs')
};
