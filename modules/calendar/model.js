const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  date:        { type: Date,   required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '',   trim: true },
  color:       { type: String, default: '#f59e0b' }
}, { timestamps: true });

eventSchema.index({ userId: 1, date: 1 });

module.exports = mongoose.model('CalendarEvent', eventSchema);
