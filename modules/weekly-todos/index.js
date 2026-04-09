/**
 * Weekly Goals & To-Dos Module
 * ──────────────────────────────
 * Exports:
 *   getDashboardData()  – data for the dashboard widget
 *   adminRouter         – Express router for /admin/weekly-todos
 *   viewPath            – absolute path to the dashboard EJS partial
 */

const express = require('express');
const path    = require('path');
const dayjs   = require('dayjs');
const Week    = require('./model');

// ── Helper: get Monday of the week containing `date` ───────────────────────────
function getMondayOf(date) {
  const d   = dayjs(date);
  const dow = d.day(); // 0=Sun … 6=Sat
  const diff = dow === 0 ? -6 : 1 - dow;
  return d.add(diff, 'day').startOf('day');
}

// ── Dashboard data ──────────────────────────────────────────────────────────────
const getDashboardData = async () => {
  const monday  = getMondayOf(new Date());
  const weekDoc = await Week.getOrCreate(monday.format('YYYY-MM-DD'));

  return {
    weekStart: monday.format('YYYY-MM-DD'),
    weekId:    weekDoc._id.toString(),
    goals:     weekDoc.goals,
    // NOTE: Do NOT use {...day} spread on a Mongoose subdocument with {_id:false}.
    // The spread does not reliably copy schema fields (dayIndex becomes undefined).
    // Always map fields explicitly.
    days: weekDoc.days.map(day => ({
      dayIndex:  day.dayIndex,
      date:      day.date,
      todos:     day.todos.map(t => ({ _id: t._id, text: t.text, completed: t.completed })),
      dateLabel: dayjs(day.date).format('ddd D'),
      isToday:   dayjs(day.date).format('YYYY-MM-DD') === dayjs().format('YYYY-MM-DD')
    }))
  };
};

// ── Admin router ────────────────────────────────────────────────────────────────
const router = express.Router();

// GET /admin/weekly-todos  →  week selector
router.get('/', async (req, res) => {
  // Build list of the last 4 and next 2 weeks for quick navigation
  const today  = dayjs();
  const monday = getMondayOf(today.toDate());
  const weeks  = [];
  for (let offset = -4; offset <= 2; offset++) {
    const wStart = monday.add(offset * 7, 'day');
    const wEnd   = wStart.add(6, 'day');
    const doc    = await Week.findOne({ weekStart: wStart.toDate() }).lean();
    weeks.push({
      weekStart:  wStart.format('YYYY-MM-DD'),
      label:      wStart.format('MMM D') + ' – ' + wEnd.format('MMM D, YYYY'),
      isCurrent:  offset === 0,
      goalCount:  doc ? doc.goals.length : 0,
      todoCount:  doc ? doc.days.reduce((s, d) => s + d.todos.length, 0) : 0
    });
  }

  res.render(path.join(__dirname, 'views', 'admin-index'), {
    weeks,
    title: 'Weekly Goals & To-Dos',
    activePage: 'weekly-todos',
    root: req.app.locals.root
  });
});

// GET /admin/weekly-todos/:weekStart/edit  →  editor
router.get('/:weekStart/edit', async (req, res) => {
  const weekDoc = await Week.getOrCreate(req.params.weekStart);
  const monday  = dayjs(req.params.weekStart);
  const weekEnd = monday.add(6, 'day');

  res.render(path.join(__dirname, 'views', 'admin-edit'), {
    week:      weekDoc.toObject(),
    weekStart: req.params.weekStart,
    weekLabel: monday.format('MMM D') + ' – ' + weekEnd.format('MMM D, YYYY'),
    dayjs,
    title:     'Edit Week',
    activePage:'weekly-todos',
    root:      req.app.locals.root
  });
});

// ── Goals CRUD ──────────────────────────────────────────────────────────────────

// POST /admin/weekly-todos/:weekStart/goals  (create)
router.post('/:weekStart/goals', async (req, res) => {
  const { text } = req.body;
  if (text && text.trim()) {
    await Week.findOneAndUpdate(
      { weekStart: dayjs(req.params.weekStart).startOf('day').toDate() },
      { $push: { goals: { text: text.trim(), completed: false } } }
    );
  }
  res.redirect(`/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// POST /admin/weekly-todos/:weekStart/goals/:goalId/edit
router.post('/:weekStart/goals/:goalId/edit', async (req, res) => {
  const { text } = req.body;
  await Week.findOneAndUpdate(
    { weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), 'goals._id': req.params.goalId },
    { $set: { 'goals.$.text': text.trim() } }
  );
  res.redirect(`/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// POST /admin/weekly-todos/:weekStart/goals/:goalId/delete
router.post('/:weekStart/goals/:goalId/delete', async (req, res) => {
  await Week.findOneAndUpdate(
    { weekStart: dayjs(req.params.weekStart).startOf('day').toDate() },
    { $pull: { goals: { _id: req.params.goalId } } }
  );
  res.redirect(`/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// ── Daily Todos CRUD ────────────────────────────────────────────────────────────

// POST /admin/weekly-todos/:weekStart/days/:dayIndex/todos  (create)
router.post('/:weekStart/days/:dayIndex/todos', async (req, res) => {
  const { text } = req.body;
  const dayIdx   = parseInt(req.params.dayIndex);
  if (text && text.trim()) {
    await Week.findOneAndUpdate(
      { weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), 'days.dayIndex': dayIdx },
      { $push: { 'days.$.todos': { text: text.trim(), completed: false } } }
    );
  }
  res.redirect(`/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// POST /admin/weekly-todos/:weekStart/days/:dayIndex/todos/:todoId/edit
router.post('/:weekStart/days/:dayIndex/todos/:todoId/edit', async (req, res) => {
  const { text } = req.body;
  const week = await Week.findOne({
    weekStart: dayjs(req.params.weekStart).startOf('day').toDate()
  });
  if (week) {
    const day = week.days.find(d => d.dayIndex === parseInt(req.params.dayIndex));
    if (day) {
      const todo = day.todos.id(req.params.todoId);
      if (todo) { todo.text = text.trim(); await week.save(); }
    }
  }
  res.redirect(`/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// POST /admin/weekly-todos/:weekStart/days/:dayIndex/todos/:todoId/delete
router.post('/:weekStart/days/:dayIndex/todos/:todoId/delete', async (req, res) => {
  const week = await Week.findOne({
    weekStart: dayjs(req.params.weekStart).startOf('day').toDate()
  });
  if (week) {
    const day = week.days.find(d => d.dayIndex === parseInt(req.params.dayIndex));
    if (day) { day.todos.pull({ _id: req.params.todoId }); await week.save(); }
  }
  res.redirect(`/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// ── Set-state API (called from dashboard via fetch) ─────────────────────────────
// Uses SET (not blind toggle) so rapid clicks or retries stay correct.

// POST /admin/weekly-todos/api/toggle-goal
router.post('/api/toggle-goal', async (req, res) => {
  try {
    const { weekId, goalId, completed } = req.body;
    const week = await Week.findById(weekId);
    if (!week) return res.json({ ok: false, error: 'Week not found' });
    const goal = week.goals.id(goalId);
    if (!goal) return res.json({ ok: false, error: 'Goal not found' });
    goal.completed = completed === true || completed === 'true';
    await week.save();
    res.json({ ok: true, completed: goal.completed });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

// POST /admin/weekly-todos/api/toggle-todo
router.post('/api/toggle-todo', async (req, res) => {
  try {
    const { weekId, dayIndex, todoId, completed } = req.body;
    const week = await Week.findById(weekId);
    if (!week) return res.json({ ok: false, error: 'Week not found' });
    const day  = week.days.find(d => d.dayIndex === parseInt(dayIndex));
    if (!day)  return res.json({ ok: false, error: 'Day not found' });
    const todo = day.todos.id(todoId);
    if (!todo) return res.json({ ok: false, error: 'Todo not found' });
    todo.completed = completed === true || completed === 'true';
    await week.save();
    res.json({ ok: true, completed: todo.completed });
  } catch (e) {
    res.json({ ok: false, error: e.message });
  }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
