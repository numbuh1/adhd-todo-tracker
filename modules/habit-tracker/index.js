const express  = require('express');
const path     = require('path');
const dayjs    = require('dayjs');
const multer   = require('multer');
const { Habit, HabitLog } = require('./model');

const bp = req => req.app.locals.basePath || '';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
  filename:    (req, file, cb) => cb(null, `habit-${Date.now()}${path.extname(file.originalname)}`)
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
const getDashboardData = async (userId, daysToShow = 3) => {
  const habits = await Habit.find({ userId }).sort({ order: 1, createdAt: 1 }).lean();

  const days = [];
  for (let i = daysToShow - 1; i >= 0; i--) {
    const d = dayjs().subtract(i, 'day').startOf('day');
    days.push({ dateStr: d.format('YYYY-MM-DD'), label: i === 0 ? 'Today' : d.format('ddd D'), isToday: i === 0, date: d.toDate() });
  }

  const habitIds  = habits.map(h => h._id);
  const startDate = days[0].date;
  const endDate   = dayjs().endOf('day').toDate();
  const logs = await HabitLog.find({
    habitId: { $in: habitIds },
    date:    { $gte: startDate, $lte: endDate }
  }).lean();

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

router.get('/', async (req, res) => {
  const Settings = require('../../models/Settings');
  const userId   = req.session.userId;
  const settings = await Settings.getSettings(userId);
  const habits   = await Habit.find({ userId }).sort({ order: 1, createdAt: 1 }).lean();
  res.render(path.join(__dirname, 'views', 'admin'), {
    habits,
    daysToShow: settings.modules.habitTracker?.daysToShow ?? 3,
    enabled:    settings.modules.habitTracker?.enabled    ?? true,
    title: 'Habit Tracker', activePage: 'habit-tracker',
    root: req.app.locals.root, error: req.query.error || null, saved: req.query.saved || null
  });
});

router.post('/settings', async (req, res) => {
  try {
    const Settings = require('../../models/Settings');
    const userId   = req.session.userId;
    const settings = await Settings.getSettings(userId);
    if (!settings.modules.habitTracker) settings.modules.habitTracker = {};
    settings.modules.habitTracker.daysToShow = Math.min(7, Math.max(1, parseInt(req.body.daysToShow) || 3));
    settings.modules.habitTracker.enabled    = req.body.habitTrackerEnabled === 'on';
    settings.markModified('modules');
    await settings.save();
    res.redirect(bp(req) + '/admin/habit-tracker?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/habit-tracker?error=' + encodeURIComponent(err.message));
  }
});

router.post('/habits', upload.single('photo'), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, icon, color } = req.body;
    if (!name || !name.trim()) throw new Error('Name is required');
    const count = await Habit.countDocuments({ userId });
    await Habit.create({ userId, name: name.trim(), icon: icon || '✅', color: color || '#7c3aed', photo: req.file ? '/uploads/' + req.file.filename : null, order: count });
    res.redirect(bp(req) + '/admin/habit-tracker');
  } catch (err) {
    res.redirect(bp(req) + '/admin/habit-tracker?error=' + encodeURIComponent(err.message));
  }
});

router.post('/habits/:id/edit', upload.single('photo'), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, icon, color } = req.body;
    const update = { name: name.trim(), icon: icon || '✅', color: color || '#7c3aed' };
    if (req.file)                  update.photo = '/uploads/' + req.file.filename;
    if (req.body.removePhoto==='1') update.photo = null;
    await Habit.findOneAndUpdate({ _id: req.params.id, userId }, update);
    res.redirect(bp(req) + '/admin/habit-tracker');
  } catch (err) {
    res.redirect(bp(req) + '/admin/habit-tracker?error=' + encodeURIComponent(err.message));
  }
});

router.post('/habits/:id/delete', async (req, res) => {
  const userId = req.session.userId;
  await Habit.findOneAndDelete({ _id: req.params.id, userId });
  await HabitLog.deleteMany({ habitId: req.params.id });
  res.redirect(bp(req) + '/admin/habit-tracker');
});

router.post('/api/toggle', async (req, res) => {
  try {
    const { habitId, date, completed } = req.body;
    const userId  = req.session.userId;
    // Verify habit belongs to user
    const habit = await Habit.findOne({ _id: habitId, userId });
    if (!habit) return res.json({ ok: false, error: 'Habit not found' });
    const dateObj  = dayjs(date).startOf('day').toDate();
    const wantDone = completed === true || completed === 'true';
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
