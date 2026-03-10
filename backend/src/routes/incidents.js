const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../db');
const { requireAuth, requireMaintainer } = require('../middleware/auth');

router.use(requireAuth);

async function canAccess(user, monitorId) {
    if (user.role === 'admin' || user.role === 'maintainer') return true;
    const entry = await prisma.monitorAccess.findUnique({
        where: { monitorId_userId: { monitorId, userId: user.id } },
    });
    return entry !== null;
}

// GET /api/monitors/:id/incidents — stored incidents with update timelines
router.get('/', async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    if (!await canAccess(req.user, monitorId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const incidents = await prisma.incident.findMany({
            where: { monitorId },
            include: { updates: { orderBy: { createdAt: 'asc' } } },
            orderBy: { startedAt: 'desc' },
            take: 50,
        });
        res.json(incidents);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/monitors/:id/incidents/:iId — set title / status / resolved_at
router.patch('/:iId', requireMaintainer, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    const iId = parseInt(req.params.iId, 10);
    const { title, status, resolved_at } = req.body;
    const data = {};
    if (title !== undefined) data.title = title || null;
    if (status !== undefined) data.status = status;
    if (resolved_at !== undefined) data.resolvedAt = resolved_at ? new Date(resolved_at) : null;
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    try {
        const inc = await prisma.incident.findUnique({ where: { id: iId } });
        if (!inc || inc.monitorId !== monitorId) return res.status(404).json({ error: 'Not found' });
        const updated = await prisma.incident.update({ where: { id: iId }, data });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/monitors/:id/incidents/:iId/updates — add Reddit-style update message
router.post('/:iId/updates', requireMaintainer, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    const iId = parseInt(req.params.iId, 10);
    const { message, status = 'update' } = req.body;
    if (!message?.trim()) return res.status(400).json({ error: 'message is required' });
    try {
        const inc = await prisma.incident.findUnique({ where: { id: iId } });
        if (!inc || inc.monitorId !== monitorId) return res.status(404).json({ error: 'Not found' });
        const update = await prisma.incidentUpdate.create({
            data: { incidentId: iId, message: message.trim(), status, createdById: req.user.id },
        });
        // Auto-close incident when a 'resolved' update is posted
        if (status === 'resolved' && inc.status !== 'resolved') {
            await prisma.incident.update({
                where: { id: iId },
                data: { status: 'resolved', resolvedAt: inc.resolvedAt ?? new Date() },
            });
        }
        res.status(201).json(update);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/monitors/:id/incidents/:iId/updates/:uId
router.delete('/:iId/updates/:uId', requireMaintainer, async (req, res) => {
    const iId = parseInt(req.params.iId, 10);
    const uId = parseInt(req.params.uId, 10);
    try {
        const upd = await prisma.incidentUpdate.findUnique({ where: { id: uId } });
        if (!upd || upd.incidentId !== iId) return res.status(404).json({ error: 'Not found' });
        await prisma.incidentUpdate.delete({ where: { id: uId } });
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;

router.get('/', requireAuth, async (req, res) => {
    try {
        const monitorId = parseInt(req.params.id, 10);
        const { role, id: userId } = req.user;

        if (role === 'user') {
            const entry = await prisma.monitorAccess.findUnique({
                where: { monitorId_userId: { monitorId, userId } },
            });
            if (!entry) return res.status(403).json({ error: 'Access denied' });
        }

        // Fetch up to 2000 oldest→newest checks to compute transitions
        const checks = await prisma.$queryRaw`
      SELECT checked_at, is_up, status_code, error
      FROM checks
      WHERE monitor_id = ${monitorId}
      ORDER BY checked_at ASC
      LIMIT 2000
    `;

        const incidents = [];
        let current = null;

        for (const c of checks) {
            if (!c.is_up && !current) {
                current = {
                    started_at: c.checked_at,
                    down_checks: 1,
                    error: c.error || null,
                    status_code: c.status_code || null,
                    resolved_at: null,
                    duration_seconds: null,
                };
            } else if (!c.is_up && current) {
                current.down_checks++;
                if (c.error) current.error = c.error;
                if (c.status_code) current.status_code = c.status_code;
            } else if (c.is_up && current) {
                current.resolved_at = c.checked_at;
                current.duration_seconds = Math.round(
                    (new Date(c.checked_at) - new Date(current.started_at)) / 1000,
                );
                incidents.push(current);
                current = null;
            }
        }

        // Include any ongoing (unresolved) incident
        if (current) incidents.push(current);

        // Return newest first, cap at 50
        res.json(incidents.reverse().slice(0, 50));
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
