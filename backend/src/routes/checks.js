const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

// GET /api/monitors/:id/checks - get last 100 checks for a monitor
router.get('/', requireAuth, async (req, res) => {
  try {
    const monitorId = parseInt(req.params.id, 10);
    const { role, id: userId } = req.user;

    // Access check for 'user' role
    if (role === 'user') {
      const entry = await prisma.monitorAccess.findUnique({
        where: { monitorId_userId: { monitorId, userId } },
      });
      if (!entry) return res.status(403).json({ error: 'Access denied' });
    }

    const checks = await prisma.$queryRaw`
      SELECT * FROM checks WHERE monitor_id = ${monitorId} ORDER BY checked_at DESC LIMIT 100
    `;
    res.json(checks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
