const express  = require('express');
const ejs      = require('ejs');
const dayjs    = require('dayjs');
const router   = express.Router();

const Settings    = require('../models/Settings');
const calendarMod = require('../modules/calendar/index');
const weeklyMod   = require('../modules/weekly-todos/index');
const habitMod    = require('../modules/habit-tracker/index');
const musicMod    = require('../modules/music-player/index');

// GET /  →  Main dashboard (2nd-monitor view)
router.get('/', async (req, res, next) => {
  try {
    const settings = await Settings.getSettings();

    // Gather data from each enabled module
    const calendarData = settings.modules.calendar.enabled
      ? await calendarMod.getDashboardData()
      : null;

    const weeklyData = settings.modules.weeklyTodos.enabled
      ? await weeklyMod.getDashboardData()
      : null;

    const daysToShow = settings.modules.habitTracker
      ? (settings.modules.habitTracker.daysToShow || 3)
      : 3;
    const habitData = (settings.modules.habitTracker && settings.modules.habitTracker.enabled)
      ? await habitMod.getDashboardData(daysToShow)
      : null;

    const musicData = (settings.modules.musicPlayer && settings.modules.musicPlayer.enabled)
      ? await musicMod.getDashboardData()
      : null;

    // Pre-render module partials → HTML strings
    // Note: pass dayjs explicitly — require() is not available inside EJS templates
    const calendarHtml = calendarData
      ? await ejs.renderFile(calendarMod.viewPath, { ...calendarData, dayjs })
      : '';

    const weeklyHtml = weeklyData
      ? await ejs.renderFile(weeklyMod.viewPath, weeklyData)
      : '';

    const habitHtml = habitData
      ? await ejs.renderFile(habitMod.viewPath, habitData)
      : '';

    const musicHtml = musicData
      ? await ejs.renderFile(musicMod.viewPath, musicData)
      : '';

    res.render('dashboard', {
      settings,
      calendarHtml,
      weeklyHtml,
      habitHtml,
      musicHtml,
      calendarEnabled: !!calendarData,
      weeklyEnabled:   !!weeklyData,
      habitEnabled:    !!habitData,
      musicEnabled:    !!musicData
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
