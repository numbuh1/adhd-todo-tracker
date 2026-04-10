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
const overallTodosMod = require('../modules/overall-todos/index');
const videoPlayerMod  = require('../modules/video-player/index');

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

    const calendarHtml       = calendarData      ? await ejs.renderFile(calendarMod.viewPath,        { ...calendarData,      dayjs, basePath }) : '';
    const weeklyGoalsHtml    = weeklyData         ? await ejs.renderFile(weeklyMod.goalsViewPath,     { ...weeklyData,        basePath })         : '';
    const weeklyTodosHtml    = weeklyData         ? await ejs.renderFile(weeklyMod.todosViewPath,     { ...weeklyData,        basePath })         : '';
    const habitHtml          = habitData          ? await ejs.renderFile(habitMod.viewPath,           { ...habitData,         basePath })         : '';
    const musicHtml          = musicData          ? await ejs.renderFile(musicMod.viewPath,           { ...musicData,         basePath })         : '';
    const progressHtml       = progressData       ? await ejs.renderFile(progressMod.viewPath,        { ...progressData,      basePath })         : '';
    const overallTodosHtml   = overallTodosData   ? await ejs.renderFile(overallTodosMod.viewPath,    { ...overallTodosData,  basePath })         : '';
    const videoPlayerHtml    = videoPlayerData    ? await ejs.renderFile(videoPlayerMod.viewPath,     { ...videoPlayerData,   basePath, extractYouTubeId }) : '';

    res.render('dashboard', {
      settings,
      calendarHtml, weeklyGoalsHtml, weeklyTodosHtml, habitHtml, musicHtml, progressHtml,
      overallTodosHtml, videoPlayerHtml,
      calendarEnabled:     !!calendarData,
      weeklyEnabled:       !!weeklyData,
      habitEnabled:        !!habitData,
      musicEnabled:        !!musicData,
      progressEnabled:     !!progressData,
      overallTodosEnabled: !!overallTodosData,
      videoPlayerEnabled:  !!videoPlayerData
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
