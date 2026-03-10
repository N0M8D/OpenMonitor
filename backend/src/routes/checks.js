const express = require('express');
const router = express.Router({ mergeParams: true });
const { Prisma } = require('@prisma/client');
const prisma = require('../db');
const { requireAuth } = require('../middleware/auth');

const VALID_RANGES = {
  '6h': Prisma.sql`INTERVAL '6 hours'`,
  '24h': Prisma.sql`INTERVAL '24 hours'`,
  '7d': Prisma.sql`INTERVAL '7 days'`,
};

// GET /api/monitors/:id/checks?range=6h|24h|7d
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

    const rangeInterval = VALID_RANGES[req.query.range];
    const checks = rangeInterval
      ? await prisma.$queryRaw`
          SELECT * FROM checks
          WHERE monitor_id = ${monitorId}
            AND checked_at > NOW() - ${rangeInterval}
          ORDER BY checked_at DESC
          LIMIT 2000`
      : await prisma.$queryRaw`
          SELECT * FROM checks
          WHERE monitor_id = ${monitorId}
          ORDER BY checked_at DESC
          LIMIT 100`;

    res.json(checks);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Internal server error' });
  }
});

module.exports = router;
