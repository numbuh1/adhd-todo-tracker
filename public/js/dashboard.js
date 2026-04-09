/* ══════════════════════════════════════════════════════════
   ADHD Tracker — Dashboard JavaScript
   ══════════════════════════════════════════════════════════ */

// ── Live clock ─────────────────────────────────────────────
const clockDate = document.getElementById('clock-date');
const clockTime = document.getElementById('clock-time');

const DAY_NAMES   = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTH_NAMES = ['January','February','March','April','May','June',
                     'July','August','September','October','November','December'];

function updateClock() {
  const now = new Date();
  const hh  = String(now.getHours()).padStart(2, '0');
  const mm  = String(now.getMinutes()).padStart(2, '0');
  if (clockDate) clockDate.textContent =
    `${DAY_NAMES[now.getDay()]}, ${MONTH_NAMES[now.getMonth()]} ${now.getDate()}, ${now.getFullYear()}`;
  if (clockTime) clockTime.textContent = `${hh}:${mm}`;
}
updateClock();
setInterval(updateClock, 1000);

// ── Gridstack layout ────────────────────────────────────────
// Drag by the module header; resize from left/right edges.
// Layout is auto-saved to the server after every move/resize.
(function initGrid() {
  const header = document.getElementById('dash-header');
  if (!header || typeof GridStack === 'undefined') return;

  const margin  = 8;
  const cellH   = Math.max(400, window.innerHeight - header.offsetHeight - margin * 2);

  const grid = GridStack.init({
    column:    12,
    cellHeight: 40,
    margin:    margin,
    animate:   false,
    float:     false,
    maxRow:    100,
    draggable: { handle: '.module-header' },
    resizable: { handles: 'all' }
  }, '#main-grid');

  // Debounced save so we don't hammer the server on every pixel
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(async () => {
      const items  = grid.save(false); // false = skip content HTML
      const layout = {};
      items.forEach(item => {
        if (item.id) layout[item.id] = { x: item.x, y: item.y, w: item.w, h: item.h };
      });
      try {
        await fetch('/admin/settings/grid-layout', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ layout })
        });
      } catch (e) {
        console.error('Layout save failed:', e);
      }
    }, 600);
  }

  grid.on('dragstop resizestop', scheduleSave);
})();

// ── Checkbox toggle ─────────────────────────────────────────
// `onclick="event.stopPropagation()"` on each checkbox prevents the click from
// bubbling to the parent <label>, which would re-activate the checkbox and
// toggle it back. The API receives the DESIRED state (not a blind toggle).

document.addEventListener('change', async (e) => {
  const cb = e.target;
  if (!cb.classList.contains('todo-check') && !cb.classList.contains('habit-check')) return;

  const label     = cb.closest('[data-type]');
  if (!label) return;

  const type      = label.dataset.type;
  const completed = cb.checked;

  // Optimistic UI
  label.classList.toggle('completed', completed);

  try {
    let url, body;

    if (type === 'goal') {
      url  = '/admin/weekly-todos/api/toggle-goal';
      body = { weekId: label.dataset.weekId, goalId: label.dataset.goalId, completed };

    } else if (type === 'todo') {
      url  = '/admin/weekly-todos/api/toggle-todo';
      body = {
        weekId:   label.dataset.weekId,
        dayIndex: label.dataset.dayIndex,
        todoId:   label.dataset.todoId,
        completed
      };

    } else if (type === 'habit') {
      url  = '/admin/habit-tracker/api/toggle';
      body = { habitId: label.dataset.habitId, date: label.dataset.date, completed };

    } else { return; }

    const res  = await fetch(url, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(body)
    });
    const data = await res.json();

    if (!data.ok) throw new Error(data.error || 'Toggle failed');

    cb.checked = data.completed;
    label.classList.toggle('completed', data.completed);

  } catch (err) {
    console.error('Toggle error:', err.message);
    cb.checked = !completed;   // revert
    label.classList.toggle('completed', !completed);
  }
});
