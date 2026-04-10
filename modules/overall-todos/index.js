const express = require('express');
const path    = require('path');
const OverallTodos = require('./model');

const bp = req => req.app.locals.basePath || '';

// ── Dashboard data ─────────────────────────────────────────
const getDashboardData = async (userId) => {
  const doc   = await OverallTodos.getOrCreate(userId);
  const items = doc.items
    .filter(i => i.visible)
    .sort((a, b) => a.order - b.order);
  return { docId: doc._id.toString(), items };
};

// ── Admin router ───────────────────────────────────────────
const router = express.Router();

router.get('/', async (req, res) => {
  const doc = await OverallTodos.getOrCreate(req.session.userId);
  const items = [...doc.items].sort((a, b) => a.order - b.order);
  res.render(path.join(__dirname, 'views', 'admin'), {
    docId:  doc._id.toString(),
    items,
    title:  'Overall To-Dos',
    activePage: 'overall-todos',
    root:   req.app.locals.root,
    saved:  req.query.saved  || null,
    error:  req.query.error  || null
  });
});

// Add item
router.post('/items', async (req, res) => {
  try {
    const { text } = req.body;
    if (!text || !text.trim()) throw new Error('Text is required.');
    const doc = await OverallTodos.getOrCreate(req.session.userId);
    const maxOrder = doc.items.reduce((m, i) => Math.max(m, i.order), -1);
    doc.items.push({ text: text.trim(), order: maxOrder + 1, visible: true });
    await doc.save();
    res.redirect(bp(req) + '/admin/overall-todos?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/overall-todos?error=' + encodeURIComponent(err.message));
  }
});

// Edit item text
router.post('/items/:itemId/edit', async (req, res) => {
  try {
    const { text } = req.body;
    const doc  = await OverallTodos.getOrCreate(req.session.userId);
    const item = doc.items.id(req.params.itemId);
    if (!item) throw new Error('Item not found.');
    item.text = (text || '').trim();
    await doc.save();
    res.redirect(bp(req) + '/admin/overall-todos?saved=1');
  } catch (err) {
    res.redirect(bp(req) + '/admin/overall-todos?error=' + encodeURIComponent(err.message));
  }
});

// Toggle visible (show/hide on dashboard)
router.post('/items/:itemId/toggle-visible', async (req, res) => {
  try {
    const doc  = await OverallTodos.getOrCreate(req.session.userId);
    const item = doc.items.id(req.params.itemId);
    if (!item) throw new Error('Item not found.');
    item.visible = !item.visible;
    await doc.save();
    res.redirect(bp(req) + '/admin/overall-todos');
  } catch (err) {
    res.redirect(bp(req) + '/admin/overall-todos?error=' + encodeURIComponent(err.message));
  }
});

// Delete item
router.post('/items/:itemId/delete', async (req, res) => {
  try {
    const doc  = await OverallTodos.getOrCreate(req.session.userId);
    doc.items.pull({ _id: req.params.itemId });
    await doc.save();
    res.redirect(bp(req) + '/admin/overall-todos');
  } catch (err) {
    res.redirect(bp(req) + '/admin/overall-todos?error=' + encodeURIComponent(err.message));
  }
});

// Reorder items (drag-and-drop)
router.post('/api/reorder', async (req, res) => {
  try {
    const { ids } = req.body;
    if (!Array.isArray(ids)) return res.json({ ok: false, error: 'ids must be an array' });
    const doc = await OverallTodos.getOrCreate(req.session.userId);
    ids.forEach((id, idx) => {
      const item = doc.items.id(id);
      if (item) item.order = idx;
    });
    await doc.save();
    res.json({ ok: true });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

// Toggle completed (dashboard API)
router.post('/api/toggle', async (req, res) => {
  try {
    const { docId, itemId, completed } = req.body;
    const doc  = await OverallTodos.findOne({ _id: docId, userId: req.session.userId });
    if (!doc) return res.json({ ok: false, error: 'Not found' });
    const item = doc.items.id(itemId);
    if (!item) return res.json({ ok: false, error: 'Item not found' });
    item.completed = completed === true || completed === 'true';
    await doc.save();
    res.json({ ok: true, completed: item.completed });
  } catch (e) { res.json({ ok: false, error: e.message }); }
});

module.exports = {
  getDashboardData,
  adminRouter: router,
  viewPath: path.join(__dirname, 'views', 'view.ejs')
};
