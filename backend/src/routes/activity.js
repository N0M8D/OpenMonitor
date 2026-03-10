const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/activity — public, no auth required
// Returns maintenance windows: active, scheduled and recent completed (last 30 days).
router.get('/', async (req, res) => {
    try {
        const rows = await prisma.$queryRaw`
      SELECT
        mw.id,
        mw.monitor_id,
        m.name    AS monitor_name,
        mw.description,
        mw.start_at,
        mw.end_at,
        mw.created_at,
        CASE
          WHEN mw.start_at > NOW() THEN 'scheduled'
          WHEN mw.start_at <= NOW() AND (mw.end_at IS NULL OR mw.end_at > NOW()) THEN 'active'
          ELSE 'completed'
        END AS status
      FROM maintenance_windows mw
      JOIN monitors m ON m.id = mw.monitor_id
      WHERE
        -- future/active windows (no time limit)
        mw.end_at IS NULL
        OR mw.end_at > NOW()
        -- completed windows in the last 30 days
        OR (mw.end_at <= NOW() AND mw.start_at > NOW() - INTERVAL '30 days')
      ORDER BY mw.start_at DESC
      LIMIT 100
    `;
        res.json(rows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
