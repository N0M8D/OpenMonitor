const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { randomUUID } = require('crypto');

// GET /api/monitors - list all monitors with latest check status, 24h avg response time, uptime % and hourly bars
router.get('/', async (req, res) => {
  try {
    const monitors = await prisma.$queryRaw`
      SELECT
        m.*,
        c.status_code,
        c.response_time_ms,
        c.is_up,
        c.checked_at,
        c.error,
        avg_check.avg_response_time_ms,
        uptime.uptime_pct,
        bars.hourly_bars
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
        SELECT json_agg(
          json_build_object(
            'hour',  h.hour_str,
            'up',    h.up_count,
            'down',  h.down_count,
            'total', h.total_count
          ) ORDER BY h.h
        ) AS hourly_bars
        FROM (
          SELECT
            gs.h,
            to_char(gs.h AT TIME ZONE 'UTC', 'YYYY-MM-DD"T"HH24:00:00"Z"') AS hour_str,
            COUNT(CASE WHEN ch.is_up = true  THEN 1 END)::INTEGER AS up_count,
            COUNT(CASE WHEN ch.is_up = false THEN 1 END)::INTEGER AS down_count,
            COUNT(ch.id)::INTEGER AS total_count
          FROM generate_series(
            date_trunc('hour', NOW() - INTERVAL '23 hours'),
            date_trunc('hour', NOW()),
            INTERVAL '1 hour'
          ) gs(h)
          LEFT JOIN checks ch
            ON ch.monitor_id = m.id
           AND date_trunc('hour', ch.checked_at) = gs.h
          GROUP BY gs.h
        ) h
      ) bars ON true
      ORDER BY m.created_at DESC
    `;
    res.json(monitors);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// POST /api/monitors - create a monitor
router.post('/', async (req, res) => {
  const {
    name, url, type = 'web', interval_seconds = 60, webhook_url,
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
router.delete('/:id', async (req, res) => {
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
router.patch('/:id', async (req, res) => {
  const {
    name, url, type, interval_seconds, is_active, webhook_url,
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
router.post('/:id/regenerate-token', async (req, res) => {
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
