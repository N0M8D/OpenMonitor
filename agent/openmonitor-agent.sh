#!/usr/bin/env bash
# ─────────────────────────────────────────────────────────────────────────────
# OpenMonitor Server Agent
# https://github.com/your-org/OpenMonitor
#
# Runs on Debian / Ubuntu servers and sends periodic heartbeats to OpenMonitor.
# Each heartbeat includes basic system metrics (CPU, memory, disk, load, uptime).
#
# Usage:
#   HEARTBEAT_URL="https://monitor.example.com/api/heartbeat/TOKEN" \
#   INTERVAL=60 \
#   bash openmonitor-agent.sh
#
# Install as a systemd service (run as root):
#   sudo HEARTBEAT_URL="..." INTERVAL=60 bash openmonitor-agent.sh --install
#
# Environment variables:
#   HEARTBEAT_URL   – required – full heartbeat endpoint URL including token
#   INTERVAL        – optional – heartbeat interval in seconds (default: 60)
#   VERBOSE         – optional – set to "1" to print each heartbeat response
# ─────────────────────────────────────────────────────────────────────────────

set -euo pipefail

INTERVAL="${INTERVAL:-60}"
VERBOSE="${VERBOSE:-0}"
SERVICE_NAME="openmonitor-agent"
AGENT_PATH="/usr/local/bin/openmonitor-agent"
SERVICE_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
ENV_PATH="/etc/openmonitor/agent.env"

# ── Colour helpers ────────────────────────────────────────────────────────────
_red()    { printf '\033[0;31m%s\033[0m\n' "$*"; }
_green()  { printf '\033[0;32m%s\033[0m\n' "$*"; }
_yellow() { printf '\033[0;33m%s\033[0m\n' "$*"; }
_info()   { printf '[openmonitor] %s\n' "$*"; }

# ── --install: create systemd service ────────────────────────────────────────
if [[ "${1:-}" == "--install" ]]; then
  if [[ $EUID -ne 0 ]]; then
    _red "ERROR: --install must be run as root (sudo)."
    exit 1
  fi
  if [[ -z "${HEARTBEAT_URL:-}" ]]; then
    _red "ERROR: HEARTBEAT_URL is not set."
    echo "Usage: sudo HEARTBEAT_URL=\"https://...\" INTERVAL=60 bash openmonitor-agent.sh --install"
    exit 1
  fi

  _info "Installing OpenMonitor Agent..."

  # Copy script to /usr/local/bin if not already there
  SCRIPT_PATH="$(realpath "$0")"
  if [[ "$SCRIPT_PATH" != "$AGENT_PATH" ]]; then
    cp "$SCRIPT_PATH" "$AGENT_PATH"
    chmod +x "$AGENT_PATH"
    _info "Agent copied to $AGENT_PATH"
  fi

  # Create env file
  mkdir -p "$(dirname "$ENV_PATH")"
  cat > "$ENV_PATH" <<EOF
HEARTBEAT_URL=${HEARTBEAT_URL}
INTERVAL=${INTERVAL}
VERBOSE=${VERBOSE:-0}
EOF
  chmod 600 "$ENV_PATH"
  _info "Configuration written to $ENV_PATH"

  # Create systemd unit
  cat > "$SERVICE_PATH" <<EOF
[Unit]
Description=OpenMonitor Server Agent
Documentation=https://github.com/your-org/OpenMonitor
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
EnvironmentFile=${ENV_PATH}
ExecStart=${AGENT_PATH}
Restart=on-failure
RestartSec=10
StandardOutput=journal
StandardError=journal
SyslogIdentifier=openmonitor-agent
# Run as nobody for least privilege
User=nobody
Group=nogroup

[Install]
WantedBy=multi-user.target
EOF

  systemctl daemon-reload
  systemctl enable "$SERVICE_NAME"
  _green "Service installed and enabled."
  echo ""
  echo "  Start now:  sudo systemctl start $SERVICE_NAME"
  echo "  View logs:  sudo journalctl -fu $SERVICE_NAME"
  echo "  Status:     sudo systemctl status $SERVICE_NAME"
  exit 0
fi

# ── --uninstall ───────────────────────────────────────────────────────────────
if [[ "${1:-}" == "--uninstall" ]]; then
  if [[ $EUID -ne 0 ]]; then _red "ERROR: must be run as root."; exit 1; fi
  systemctl stop "$SERVICE_NAME" 2>/dev/null || true
  systemctl disable "$SERVICE_NAME" 2>/dev/null || true
  rm -f "$SERVICE_PATH" "$AGENT_PATH" "$ENV_PATH"
  systemctl daemon-reload
  _green "OpenMonitor Agent uninstalled."
  exit 0
fi

# ── Runtime: heartbeat loop ───────────────────────────────────────────────────
if [[ -z "${HEARTBEAT_URL:-}" ]]; then
  _red "ERROR: HEARTBEAT_URL is not set."
  echo "Set the HEARTBEAT_URL environment variable and re-run."
  echo "Example:"
  echo "  HEARTBEAT_URL=\"https://monitor.example.com/api/heartbeat/TOKEN\" bash $0"
  exit 1
fi

_info "Starting heartbeat loop (interval: ${INTERVAL}s)"
_info "Target: ${HEARTBEAT_URL}"
if [[ "$VERBOSE" == "1" ]]; then
  _info "Detecting resources..."
  DISK_DEV_PREVIEW=$(awk '$3 !~ /^(loop|ram|sr|dm-|fd|zram)/ && $2+0 != 0 {print $3; exit}' /proc/diskstats 2>/dev/null || echo "none")
  NET_IFACE_PREVIEW=$(awk 'NR>2 && $1 !~ /^lo:/{gsub(/:.*/,"",$1); print $1; exit}' /proc/net/dev 2>/dev/null || echo "none")
  _info "  Disk device : $DISK_DEV_PREVIEW"
  _info "  Net iface   : $NET_IFACE_PREVIEW"
fi

collect_metrics() {
  # ── Hostname ─────────────────────────────────────────────────────────────────
  HOSTNAME_VAL=$(hostname 2>/dev/null || echo "")

  # ── Take first snapshot for CPU, disk I/O, network ───────────────────────────
  # CPU via /proc/stat
  read -r _ cpu_u1 cpu_n1 cpu_s1 cpu_i1 cpu_rest1 < /proc/stat 2>/dev/null || true

  # Disk I/O – find first real block device directly from /proc/diskstats
  # Skips: loop*, ram*, sr*, dm-*, fd* — picks sda/sdb/vda/nvme0n1/etc.
  DISK_DEV=$(awk '$3 !~ /^(loop|ram|sr|dm-|fd|zram)/ && $2+0 != 0 {print $3; exit}' \
    /proc/diskstats 2>/dev/null || echo "")
  DISK_R1=0; DISK_W1=0
  if [[ -n "$DISK_DEV" ]]; then
    DISK_R1=$(awk -v dev="$DISK_DEV" '$3==dev{print $6}' /proc/diskstats 2>/dev/null || echo 0)
    DISK_W1=$(awk -v dev="$DISK_DEV" '$3==dev{print $10}' /proc/diskstats 2>/dev/null || echo 0)
    DISK_R1="${DISK_R1:-0}"; DISK_W1="${DISK_W1:-0}"
  fi

  # Network I/O via /proc/net/dev (first non-lo iface)
  NET_IFACE=$(awk 'NR>2 && $1 !~ /^lo:/{gsub(/:.*/,"",$1); print $1; exit}' /proc/net/dev 2>/dev/null || echo "")
  NET_R1=0; NET_T1=0
  if [[ -n "$NET_IFACE" ]]; then
    NET_R1=$(awk -v iface="${NET_IFACE}:" '$1==iface{print $2}' /proc/net/dev 2>/dev/null || echo 0)
    NET_T1=$(awk -v iface="${NET_IFACE}:" '$1==iface{print $10}' /proc/net/dev 2>/dev/null || echo 0)
    NET_R1="${NET_R1:-0}"; NET_T1="${NET_T1:-0}"
  fi

  # ── 1-second sleep for rate calculations ─────────────────────────────────────
  sleep 1

  # ── CPU (second sample + diff) ───────────────────────────────────────────────
  read -r _ cpu_u2 cpu_n2 cpu_s2 cpu_i2 cpu_rest2 < /proc/stat 2>/dev/null || true
  cpu_total=$(( (cpu_u2+cpu_n2+cpu_s2+cpu_i2) - (cpu_u1+cpu_n1+cpu_s1+cpu_i1) )) || true
  cpu_used=$(( (cpu_u2+cpu_n2+cpu_s2) - (cpu_u1+cpu_n1+cpu_s1) )) || true
  if [[ ${cpu_total:-0} -gt 0 ]]; then
    CPU_PCT=$(awk "BEGIN{printf \"%.1f\", ${cpu_used}*100/${cpu_total}}")
  else
    CPU_PCT="0.0"
  fi

  # ── Disk I/O (second sample + diff, sectors=512B → KB=/2) ───────────────────
  DISK_R2=0; DISK_W2=0
  if [[ -n "$DISK_DEV" ]]; then
    DISK_R2=$(awk -v dev="$DISK_DEV" '$3==dev{print $6}' /proc/diskstats 2>/dev/null || echo 0)
    DISK_W2=$(awk -v dev="$DISK_DEV" '$3==dev{print $10}' /proc/diskstats 2>/dev/null || echo 0)
    DISK_R2="${DISK_R2:-0}"; DISK_W2="${DISK_W2:-0}"
  fi
  DISK_READ_KBS=$(awk "BEGIN{printf \"%.1f\", (${DISK_R2}-${DISK_R1})/2}")
  DISK_WRITE_KBS=$(awk "BEGIN{printf \"%.1f\", (${DISK_W2}-${DISK_W1})/2}")

  # ── Network (second sample + diff, bytes → KB) ───────────────────────────────
  NET_R2=0; NET_T2=0
  if [[ -n "$NET_IFACE" ]]; then
    NET_R2=$(awk -v iface="${NET_IFACE}:" '$1==iface{print $2}' /proc/net/dev 2>/dev/null || echo 0)
    NET_T2=$(awk -v iface="${NET_IFACE}:" '$1==iface{print $10}' /proc/net/dev 2>/dev/null || echo 0)
    NET_R2="${NET_R2:-0}"; NET_T2="${NET_T2:-0}"
  fi
  NET_IN_KBS=$(awk "BEGIN{printf \"%.1f\", (${NET_R2}-${NET_R1})/1024}")
  NET_OUT_KBS=$(awk "BEGIN{printf \"%.1f\", (${NET_T2}-${NET_T1})/1024}")

  # ── Memory usage ────────────────────────────────────────────────────────────
  MEM_LINE=$(free -m | awk '/^Mem:/{print $2, $3}')
  MEM_TOTAL=$(echo "$MEM_LINE" | awk '{print $1}')
  MEM_USED=$(echo "$MEM_LINE" | awk '{print $2}')
  if [[ "${MEM_TOTAL:-0}" -gt 0 ]]; then
    MEM_PCT=$(awk "BEGIN{printf \"%.1f\", $MEM_USED*100/$MEM_TOTAL}")
  else
    MEM_PCT="0.0"
  fi

  # ── Disk usage (root filesystem) ────────────────────────────────────────────
  DISK_INFO=$(df -BG / | awk 'NR==2{gsub(/G/,"",$2); gsub(/G/,"",$3); gsub(/%/,"",$5); print $2, $3, $5}')
  DISK_TOTAL_GB=$(echo "$DISK_INFO" | awk '{print $1}')
  DISK_USED_GB=$(echo "$DISK_INFO" | awk '{print $2}')
  DISK_PCT=$(echo "$DISK_INFO" | awk '{print $3}')
  DISK_PCT="${DISK_PCT:-0}"
  DISK_TOTAL_GB="${DISK_TOTAL_GB:-0}"
  DISK_USED_GB="${DISK_USED_GB:-0}"

  # ── Load average (1-minute) ─────────────────────────────────────────────────
  LOAD_1=$(awk '{print $1}' /proc/loadavg 2>/dev/null || echo "0")
  LOAD_1="${LOAD_1:-0}"

  # ── System uptime ────────────────────────────────────────────────────────────
  UPTIME_SEC=$(awk '{print int($1)}' /proc/uptime 2>/dev/null || echo "0")
}

while true; do
  collect_metrics

  PAYLOAD="{\"hostname\":\"${HOSTNAME_VAL}\",\"cpu_pct\":${CPU_PCT},\"mem_pct\":${MEM_PCT},\"mem_used_mb\":${MEM_USED},\"mem_total_mb\":${MEM_TOTAL},\"disk_pct\":${DISK_PCT},\"disk_used_gb\":${DISK_USED_GB},\"disk_total_gb\":${DISK_TOTAL_GB},\"disk_read_kbs\":${DISK_READ_KBS},\"disk_write_kbs\":${DISK_WRITE_KBS},\"net_in_kbs\":${NET_IN_KBS},\"net_out_kbs\":${NET_OUT_KBS},\"load_1\":${LOAD_1},\"uptime_seconds\":${UPTIME_SEC}}"

  RESPONSE=$(curl -s \
    --max-time 10 \
    --retry 2 \
    --retry-delay 3 \
    -X POST "${HEARTBEAT_URL}" \
    -H "Content-Type: application/json" \
    -d "${PAYLOAD}" \
    -w "\n%{http_code}" 2>/dev/null) || RESPONSE=""

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  BODY=$(echo "$RESPONSE" | head -1)

  if [[ "$HTTP_CODE" == "200" ]]; then
    if [[ "$VERBOSE" == "1" ]]; then
      _info "Heartbeat sent \u2192 ${HTTP_CODE} | cpu=${CPU_PCT}% mem=${MEM_PCT}% (${MEM_USED}/${MEM_TOTAL} MB) disk=${DISK_PCT}% (${DISK_USED_GB}/${DISK_TOTAL_GB} GB) io=R${DISK_READ_KBS}/W${DISK_WRITE_KBS} KB/s net=IN${NET_IN_KBS}/OUT${NET_OUT_KBS} KB/s load=${LOAD_1}"
    fi
  else
    _yellow "Heartbeat failed (HTTP ${HTTP_CODE:-timeout}): ${BODY}"
  fi

  sleep "${INTERVAL}"
done
