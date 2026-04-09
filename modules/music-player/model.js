/**
 * Music Player Module — Model
 *
 * The music player is a local-file player. Audio files are never uploaded
 * to the server; they are loaded directly in the browser from the user's
 * device. This model file is intentionally minimal — it only exists so
 * future server-side features (e.g. saved queue metadata) have somewhere
 * to live without changing the module structure.
 */

// No Mongoose models needed for local-file playback.
// Export an empty object to keep the require() in index.js consistent.
module.exports = {};
