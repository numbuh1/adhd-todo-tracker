/* ══════════════════════════════════════════════════════════
   ADHD Tracker — Dashboard JavaScript
   ══════════════════════════════════════════════════════════ */

const BP = window.BASE_PATH || '';  // sub-path prefix, e.g. '/adhd-todo-tracker'

// ── Live clock ─────────────────────────────────────────────
const clockDate = document.getElementById('clock-date');
const clockTime = document.getElementById('clock-time');
const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2,'0');
  const mm  = String(now.getMinutes()).padStart(2,'0');
  if (clockDate) clockDate.textContent =
    `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  if (clockTime) clockTime.textContent = `${hh}:${mm}`;
}
updateClock();
setInterval(updateClock, 1000);

// ── Gridstack layout ────────────────────────────────────────
(function initGrid() {
  const header = document.getElementById('dash-header');
  if (!header || typeof GridStack === 'undefined') return;

  const LS_KEY = 'adhd_grid_layout';

  // ── Patch DOM attributes from localStorage BEFORE GridStack.init() ──
  // This lets GridStack see the correct positions during its initial
  // compaction pass, preventing items from being gravity-packed into
  // wrong slots (the post-init batchUpdate approach fought the engine).
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const layout = JSON.parse(raw);
      document.querySelectorAll('#main-grid .grid-stack-item[gs-id]').forEach(el => {
        const id = el.getAttribute('gs-id');
        if (id && layout[id]) {
          const p = layout[id];
          el.setAttribute('gs-x', p.x);
          el.setAttribute('gs-y', p.y);
          el.setAttribute('gs-w', p.w);
          el.setAttribute('gs-h', p.h);
        }
      });
    }
  } catch (e) {
    console.warn('Could not restore layout from localStorage:', e);
  }

  const margin = 8;
  const grid   = GridStack.init({
    column: 12, cellHeight: 40, margin, animate: false,
    float: false, maxRow: 100,
    draggable: { handle: '.module-header' },
    resizable: { handles: 'all' }
  }, '#main-grid');

  // ── Save layout to localStorage on drag/resize ──────────────
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      const items  = grid.save(false);
      const layout = {};
      items.forEach(item => {
        if (item.id) layout[item.id] = { x: item.x, y: item.y, w: item.w, h: item.h };
      });
      try {
        localStorage.setItem(LS_KEY, JSON.stringify(layout));
      } catch (e) { console.error('Layout save failed:', e); }
    }, 600);
  }
  grid.on('dragstop resizestop', scheduleSave);

  // expose for layout profile loader
  window._adhd_grid   = grid;
  window._adhd_ls_key = LS_KEY;
})();

// ── Checkbox toggle ─────────────────────────────────────────
document.addEventListener('change', async (e) => {
  const cb = e.target;
  if (!cb.classList.contains('todo-check') && !cb.classList.contains('habit-check')) return;
  const label     = cb.closest('[data-type]');
  if (!label) return;
  const type      = label.dataset.type;
  const completed = cb.checked;
  label.classList.toggle('completed', completed);
  try {
    let url, body;
    if (type === 'goal') {
      url  = BP + '/admin/weekly-todos/api/toggle-goal';
      body = { weekId: label.dataset.weekId, goalId: label.dataset.goalId, completed };
    } else if (type === 'todo') {
      url  = BP + '/admin/weekly-todos/api/toggle-todo';
      body = { weekId: label.dataset.weekId, dayIndex: label.dataset.dayIndex,
               todoId: label.dataset.todoId, completed };
    } else if (type === 'habit') {
      url  = BP + '/admin/habit-tracker/api/toggle';
      body = { habitId: label.dataset.habitId, date: label.dataset.date, completed };
    } else if (type === 'overall') {
      url  = BP + '/admin/overall-todos/api/toggle';
      body = { docId: label.dataset.docId, itemId: label.dataset.itemId, completed };
    } else if (type === 'recurring') {
      url  = BP + '/admin/recurring-todos/api/toggle';
      body = { ruleId: label.dataset.ruleId, date: label.dataset.date, completed };
    } else { return; }

    const res  = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Toggle failed');
    cb.checked = data.completed;
    label.classList.toggle('completed', data.completed);
  } catch (err) {
    console.error('Toggle error:', err.message);
    cb.checked = !completed;
    label.classList.toggle('completed', !completed);
  }
});

// ── Layout Profile Picker ───────────────────────────────────
(function initLayoutProfiles() {
  const btn      = document.getElementById('lpBtn');
  const panel    = document.getElementById('lpPanel');
  const list     = document.getElementById('lpList');
  const nameInput = document.getElementById('lpNameInput');
  const saveBtn  = document.getElementById('lpSaveBtn');
  if (!btn || !panel) return;

  // Toggle panel
  btn.addEventListener('click', (e) => {
    e.stopPropagation();
    const isOpen = panel.classList.toggle('open');
    if (isOpen) { loadProfileList(); nameInput.focus(); }
  });
  document.addEventListener('click', (e) => {
    if (!btn.contains(e.target) && !panel.contains(e.target))
      panel.classList.remove('open');
  });

  // Load list from server
  async function loadProfileList() {
    list.innerHTML = '<div class="lp-empty" style="opacity:.4">Loading…</div>';
    try {
      const res      = await fetch(BP + '/admin/layout-profiles');
      const profiles = await res.json();
      renderList(profiles);
    } catch (e) {
      list.innerHTML = '<div class="lp-empty">Error loading profiles</div>';
    }
  }

  function renderList(profiles) {
    if (!profiles.length) {
      list.innerHTML = '<div class="lp-empty">No saved profiles yet</div>';
      return;
    }
    list.innerHTML = profiles.map(p => `
      <div class="lp-item" data-id="${p._id}">
        <span class="lp-item-name" title="${esc(p.name)}">📐 ${esc(p.name)}</span>
        <button class="lp-load-btn" data-load="${p._id}">Load</button>
        <button class="lp-del-btn"  data-del="${p._id}"  title="Delete">✕</button>
      </div>`).join('');
  }

  function esc(s) {
    return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  // Save current layout as new profile
  saveBtn.addEventListener('click', async () => {
    const name = nameInput.value.trim();
    if (!name) { nameInput.focus(); return; }

    // Gather current grid state
    const gridLayout = {};
    if (window._adhd_grid) {
      window._adhd_grid.save(false).forEach(item => {
        if (item.id) gridLayout[item.id] = { x: item.x, y: item.y, w: item.w, h: item.h };
      });
    }

    saveBtn.disabled = true;
    saveBtn.textContent = '…';
    try {
      const res  = await fetch(BP + '/admin/layout-profiles', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, gridLayout })
      });
      const data = await res.json();
      if (!data.ok) throw new Error(data.error);
      nameInput.value = '';
      showMsg('✅ Saved!');
      loadProfileList();
    } catch (e) {
      showMsg('⚠️ ' + e.message);
    } finally {
      saveBtn.disabled = false;
      saveBtn.textContent = '💾 Save';
    }
  });
  nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') saveBtn.click(); });

  // List click delegation
  list.addEventListener('click', async (e) => {
    const loadBtn = e.target.closest('[data-load]');
    const delBtn  = e.target.closest('[data-del]');

    if (loadBtn) {
      const id = loadBtn.dataset.load;
      loadBtn.textContent = '…';
      loadBtn.disabled = true;
      try {
        const res  = await fetch(BP + `/admin/layout-profiles/${id}/load`, { method: 'POST' });
        const data = await res.json();
        if (!data.ok) throw new Error(data.error);
        // Write the loaded profile layout to localStorage so it persists client-side
        if (data.gridLayout && window._adhd_ls_key) {
          try { localStorage.setItem(window._adhd_ls_key, JSON.stringify(data.gridLayout)); } catch(_) {}
        }
        window.location.reload();
      } catch (e) {
        showMsg('⚠️ ' + e.message);
        loadBtn.textContent = 'Load';
        loadBtn.disabled = false;
      }
    }

    if (delBtn) {
      const id   = delBtn.dataset.del;
      const item = delBtn.closest('.lp-item');
      const name = item?.querySelector('.lp-item-name')?.textContent?.replace('📐 ','') || 'this profile';
      if (!confirm(`Delete profile "${name}"?`)) return;
      delBtn.disabled = true;
      try {
        await fetch(BP + `/admin/layout-profiles/${id}/delete`, { method: 'POST' });
        loadProfileList();
      } catch (e) {
        showMsg('⚠️ ' + e.message);
        delBtn.disabled = false;
      }
    }
  });

  function showMsg(text) {
    let msg = panel.querySelector('.lp-msg');
    if (!msg) { msg = document.createElement('div'); msg.className = 'lp-msg'; panel.appendChild(msg); }
    msg.textContent = text;
    clearTimeout(msg._t);
    msg._t = setTimeout(() => { msg.textContent = ''; }, 3000);
  }
}());
