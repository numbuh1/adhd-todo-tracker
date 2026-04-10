const express  = require('express');
const path     = require('path');
const Settings = require('../../models/Settings');

const bp = req => req.app.locals.basePath || '';

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (userId) => {
  const settings = await Settings.getSettings(userId);
  return {
    lastUrl: settings.modules.videoPlayer?.lastUrl || ''
  };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

router.get('/', async (req, res) => {
  const settings = await Settings.getSettings(req.session.userId);
  res.render(path.join(__dirname, 'views', 'admin'), {
    vs:    settings.modules.videoPlayer || {},
    title: 'Video Player',
    activePage: 'video-player',
    root:  req.app.locals.root,
    saved: req.query.saved || null,
    error: req.query.error || null
  });
});

router.post('/settings', async (req, res) => {
  try {
    const settings = await Settings.getSettings(req.session.userId);
    if (!settings.modules.videoPlayer) settings.modules.videoPlayer = {};
    settings.modules.videoPlayer.enabled  = req.body.videoPlayerEnabled === 'on';
    settings.modules.videoPlayer.lastUrl  = (req.body.defaultUrl || '').trim();
    settings.markModified('modules');
    await settings.save();
    res.redirect(bp(req) + '/admin/video-player?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/video-player?error=' + encodeURIComponent(err.message));
  }
});

// API: save current URL (called from dashboard)
router.post('/api/save-url', async (req, res) => {
  try {
    const { url } = req.body;
    const settings = await Settings.getSettings(req.session.userId);
    if (!settings.modules.videoPlayer) settings.modules.videoPlayer = {};
    settings.modules.videoPlayer.lastUrl = (url || '').trim();
    settings.markModified('modules');
    await settings.save();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
