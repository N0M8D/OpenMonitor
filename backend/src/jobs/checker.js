const cron = require('node-cron');
const fetch = require('node-fetch');
const prisma = require('../db');

async function checkMonitor(monitor) {
  const start = Date.now();
  let statusCode = null;
  let responseTimeMs = null;
  let isUp = false;
  let error = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    let response;
    try {
      response = await fetch(monitor.url, { redirect: 'follow', signal: controller.signal });
    } finally {
      clearTimeout(timer);
    }
    statusCode = response.status;
    responseTimeMs = Date.now() - start;
    isUp = statusCode >= 200 && statusCode < 400;
  } catch (err) {
    responseTimeMs = Date.now() - start;
    error = err.message;
    isUp = false;
  }

  await prisma.check.create({
    data: {
      monitorId: monitor.id,
      statusCode,
      responseTimeMs,
      isUp,
      error,
    },
  });
}

function startChecker() {
  cron.schedule('*/30 * * * * *', async () => {
    try {
      const monitors = await prisma.monitor.findMany({ where: { isActive: true } });
      await Promise.allSettled(monitors.map(checkMonitor));
    } catch (err) {
      console.error('Checker job error:', err);
    }
  });
  console.log('Monitor checker started (runs every 30 seconds)');
}

module.exports = { startChecker };
