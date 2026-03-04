const cron = require('node-cron');
const fetch = require('node-fetch');
const prisma = require('../db');

// In-memory state per monitor
// lastChecked: Map<monitorId, Date>         – when was the monitor last checked / heartbeat received
// lastStatus:  Map<monitorId, boolean|null> – last known is_up value (for transition detection)
//
// Exported so that heartbeat.js can update them when a heartbeat arrives.
const lastChecked = new Map();
const lastStatus = new Map();

/**
 * Call a monitor's webhook URL with the given payload.
 * Fires and forgets – errors are only logged.
 */
async function callWebhook(webhookUrl, payload) {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10000);
    try {
      await fetch(webhookUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      });
    } finally {
      clearTimeout(timer);
    }
  } catch (err) {
    console.error(`Webhook call failed for ${webhookUrl}:`, err.message);
  }
}

/**
 * Evaluate staleness of a server-type monitor.
 * We do NOT make HTTP requests – instead we check whether a heartbeat
 * arrived within the grace period (interval × 2.5, minimum 90 s).
 * Only inserts a check row on state transitions to avoid flooding the DB.
 */
async function checkServerMonitor(monitor) {
  // Require at least one heartbeat before marking DOWN
  if (!monitor.lastHeartbeatAt) return;

  const intervalMs = (monitor.intervalSeconds || 60) * 1000;
  const graceMs = Math.max(intervalMs * 2.5, 90 * 1000);
  const msSinceHeartbeat = Date.now() - new Date(monitor.lastHeartbeatAt).getTime();
  const isUp = msSinceHeartbeat < graceMs;
  const prevStatus = lastStatus.get(monitor.id);

  if (!isUp && prevStatus !== false) {
    // Transition: UP/unknown → DOWN
    const checkedAt = new Date();
    const secsSince = Math.round(msSinceHeartbeat / 1000);
    await prisma.check.create({
      data: {
        monitorId: monitor.id,
        isUp: false,
        checkedAt,
        error: `No heartbeat for ${secsSince}s (grace period: ${Math.round(graceMs / 1000)}s)`,
      },
    });
    lastStatus.set(monitor.id, false);
    lastChecked.set(monitor.id, checkedAt);

    if (monitor.webhookUrl) {
      await callWebhook(monitor.webhookUrl, {
        event: 'monitor.down',
        monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
        error: `No heartbeat received for ${secsSince}s`,
        checkedAt: checkedAt.toISOString(),
      });
    }
  } else if (isUp && prevStatus === false) {
    // Recovery already handled by heartbeat.js; just sync in-memory state
    lastStatus.set(monitor.id, true);
  }
}

/**
 * Traverse a dot-notation path in a plain object.
 * e.g. getJsonByPath({a:{b:1}}, 'a.b') === 1
 */
function getJsonByPath(obj, path) {
  return path.split('.').reduce(
    (acc, key) => (acc != null && typeof acc === 'object' ? acc[key] : undefined),
    obj,
  );
}

/**
 * Perform an API-type check: configurable method, headers, body, and assertions.
 * Returns { statusCode, responseTimeMs, isUp, error }.
 */
async function checkApiMonitor(monitor, start) {
  let statusCode = null;
  let responseTimeMs = null;
  let isUp = false;
  let error = null;

  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    const method = (monitor.method || 'GET').toUpperCase();
    const fetchOptions = { method, redirect: 'follow', signal: controller.signal };

    // Build headers object from stored JSONB
    let headersObj = {};
    if (monitor.requestHeaders) {
      try {
        headersObj = typeof monitor.requestHeaders === 'string'
          ? JSON.parse(monitor.requestHeaders)
          : monitor.requestHeaders;
      } catch { /* ignore bad header config */ }
    }

    // Attach body for non-GET/HEAD methods
    if (monitor.requestBody && !['GET', 'HEAD'].includes(method)) {
      if (!headersObj['Content-Type'] && !headersObj['content-type']) {
        headersObj['Content-Type'] = 'application/json';
      }
      fetchOptions.body = monitor.requestBody;
    }

    if (Object.keys(headersObj).length > 0) fetchOptions.headers = headersObj;

    let response;
    try {
      response = await fetch(monitor.url, fetchOptions);
    } finally {
      clearTimeout(timer);
    }

    statusCode = response.status;
    responseTimeMs = Date.now() - start;

    // ── Status code assertion ────────────────────────────────────────────────
    if (monitor.expectedStatusCodes) {
      const allowed = monitor.expectedStatusCodes
        .split(',')
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => !isNaN(n));
      isUp = allowed.includes(statusCode);
      if (!isUp) error = `Expected status ${monitor.expectedStatusCodes}, got ${statusCode}`;
    } else {
      isUp = statusCode >= 200 && statusCode < 400;
    }

    // ── JSON body assertion (only when status check passed) ──────────────────
    if (isUp && monitor.assertJsonPath && monitor.assertJsonValue != null && monitor.assertJsonValue !== '') {
      try {
        const bodyText = await response.text();
        const json = JSON.parse(bodyText);
        const actual = getJsonByPath(json, monitor.assertJsonPath);
        const expected = String(monitor.assertJsonValue);
        const match =
          String(actual) === expected ||
          (!isNaN(expected) && !isNaN(Number(actual)) && Number(actual) === Number(expected));
        if (!match) {
          isUp = false;
          error = `Assertion failed: "${monitor.assertJsonPath}" = ${JSON.stringify(actual)}, expected "${expected}"`;
        }
      } catch {
        isUp = false;
        error = 'Assertion failed: response is not valid JSON';
      }
    }
  } catch (err) {
    responseTimeMs = responseTimeMs ?? Date.now() - start;
    error = err.message;
    isUp = false;
  }

  return { statusCode, responseTimeMs, isUp, error };
}

async function checkMonitor(monitor) {
  // Server-type monitors are handled differently: they push heartbeats to us
  if (monitor.type === 'server') {
    return checkServerMonitor(monitor);
  }

  const start = Date.now();
  let statusCode = null;
  let responseTimeMs = null;
  let isUp = false;
  let error = null;

  if (monitor.type === 'api') {
    ({ statusCode, responseTimeMs, isUp, error } = await checkApiMonitor(monitor, start));
  } else {
    // web / other types – plain GET
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
  }

  const checkedAt = new Date();

  await prisma.check.create({
    data: {
      monitorId: monitor.id,
      statusCode,
      responseTimeMs,
      isUp,
      error,
    },
  });

  // Update in-memory state
  const prevStatus = lastStatus.get(monitor.id);
  lastChecked.set(monitor.id, checkedAt);
  lastStatus.set(monitor.id, isUp);

  // Fire webhook on DOWN (or UP→DOWN transition when previous state was known)
  if (!isUp && monitor.webhookUrl) {
    // Only notify when transitioning to DOWN (or first check is DOWN)
    const justWentDown = prevStatus === true || prevStatus === undefined || prevStatus === null;
    if (justWentDown) {
      await callWebhook(monitor.webhookUrl, {
        event: 'monitor.down',
        monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
        statusCode,
        responseTimeMs,
        error,
        checkedAt: checkedAt.toISOString(),
      });
    }
  }

  // Optionally notify recovery (DOWN→UP)
  if (isUp && prevStatus === false && monitor.webhookUrl) {
    await callWebhook(monitor.webhookUrl, {
      event: 'monitor.up',
      monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
      statusCode,
      responseTimeMs,
      checkedAt: checkedAt.toISOString(),
    });
  }
}

/**
 * Initialise in-memory state from the database on startup.
 * Reads the most recent check per monitor so we know the last checked time and status.
 */
async function initState() {
  try {
    const rows = await prisma.$queryRaw`
      SELECT DISTINCT ON (monitor_id) monitor_id, checked_at, is_up
      FROM checks
      ORDER BY monitor_id, checked_at DESC
    `;
    rows.forEach((r) => {
      lastChecked.set(r.monitor_id, new Date(r.checked_at));
      lastStatus.set(r.monitor_id, r.is_up);
    });
    console.log(`Checker state initialised for ${rows.length} monitor(s)`);
  } catch (err) {
    console.error('Failed to init checker state:', err);
  }
}

function isDue(monitor) {
  // Server monitors are cheap to evaluate (just timestamp comparison),
  // always run them on every tick so we detect missed heartbeats quickly.
  if (monitor.type === 'server') return true;

  const last = lastChecked.get(monitor.id);
  if (!last) return true; // never checked → due immediately
  const intervalMs = (monitor.intervalSeconds || 60) * 1000;
  return Date.now() - last.getTime() >= intervalMs;
}

async function startChecker() {
  await initState();

  cron.schedule('*/30 * * * * *', async () => {
    try {
      const monitors = await prisma.monitor.findMany({ where: { isActive: true } });
      const due = monitors.filter(isDue);
      if (due.length > 0) {
        await Promise.allSettled(due.map(checkMonitor));
      }
    } catch (err) {
      console.error('Checker job error:', err);
    }
  });

  console.log('Monitor checker started (tick every 30 s, respects per-monitor interval)');
}

module.exports = { startChecker, callWebhook, lastChecked, lastStatus };
