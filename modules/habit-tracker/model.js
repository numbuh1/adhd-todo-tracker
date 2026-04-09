const mongoose = require('mongoose');

// ── Habit definition ───────────────────────────────────────
const habitSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:   { type: String, required: true, trim: true },
  icon:   { type: String, default: '✅' },
  photo:  { type: String, default: null },
  color:  { type: String, default: '#7c3aed' },
  order:  { type: Number, default: 0 }
}, { timestamps: true });

habitSchema.index({ userId: 1, order: 1 });

// ── Completion log — one document per habit per day ────────
const habitLogSchema = new mongoose.Schema({
  habitId:   { type: mongoose.Schema.Types.ObjectId, ref: 'Habit', required: true },
  date:      { type: Date,    required: true },   // start of day
  completed: { type: Boolean, default: false }
}, { timestamps: true });

habitLogSchema.index({ habitId: 1, date: 1 }, { unique: true });

const Habit    = mongoose.model('Habit',    habitSchema);
const HabitLog = mongoose.model('HabitLog', habitLogSchema);

module.exports = { Habit, HabitLog };
