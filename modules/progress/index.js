const express            = require('express');
const path               = require('path');
const multer             = require('multer');
const Task               = require('./model');
const recurringProgressMod = require('../recurring-progress/index');

const bp = req => req.app.locals.basePath || '';

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, path.join(__dirname, '../../public/uploads')),
  filename:    (req, file, cb) => cb(null, `prog-${Date.now()}${path.extname(file.originalname)}`)
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
const getDashboardData = async (userId) => {
  const [regularTasks, recurringData] = await Promise.all([
    Task.find({ userId, visible: true }).sort({ order: 1, createdAt: -1 }).lean(),
    recurringProgressMod.getDashboardData(userId)
  ]);

  // Tag regular tasks
  const tasks = [
    ...regularTasks.map(t => ({ ...t, isRecurring: false })),
    ...recurringData.tasks
  ];
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
router.post('/tasks', upload.single('photo'), async (req, res) => {
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
      photo:       req.file ? '/uploads/' + req.file.filename : null,
      visible:     visible  === 'on'
    });
    res.redirect(bp(req) + '/admin/progress?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/progress?error=' + encodeURIComponent(err.message));
  }
});

// Edit task
router.post('/tasks/:id/edit', upload.single('photo'), async (req, res) => {
  try {
    const userId = req.session.userId;
    const { name, description, icon, progress, status, color, deadline, visible } = req.body;
    const update = {
      name:        (name || '').trim(),
      description: (description || '').trim(),
      icon:        (icon  || '📋').trim(),
      progress:    Math.min(100, Math.max(0, parseInt(progress) || 0)),
      status:      status === 'in-progress' ? 'in-progress' : 'idle',
      color:       color  || '#7c3aed',
      deadline:    deadline ? new Date(deadline) : null,
      visible:     visible  === 'on'
    };
    if (req.file)                    update.photo = '/uploads/' + req.file.filename;
    if (req.body.removePhoto === '1') update.photo = null;
    await Task.findOneAndUpdate({ _id: req.params.id, userId }, update);
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
