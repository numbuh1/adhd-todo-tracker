const mongoose = require('mongoose');

const settingsSchema = new mongoose.Schema({
  userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, unique: true },

  theme: {
    accentColor:       { type: String, default: '#7c3aed' },
    backgroundColor:   { type: String, default: '#0a0a16' },
    cardColor:         { type: String, default: '#12122a' },
    textColor:         { type: String, default: '#e2e8f0' },
    wallpaper:         { type: String, default: null },
    wallpaperOpacity:  { type: Number, default: 0.15, min: 0, max: 1 }
  },

  // gridLayout stores Gridstack positions { x, y, w, h } per module key.
  gridLayout: {
    type: mongoose.Schema.Types.Mixed,
    default: () => ({
      calendar:     { x: 0, y: 0, w: 4, h: 6 },
      weeklyGoals:  { x: 4, y: 0, w: 4, h: 3 },
      weeklyTodos:  { x: 4, y: 3, w: 4, h: 5 },
      habitTracker: { x: 8, y: 0, w: 4, h: 5 },
      musicPlayer:  { x: 8, y: 5, w: 4, h: 4 },
      progress:     { x: 0, y: 8, w: 12, h: 4 }
    })
  },

  modules: {
    calendar:    { enabled: { type: Boolean, default: true } },
    weeklyTodos: { enabled: { type: Boolean, default: true } },
    habitTracker: {
      enabled:    { type: Boolean, default: true },
      daysToShow: { type: Number,  default: 3, min: 1, max: 7 }
    },
    musicPlayer: {
      enabled:      { type: Boolean, default: true },
      showSongName: { type: Boolean, default: true },
      showJacket:   { type: Boolean, default: true },
      showPlaylist: { type: Boolean, default: true }
    },
    progress: {
      enabled: { type: Boolean, default: true }
    }
  }
}, { timestamps: true });

// Per-user singleton — get or create settings for the given userId
settingsSchema.statics.getSettings = async function (userId) {
  let s = await this.findOne({ userId });
  if (!s) s = await this.create({ userId });

  // Back-fill gridLayout if missing entirely
  if (!s.gridLayout) {
    s.gridLayout = {
      calendar:     { x: 0, y: 0, w: 4, h: 6 },
      weeklyGoals:  { x: 4, y: 0, w: 4, h: 3 },
      weeklyTodos:  { x: 4, y: 3, w: 4, h: 5 },
      habitTracker: { x: 8, y: 0, w: 4, h: 5 },
      musicPlayer:  { x: 8, y: 5, w: 4, h: 4 },
      progress:     { x: 0, y: 8, w: 12, h: 4 }
    };
    s.markModified('gridLayout');
    await s.save();
  }

  // Back-fill individual keys added in later versions
  let dirty = false;
  const backfill = {
    musicPlayer:  { x: 8, y: 5, w: 4, h: 4 },
    weeklyGoals:  { x: 4, y: 0, w: 4, h: 3 },
    progress:     { x: 0, y: 8, w: 12, h: 4 }
  };
  for (const [key, def] of Object.entries(backfill)) {
    if (!s.gridLayout[key]) { s.gridLayout[key] = def; dirty = true; }
  }
  if (dirty) { s.markModified('gridLayout'); await s.save(); }

  return s;
};

module.exports = mongoose.model('Settings', settingsSchema);
