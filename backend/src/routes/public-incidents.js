const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/public-incidents — public, no auth required
// Returns open incidents + incidents started in the last 30 days, with update timelines.
router.get('/', async (req, res) => {
    try {
        const since = new Date(Date.now() - 30 * 86400 * 1000);
        const incidents = await prisma.incident.findMany({
            where: {
                OR: [
                    { status: 'open' },
                    { startedAt: { gte: since } },
                ],
            },
            include: {
                monitor: { select: { name: true, description: true } },
                updates: { orderBy: { createdAt: 'asc' } },
            },
            orderBy: { startedAt: 'desc' },
            take: 100,
        });
        res.json(incidents);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
