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
      weeklyTodos:  { x: 4, y: 0, w: 5, h: 6 },
      habitTracker: { x: 9, y: 0, w: 3, h: 4 },
      musicPlayer:  { x: 9, y: 4, w: 3, h: 5 }
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
    }
  }
}, { timestamps: true });

// Per-user singleton — get or create settings for the given userId
settingsSchema.statics.getSettings = async function (userId) {
  let s = await this.findOne({ userId });
  if (!s) s = await this.create({ userId });

  // Back-fill gridLayout if missing (e.g. older documents)
  if (!s.gridLayout) {
    s.gridLayout = {
      calendar:     { x: 0, y: 0, w: 4, h: 6 },
      weeklyTodos:  { x: 4, y: 0, w: 5, h: 6 },
      habitTracker: { x: 9, y: 0, w: 3, h: 4 },
      musicPlayer:  { x: 9, y: 4, w: 3, h: 5 }
    };
    s.markModified('gridLayout');
    await s.save();
  }

  if (s.gridLayout && !s.gridLayout.musicPlayer) {
    s.gridLayout.musicPlayer = { x: 9, y: 4, w: 3, h: 5 };
    s.markModified('gridLayout');
    await s.save();
  }

  return s;
};

module.exports = mongoose.model('Settings', settingsSchema);
