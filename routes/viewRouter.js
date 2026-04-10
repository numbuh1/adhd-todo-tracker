const express  = require('express');
const ejs      = require('ejs');
const dayjs    = require('dayjs');
const router   = express.Router();

const liveUpdates    = require('../lib/liveUpdates');
const Settings       = require('../models/Settings');
const calendarMod    = require('../modules/calendar/index');
const weeklyMod      = require('../modules/weekly-todos/index');
const habitMod       = require('../modules/habit-tracker/index');
const musicMod       = require('../modules/music-player/index');
const progressMod    = require('../modules/progress/index');
const overallTodosMod   = require('../modules/overall-todos/index');
const videoPlayerMod    = require('../modules/video-player/index');
const recurringTodosMod = require('../modules/recurring-todos/index');

// Helper passed to video-player view template
function extractYouTubeId(url) {
  if (!url) return '';
  const patterns = [
    /youtu\.be\/([a-zA-Z0-9_-]{11})/,
    /[?&]v=([a-zA-Z0-9_-]{11})/,
    /embed\/([a-zA-Z0-9_-]{11})/,
    /shorts\/([a-zA-Z0-9_-]{11})/
  ];
  for (const p of patterns) { const m = url.match(p); if (m) return m[1]; }
  return '';
}

// ── Per-module HTML refresh endpoint ───────────────────────
// Called by the dashboard SSE client to swap a single panel in place.
router.get('/module-html/:module', async (req, res) => {
  try {
    const userId    = req.session.userId;
    const settings  = await Settings.getSettings(userId);
    const basePath  = req.app.locals.basePath || '';
    const mod       = req.params.module;
    let   html      = '';

    if (mod === 'calendar' && settings.modules.calendar?.enabled) {
      const d = await calendarMod.getDashboardData(userId);
      html = await ejs.renderFile(calendarMod.viewPath, { ...d, dayjs, basePath });

    } else if (mod === 'weeklyGoals' && settings.modules.weeklyTodos?.enabled) {
      const d = await weeklyMod.getDashboardData(userId);
      html = await ejs.renderFile(weeklyMod.goalsViewPath, { ...d, basePath });

    } else if (mod === 'weeklyTodos' && settings.modules.weeklyTodos?.enabled) {
      const d = await weeklyMod.getDashboardData(userId);
      html = await ejs.renderFile(weeklyMod.todosViewPath, { ...d, basePath });

    } else if (mod === 'habitTracker' && settings.modules.habitTracker?.enabled) {
      const daysToShow = settings.modules.habitTracker?.daysToShow || 3;
      const d = await habitMod.getDashboardData(userId, daysToShow);
      html = await ejs.renderFile(habitMod.viewPath, { ...d, basePath });

    } else if (mod === 'musicPlayer' && settings.modules.musicPlayer?.enabled) {
      const d = await musicMod.getDashboardData(userId);
      html = await ejs.renderFile(musicMod.viewPath, { ...d, basePath });

    } else if (mod === 'progress' && settings.modules.progress?.enabled) {
      const d = await progressMod.getDashboardData(userId);
      html = await ejs.renderFile(progressMod.viewPath, { ...d, basePath });

    } else if (mod === 'overallTodos' && settings.modules.overallTodos?.enabled) {
      const d = await overallTodosMod.getDashboardData(userId);
      html = await ejs.renderFile(overallTodosMod.viewPath, { ...d, basePath });

    } else if (mod === 'recurringTodos' && settings.modules.recurringTodos?.enabled) {
      const d = await recurringTodosMod.getDashboardData(userId);
      html = await ejs.renderFile(recurringTodosMod.viewPath, { ...d, basePath });
    }

    res.json({ ok: true, html });
  } catch (err) {
    res.json({ ok: false, error: err.message });
  }
});

// ── SSE live-update stream ──────────────────────────────────
router.get('/live-updates', (req, res) => {
  res.setHeader('Content-Type',  'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection',    'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // disables Nginx buffering
  res.flushHeaders();
  res.write('event: connected\ndata: {}\n\n');
  liveUpdates.subscribe(req.session.userId, res);
  const ka = setInterval(() => { try { res.write(':ka\n\n'); } catch(_) { clearInterval(ka); } }, 25000);
  req.on('close', () => clearInterval(ka));
});

router.get('/', async (req, res, next) => {
  try {
    const userId   = req.session.userId;
    const settings = await Settings.getSettings(userId);
    const basePath = req.app.locals.basePath || '';

    const calendarData = settings.modules.calendar.enabled
      ? await calendarMod.getDashboardData(userId) : null;

    const weeklyData = settings.modules.weeklyTodos.enabled
      ? await weeklyMod.getDashboardData(userId) : null;

    const daysToShow = settings.modules.habitTracker?.daysToShow || 3;
    const habitData  = settings.modules.habitTracker?.enabled
      ? await habitMod.getDashboardData(userId, daysToShow) : null;

    const musicData  = settings.modules.musicPlayer?.enabled
      ? await musicMod.getDashboardData(userId) : null;

    const progressData = settings.modules.progress?.enabled
      ? await progressMod.getDashboardData(userId) : null;

    const overallTodosData = settings.modules.overallTodos?.enabled
      ? await overallTodosMod.getDashboardData(userId) : null;

    const videoPlayerData = settings.modules.videoPlayer?.enabled
      ? await videoPlayerMod.getDashboardData(userId) : null;

    const recurringTodosData = settings.modules.recurringTodos?.enabled
      ? await recurringTodosMod.getDashboardData(userId) : null;

    const calendarHtml       = calendarData      ? await ejs.renderFile(calendarMod.viewPath,        { ...calendarData,      dayjs, basePath }) : '';
    const weeklyGoalsHtml    = weeklyData         ? await ejs.renderFile(weeklyMod.goalsViewPath,     { ...weeklyData,        basePath })         : '';
    const weeklyTodosHtml    = weeklyData         ? await ejs.renderFile(weeklyMod.todosViewPath,     { ...weeklyData,        basePath })         : '';
    const habitHtml          = habitData          ? await ejs.renderFile(habitMod.viewPath,           { ...habitData,         basePath })         : '';
    const musicHtml          = musicData          ? await ejs.renderFile(musicMod.viewPath,           { ...musicData,         basePath })         : '';
    const progressHtml       = progressData       ? await ejs.renderFile(progressMod.viewPath,        { ...progressData,      basePath })         : '';
    const overallTodosHtml   = overallTodosData   ? await ejs.renderFile(overallTodosMod.viewPath,    { ...overallTodosData,   basePath })                   : '';
    const videoPlayerHtml    = videoPlayerData    ? await ejs.renderFile(videoPlayerMod.viewPath,     { ...videoPlayerData,    basePath, extractYouTubeId })  : '';
    const recurringTodosHtml = recurringTodosData ? await ejs.renderFile(recurringTodosMod.viewPath,  { ...recurringTodosData, basePath })                    : '';

    res.render('dashboard', {
      settings,
      calendarHtml, weeklyGoalsHtml, weeklyTodosHtml, habitHtml, musicHtml, progressHtml,
      overallTodosHtml, videoPlayerHtml, recurringTodosHtml,
      calendarEnabled:      !!calendarData,
      weeklyEnabled:        !!weeklyData,
      habitEnabled:         !!habitData,
      musicEnabled:         !!musicData,
      progressEnabled:      !!progressData,
      overallTodosEnabled:  !!overallTodosData,
      videoPlayerEnabled:   !!videoPlayerData,
      recurringTodosEnabled: !!recurringTodosData
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
