const mongoose = require('mongoose');

// ── Sub-schemas ────────────────────────────────────────────
const todoSchema = new mongoose.Schema({
  text:      { type: String, required: true, trim: true },
  completed: { type: Boolean, default: false },
  order:     { type: Number, default: 0 }
}, { _id: true });

const daySchema = new mongoose.Schema({
  dayIndex: { type: Number, required: true }, // 0=Mon … 6=Sun
  date:     { type: Date,   required: true },
  todos:    [todoSchema]
}, { _id: false });

// ── Week schema ────────────────────────────────────────────
const weekSchema = new mongoose.Schema({
  userId:    { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  weekStart: { type: Date, required: true }, // Monday 00:00
  goals:     [todoSchema],
  days:      [daySchema]
}, { timestamps: true });

// Unique per user+week
weekSchema.index({ userId: 1, weekStart: 1 }, { unique: true });

/**
 * Find or create the week document for a given Monday (YYYY-MM-DD) and userId.
 */
weekSchema.statics.getOrCreate = async function (weekStartStr, userId) {
  const dayjs  = require('dayjs');
  const monday = dayjs(weekStartStr).startOf('day');
  let week = await this.findOne({ weekStart: monday.toDate(), userId });

  if (!week) {
    const days = [];
    for (let i = 0; i < 7; i++) {
      days.push({
        dayIndex: i,
        date: monday.add(i, 'day').toDate(),
        todos: []
      });
    }
    week = await this.create({
      userId,
      weekStart: monday.toDate(),
      goals: [],
      days
    });
  }

  return week;
};

module.exports = mongoose.model('Week', weekSchema);
