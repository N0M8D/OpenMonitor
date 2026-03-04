const express = require('express');
const router = express.Router();
const prisma = require('../db');
const { callWebhook, lastChecked, lastStatus } = require('../jobs/checker');

/**
 * POST /api/heartbeat/:token
 *
 * Receives a heartbeat from the OpenMonitor server agent.
 * Identifies the monitor by its secret_token, records an UP check,
 * and updates last_heartbeat_at.
 *
 * Optional JSON body:
 *   { cpu_pct, mem_pct, disk_pct, load_1, uptime_seconds }
 *
 * Returns: { ok: true, received_at: ISO string }
 */
router.post('/:token', async (req, res) => {
    const { token } = req.params;
    const body = req.body || {};

    try {
        const monitor = await prisma.monitor.findUnique({
            where: { secretToken: token },
        });

        if (!monitor) {
            return res.status(404).json({ error: 'Monitor not found' });
        }
        if (monitor.type !== 'server') {
            return res.status(400).json({ error: 'Token belongs to a non-server monitor' });
        }
        if (!monitor.isActive) {
            // Accept heartbeat silently but don't record – monitor is paused
            return res.json({ ok: true, paused: true });
        }

        const now = new Date();
        const prevStatus = lastStatus.get(monitor.id);

        // Build optional metrics metadata
        const metadata = {};
        const fields = ['cpu_pct', 'mem_pct', 'disk_pct', 'load_1', 'uptime_seconds'];
        fields.forEach((f) => { if (body[f] !== undefined) metadata[f] = body[f]; });

        // Record the UP check
        await prisma.check.create({
            data: {
                monitorId: monitor.id,
                isUp: true,
                checkedAt: now,
                ...(Object.keys(metadata).length > 0 && { metadata }),
            },
        });

        // Update last_heartbeat_at in DB
        await prisma.monitor.update({
            where: { id: monitor.id },
            data: { lastHeartbeatAt: now },
        });

        // Sync in-memory state so checker knows the heartbeat arrived
        lastChecked.set(monitor.id, now);
        lastStatus.set(monitor.id, true);

        // Fire recovery webhook if monitor was previously DOWN
        if (prevStatus === false && monitor.webhookUrl) {
            await callWebhook(monitor.webhookUrl, {
                event: 'monitor.up',
                monitor: { id: monitor.id, name: monitor.name, url: monitor.url },
                checkedAt: now.toISOString(),
            });
        }

        res.json({ ok: true, received_at: now.toISOString() });
    } catch (err) {
        console.error('Heartbeat error:', err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
