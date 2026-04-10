require('dotenv').config();
const express    = require('express');
const path       = require('path');
const morgan     = require('morgan');
const bodyParser = require('body-parser');
const session    = require('express-session');
const MongoStore = require('connect-mongo');

const connectDB    = require('./config/db');
const viewRouter   = require('./routes/viewRouter');
const adminRouter  = require('./routes/adminRouter');
const authRouter   = require('./routes/authRouter');

connectDB();

const app = express();

// ── Sub-path support ───────────────────────────────────────
// Set BASE_PATH=/adhd-todo-tracker in .env when hosting at a sub-path.
// Leave blank (or omit) when running at the domain root.
const BASE_PATH = (process.env.BASE_PATH || '').replace(/\/$/, ''); // strip trailing slash

// ── View Engine ────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ─────────────────────────────────────────────
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());

// Serve static files at base path  (e.g. /adhd-todo-tracker/css/...)
app.use(BASE_PATH || '/', express.static(path.join(__dirname, 'public')));

// Session
app.use(session({
  secret:            process.env.SESSION_SECRET || 'adhd-tracker-secret-change-me',
  resave:            false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/adhd-tracker'
  }),
  cookie: { maxAge: 1000 * 60 * 60 * 24 * 7 } // 7 days
}));

// Inject helpers into every request
app.use((req, res, next) => {
  res.locals.basePath    = BASE_PATH;
  res.locals.currentUser = req.session.userId
    ? { _id: req.session.userId, username: req.session.username }
    : null;
  next();
});

// Store in app.locals so route handlers can access via req.app.locals
app.locals.basePath = BASE_PATH;
app.locals.root     = __dirname;

// ── Auth guard ─────────────────────────────────────────────
function requireAuth(req, res, next) {
  if (!req.session.userId) return res.redirect(BASE_PATH + '/login');
  next();
}

// ── Routes ─────────────────────────────────────────────────
// Public auth routes (login / register / logout)
app.use(BASE_PATH || '/', authRouter);

// Protected routes
app.use(BASE_PATH || '/',        requireAuth, viewRouter);
app.use(BASE_PATH + '/admin',    requireAuth, adminRouter);

// ── Error Handler ──────────────────────────────────────────
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).send(`<h1>Error</h1><pre>${err.message}</pre>`);
});

// ── Start Server ───────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('');
  console.log('🧠  ADHD Tracker is running!');
  console.log(`📊  Dashboard  →  http://localhost:${PORT}${BASE_PATH}/`);
  console.log(`⚙️   Admin      →  http://localhost:${PORT}${BASE_PATH}/admin`);
  console.log('');
});
