const express = require('express');
const router = express.Router();
const pool = require('../db');

// GET /api/monitors - list all monitors with latest check status
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(`
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
    `);
    res.json(result.rows);
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
    const result = await pool.query(
      'INSERT INTO monitors (name, url, type, interval_seconds) VALUES ($1, $2, $3, $4) RETURNING *',
      [name, url, type, interval_seconds]
    );
    res.status(201).json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// DELETE /api/monitors/:id - delete a monitor
router.delete('/:id', async (req, res) => {
  try {
    const result = await pool.query('DELETE FROM monitors WHERE id = $1 RETURNING *', [req.params.id]);
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }
    res.json({ message: 'Monitor deleted' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// PATCH /api/monitors/:id - update a monitor
router.patch('/:id', async (req, res) => {
  const { name, url, interval_seconds, is_active } = req.body;
  const fields = [];
  const values = [];
  let i = 1;

  if (name !== undefined) { fields.push(`name = $${i++}`); values.push(name); }
  if (url !== undefined) { fields.push(`url = $${i++}`); values.push(url); }
  if (interval_seconds !== undefined) { fields.push(`interval_seconds = $${i++}`); values.push(interval_seconds); }
  if (is_active !== undefined) { fields.push(`is_active = $${i++}`); values.push(is_active); }

  if (fields.length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  values.push(req.params.id);
  try {
    const result = await pool.query(
      `UPDATE monitors SET ${fields.join(', ')} WHERE id = $${i} RETURNING *`,
      values
    );
    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Monitor not found' });
    }
    res.json(result.rows[0]);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
