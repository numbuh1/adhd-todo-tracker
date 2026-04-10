const express       = require('express');
const path          = require('path');
const dayjs         = require('dayjs');
const CalendarEvent = require('./model');

const bp = req => req.app.locals.basePath || '';

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (userId) => {
  const now          = dayjs();
  const startOfMonth = now.startOf('month').toDate();
  const endOfMonth   = now.endOf('month').toDate();

  const events = await CalendarEvent.find({
    userId,
    date: { $gte: startOfMonth, $lte: endOfMonth }
  }).sort({ date: 1 }).lean();

  const eventsByDay = {};
  events.forEach(ev => {
    const key = dayjs(ev.date).format('YYYY-MM-DD');
    if (!eventsByDay[key]) eventsByDay[key] = [];
    eventsByDay[key].push(ev);
  });

  const upcomingEvents = await CalendarEvent.find({
    userId,
    date: { $gte: now.startOf('day').toDate() }
  }).sort({ date: 1 }).limit(8).lean();

  return {
    currentMonth:    now.format('MMMM YYYY'),
    monthNumber:     now.month() + 1,
    year:            now.year(),
    today:           now.format('YYYY-MM-DD'),
    daysInMonth:     now.daysInMonth(),
    firstDayOfMonth: now.startOf('month').day(),
    eventsByDay,
    upcomingEvents
  };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.session.userId;
  const events = await CalendarEvent.find({ userId }).sort({ date: 1 }).lean();
  res.render(path.join(__dirname, 'views', 'admin'), {
    events, dayjs,
    title: 'Calendar & Events', activePage: 'calendar',
    root: req.app.locals.root, error: req.query.error || null
  });
});

router.post('/events', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { date, title, description, color } = req.body;
    if (!date || !title) throw new Error('Date and title are required.');
    await CalendarEvent.create({ userId, date, title, description, color });
    res.redirect(bp(req) + '/admin/calendar');
  } catch (err) {
    res.redirect(bp(req) + '/admin/calendar?error=' + encodeURIComponent(err.message));
  }
});

router.post('/events/:id/edit', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { date, title, description, color } = req.body;
    await CalendarEvent.findOneAndUpdate({ _id: req.params.id, userId }, { date, title, description, color });
    res.redirect(bp(req) + '/admin/calendar');
  } catch (err) {
    res.redirect(bp(req) + '/admin/calendar?error=' + encodeURIComponent(err.message));
  }
});

router.post('/events/:id/delete', async (req, res) => {
  await CalendarEvent.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
  res.redirect(bp(req) + '/admin/calendar');
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
