/**
 * Habit Tracker Module
 * ─────────────────────
 * Exports:
 *   getDashboardData(daysToShow)  – data for dashboard widget
 *   adminRouter                   – Express router for /admin/habit-tracker
 *   viewPath                      – absolute path to dashboard EJS partial
 */

const express  = require('express');
const path     = require('path');
const dayjs    = require('dayjs');
const multer   = require('multer');
const { Habit, HabitLog } = require('./model');

// ── Multer for habit photos ────────────────────────────────
const storage = multer.diskStorage({
  destination: (req, file, cb) =>
    cb(null, path.join(__dirname, '../../public/uploads')),
  filename: (req, file, cb) =>
    cb(null, `habit-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  }
});

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (daysToShow = 3) => {
  const habits = await Habit.find().sort({ order: 1, createdAt: 1 }).lean();

  // Build day list: oldest first, today last
  const days = [];
  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = dayjs().subtract(i, 'day').startOf('day');
    days.push({
      dateStr: d.format('YYYY-MM-DD'),
      label:   i === 0 ? 'Today' : d.format('ddd D'),
      isToday: i === 0,
      date:    d.toDate()
    });
  }

  // Fetch all logs for this date range
  const startDate = days[0].date;
  const endDate   = dayjs().endOf('day').toDate();
  const logs = await HabitLog.find({
    date: { $gte: startDate, $lte: endDate }
  }).lean();

  // logMap[habitId][dateStr] = log
  const logMap = {};
  logs.forEach(log => {
    const hId = log.habitId.toString();
    const dStr = dayjs(log.date).format('YYYY-MM-DD');
    if (!logMap[hId]) logMap[hId] = {};
    logMap[hId][dStr] = log;
  });

  return { habits, days, logMap, daysToShow };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

// GET /admin/habit-tracker
router.get('/', async (req, res) => {
  const Settings = require('../../models/Settings');
  const settings = await Settings.getSettings();
  const habits   = await Habit.find().sort({ order: 1, createdAt: 1 }).lean();

  res.render(path.join(__dirname, 'views', 'admin'), {
    habits,
    daysToShow: settings.modules.habitTracker
      ? settings.modules.habitTracker.daysToShow
      : 3,
    enabled: settings.modules.habitTracker
      ? settings.modules.habitTracker.enabled
      : true,
    title:      'Habit Tracker',
    activePage: 'habit-tracker',
    root:       req.app.locals.root,
    error:      req.query.error || null,
    saved:      req.query.saved || null
  });
});

// POST /admin/habit-tracker/settings  (save module settings)
router.post('/settings', async (req, res) => {
  try {
    const Settings = require('../../models/Settings');
    const settings = await Settings.getSettings();
    if (!settings.modules.habitTracker) settings.modules.habitTracker = {};
    settings.modules.habitTracker.daysToShow = Math.min(7, Math.max(1,
      parseInt(req.body.daysToShow) || 3
    ));
    settings.modules.habitTracker.enabled = req.body.habitTrackerEnabled === 'on';
    settings.markModified('modules');
    await settings.save();
    res.redirect('/admin/habit-tracker?saved=1');
  } catch (err) {
    res.redirect('/admin/habit-tracker?error=' + encodeURIComponent(err.message));
  }
});

// POST /admin/habit-tracker/habits  (create)
router.post('/habits', upload.single('photo'), async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    if (!name || !name.trim()) throw new Error('Name is required');
    const count = await Habit.countDocuments();
    await Habit.create({
      name:  name.trim(),
      icon:  icon  || '✅',
      color: color || '#7c3aed',
      photo: req.file ? '/uploads/' + req.file.filename : null,
      order: count
    });
    res.redirect('/admin/habit-tracker');
  } catch (err) {
    res.redirect('/admin/habit-tracker?error=' + encodeURIComponent(err.message));
  }
});

// POST /admin/habit-tracker/habits/:id/edit
router.post('/habits/:id/edit', upload.single('photo'), async (req, res) => {
  try {
    const { name, icon, color } = req.body;
    const update = {
      name:  name.trim(),
      icon:  icon  || '✅',
      color: color || '#7c3aed'
    };
    if (req.file) update.photo = '/uploads/' + req.file.filename;
    if (req.body.removePhoto === '1') update.photo = null;
    await Habit.findByIdAndUpdate(req.params.id, update);
    res.redirect('/admin/habit-tracker');
  } catch (err) {
    res.redirect('/admin/habit-tracker?error=' + encodeURIComponent(err.message));
  }
});

// POST /admin/habit-tracker/habits/:id/delete
router.post('/habits/:id/delete', async (req, res) => {
  await Habit.findByIdAndDelete(req.params.id);
  await HabitLog.deleteMany({ habitId: req.params.id });
  res.redirect('/admin/habit-tracker');
});

// POST /admin/habit-tracker/api/toggle  (dashboard checkbox)
router.post('/api/toggle', async (req, res) => {
  try {
    const { habitId, date, completed } = req.body;
    const dateObj    = dayjs(date).startOf('day').toDate();
    const wantDone   = completed === true || completed === 'true';
    const log = await HabitLog.findOneAndUpdate(
      { habitId, date: dateObj },
      { $set: { completed: wantDone } },
      { upsert: true, new: true }
    );
    res.json({ ok: true, completed: log.completed });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
