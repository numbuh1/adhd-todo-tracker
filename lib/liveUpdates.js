/**
 * Server-Sent Events (SSE) live-update broadcaster.
 * Keeps a per-user registry of connected dashboard clients.
 * Call notify(userId) after any admin mutation to push a reload signal.
 */
const registry = new Map(); // userId:string → Set<res>

function subscribe(userId, res) {
  const id = String(userId);
  if (!registry.has(id)) registry.set(id, new Set());
  registry.get(id).add(res);
  res.on('close', () => {
    const set = registry.get(id);
    if (set) { set.delete(res); if (set.size === 0) registry.delete(id); }
  });
}

/**
 * notify(userId, modules)
 * modules: string | string[] — which dashboard panels need refreshing.
 *          Pass 'all' (or omit) to trigger a full page reload.
 */
function notify(userId, modules) {
  const set = registry.get(String(userId));
  if (!set || set.size === 0) return;
  const arr = modules
    ? (Array.isArray(modules) ? modules : [modules])
    : ['all'];
  const payload = JSON.stringify({ modules: arr });
  set.forEach(res => {
    try { res.write(`event: update\ndata: ${payload}\n\n`); } catch (_) {}
  });
}

module.exports = { subscribe, notify };
