const express = require('express');
const prisma = require('../db');
const { requireAuth, requireAdmin, validateOrigin } = require('../middleware/auth');

const router = express.Router({ mergeParams: true });

router.use(requireAuth);

// ── GET /api/monitors/:id/access ──────────────────────────────────────────────
// Returns list of user IDs that have access to this monitor.
router.get('/', requireAdmin, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    try {
        const entries = await prisma.monitorAccess.findMany({
            where: { monitorId },
            include: {
                user: {
                    select: { id: true, username: true, email: true, role: true },
                },
            },
        });
        res.json(entries.map((e) => e.user));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// ── PUT /api/monitors/:id/access ──────────────────────────────────────────────
// Replace the entire access list for this monitor with the given user_ids array.
router.put('/', requireAdmin, validateOrigin, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    const { user_ids } = req.body; // array of integer user IDs

    if (!Array.isArray(user_ids)) {
        return res.status(400).json({ error: 'user_ids must be an array' });
    }

    try {
        // Replace in a transaction
        await prisma.$transaction([
            prisma.monitorAccess.deleteMany({ where: { monitorId } }),
            ...user_ids.map((userId) =>
                prisma.monitorAccess.create({ data: { monitorId, userId } }),
            ),
        ]);
        res.json({ ok: true, monitor_id: monitorId, user_ids });
    } catch (err) {
        if (err.code === 'P2003') return res.status(400).json({ error: 'One or more user IDs are invalid' });
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
