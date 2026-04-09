require('dotenv').config();
const express = require('express');
const path = require('path');
const morgan = require('morgan');
const bodyParser = require('body-parser');

const connectDB = require('./config/db');
const viewRouter = require('./routes/viewRouter');
const adminRouter = require('./routes/adminRouter');
const mainRouter = express.Router();

const BASE_PATH = process.env.BASE_PATH || '';

// Connect to MongoDB
connectDB();

const app = express();

// ── View Engine ────────────────────────────────────────────
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, 'views'));

// ── Middleware ─────────────────────────────────────────────
app.use(morgan('dev'));
app.use(bodyParser.urlencoded({ extended: true }));
app.use(bodyParser.json());
// app.use(express.static(path.join(__dirname, 'public')));
app.use(BASE_PATH, express.static(path.join(__dirname, 'public')));

// Make __dirname available in all views (for include() absolute paths)
app.locals.root = __dirname;

// ── Routes ─────────────────────────────────────────────────
// mount your routers INSIDE
mainRouter.use('/', viewRouter);
mainRouter.use('/admin', adminRouter);

// then mount once
app.use(BASE_PATH, mainRouter);

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
  console.log(`📊  Dashboard  →  http://localhost:${PORT}`);
  console.log(`⚙️   Admin      →  http://localhost:${PORT}/admin`);
  console.log('');
});
