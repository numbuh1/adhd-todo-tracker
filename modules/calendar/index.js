/**
 * Calendar & Events Module
 * ─────────────────────────
 * Exports:
 *   getDashboardData()  – data for the dashboard widget
 *   adminRouter         – Express router for /admin/calendar
 *   viewPath            – absolute path to the dashboard EJS partial
 */

const express    = require('express');
const path       = require('path');
const dayjs      = require('dayjs');
const CalendarEvent = require('./model');

// ── Dashboard data ─────────────────────────────────────────────────────────────
const getDashboardData = async () => {
  const now          = dayjs();
  const startOfMonth = now.startOf('month').toDate();
  const endOfMonth   = now.endOf('month').toDate();

  const events = await CalendarEvent.find({
    date: { $gte: startOfMonth, $lte: endOfMonth }
  }).sort({ date: 1 }).lean();

  // Group events by YYYY-MM-DD key for quick lookup in the template
  const eventsByDay = {};
  events.forEach(ev => {
    const key = dayjs(ev.date).format('YYYY-MM-DD');
    if (!eventsByDay[key]) eventsByDay[key] = [];
    eventsByDay[key].push(ev);
  });

  // Also get upcoming events for the list below the calendar
  const upcomingEvents = await CalendarEvent.find({
    date: { $gte: now.startOf('day').toDate() }
  }).sort({ date: 1 }).limit(8).lean();

  return {
    currentMonth:   now.format('MMMM YYYY'),
    monthNumber:    now.month() + 1,       // 1-12
    year:           now.year(),
    today:          now.format('YYYY-MM-DD'),
    daysInMonth:    now.daysInMonth(),
    firstDayOfMonth: now.startOf('month').day(), // 0=Sun
    eventsByDay,
    upcomingEvents
  };
};

// ── Admin router ───────────────────────────────────────────────────────────────
const router = express.Router();

// GET /admin/calendar
router.get('/', async (req, res) => {
  const events = await CalendarEvent.find().sort({ date: 1 }).lean();
  res.render(path.join(__dirname, 'views', 'admin'), {
    events,
    dayjs,
    title: 'Calendar & Events',
    activePage: 'calendar',
    root: req.app.locals.root,
    error: req.query.error || null
  });
});

// POST /admin/calendar/events  (create)
router.post('/events', async (req, res) => {
  try {
    const { date, title, description, color } = req.body;
    if (!date || !title) throw new Error('Date and title are required.');
    await CalendarEvent.create({ date, title, description, color });
    res.redirect('/admin/calendar');
  } catch (err) {
    res.redirect('/admin/calendar?error=' + encodeURIComponent(err.message));
  }
});

// POST /admin/calendar/events/:id/edit  (update)
router.post('/events/:id/edit', async (req, res) => {
  try {
    const { date, title, description, color } = req.body;
    await CalendarEvent.findByIdAndUpdate(req.params.id, { date, title, description, color });
    res.redirect('/admin/calendar');
  } catch (err) {
    res.redirect('/admin/calendar?error=' + encodeURIComponent(err.message));
  }
});

// POST /admin/calendar/events/:id/delete  (delete)
router.post('/events/:id/delete', async (req, res) => {
  await CalendarEvent.findByIdAndDelete(req.params.id);
  res.redirect('/admin/calendar');
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
