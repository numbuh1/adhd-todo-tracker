const express = require('express');
const path    = require('path');
const Task    = require('./model');

const bp = req => req.app.locals.basePath || '';

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (userId) => {
  const tasks = await Task.find({ userId, visible: true }).sort({ order: 1, createdAt: -1 }).lean();
  return { tasks };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

// Admin list page
router.get('/', async (req, res) => {
  const userId = req.session.userId;
  const tasks  = await Task.find({ userId }).sort({ createdAt: -1 }).lean();
  res.render(path.join(__dirname, 'views', 'admin'), {
    tasks, title: 'Progress Tracker', activePage: 'progress',
    root: req.app.locals.root,
    saved: req.query.saved || null,
    error: req.query.error || null
  });
});

// Create task
router.post('/tasks', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, description, icon, progress, status, color, deadline, visible } = req.body;
    if (!name || !name.trim()) throw new Error('Task name is required.');
    await Task.create({
      userId,
      name:        name.trim(),
      description: (description || '').trim(),
      icon:        (icon  || '📋').trim(),
      progress:    Math.min(100, Math.max(0, parseInt(progress) || 0)),
      status:      status === 'in-progress' ? 'in-progress' : 'idle',
      color:       color  || '#7c3aed',
      deadline:    deadline ? new Date(deadline) : null,
      visible:     visible  === 'on'
    });
    res.redirect(bp(req) + '/admin/progress?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/progress?error=' + encodeURIComponent(err.message));
  }
});

// Edit task
router.post('/tasks/:id/edit', async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, description, icon, progress, status, color, deadline, visible } = req.body;
    await Task.findOneAndUpdate(
      { _id: req.params.id, userId },
      {
        name:        (name || '').trim(),
        description: (description || '').trim(),
        icon:        (icon  || '📋').trim(),
        progress:    Math.min(100, Math.max(0, parseInt(progress) || 0)),
        status:      status === 'in-progress' ? 'in-progress' : 'idle',
        color:       color  || '#7c3aed',
        deadline:    deadline ? new Date(deadline) : null,
        visible:     visible  === 'on'
      }
    );
    res.redirect(bp(req) + '/admin/progress?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/progress?error=' + encodeURIComponent(err.message));
  }
});

// Delete task
router.post('/tasks/:id/delete', async (req, res) => {
  try {
    await Task.findOneAndDelete({ _id: req.params.id, userId: req.session.userId });
    res.redirect(bp(req) + '/admin/progress');
  } catch (err) {
    res.redirect(bp(req) + '/admin/progress?error=' + encodeURIComponent(err.message));
  }
});

// ── Dashboard APIs ─────────────────────────────────────────

// Update progress value
router.post('/api/update-progress', async (req, res) => {
  try {
    const { taskId, progress } = req.body;
    const pct = Math.min(100, Math.max(0, parseInt(progress) || 0));
    const task = await Task.findOneAndUpdate(
      { _id: taskId, userId: req.session.userId },
      { progress: pct },
      { new: true }
    );
    if (!task) return res.json({ ok: false, error: 'Task not found' });
    res.json({ ok: true, progress: task.progress });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Reorder tasks (drag-and-drop)
router.post('/api/reorder', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.json({ ok: false, error: 'ids must be an array' });
    const userId = req.session.userId;
    await Promise.all(ids.map((id, idx) =>
      Task.findOneAndUpdate({ _id: id, userId }, { order: idx })
    ));
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Toggle status between idle and in-progress
router.post('/api/toggle-status', async (req, res) => {
  try {
    const { taskId } = req.body;
    const task = await Task.findOne({ _id: taskId, userId: req.session.userId });
    if (!task) return res.json({ ok: false, error: 'Task not found' });
    task.status = task.status === 'in-progress' ? 'idle' : 'in-progress';
    await task.save();
    res.json({ ok: true, status: task.status });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
