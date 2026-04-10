const express = require('express');
const path    = require('path');

const bp = req => req.app.locals.basePath || '';

const getDashboardData = async (userId) => {
  const Settings = require('../../models/Settings');
  const settings = await Settings.getSettings(userId);
  const ms = (settings.modules && settings.modules.musicPlayer) || {};
  return {
    showSongName: ms.showSongName !== false,
    showJacket:   ms.showJacket   !== false,
    showPlaylist: ms.showPlaylist  !== false
  };
};

const router = express.Router();

router.get('/', async (req, res) => {
  const Settings = require('../../models/Settings');
  const settings = await Settings.getSettings(req.session.userId);
  const ms = (settings.modules && settings.modules.musicPlayer) || {};
  res.render(path.join(__dirname, 'views', 'admin'), {
    ms, title: 'Music Player', activePage: 'music-player',
    root: req.app.locals.root, error: req.query.error || null, saved: req.query.saved || null
  });
});

router.post('/settings', async (req, res) => {
  try {
    const Settings = require('../../models/Settings');
    const settings = await Settings.getSettings(req.session.userId);
    if (!settings.modules.musicPlayer) settings.modules.musicPlayer = {};
    const mp = settings.modules.musicPlayer;
    mp.enabled      = req.body.musicPlayerEnabled === 'on';
    mp.showSongName = req.body.showSongName        === 'on';
    mp.showJacket   = req.body.showJacket          === 'on';
    mp.showPlaylist = req.body.showPlaylist         === 'on';
    settings.markModified('modules');
    await settings.save();
    res.redirect(bp(req) + '/admin/music-player?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/music-player?error=' + encodeURIComponent(err.message));
  }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath:    path.join(__dirname, 'views', 'view.ejs')
};
