const express = require('express');
const path    = require('path');
const multer  = require('multer');
const router  = express.Router();

const Settings    = require('../models/Settings');
const calendarMod = require('../modules/calendar/index');
const weeklyMod   = require('../modules/weekly-todos/index');
const habitMod    = require('../modules/habit-tracker/index');
const musicMod    = require('../modules/music-player/index');

// ── Multer for wallpaper uploads ───────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename:    (req, file, cb) => cb(null, 'wallpaper' + path.extname(file.originalname))
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files are allowed'));
  }
});

// ── Admin home ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const settings = await Settings.getSettings();
  res.render('admin/index', {
    settings,
    title: 'Admin Dashboard',
    activePage: 'home',
    root: req.app.locals.root
  });
});

// ── Settings ───────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  const settings = await Settings.getSettings();
  res.render('admin/settings', {
    settings,
    title: 'Settings',
    activePage: 'settings',
    root: req.app.locals.root,
    saved: req.query.saved || null,
    error: req.query.error || null
  });
});

router.post('/settings', upload.single('wallpaper'), async (req, res) => {
  try {
    const settings = await Settings.getSettings();
    const b = req.body;

    settings.theme.accentColor      = b.accentColor      || settings.theme.accentColor;
    settings.theme.backgroundColor  = b.backgroundColor  || settings.theme.backgroundColor;
    settings.theme.cardColor        = b.cardColor        || settings.theme.cardColor;
    settings.theme.textColor        = b.textColor        || settings.theme.textColor;
    settings.theme.wallpaperOpacity = parseFloat(b.wallpaperOpacity) || settings.theme.wallpaperOpacity;

    if (req.file)                  settings.theme.wallpaper = '/uploads/' + req.file.filename;
    if (b.removeWallpaper === '1') settings.theme.wallpaper = null;

    settings.modules.calendar.enabled    = b.calendarEnabled    === 'on';
    settings.modules.weeklyTodos.enabled = b.weeklyTodosEnabled === 'on';

    if (!settings.modules.habitTracker) settings.modules.habitTracker = {};
    settings.modules.habitTracker.enabled = b.habitTrackerEnabled === 'on';

    if (!settings.modules.musicPlayer) settings.modules.musicPlayer = {};
    settings.modules.musicPlayer.enabled = b.musicPlayerEnabled === 'on';

    settings.markModified('modules');
    await settings.save();
    res.redirect('/admin/settings?saved=1');
  } catch (err) {
    res.redirect('/admin/settings?error=' + encodeURIComponent(err.message));
  }
});

// ── Grid layout (called from dashboard via fetch on drag/resize) ───────────────
router.post('/settings/grid-layout', async (req, res) => {
  try {
    const { layout } = req.body;           // { calendar: {x,y,w,h}, ... }
    if (!layout || typeof layout !== 'object') return res.json({ ok: false, error: 'Invalid layout' });
    const settings = await Settings.getSettings();
    if (!settings.gridLayout) settings.gridLayout = {};
    Object.keys(layout).forEach(moduleId => {
      const { x, y, w, h } = layout[moduleId];
      settings.gridLayout[moduleId] = { x, y, w, h };
    });
    settings.markModified('gridLayout');
    await settings.save();
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ── Module admin routers ───────────────────────────────────
router.use('/calendar',      calendarMod.adminRouter);
router.use('/weekly-todos',  weeklyMod.adminRouter);
router.use('/habit-tracker', habitMod.adminRouter);
router.use('/music-player',  musicMod.adminRouter);

module.exports = router;
