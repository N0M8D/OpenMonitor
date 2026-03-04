const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../db');

// GET /api/monitors/:id/checks - get last 100 checks for a monitor
router.get('/', async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const checks = await prisma.$queryRaw`
      SELECT * FROM checks WHERE monitor_id = ${id} ORDER BY checked_at DESC LIMIT 100
    `;
    res.json(checks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
