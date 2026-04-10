const mongoose = require('mongoose');

// One document per recurring todo rule
const recurringTodoSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },

  text: { type: String, required: true, trim: true },

  // 'weekly' | 'monthly' | 'yearly'
  type: { type: String, enum: ['weekly', 'monthly', 'yearly'], required: true },

  // weekly  → dayOfWeek  0(Sun)–6(Sat)
  // monthly → dayOfMonth 1–31
  // yearly  → dayOfMonth 1–31  +  monthOfYear 1–12
  dayOfWeek:   { type: Number, min: 0,  max: 6  },
  dayOfMonth:  { type: Number, min: 1,  max: 31 },
  monthOfYear: { type: Number, min: 1,  max: 12 },

  // Date range during which the rule is active
  startDate: { type: Date, default: () => new Date() },
  endDate:   { type: Date, default: null },   // null = no end

  // Soft-hide without deleting
  active: { type: Boolean, default: true },

  // Track which specific calendar dates have been checked off.
  // Stored as YYYY-MM-DD strings for easy daily lookup.
  completions: [{ type: String }]
}, { timestamps: true });

// Index for fast per-user queries
recurringTodoSchema.index({ userId: 1, active: 1 });

/**
 * Return all active rules for userId whose schedule matches `date`.
 * Also attaches `completedToday` based on the date string.
 */
recurringTodoSchema.statics.getTodayItems = async function (userId, date) {
  const d        = date || new Date();
  const ymd      = d.toISOString().slice(0, 10); // YYYY-MM-DD
  const dow      = d.getDay();                   // 0–6
  const dom      = d.getDate();                  // 1–31
  const moy      = d.getMonth() + 1;             // 1–12

  const rules = await this.find({ userId, active: true }).lean();

  return rules
    .filter(r => {
      // Must be within date range
      if (r.startDate && d < new Date(r.startDate)) return false;
      if (r.endDate   && d > new Date(r.endDate))   return false;

      if (r.type === 'weekly')  return r.dayOfWeek  === dow;
      if (r.type === 'monthly') return r.dayOfMonth === dom;
      if (r.type === 'yearly')  return r.dayOfMonth === dom && r.monthOfYear === moy;
      return false;
    })
    .map(r => ({
      ...r,
      completedToday: r.completions.includes(ymd)
    }));
};

module.exports = mongoose.model('RecurringTodo', recurringTodoSchema);
