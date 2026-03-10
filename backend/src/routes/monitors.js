const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { randomUUID } = require('crypto');
const { requireAuth, requireMaintainer } = require('../middleware/auth');

// All monitor routes require a valid session
router.use(requireAuth);

/** Returns true if the user can see/access a given monitor. */
async function canAccessMonitor(user, monitorId) {
  if (user.role === 'admin' || user.role === 'maintainer') return true;
  const entry = await prisma.monitorAccess.findUnique({
    where: { monitorId_userId: { monitorId, userId: user.id } },
  });
  return entry !== null;
}

// GET /api/monitors - list all monitors with latest check status, 24h avg response time, uptime % and hourly bars
router.get('/', async (req, res) => {
  const { role, id: userId } = req.user;
  // Build access filter clause
  const accessClause =
    role === 'admin' || role === 'maintainer'
      ? '' // no filter – see everything
      : `AND m.id IN (SELECT monitor_id FROM monitor_access WHERE user_id = ${userId})`;

  try {
    const monitors = await prisma.$queryRawUnsafe(`
      SELECT
        m.*,
        m.created_at AS monitor_created_at,
        c.status_code,
        c.response_time_ms,
        c.is_up,
        c.checked_at,
        c.error,
        avg_check.avg_response_time_ms,
        uptime.uptime_pct,
        uptime_7d.uptime_7d_pct,
        uptime_30d.uptime_30d_pct,
        bars.daily_bars,
        mw.maintenance_active,
        mw.maintenance_description,
        mw.maintenance_start_at,
        mw.maintenance_end_at,
        mw.maintenance_id
      FROM monitors m
      LEFT JOIN LATERAL (
        SELECT * FROM checks
        WHERE monitor_id = m.id
        ORDER BY checked_at DESC
        LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT
          AVG(response_time_ms)::INTEGER AS avg_response_time_ms
        FROM checks
        WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '24 hours'
      ) avg_check ON true
      LEFT JOIN LATERAL (
        SELECT
          ROUND(
            COUNT(CASE WHEN is_up THEN 1 END)::NUMERIC
            / NULLIF(COUNT(*), 0) * 100,
            2
          ) AS uptime_pct
        FROM checks
        WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '24 hours'
      ) uptime ON true
      LEFT JOIN LATERAL (
        SELECT
          ROUND(
            COUNT(CASE WHEN is_up THEN 1 END)::NUMERIC
            / NULLIF(COUNT(*), 0) * 100,
            2
          ) AS uptime_7d_pct
        FROM checks
        WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '7 days'
      ) uptime_7d ON true
      LEFT JOIN LATERAL (
        SELECT
          ROUND(
            COUNT(CASE WHEN is_up THEN 1 END)::NUMERIC
            / NULLIF(COUNT(*), 0) * 100,
            2
          ) AS uptime_30d_pct
        FROM checks
        WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '30 days'
      ) uptime_30d ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'day',               d.day_str,
            'up',                d.up_count,
            'down',              d.down_count,
            'total',             d.total_count,
            'incident',          d.had_incident,
            'maintenance',       d.had_maintenance,
            'max_incident_secs', d.max_incident_secs
          ) ORDER BY d.d
        ) AS daily_bars
        FROM (
          SELECT
            gs.d,
            to_char(gs.d AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_str,
            COUNT(CASE WHEN ch.is_up = true  THEN 1 END)::INTEGER AS up_count,
            COUNT(CASE WHEN ch.is_up = false THEN 1 END)::INTEGER AS down_count,
            COUNT(ch.id)::INTEGER                                  AS total_count,
            EXISTS(
              SELECT 1 FROM incidents inc
              WHERE inc.monitor_id = m.id
                AND date_trunc('day', inc.started_at AT TIME ZONE 'UTC') = gs.d
            ) AS had_incident,
            EXISTS(
              SELECT 1 FROM maintenance_windows mw2
              WHERE mw2.monitor_id = m.id
                AND date_trunc('day', mw2.start_at AT TIME ZONE 'UTC') = gs.d
            ) AS had_maintenance,
            COALESCE((
              SELECT MAX(EXTRACT(EPOCH FROM (COALESCE(inc.resolved_at, NOW()) - inc.started_at))::INTEGER)
              FROM incidents inc
              WHERE inc.monitor_id = m.id
                AND date_trunc('day', inc.started_at AT TIME ZONE 'UTC') = gs.d
            ), 0) AS max_incident_secs
          FROM generate_series(
            date_trunc('day', NOW() AT TIME ZONE 'UTC') - INTERVAL '59 days',
            date_trunc('day', NOW() AT TIME ZONE 'UTC'),
            INTERVAL '1 day'
          ) gs(d)
          LEFT JOIN checks ch
            ON ch.monitor_id = m.id
           AND date_trunc('day', ch.checked_at AT TIME ZONE 'UTC') = gs.d
          GROUP BY gs.d
        ) d
      ) bars ON true
      LEFT JOIN LATERAL (
        SELECT
          id                                                        AS maintenance_id,
          description                                               AS maintenance_description,
          start_at                                                  AS maintenance_start_at,
          end_at                                                    AS maintenance_end_at,
          (start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())) AS maintenance_active
        FROM maintenance_windows
        WHERE monitor_id = m.id
          AND (end_at IS NULL OR end_at > NOW())
          AND start_at <= NOW() + INTERVAL '1 year'
        ORDER BY start_at ASC
        LIMIT 1
      ) mw ON true
      WHERE 1=1 ${accessClause}
      ORDER BY m.created_at DESC
    `);
    res.json(monitors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/monitors - create a monitor
router.post('/', requireMaintainer, async (req, res) => {
  const {
    name, url, type = 'web', interval_seconds = 60, webhook_url, description,
    method, request_headers, request_body, expected_status_codes,
    assert_json_path, assert_json_value,
  } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'name and url are required' });
  }
  const secretToken = type === 'server' ? randomUUID().replace(/-/g, '') : null;
  try {
    const monitor = await prisma.monitor.create({
      data: {
        name, url, type,
        intervalSeconds: interval_seconds,
        webhookUrl: webhook_url || null,
        description: description || null,
        secretToken,
        method: method || 'GET',
        requestHeaders: request_headers || null,
        requestBody: request_body || null,
        expectedStatusCodes: expected_status_codes || null,
        assertJsonPath: assert_json_path || null,
        assertJsonValue: assert_json_value || null,
      },
    });
    res.status(201).json(monitor);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/monitors/:id - delete a monitor
router.delete('/:id', requireMaintainer, async (req, res) => {
  try {
    await prisma.monitor.delete({ where: { id: parseInt(req.params.id, 10) } });
    res.json({ message: 'Monitor deleted' });
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Monitor not found' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/monitors/:id - update a monitor
router.patch('/:id', requireMaintainer, async (req, res) => {
  const {
    name, url, type, interval_seconds, is_active, webhook_url, description,
    method, request_headers, request_body, expected_status_codes,
    assert_json_path, assert_json_value,
  } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (url !== undefined) data.url = url;
  if (type !== undefined) data.type = type;
  if (interval_seconds !== undefined) data.intervalSeconds = interval_seconds;
  if (is_active !== undefined) data.isActive = is_active;
  if (webhook_url !== undefined) data.webhookUrl = webhook_url || null;
  if (description !== undefined) data.description = description || null;
  if (method !== undefined) data.method = method || 'GET';
  if (request_headers !== undefined) data.requestHeaders = request_headers || null;
  if (request_body !== undefined) data.requestBody = request_body || null;
  if (expected_status_codes !== undefined) data.expectedStatusCodes = expected_status_codes || null;
  if (assert_json_path !== undefined) data.assertJsonPath = assert_json_path || null;
  if (assert_json_value !== undefined) data.assertJsonValue = assert_json_value || null;

  if (Object.keys(data).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const monitor = await prisma.monitor.update({
      where: { id: parseInt(req.params.id, 10) },
      data,
    });
    res.json(monitor);
  } catch (err) {
    if (err.code === 'P2025') {
      return res.status(404).json({ error: 'Monitor not found' });
    }
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/monitors/:id/regenerate-token - regenerate secret token for a server monitor
router.post('/:id/regenerate-token', requireMaintainer, async (req, res) => {
  try {
    const monitor = await prisma.monitor.findUnique({ where: { id: parseInt(req.params.id, 10) } });
    if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
    if (monitor.type !== 'server') return res.status(400).json({ error: 'Only server monitors have tokens' });

    const secretToken = randomUUID().replace(/-/g, '');
    const updated = await prisma.monitor.update({
      where: { id: monitor.id },
      data: { secretToken },
    });
    res.json({ secret_token: updated.secretToken });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
