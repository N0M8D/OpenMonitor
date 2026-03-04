# OpenMonitor Server Agent

A lightweight bash agent for Debian/Ubuntu servers.  
Sends periodic heartbeats to OpenMonitor including system metrics.

## How it works

```
Server                          OpenMonitor
  │                                  │
  │──── POST /api/heartbeat/TOKEN ──▶│  (every INTERVAL seconds)
  │     { cpu_pct, mem_pct,          │
  │       disk_pct, load_1,          │  Records UP check
  │       uptime_seconds }           │
  │                                  │  If no heartbeat for INTERVAL × 2.5 seconds:
  │                                  │  → Records DOWN check
  │                                  │  → Sends webhook notification
```

No inbound ports needed. The agent only makes outbound HTTP requests.

---

## Quick install (Debian / Ubuntu)

### 1. Get your heartbeat URL

In OpenMonitor:
1. Click **+ Add Monitor**
2. Select type **Server (agent-based)**
3. Fill in a name and click **Add & Get Setup Guide**
4. Copy the displayed Heartbeat URL

### 2. Download and install

```bash
# Download
sudo curl -fsSL https://YOUR-OPENMONITOR/agent/openmonitor-agent.sh \
     -o /usr/local/bin/openmonitor-agent
sudo chmod +x /usr/local/bin/openmonitor-agent

# Install as systemd service (replace TOKEN and interval as needed)
sudo HEARTBEAT_URL="https://YOUR-OPENMONITOR/api/heartbeat/TOKEN" \
     INTERVAL=60 \
     /usr/local/bin/openmonitor-agent --install

# Start
sudo systemctl start openmonitor-agent
sudo systemctl status openmonitor-agent
```

### 3. View logs

```bash
sudo journalctl -fu openmonitor-agent
```

---

## Manual / test run (no install)

```bash
HEARTBEAT_URL="https://YOUR-OPENMONITOR/api/heartbeat/TOKEN" \
INTERVAL=60 \
VERBOSE=1 \
bash openmonitor-agent.sh
```

---

## Uninstall

```bash
sudo /usr/local/bin/openmonitor-agent --uninstall
```

---

## Sent metrics

Each heartbeat POST contains:

| Field            | Description                              |
|------------------|------------------------------------------|
| `cpu_pct`        | CPU usage % (user + system, 1s sample)  |
| `mem_pct`        | Memory usage %                           |
| `disk_pct`       | Root filesystem usage %                  |
| `load_1`         | 1-minute load average                    |
| `uptime_seconds` | Server uptime in seconds                 |

Example payload:
```json
{
  "cpu_pct": 12.4,
  "mem_pct": 45.8,
  "disk_pct": 61,
  "load_1": 0.42,
  "uptime_seconds": 864321
}
```

---

## Environment variables

| Variable        | Required | Default | Description                        |
|-----------------|----------|---------|------------------------------------|
| `HEARTBEAT_URL` | ✅       | —       | Full heartbeat URL including token |
| `INTERVAL`      | —        | `60`    | Seconds between heartbeats         |
| `VERBOSE`       | —        | `0`     | Set to `1` for detailed logging    |

---

## DOWN detection

OpenMonitor marks a server as **DOWN** when no heartbeat is received for:

```
grace_period = max(INTERVAL × 2.5, 90 seconds)
```

Examples:
- `INTERVAL=60` → DOWN after **150s** (2.5 missed heartbeats)
- `INTERVAL=30` → DOWN after **90s** (3 missed heartbeats)
- `INTERVAL=300` → DOWN after **750s**

After the server sends a new heartbeat, it is immediately marked **UP** again.

---

## Security

- The `secret_token` in the heartbeat URL is the only authentication.  
  Keep it private — treat it like a password.
- You can regenerate the token at any time from the **Edit Monitor** dialog.
- The service runs as `nobody:nogroup` by default.
- The env file (`/etc/openmonitor/agent.env`) is `chmod 600`.
