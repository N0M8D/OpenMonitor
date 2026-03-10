const express = require('express');
const router = express.Router();
const prisma = require('../db');

// GET /api/status — public, no auth required
// Returns overall status + per-monitor summary for a public status page.
router.get('/', async (req, res) => {
    try {
        const monitors = await prisma.$queryRaw`
      SELECT
        m.id,
        m.name,
        m.type,
        m.description,
        m.is_active,
        m.created_at,
        c.is_up,
        c.checked_at,
        uptime.uptime_pct,
        avg_check.avg_response_time_ms,
        bars.daily_bars,
        mw.maintenance_active,
        mw.maintenance_description,
        mw.maintenance_start_at,
        mw.maintenance_end_at,
        mw.maintenance_id
      FROM monitors m
      LEFT JOIN LATERAL (
        SELECT is_up, checked_at
        FROM checks
        WHERE monitor_id = m.id
        ORDER BY checked_at DESC
        LIMIT 1
      ) c ON true
      LEFT JOIN LATERAL (
        SELECT
          ROUND(
            COUNT(CASE WHEN is_up THEN 1 END)::NUMERIC
            / NULLIF(COUNT(*), 0) * 100,
            2
          ) AS uptime_pct
        FROM checks
        WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '24 hours'
      ) uptime ON true
      LEFT JOIN LATERAL (
        SELECT AVG(response_time_ms)::INTEGER AS avg_response_time_ms
        FROM checks
        WHERE monitor_id = m.id AND checked_at > NOW() - INTERVAL '24 hours'
      ) avg_check ON true
      LEFT JOIN LATERAL (
        SELECT json_agg(
          json_build_object(
            'day',               d.day_str,
            'up',                d.up_count,
            'down',              d.down_count,
            'total',             d.total_count,
            'incident',          d.had_incident,
            'maintenance',       d.had_maintenance,
            'max_incident_secs', d.max_incident_secs
          ) ORDER BY d.d
        ) AS daily_bars
        FROM (
          SELECT
            gs.d,
            to_char(gs.d AT TIME ZONE 'UTC', 'YYYY-MM-DD') AS day_str,
            COUNT(CASE WHEN ch.is_up = true  THEN 1 END)::INTEGER AS up_count,
            COUNT(CASE WHEN ch.is_up = false THEN 1 END)::INTEGER AS down_count,
            COUNT(ch.id)::INTEGER                                  AS total_count,
            EXISTS(
              SELECT 1 FROM incidents inc
              WHERE inc.monitor_id = m.id
                AND date_trunc('day', inc.started_at AT TIME ZONE 'UTC') = gs.d
            ) AS had_incident,
            EXISTS(
              SELECT 1 FROM maintenance_windows mw2
              WHERE mw2.monitor_id = m.id
                AND date_trunc('day', mw2.start_at AT TIME ZONE 'UTC') = gs.d
            ) AS had_maintenance,
            COALESCE((
              SELECT MAX(EXTRACT(EPOCH FROM (COALESCE(inc.resolved_at, NOW()) - inc.started_at))::INTEGER)
              FROM incidents inc
              WHERE inc.monitor_id = m.id
                AND date_trunc('day', inc.started_at AT TIME ZONE 'UTC') = gs.d
            ), 0) AS max_incident_secs
          FROM generate_series(
            date_trunc('day', NOW() AT TIME ZONE 'UTC') - INTERVAL '59 days',
            date_trunc('day', NOW() AT TIME ZONE 'UTC'),
            INTERVAL '1 day'
          ) gs(d)
          LEFT JOIN checks ch
            ON ch.monitor_id = m.id
           AND date_trunc('day', ch.checked_at AT TIME ZONE 'UTC') = gs.d
          GROUP BY gs.d
        ) d
      ) bars ON true
      LEFT JOIN LATERAL (
        SELECT
          (start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())) AS maintenance_active,
          description AS maintenance_description,
          start_at    AS maintenance_start_at,
          end_at      AS maintenance_end_at,
          id          AS maintenance_id
        FROM maintenance_windows
        WHERE monitor_id = m.id
          AND (
            (start_at <= NOW() AND (end_at IS NULL OR end_at > NOW()))
            OR start_at > NOW()
          )
        ORDER BY
          (start_at <= NOW() AND (end_at IS NULL OR end_at > NOW())) DESC,
          start_at ASC
        LIMIT 1
      ) mw ON true
      WHERE m.is_active = true
      ORDER BY m.created_at ASC
    `;

        const activeMonitors = monitors.filter((m) => m.is_active !== false);
        // Monitors in active maintenance are excluded from degraded/outage calculation
        const unmitigatedDown = activeMonitors.filter(
            (m) => m.is_up === false && !m.maintenance_active,
        ).length;
        const maintenanceDown = activeMonitors.filter(
            (m) => m.is_up === false && m.maintenance_active,
        ).length;

        const overall =
            unmitigatedDown === 0 && maintenanceDown === 0 ? 'operational'
                : unmitigatedDown === 0 && maintenanceDown > 0 ? 'maintenance'
                    : unmitigatedDown < activeMonitors.length ? 'degraded'
                        : 'outage';

        res.json({
            overall,
            updated_at: new Date().toISOString(),
            monitors,
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ error: 'Internal server error' });
    }
});

module.exports = router;
