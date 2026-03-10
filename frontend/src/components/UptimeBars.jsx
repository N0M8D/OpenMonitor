import { useState } from 'react';

/**
 * UptimeBars – 60-day miniature bar chart for a monitor card.
 *
 * Props:
 *   bars      – array of 60 objects: { day, up, down, total, incident, maintenance, max_incident_secs }
 *   createdAt – ISO string of when the monitor was created.
 *               Days after createdAt with total=0 are muted red (should have data).
 */
export default function UptimeBars({ bars, createdAt }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!bars || bars.length === 0) {
        return <div className="uptime-empty">No data</div>;
    }

    const createdMs = createdAt ? new Date(createdAt).getTime() : null;

    const hovered = hoveredIndex !== null ? bars[hoveredIndex] : null;
    const tooltipText = hovered
        ? hovered.total === 0
            ? `${formatDay(hovered.day)} – no data`
            : `${formatDay(hovered.day)} – ${Math.round((hovered.up / hovered.total) * 100)}% up (${hovered.up}↑ ${hovered.down}↓)`
        : null;

    const tooltipLeft = hoveredIndex !== null
        ? `${((hoveredIndex + 0.5) / bars.length) * 100}%`
        : '50%';

    return (
        <div className="uptime-bars" style={{ gap: '1px' }}>
            {bars.map((b, i) => (
                <div
                    key={i}
                    className="uptime-bar"
                    style={{ background: barColor(b, createdMs) }}
                    onMouseEnter={() => setHoveredIndex(i)}
                    onMouseLeave={() => setHoveredIndex(null)}
                />
            ))}

            {tooltipText && (
                <div className="uptime-tooltip" style={{ left: tooltipLeft }}>
                    {tooltipText}
                </div>
            )}
        </div>
    );
}

function barColor(b, createdMs) {
    if (b.total === 0) {
        if (createdMs != null) {
            // Day bar represents midnight→midnight; monitor was created before end of day → should have had checks
            const dayEnd = new Date(b.day + 'T23:59:59Z').getTime();
            if (dayEnd > createdMs) {
                // No data received after deployment – treat as DOWN, unless maintenance was active that day
                if (b.maintenance) return '#f59e0b'; // yellow – expected downtime (maintenance)
                return '#ef4444'; // red – no data = full outage
            }
        }
        return '#1e3a52'; // gray – before monitor existed
    }
    if (b.down === 0) return '#22c55e'; // all up → green
    // Has some downtime – classify by incident severity
    if (b.incident && !b.maintenance && (b.max_incident_secs || 0) > 3600) return '#ef4444'; // red – significant outage
    return '#f59e0b'; // yellow – minor or maintenance-covered
}

function formatDay(isoDay) {
    if (!isoDay) return '?';
    return new Date(isoDay + 'T12:00:00Z').toLocaleDateString(undefined, {
        month: 'short', day: 'numeric', year: 'numeric',
    });
}

