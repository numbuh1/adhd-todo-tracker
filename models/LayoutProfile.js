const mongoose = require('mongoose');

const layoutProfileSchema = new mongoose.Schema({
  userId:     { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  name:       { type: String, required: true, trim: true },
  gridLayout: { type: mongoose.Schema.Types.Mixed, default: {} }
}, { timestamps: true });

layoutProfileSchema.index({ userId: 1, name: 1 });

module.exports = mongoose.model('LayoutProfile', layoutProfileSchema);
