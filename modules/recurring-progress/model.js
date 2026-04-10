const mongoose = require('mongoose');

const periodSchema = new mongoose.Schema({
  periodKey: { type: String, required: true },
  progress:  { type: Number, default: 0, min: 0, max: 100 },
  status:    { type: String, enum: ['idle', 'in-progress'], default: 'idle' }
}, { _id: false });

const recurringProgressSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon:        { type: String, default: '📊' },
  color:       { type: String, default: '#7c3aed' },

  // Recurrence type
  type: { type: String, enum: ['weekly', 'monthly', 'yearly'], default: 'weekly' },

  // Weekly window: day-of-week (0=Sun, 1=Mon … 6=Sat)
  startDow: { type: Number, default: 1 },  // Monday
  endDow:   { type: Number, default: 0 },  // Sunday

  // Monthly / yearly window: day-of-month (1-31)
  startDom: { type: Number, default: 1 },
  endDom:   { type: Number, default: 28 },

  // Yearly window: month (1-12)
  startMonth: { type: Number, default: 1 },
  endMonth:   { type: Number, default: 12 },

  // Optional global date bounds
  startDate: { type: Date, default: null },
  endDate:   { type: Date, default: null },

  active:  { type: Boolean, default: true },
  periods: [periodSchema]
}, { timestamps: true });

recurringProgressSchema.index({ userId: 1 });

module.exports = mongoose.model('RecurringProgress', recurringProgressSchema);
