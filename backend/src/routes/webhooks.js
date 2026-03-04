const express = require('express');
const router = express.Router();
const { callWebhook } = require('../jobs/checker');
const prisma = require('../db');

/**
 * POST /api/webhooks/test
 * Body: { webhook_url: string } OR { monitor_id: number }
 * Sends a test payload to the given webhook URL.
 */
router.post('/test', async (req, res) => {
    let webhookUrl = req.body.webhook_url;

    // If monitor_id is supplied, look up the webhook URL from DB
    if (!webhookUrl && req.body.monitor_id) {
        try {
            const monitor = await prisma.monitor.findUnique({
                where: { id: parseInt(req.body.monitor_id, 10) },
            });
            if (!monitor) return res.status(404).json({ error: 'Monitor not found' });
            webhookUrl = monitor.webhookUrl;
        } catch (err) {
            console.error(err);
            return res.status(500).json({ error: 'Internal server error' });
        }
    }

    if (!webhookUrl) {
        return res.status(400).json({ error: 'webhook_url is required' });
    }

    const payload = {
        event: 'monitor.test',
        message: 'This is a test notification from OpenMonitor.',
        checkedAt: new Date().toISOString(),
    };

    try {
        await callWebhook(webhookUrl, payload);
        res.json({ ok: true, message: 'Test webhook sent' });
    } catch (err) {
        res.status(502).json({ error: 'Failed to reach webhook URL', detail: err.message });
    }
});

module.exports = router;
