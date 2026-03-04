import { useState } from 'react';
import { regenerateToken } from '../api/client.js';

// ── Inline copy button ────────────────────────────────────────────────────────
function CopyButton({ text }) {
    const [copied, setCopied] = useState(false);
    const handle = async () => {
        try {
            await navigator.clipboard.writeText(text);
        } catch {
            // Fallback for non-https contexts
            const el = document.createElement('textarea');
            el.value = text;
            document.body.appendChild(el);
            el.select();
            document.execCommand('copy');
            document.body.removeChild(el);
        }
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };
    return (
        <button type="button" className={`btn-copy${copied ? ' btn-copy--ok' : ''}`} onClick={handle}>
            {copied ? '✓ Copied' : 'Copy'}
        </button>
    );
}

/**
 * ServerSetupGuide
 *
 * Displays the heartbeat URL, install instructions and token management
 * for a server-type monitor.
 *
 * Props:
 *   token          – current secret_token string
 *   monitorId      – monitor ID (needed for regeneration)
 *   interval       – interval_seconds (used for grace period label + install cmd)
 *   onTokenChanged – called with the new token string after regeneration
 */
export default function ServerSetupGuide({ token, monitorId, interval = 60, onTokenChanged }) {
    const [regenLoading, setRegenLoading] = useState(false);
    const [regenError, setRegenError] = useState('');

    const graceSeconds = Math.round(interval * 2.5);
    const base = window.location.origin;
    const heartbeatUrl = token ? `${base}/api/heartbeat/${token}` : '—';
    const agentUrl = `${base}/agent/openmonitor-agent.sh`;

    const handleRegen = async () => {
        if (!confirm('Regenerate token?\n\nThe agent on the server will stop sending data until you update its configuration.')) return;
        setRegenLoading(true);
        setRegenError('');
        try {
            const data = await regenerateToken(monitorId);
            onTokenChanged?.(data.secret_token);
        } catch (err) {
            setRegenError(err.message);
        } finally {
            setRegenLoading(false);
        }
    };

    return (
        <div className="setup-guide">
            <div className="setup-guide-title">Server agent setup</div>

            <div className="info-box">
                OpenMonitor uses a <strong>push-based heartbeat</strong>. A lightweight bash agent runs on the
                server and POSTs to the heartbeat URL every <strong>{interval}s</strong>.
                If no heartbeat arrives within <strong>{graceSeconds}s</strong> the server is marked{' '}
                <strong>DOWN</strong> and you&apos;ll receive a webhook notification.
            </div>

            <p className="setup-step"><strong>1. Heartbeat URL</strong></p>
            <div className="code-row">
                <div className="code-box">{heartbeatUrl}</div>
                <CopyButton text={heartbeatUrl} />
            </div>

            <p className="setup-step"><strong>2. Download &amp; install agent (Debian / Ubuntu)</strong></p>
            <div className="code-block">{`# Download
sudo curl -fsSL ${agentUrl} -o /usr/local/bin/openmonitor-agent
sudo chmod +x /usr/local/bin/openmonitor-agent

# Install as a systemd service (runs on boot, restarts on failure)
sudo HEARTBEAT_URL="${heartbeatUrl}" INTERVAL=${interval} \\
     /usr/local/bin/openmonitor-agent --install

# Start it
sudo systemctl start openmonitor-agent
sudo systemctl status openmonitor-agent`}</div>

            <p className="setup-step"><strong>3. Quick test (no install)</strong></p>
            <div className="code-row">
                <div className="code-box">{`curl -s -X POST "${heartbeatUrl}" -H "Content-Type: application/json" -d '{}'`}</div>
                <CopyButton text={`curl -s -X POST "${heartbeatUrl}" -H "Content-Type: application/json" -d '{}'`} />
            </div>

            <p className="setup-step" style={{ marginTop: '0.75rem' }}>
                The agent reports <strong>cpu_pct</strong>, <strong>mem_pct</strong>, <strong>disk_pct</strong>,{' '}
                <strong>load_1</strong> and <strong>uptime_seconds</strong> with every heartbeat.
            </p>

            {monitorId && (
                <div style={{ marginTop: '0.75rem' }}>
                    <div className="danger-row">
                        <span>Invalidates current credentials — update agent config after regenerating</span>
                        <button type="button" className="btn-danger" onClick={handleRegen} disabled={regenLoading}>
                            {regenLoading ? 'Regenerating…' : 'Regenerate token'}
                        </button>
                    </div>
                    {regenError && <p className="error-msg">{regenError}</p>}
                </div>
            )}
        </div>
    );
}
