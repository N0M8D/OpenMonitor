require('dotenv').config();
const express = require('express');
const cors = require('cors');
const rateLimit = require('express-rate-limit');
const fs = require('fs');
const path = require('path');
const pool = require('./db');
const monitorsRouter = require('./routes/monitors');
const checksRouter = require('./routes/checks');
const { startChecker } = require('./jobs/checker');

const app = express();
const PORT = process.env.PORT || 3001;

const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 120,
  standardHeaders: true,
  legacyHeaders: false,
});

app.use(cors());
app.use(express.json());

app.use('/api', apiLimiter);
app.use('/api/monitors', monitorsRouter);
app.use('/api/monitors/:id/checks', checksRouter);

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

async function runMigrations() {
  const sqlPath = path.join(__dirname, 'migrations', '001_initial.sql');
  const sql = fs.readFileSync(sqlPath, 'utf8');
  await pool.query(sql);
  console.log('Migrations applied');
}

async function start() {
  try {
    await runMigrations();
    startChecker();
    app.listen(PORT, () => {
      console.log(`OpenMonitor backend running on port ${PORT}`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

start();
