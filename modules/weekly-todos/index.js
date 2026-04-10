const express       = require('express');
const path          = require('path');
const dayjs         = require('dayjs');
const Week          = require('./model');
const RecurringTodo = require('../recurring-todos/model');

const bp = req => req.app.locals.basePath || '';

function getMondayOf(date) {
  const d   = dayjs(date);
  const dow = d.day();
  const diff = dow === 0 ? -6 : 1 - dow;
  return d.add(diff, 'day').startOf('day');
}

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (userId) => {
  const monday  = getMondayOf(new Date());
  const weekDoc = await Week.getOrCreate(monday.format('YYYY-MM-DD'), userId);

  // Fetch all active recurring rules once, then match per day
  const allRules = await RecurringTodo.find({ userId, active: true }).lean();

  const days = weekDoc.days.map(day => {
    const date    = new Date(day.date);
    const ymd     = dayjs(day.date).format('YYYY-MM-DD');
    const dow     = date.getDay();
    const dom     = date.getDate();
    const moy     = date.getMonth() + 1;

    const recurringTodos = allRules
      .filter(r => {
        if (r.startDate && date < new Date(r.startDate)) return false;
        if (r.endDate   && date > new Date(r.endDate))   return false;
        if (r.type === 'weekly')  return r.dayOfWeek  === dow;
        if (r.type === 'monthly') return r.dayOfMonth === dom;
        if (r.type === 'yearly')  return r.dayOfMonth === dom && r.monthOfYear === moy;
        return false;
      })
      .map(r => ({
        _id:           r._id,
        text:          r.text,
        completedToday: r.completions.includes(ymd),
        ymd
      }));

    return {
      dayIndex:       day.dayIndex,
      date:           day.date,
      todos:          day.todos.map(t => ({ _id: t._id, text: t.text, completed: t.completed })),
      recurringTodos,
      dateLabel:      dayjs(day.date).format('ddd D'),
      isToday:        ymd === dayjs().format('YYYY-MM-DD')
    };
  });

  return {
    weekStart: monday.format('YYYY-MM-DD'),
    weekId:    weekDoc._id.toString(),
    goals:     weekDoc.goals,
    days
  };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

router.get('/', async (req, res) => {
  const userId = req.session.userId;
  const today  = dayjs();
  const monday = getMondayOf(today.toDate());
  const weeks  = [];
  for (let offset = -4; offset <= 2; offset++) {
    const wStart = monday.add(offset * 7, 'day');
    const wEnd   = wStart.add(6, 'day');
    const doc    = await Week.findOne({ weekStart: wStart.toDate(), userId }).lean();
    weeks.push({
      weekStart: wStart.format('YYYY-MM-DD'),
      label:     wStart.format('MMM D') + ' – ' + wEnd.format('MMM D, YYYY'),
      isCurrent: offset === 0,
      goalCount: doc ? doc.goals.length : 0,
      todoCount: doc ? doc.days.reduce((s, d) => s + d.todos.length, 0) : 0
    });
  }
  res.render(path.join(__dirname, 'views', 'admin-index'), {
    weeks, title: 'Weekly Goals & To-Dos',
    activePage: 'weekly-todos', root: req.app.locals.root
  });
});

router.get('/:weekStart/edit', async (req, res) => {
  const userId  = req.session.userId;
  const weekDoc = await Week.getOrCreate(req.params.weekStart, userId);
  const monday  = dayjs(req.params.weekStart);
  res.render(path.join(__dirname, 'views', 'admin-edit'), {
    week:      weekDoc.toObject(),
    weekStart: req.params.weekStart,
    weekLabel: monday.format('MMM D') + ' – ' + monday.add(6,'day').format('MMM D, YYYY'),
    dayjs, title: 'Edit Week', activePage: 'weekly-todos', root: req.app.locals.root
  });
});

// Goals CRUD
router.post('/:weekStart/goals', async (req, res) => {
  const userId = req.session.userId;
  const { text } = req.body;
  if (text && text.trim()) {
    await Week.findOneAndUpdate(
      { weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), userId },
      { $push: { goals: { text: text.trim(), completed: false } } }
    );
  }
  res.redirect(bp(req) + `/admin/weekly-todos/${req.params.weekStart}/edit`);
});

router.post('/:weekStart/goals/:goalId/edit', async (req, res) => {
  const userId = req.session.userId;
  const { text } = req.body;
  await Week.findOneAndUpdate(
    { weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), userId, 'goals._id': req.params.goalId },
    { $set: { 'goals.$.text': text.trim() } }
  );
  res.redirect(bp(req) + `/admin/weekly-todos/${req.params.weekStart}/edit`);
});

router.post('/:weekStart/goals/:goalId/delete', async (req, res) => {
  const userId = req.session.userId;
  await Week.findOneAndUpdate(
    { weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), userId },
    { $pull: { goals: { _id: req.params.goalId } } }
  );
  res.redirect(bp(req) + `/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// Daily Todos CRUD
router.post('/:weekStart/days/:dayIndex/todos', async (req, res) => {
  const userId = req.session.userId;
  const { text } = req.body;
  const dayIdx  = parseInt(req.params.dayIndex);
  if (text && text.trim()) {
    await Week.findOneAndUpdate(
      { weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), userId, 'days.dayIndex': dayIdx },
      { $push: { 'days.$.todos': { text: text.trim(), completed: false } } }
    );
  }
  res.redirect(bp(req) + `/admin/weekly-todos/${req.params.weekStart}/edit`);
});

router.post('/:weekStart/days/:dayIndex/todos/:todoId/edit', async (req, res) => {
  const userId = req.session.userId;
  const { text } = req.body;
  const week = await Week.findOne({ weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), userId });
  if (week) {
    const day = week.days.find(d => d.dayIndex === parseInt(req.params.dayIndex));
    if (day) {
      const todo = day.todos.id(req.params.todoId);
      if (todo) { todo.text = text.trim(); await week.save(); }
    }
  }
  res.redirect(bp(req) + `/admin/weekly-todos/${req.params.weekStart}/edit`);
});

router.post('/:weekStart/days/:dayIndex/todos/:todoId/delete', async (req, res) => {
  const userId = req.session.userId;
  const week = await Week.findOne({ weekStart: dayjs(req.params.weekStart).startOf('day').toDate(), userId });
  if (week) {
    const day = week.days.find(d => d.dayIndex === parseInt(req.params.dayIndex));
    if (day) { day.todos.pull({ _id: req.params.todoId }); await week.save(); }
  }
  res.redirect(bp(req) + `/admin/weekly-todos/${req.params.weekStart}/edit`);
});

// Reorder goals
router.post('/api/reorder-goals', async (req, res) => {
  try {
    const { weekId, ids } = req.body;
    const week = await Week.findOne({ _id: weekId, userId: req.session.userId });
    if (!week) return res.json({ ok: false, error: 'Week not found' });
    ids.forEach((id, idx) => {
      const goal = week.goals.id(id);
      if (goal) goal.order = idx;
    });
    await week.save();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Reorder todos within a day
router.post('/api/reorder-todos', async (req, res) => {
  try {
    const { weekId, dayIndex, ids } = req.body;
    const week = await Week.findOne({ _id: weekId, userId: req.session.userId });
    if (!week) return res.json({ ok: false, error: 'Week not found' });
    const day = week.days.find(d => d.dayIndex === parseInt(dayIndex));
    if (!day) return res.json({ ok: false, error: 'Day not found' });
    ids.forEach((id, idx) => {
      const todo = day.todos.id(id);
      if (todo) todo.order = idx;
    });
    await week.save();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Toggle APIs (dashboard checkboxes)
router.post('/api/toggle-goal', async (req, res) => {
  try {
    const { weekId, goalId, completed } = req.body;
    const week = await Week.findOne({ _id: weekId, userId: req.session.userId });
    if (!week) return res.json({ ok: false, error: 'Week not found' });
    const goal = week.goals.id(goalId);
    if (!goal) return res.json({ ok: false, error: 'Goal not found' });
    goal.completed = completed === true || completed === 'true';
    await week.save();
    res.json({ ok: true, completed: goal.completed });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

router.post('/api/toggle-todo', async (req, res) => {
  try {
    const { weekId, dayIndex, todoId, completed } = req.body;
    const week = await Week.findOne({ _id: weekId, userId: req.session.userId });
    if (!week) return res.json({ ok: false, error: 'Week not found' });
    const day  = week.days.find(d => d.dayIndex === parseInt(dayIndex));
    if (!day)  return res.json({ ok: false, error: 'Day not found' });
    const todo = day.todos.id(todoId);
    if (!todo) return res.json({ ok: false, error: 'Todo not found' });
    todo.completed = completed === true || completed === 'true';
    await week.save();
    res.json({ ok: true, completed: todo.completed });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath:      path.join(__dirname, 'views', 'view.ejs'),       // legacy (combined)
  goalsViewPath: path.join(__dirname, 'views', 'goals-view.ejs'), // split panel: goals
  todosViewPath: path.join(__dirname, 'views', 'todos-view.ejs')  // split panel: todos
};
