require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const pgSession = require('connect-pg-simple')(session);
const prisma = require('./db');
const monitorsRouter = require('./routes/monitors');
const checksRouter = require('./routes/checks');
const webhooksRouter = require('./routes/webhooks');
const heartbeatRouter = require('./routes/heartbeat');
const { router: authRouter } = require('./routes/auth');
const usersRouter = require('./routes/users');
const accessRouter = require('./routes/access');
const incidentsRouter = require('./routes/incidents');
const statusRouter = require('./routes/status');
const maintenanceRouter = require('./routes/maintenance');
const activityRouter = require('./routes/activity');
const publicIncidentsRouter = require('./routes/public-incidents');
const { startChecker } = require('./jobs/checker');

const app = express();
const PORT = process.env.PORT || 3001;

// ── CORS (credentials required for session cookies) ───────────────────────────
const FRONTEND_ORIGIN = process.env.FRONTEND_ORIGIN || 'http://localhost:5173';
app.use(cors({
  origin: FRONTEND_ORIGIN,
  credentials: true,
}));

app.use(express.json());

// ── Session ───────────────────────────────────────────────────────────────────
app.use(session({
  store: new pgSession({
    conString: process.env.DATABASE_URL,
    tableName: 'sessions',
    createTableIfMissing: false,
  }),
  secret: process.env.SESSION_SECRET || 'change-me-in-production-use-long-random-string',
  resave: false,
  saveUninitialized: false,
  cookie: {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000, // 7 days
  },
  name: 'openmonitor.sid',
}));

// ── Rate limiting ─────────────────────────────────────────────────────────────
const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use('/api', apiLimiter);

// ── Routes ────────────────────────────────────────────────────────────────────
app.use('/api/auth', authRouter);
app.use('/api/status', statusRouter);
app.use('/api/users', usersRouter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/monitors/:id/checks', checksRouter);
app.use('/api/monitors/:id/incidents', incidentsRouter);
app.use('/api/monitors/:id/maintenance', maintenanceRouter);
app.use('/api/monitors/:id/access', accessRouter);
app.use('/api/activity', activityRouter);
app.use('/api/public-incidents', publicIncidentsRouter);
app.use('/api/webhooks', webhooksRouter);
app.use(
  '/api/heartbeat',
  rateLimit({ windowMs: 60 * 1000, max: 600, standardHeaders: true, legacyHeaders: false }),
  heartbeatRouter,
);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function start() {
  try {
    await startChecker();
    app.listen(PORT, () => {
      console.log(`OpenMonitor backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
