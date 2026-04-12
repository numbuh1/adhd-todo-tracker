const express            = require('express');
const path               = require('path');
const multer             = require('multer');
const dayjs              = require('dayjs');
const RecurringProgress  = require('./model');

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
  filename:    (req, file, cb) => cb(null, `rprog-${Date.now()}${path.extname(file.originalname)}`)
});
const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Images only'));
  }
});

const bp = req => req.app.locals.basePath || '';

// ── Helpers ────────────────────────────────────────────────

function getMondayOf(date) {
  const d   = dayjs(date);
  const dow = d.day();
  const diff = dow === 0 ? -6 : 1 - dow;
  return d.add(diff, 'day').startOf('day');
}

/** Returns the period key string for the given type + date */
function getPeriodKey(type, date) {
  const d = dayjs(date);
  if (type === 'weekly') {
    const monday = getMondayOf(d.toDate());
    return monday.format('YYYY-[W]WW');
  }
  if (type === 'monthly') return d.format('YYYY-MM');
  if (type === 'yearly')  return d.format('YYYY');
  return d.format('YYYY-MM-DD');
}

/** True if today falls inside the rule's active window */
function isInWindow(rule, date) {
  const d     = dayjs(date);
  const today = d.toDate();

  if (rule.startDate && today < new Date(rule.startDate)) return false;
  if (rule.endDate   && today > new Date(rule.endDate))   return false;

  if (rule.type === 'weekly') {
    const dow = d.day();
    const s = rule.startDow, e = rule.endDow;
    return s <= e ? (dow >= s && dow <= e) : (dow >= s || dow <= e);
  }
  if (rule.type === 'monthly') {
    const dom = d.date();
    const s = rule.startDom, e = rule.endDom;
    return s <= e ? (dom >= s && dom <= e) : (dom >= s || dom <= e);
  }
  if (rule.type === 'yearly') {
    const moy = d.month() + 1;
    const dom = d.date();
    const todayMMDD = moy * 100 + dom;
    const startMMDD = rule.startMonth * 100 + rule.startDom;
    const endMMDD   = rule.endMonth   * 100 + rule.endDom;
    return startMMDD <= endMMDD
      ? (todayMMDD >= startMMDD && todayMMDD <= endMMDD)
      : (todayMMDD >= startMMDD || todayMMDD <= endMMDD);
  }
  return false;
}

const DOW_NAMES  = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const MON_NAMES  = ['','Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

/** Build a short deadline label shown on the progress card */
function deadlineLabel(rule) {
  if (rule.type === 'weekly')  return DOW_NAMES[rule.endDow];
  if (rule.type === 'monthly') return `${rule.endDom}th`;
  if (rule.type === 'yearly')  return `${MON_NAMES[rule.endMonth]} ${rule.endDom}`;
  return '';
}

/** Human-readable schedule string for admin list */
function scheduleLabel(rule) {
  if (rule.type === 'weekly') {
    return `Weekly · ${DOW_NAMES[rule.startDow]}–${DOW_NAMES[rule.endDow]}`;
  }
  if (rule.type === 'monthly') {
    return `Monthly · day ${rule.startDom}–${rule.endDom}`;
  }
  if (rule.type === 'yearly') {
    return `Yearly · ${MON_NAMES[rule.startMonth]} ${rule.startDom} – ${MON_NAMES[rule.endMonth]} ${rule.endDom}`;
  }
  return '';
}

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (userId) => {
  const today = new Date();
  const rules = await RecurringProgress.find({ userId, active: true }).lean();
  const tasks = [];

  for (const rule of rules) {
    if (!isInWindow(rule, today)) continue;
    const periodKey = getPeriodKey(rule.type, today);
    const period    = rule.periods.find(p => p.periodKey === periodKey);
    const progress  = period ? period.progress : 0;
    const status    = period ? period.status   : 'idle';

    tasks.push({
      _id:          rule._id.toString(),
      name:         rule.name,
      description:  rule.description,
      icon:         rule.icon,
      color:        rule.color,
      photo:        rule.photo || null,
      progress,
      status,
      deadlineLabel: deadlineLabel(rule),
      isRecurring:  true,
      periodKey,
      ruleType:     rule.type
    });
  }

  return { tasks };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

// List page
router.get('/', async (req, res) => {
  const rules = await RecurringProgress.find({ userId: req.session.userId }).sort({ createdAt: -1 }).lean();
  res.render(path.join(__dirname, 'views', 'admin'), {
    rules,
    scheduleLabel,
    title: 'Recurring Progress',
    activePage: 'recurring-progress',
    root: req.app.locals.root,
    saved:  req.query.saved  || null,
    error:  req.query.error  || null
  });
});

// Create rule
router.post('/rules', upload.single('photo'), async (req, res) => {
  try {
    const uid = req.session.userId;
    const b   = req.body;
    if (!b.name || !b.name.trim()) throw new Error('Name is required.');
    await RecurringProgress.create({
      userId:      uid,
      name:        b.name.trim(),
      description: (b.description || '').trim(),
      icon:        (b.icon  || '📊').trim(),
      color:       b.color  || '#7c3aed',
      type:        b.type   || 'weekly',
      startDow:    parseInt(b.startDow)   || 1,
      endDow:      parseInt(b.endDow)     || 0,
      startDom:    parseInt(b.startDom)   || 1,
      endDom:      parseInt(b.endDom)     || 28,
      startMonth:  parseInt(b.startMonth) || 1,
      endMonth:    parseInt(b.endMonth)   || 12,
      startDate:   b.startDate ? new Date(b.startDate) : null,
      endDate:     b.endDate   ? new Date(b.endDate)   : null,
      photo:       req.file ? '/uploads/' + req.file.filename : null,
      active:      true
    });
    res.redirect(bp(req) + '/admin/recurring-progress?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/recurring-progress?error=' + encodeURIComponent(err.message));
  }
});

// Edit rule
router.post('/rules/:id/edit', upload.single('photo'), async (req, res) => {
  try {
    const b = req.body;
    const update = {
      name:        (b.name || '').trim(),
      description: (b.description || '').trim(),
      icon:        (b.icon  || '📊').trim(),
      color:       b.color  || '#7c3aed',
      type:        b.type   || 'weekly',
      startDow:    parseInt(b.startDow)   || 1,
      endDow:      parseInt(b.endDow)     || 0,
      startDom:    parseInt(b.startDom)   || 1,
      endDom:      parseInt(b.endDom)     || 28,
      startMonth:  parseInt(b.startMonth) || 1,
      endMonth:    parseInt(b.endMonth)   || 12,
      startDate:   b.startDate ? new Date(b.startDate) : null,
      endDate:     b.endDate   ? new Date(b.endDate)   : null
    };
    if (req.file)                    update.photo = '/uploads/' + req.file.filename;
    if (b.removePhoto === '1')        update.photo = null;
    await RecurringProgress.findOneAndUpdate(
      { _id: req.params.id, userId: req.session.userId },
      update
    );
    res.redirect(bp(req) + '/admin/recurring-progress?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/recurring-progress?error=' + encodeURIComponent(err.message));
  }
});

// Toggle active
router.post('/rules/:id/toggle-active', async (req, res) => {
  try {
    const rule = await RecurringProgress.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!rule) return res.json({ ok: false, error: 'Not found' });
    rule.active = !rule.active;
    await rule.save();
    res.json({ ok: true, active: rule.active });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Delete rule
router.post('/rules/:id/delete', async (req, res) => {
  try {
    await RecurringProgress.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.redirect(bp(req) + '/admin/recurring-progress');
  } catch (err) {
    res.redirect(bp(req) + '/admin/recurring-progress?error=' + encodeURIComponent(err.message));
  }
});

// ── Dashboard APIs ─────────────────────────────────────────

// Update progress for a period
router.post('/api/update-progress', async (req, res) => {
  try {
    const { ruleId, periodKey, progress } = req.body;
    const pct  = Math.min(100, Math.max(0, parseInt(progress) || 0));
    const rule = await RecurringProgress.findOne({ _id: ruleId, userId: req.session.userId });
    if (!rule) return res.json({ ok: false, error: 'Rule not found' });

    let period = rule.periods.find(p => p.periodKey === periodKey);
    if (period) {
      period.progress = pct;
    } else {
      rule.periods.push({ periodKey, progress: pct, status: 'idle' });
    }
    rule.markModified('periods');
    await rule.save();
    res.json({ ok: true, progress: pct });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Toggle status for a period
router.post('/api/toggle-status', async (req, res) => {
  try {
    const { ruleId, periodKey } = req.body;
    const rule = await RecurringProgress.findOne({ _id: ruleId, userId: req.session.userId });
    if (!rule) return res.json({ ok: false, error: 'Rule not found' });

    let period = rule.periods.find(p => p.periodKey === periodKey);
    if (!period) {
      rule.periods.push({ periodKey, progress: 0, status: 'idle' });
      period = rule.periods[rule.periods.length - 1];
    }
    period.status = period.status === 'in-progress' ? 'idle' : 'in-progress';
    rule.markModified('periods');
    await rule.save();
    res.json({ ok: true, status: period.status });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  scheduleLabel
};
