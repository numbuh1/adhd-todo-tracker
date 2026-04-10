const mongoose = require('mongoose');

const taskSchema = new mongoose.Schema({
  userId:      { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:        { type: String, required: true, trim: true },
  description: { type: String, default: '' },
  icon:        { type: String, default: '📋' },
  progress:    { type: Number, default: 0, min: 0, max: 100 },
  status:      { type: String, enum: ['idle', 'in-progress'], default: 'idle' },
  color:       { type: String, default: '#7c3aed' },
  deadline:    { type: Date, default: null },
  visible:     { type: Boolean, default: true }
}, { timestamps: true });

taskSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('ProgressTask', taskSchema);
