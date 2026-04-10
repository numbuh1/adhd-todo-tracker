const express       = require('express');
const path          = require('path');
const RecurringTodo = require('./model');

const bp = req => req.app.locals.basePath || '';

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (userId) => {
  const today = new Date();
  const ymd   = today.toISOString().slice(0, 10);
  const items = await RecurringTodo.getTodayItems(userId, today);
  return { items, todayYmd: ymd };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

// List all rules
router.get('/', async (req, res) => {
  const rules = await RecurringTodo.find({ userId: req.session.userId })
    .sort({ active: -1, createdAt: 1 }).lean();

  // Attach human-readable schedule label
  const enriched = rules.map(r => ({ ...r, scheduleLabel: scheduleLabel(r) }));

  res.render(path.join(__dirname, 'views', 'admin'), {
    rules: enriched,
    dayNames:   DAY_NAMES,
    monthNames: MONTH_NAMES,
    title:      'Recurring To-Dos',
    activePage: 'recurring-todos',
    root:       req.app.locals.root,
    saved:      req.query.saved  || null,
    error:      req.query.error  || null
  });
});

// Create
router.post('/rules', async (req, res) => {
  try {
    const b = req.body;
    if (!b.text || !b.text.trim()) throw new Error('Text is required.');
    if (!['weekly','monthly','yearly'].includes(b.type)) throw new Error('Invalid type.');

    const rule = { userId: req.session.userId, text: b.text.trim(), type: b.type };

    if (b.type === 'weekly') {
      const dow = parseInt(b.dayOfWeek, 10);
      if (isNaN(dow) || dow < 0 || dow > 6) throw new Error('Invalid day of week.');
      rule.dayOfWeek = dow;
    } else if (b.type === 'monthly') {
      const dom = parseInt(b.dayOfMonth, 10);
      if (isNaN(dom) || dom < 1 || dom > 31) throw new Error('Invalid day of month.');
      rule.dayOfMonth = dom;
    } else {
      const dom = parseInt(b.dayOfMonth, 10);
      const moy = parseInt(b.monthOfYear, 10);
      if (isNaN(dom) || dom < 1 || dom > 31) throw new Error('Invalid day.');
      if (isNaN(moy) || moy < 1 || moy > 12) throw new Error('Invalid month.');
      rule.dayOfMonth  = dom;
      rule.monthOfYear = moy;
    }

    if (b.startDate) rule.startDate = new Date(b.startDate);
    if (b.endDate   && b.endDate.trim()) rule.endDate = new Date(b.endDate);

    await RecurringTodo.create(rule);
    res.redirect(bp(req) + '/admin/recurring-todos?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/recurring-todos?error=' + encodeURIComponent(err.message));
  }
});

// Edit
router.post('/rules/:id/edit', async (req, res) => {
  try {
    const b    = req.body;
    const rule = await RecurringTodo.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!rule) throw new Error('Not found.');

    if (b.text && b.text.trim()) rule.text = b.text.trim();
    rule.type = b.type || rule.type;

    if (rule.type === 'weekly') {
      rule.dayOfWeek  = parseInt(b.dayOfWeek, 10);
    } else if (rule.type === 'monthly') {
      rule.dayOfMonth  = parseInt(b.dayOfMonth, 10);
    } else {
      rule.dayOfMonth  = parseInt(b.dayOfMonth, 10);
      rule.monthOfYear = parseInt(b.monthOfYear, 10);
    }

    if (b.startDate) rule.startDate = new Date(b.startDate);
    rule.endDate = (b.endDate && b.endDate.trim()) ? new Date(b.endDate) : null;

    await rule.save();
    res.redirect(bp(req) + '/admin/recurring-todos?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/recurring-todos?error=' + encodeURIComponent(err.message));
  }
});

// Toggle active/hidden
router.post('/rules/:id/toggle-active', async (req, res) => {
  try {
    const rule = await RecurringTodo.findOne({ _id: req.params.id, userId: req.session.userId });
    if (!rule) throw new Error('Not found.');
    rule.active = !rule.active;
    await rule.save();
    res.redirect(bp(req) + '/admin/recurring-todos');
  } catch (err) {
    res.redirect(bp(req) + '/admin/recurring-todos?error=' + encodeURIComponent(err.message));
  }
});

// Delete
router.post('/rules/:id/delete', async (req, res) => {
  try {
    await RecurringTodo.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.redirect(bp(req) + '/admin/recurring-todos');
  } catch (err) {
    res.redirect(bp(req) + '/admin/recurring-todos?error=' + encodeURIComponent(err.message));
  }
});

// Toggle completion for today (called from dashboard)
router.post('/api/toggle', async (req, res) => {
  try {
    const { ruleId, date, completed } = req.body;
    const rule = await RecurringTodo.findOne({ _id: ruleId, userId: req.session.userId });
    if (!rule) return res.json({ ok: false, error: 'Not found' });

    const ymd = (date || new Date().toISOString().slice(0, 10));
    if (completed === true || completed === 'true') {
      if (!rule.completions.includes(ymd)) rule.completions.push(ymd);
    } else {
      rule.completions = rule.completions.filter(d => d !== ymd);
    }
    await rule.save();
    res.json({ ok: true, completed: rule.completions.includes(ymd) });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// ── Schedule label helper ──────────────────────────────────
function scheduleLabel(r) {
  if (r.type === 'weekly')
    return 'Every ' + DAY_NAMES[r.dayOfWeek];
  if (r.type === 'monthly')
    return 'Monthly on the ' + ordinal(r.dayOfMonth);
  if (r.type === 'yearly')
    return 'Yearly on ' + MONTH_NAMES[r.monthOfYear - 1] + ' ' + ordinal(r.dayOfMonth);
  return '';
}

function ordinal(n) {
  const s = ['th','st','nd','rd'];
  const v = n % 100;
  return n + (s[(v-20)%10] || s[v] || s[0]);
}

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
