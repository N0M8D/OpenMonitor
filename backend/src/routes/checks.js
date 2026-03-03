const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db');

// GET /api/monitors/:id/checks - get last 100 checks for a monitor
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM checks WHERE monitor_id = $1 ORDER BY checked_at DESC LIMIT 100',
      [req.params.id]
    );
    res.json(result.rows);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
