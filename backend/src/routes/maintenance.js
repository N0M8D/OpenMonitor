const express = require('express');
const router = express.Router({ mergeParams: true });
const prisma = require('../db');
const { requireAuth, requireMaintainer } = require('../middleware/auth');

router.use(requireAuth);

function parseOptionalDate(val) {
    if (!val) return null;
    const d = new Date(val);
    return isNaN(d.getTime()) ? null : d;
}

async function canAccess(user, monitorId) {
    if (user.role === 'admin' || user.role === 'maintainer') return true;
    const entry = await prisma.monitorAccess.findUnique({
        where: { monitorId_userId: { monitorId, userId: user.id } },
    });
    return entry !== null;
}

// GET /api/monitors/:id/maintenance
router.get('/', async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    if (!await canAccess(req.user, monitorId)) return res.status(403).json({ error: 'Access denied' });
    try {
        const windows = await prisma.$queryRaw`
      SELECT *, (start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())) AS is_active
      FROM maintenance_windows
      WHERE monitor_id = ${monitorId}
      ORDER BY start_at DESC
      LIMIT 100
    `;
        res.json(windows);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/monitors/:id/maintenance  — create (or "start now")
router.post('/', requireMaintainer, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    const { description, start_at, end_at } = req.body;
    const startAt = parseOptionalDate(start_at) || new Date();
    const endAt = parseOptionalDate(end_at);
    if (endAt && endAt <= startAt) {
        return res.status(400).json({ error: 'end_at must be after start_at' });
    }
    try {
        const monitor = await prisma.monitor.findUnique({ where: { id: monitorId } });
        if (!monitor) return res.status(404).json({ error: 'Monitor not found' });

        const result = await prisma.maintenanceWindow.create({
            data: {
                monitorId,
                description: description || null,
                startAt,
                endAt: endAt || null,
                createdById: req.user.id,
            },
        });
        res.status(201).json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// PATCH /api/monitors/:id/maintenance/:mwId
router.patch('/:mwId', requireMaintainer, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    const mwId = parseInt(req.params.mwId, 10);
    const { description, start_at, end_at } = req.body;
    const data = {};
    if (description !== undefined) data.description = description || null;
    if (start_at !== undefined) data.startAt = parseOptionalDate(start_at);
    if (end_at !== undefined) data.endAt = parseOptionalDate(end_at);
    if (Object.keys(data).length === 0) return res.status(400).json({ error: 'Nothing to update' });
    try {
        const win = await prisma.maintenanceWindow.findUnique({ where: { id: mwId } });
        if (!win || win.monitorId !== monitorId) return res.status(404).json({ error: 'Not found' });
        const updated = await prisma.maintenanceWindow.update({ where: { id: mwId }, data });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// POST /api/monitors/:id/maintenance/:mwId/stop  — stop active maintenance (set end_at = NOW())
router.post('/:mwId/stop', requireMaintainer, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    const mwId = parseInt(req.params.mwId, 10);
    try {
        const win = await prisma.maintenanceWindow.findUnique({ where: { id: mwId } });
        if (!win || win.monitorId !== monitorId) return res.status(404).json({ error: 'Not found' });
        const updated = await prisma.maintenanceWindow.update({
            where: { id: mwId },
            data: { endAt: new Date() },
        });
        res.json(updated);
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

// DELETE /api/monitors/:id/maintenance/:mwId
router.delete('/:mwId', requireMaintainer, async (req, res) => {
    const monitorId = parseInt(req.params.id, 10);
    const mwId = parseInt(req.params.mwId, 10);
    try {
        const win = await prisma.maintenanceWindow.findUnique({ where: { id: mwId } });
        if (!win || win.monitorId !== monitorId) return res.status(404).json({ error: 'Not found' });
        await prisma.maintenanceWindow.delete({ where: { id: mwId } });
        res.json({ message: 'Deleted' });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
