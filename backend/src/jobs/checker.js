const cron = require('node-cron');
const fetch = require('node-fetch');
const pool = require('../db');

async function checkMonitor(monitor) {
  const start = Date.now();
  let status_code = null;
  let response_time_ms = null;
  let is_up = false;
  let error = null;

  try {
    const response = await fetch(monitor.url, {
      redirect: 'follow',
      timeout: 15000,
    });
    status_code = response.status;
    response_time_ms = Date.now() - start;
    is_up = status_code >= 200 && status_code < 400;
  } catch (err) {
    response_time_ms = Date.now() - start;
    error = err.message;
    is_up = false;
  }

  await pool.query(
    'INSERT INTO checks (monitor_id, status_code, response_time_ms, is_up, error) VALUES ($1, $2, $3, $4, $5)',
    [monitor.id, status_code, response_time_ms, is_up, error]
  );
}

function startChecker() {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const result = await pool.query('SELECT * FROM monitors WHERE is_active = true');
      const monitors = result.rows;
      await Promise.allSettled(monitors.map(checkMonitor));
    } catch (err) {
      console.error('Checker job error:', err);
    }
  });
  console.log('Monitor checker started (runs every 30 seconds)');
}

module.exports = { startChecker };
