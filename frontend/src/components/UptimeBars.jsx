import { useState } from 'react';

/**
 * UptimeBars – 24-hour miniature bar chart for a monitor card.
 *
 * Props:
 *   bars – array of 24 objects: { hour: ISO string, up: number, down: number, total: number }
 */
export default function UptimeBars({ bars }) {
    const [hoveredIndex, setHoveredIndex] = useState(null);

    if (!bars || bars.length === 0) {
        return <div className="uptime-empty">No data</div>;
    }

    const hovered = hoveredIndex !== null ? bars[hoveredIndex] : null;
    const tooltipText = hovered
        ? hovered.total === 0
            ? `${formatHour(hovered.hour)} – no data`
            : `${formatHour(hovered.hour)} – ${Math.round((hovered.up / hovered.total) * 100)}% up (${hovered.up}↑ ${hovered.down}↓)`
        : null;

    // Center tooltip on the hovered bar: (index + 0.5) / length * 100 %
    const tooltipLeft = hoveredIndex !== null
        ? `${((hoveredIndex + 0.5) / bars.length) * 100}%`
        : '50%';

    return (
        <div className="uptime-bars">
            {bars.map((b, i) => (
                <div
                    key={i}
                    className="uptime-bar"
                    style={{ background: barColor(b) }}
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

function barColor(b) {
    if (b.total === 0) return '#1e3a52';
    if (b.down === 0) return '#22c55e';
    if (b.up === 0) return '#ef4444';
    return '#f59e0b';
}

function formatHour(isoHour) {
    if (!isoHour) return '?';
    return new Date(isoHour).toLocaleString(undefined, {
        month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
}

