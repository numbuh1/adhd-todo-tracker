const mongoose = require('mongoose');

const eventSchema = new mongoose.Schema({
  date:        { type: Date,   required: true },
  title:       { type: String, required: true, trim: true },
  description: { type: String, default: '',   trim: true },
  color:       { type: String, default: '#f59e0b' }  // amber dot
}, { timestamps: true });

module.exports = mongoose.model('CalendarEvent', eventSchema);
