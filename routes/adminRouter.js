const express       = require('express');
const path          = require('path');
const multer        = require('multer');
const router        = express.Router();

const Settings        = require('../models/Settings');
const LayoutProfile   = require('../models/LayoutProfile');
const liveUpdates     = require('../lib/liveUpdates');
const calendarMod     = require('../modules/calendar/index');
const weeklyMod       = require('../modules/weekly-todos/index');
const habitMod        = require('../modules/habit-tracker/index');
const musicMod        = require('../modules/music-player/index');
const progressMod     = require('../modules/progress/index');
const overallTodosMod = require('../modules/overall-todos/index');
const videoPlayerMod  = require('../modules/video-player/index');

const bp = req => req.app.locals.basePath || '';

// ── SSE notify on mutating POST requests ──────────────────
// Excluded: grid-layout saves, layout-profile ops, video save-url
// (these don't change content that the dashboard displays)
const SSE_SKIP = [
  '/settings/grid-layout',
  '/layout-profiles',
  '/video-player/api/save-url'
];
router.use((req, res, next) => {
  if (req.method !== 'POST') return next();
  const skip = SSE_SKIP.some(p => req.path === p || req.path.startsWith('/layout-profiles/'));
  if (skip) return next();
  const origJson     = res.json.bind(res);
  const origRedirect = res.redirect.bind(res);
  res.json = function (data) {
    if (data && data.ok !== false) liveUpdates.notify(req.session.userId);
    return origJson(data);
  };
  res.redirect = function (...args) {
    liveUpdates.notify(req.session.userId);
    return origRedirect(...args);
  };
  next();
});

// ── Multer for wallpaper uploads ───────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../public/uploads')),
  filename:    (req, file, cb) => cb(null, `wp-${req.session.userId}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Only image files allowed'));
  }
});

// ── Admin home ─────────────────────────────────────────────
router.get('/', async (req, res) => {
  const settings = await Settings.getSettings(req.session.userId);
  res.render('admin/index', {
    settings, title: 'Admin Dashboard',
    activePage: 'home', root: req.app.locals.root
  });
});

// ── Settings ───────────────────────────────────────────────
router.get('/settings', async (req, res) => {
  const settings = await Settings.getSettings(req.session.userId);
  res.render('admin/settings', {
    settings, title: 'Settings', activePage: 'settings',
    root: req.app.locals.root,
    saved: req.query.saved || null, error: req.query.error || null
  });
});

router.post('/settings', upload.single('wallpaper'), async (req, res) => {
  try {
    const settings = await Settings.getSettings(req.session.userId);
    const b = req.body;

    settings.theme.accentColor      = b.accentColor      || settings.theme.accentColor;
    settings.theme.backgroundColor  = b.backgroundColor  || settings.theme.backgroundColor;
    settings.theme.cardColor        = b.cardColor        || settings.theme.cardColor;
    settings.theme.textColor        = b.textColor        || settings.theme.textColor;
    settings.theme.wallpaperOpacity = parseFloat(b.wallpaperOpacity) || settings.theme.wallpaperOpacity;
    if (b.moduleOpacity !== undefined) settings.theme.moduleOpacity = parseFloat(b.moduleOpacity);

    if (req.file)                  settings.theme.wallpaper = '/uploads/' + req.file.filename;
    if (b.removeWallpaper === '1') settings.theme.wallpaper = null;

    settings.modules.calendar.enabled    = b.calendarEnabled    === 'on';
    settings.modules.weeklyTodos.enabled = b.weeklyTodosEnabled === 'on';

    if (!settings.modules.habitTracker) settings.modules.habitTracker = {};
    settings.modules.habitTracker.enabled = b.habitTrackerEnabled === 'on';

    if (!settings.modules.musicPlayer) settings.modules.musicPlayer = {};
    settings.modules.musicPlayer.enabled = b.musicPlayerEnabled === 'on';

    if (!settings.modules.progress) settings.modules.progress = {};
    settings.modules.progress.enabled = b.progressEnabled === 'on';

    if (!settings.modules.overallTodos) settings.modules.overallTodos = {};
    settings.modules.overallTodos.enabled = b.overallTodosEnabled === 'on';

    if (!settings.modules.videoPlayer) settings.modules.videoPlayer = {};
    settings.modules.videoPlayer.enabled = b.videoPlayerEnabled === 'on';

    settings.markModified('modules');
    settings.markModified('theme');
    await settings.save();
    res.redirect(bp(req) + '/admin/settings?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/settings?error=' + encodeURIComponent(err.message));
  }
});

// ── Grid layout (auto-saved from dashboard drag/resize) ────
router.post('/settings/grid-layout', async (req, res) => {
  try {
    const { layout } = req.body;
    if (!layout || typeof layout !== 'object') return res.json({ ok: false, error: 'Invalid layout' });
    const settings = await Settings.getSettings(req.session.userId);
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

// ── Layout Profiles ────────────────────────────────────────
// GET  /admin/layout-profiles        → list as JSON
router.get('/layout-profiles', async (req, res) => {
  const profiles = await LayoutProfile.find({ userId: req.session.userId })
    .sort({ createdAt: -1 }).lean();
  res.json(profiles);
});

// POST /admin/layout-profiles        → create
router.post('/layout-profiles', async (req, res) => {
  try {
    const { name, gridLayout } = req.body;
    if (!name || !name.trim()) return res.json({ ok: false, error: 'Name is required' });
    const profile = await LayoutProfile.create({
      userId:     req.session.userId,
      name:       name.trim(),
      gridLayout: gridLayout || {}
    });
    res.json({ ok: true, profile });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// POST /admin/layout-profiles/:id/load → apply to settings
router.post('/layout-profiles/:id/load', async (req, res) => {
  try {
    const profile = await LayoutProfile.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!profile) return res.json({ ok: false, error: 'Profile not found' });
    const settings = await Settings.getSettings(req.session.userId);
    settings.gridLayout = profile.gridLayout;
    settings.markModified('gridLayout');
    await settings.save();
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// POST /admin/layout-profiles/:id/rename
router.post('/layout-profiles/:id/rename', async (req, res) => {
  try {
    const { name } = req.body;
    if (!name || !name.trim()) return res.json({ ok: false, error: 'Name required' });
    await LayoutProfile.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      { name: name.trim() }
    );
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// POST /admin/layout-profiles/:id/delete
router.post('/layout-profiles/:id/delete', async (req, res) => {
  try {
    await LayoutProfile.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.json({ ok: true });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ── Module admin routers ───────────────────────────────────
router.use('/calendar',       calendarMod.adminRouter);
router.use('/weekly-todos',   weeklyMod.adminRouter);
router.use('/habit-tracker',  habitMod.adminRouter);
router.use('/music-player',   musicMod.adminRouter);
router.use('/progress',       progressMod.adminRouter);
router.use('/overall-todos',  overallTodosMod.adminRouter);
router.use('/video-player',   videoPlayerMod.adminRouter);

module.exports = router;
