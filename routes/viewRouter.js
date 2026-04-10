const express  = require('express');
const ejs      = require('ejs');
const dayjs    = require('dayjs');
const router   = express.Router();

const Settings     = require('../models/Settings');
const calendarMod  = require('../modules/calendar/index');
const weeklyMod    = require('../modules/weekly-todos/index');
const habitMod     = require('../modules/habit-tracker/index');
const musicMod     = require('../modules/music-player/index');
const progressMod  = require('../modules/progress/index');

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

    const calendarHtml  = calendarData  ? await ejs.renderFile(calendarMod.viewPath,        { ...calendarData,  dayjs, basePath }) : '';
    const weeklyGoalsHtml = weeklyData  ? await ejs.renderFile(weeklyMod.goalsViewPath,      { ...weeklyData,   basePath })         : '';
    const weeklyTodosHtml = weeklyData  ? await ejs.renderFile(weeklyMod.todosViewPath,      { ...weeklyData,   basePath })         : '';
    const habitHtml     = habitData     ? await ejs.renderFile(habitMod.viewPath,            { ...habitData,    basePath })         : '';
    const musicHtml     = musicData     ? await ejs.renderFile(musicMod.viewPath,            { ...musicData,    basePath })         : '';
    const progressHtml  = progressData  ? await ejs.renderFile(progressMod.viewPath,         { ...progressData, basePath })         : '';

    res.render('dashboard', {
      settings,
      calendarHtml, weeklyGoalsHtml, weeklyTodosHtml, habitHtml, musicHtml, progressHtml,
      calendarEnabled:  !!calendarData,
      weeklyEnabled:    !!weeklyData,
      habitEnabled:     !!habitData,
      musicEnabled:     !!musicData,
      progressEnabled:  !!progressData
    });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
