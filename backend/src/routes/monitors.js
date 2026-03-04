const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/monitors - list all monitors with latest check status and 24h avg response time
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
        avg_check.avg_response_time_ms
      FROM monitors m
      LEFT JOIN LATERAL (
        SELECT * FROM checks
        WHERE monitor_id = m.id
        ORDER BY checked_at DESC
        LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT AVG(response_time_ms)::INTEGER AS avg_response_time_ms
        FROM checks
        WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '24 hours'
      ) avg_check ON true
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
  const { name, url, type = 'web', interval_seconds = 60 } = req.body;
  if (!name || !url) {
    return res.status(400).json({ error: 'name and url are required' });
  }
  try {
    const monitor = await prisma.monitor.create({
      data: { name, url, type, intervalSeconds: interval_seconds },
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
  const { name, url, interval_seconds, is_active } = req.body;
  const data = {};
  if (name !== undefined) data.name = name;
  if (url !== undefined) data.url = url;
  if (interval_seconds !== undefined) data.intervalSeconds = interval_seconds;
  if (is_active !== undefined) data.isActive = is_active;

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

module.exports = router;
