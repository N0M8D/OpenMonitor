# OpenMonitor

A lightweight, self-hosted monitoring application for web endpoints, APIs, and servers. Track uptime, response times, and system metrics from a single dark-themed dashboard.

## Features

- **Web monitoring** – HTTP/HTTPS endpoints checked at configurable intervals (30 s – 10 min)
- **API monitoring** – Configurable method, custom headers, request body, expected status codes, and JSON response assertion (dot-notation path + value)
- **Server monitoring** – Push-based heartbeat agent (Bash) reports CPU, memory, disk, I/O, and network metrics; no open ports required
- **Dashboard** – Live overview with UP/DOWN status, uptime %, avg response time, and 24-hour sparkbar
- **Detail view** – Response time chart, check history table; server type shows metric gauges, disk capacity, I/O and network charts
- **Webhook notifications** – Per-monitor DOWN/UP alerts sent as HTTP POST; testable from the UI
- **Dark UI** – Clean, modern dark theme
- **Docker ready** – Full stack via Docker Compose

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js, Express, node-cron, Prisma |
| Database  | PostgreSQL 16                       |
| Frontend  | React 18, Vite, recharts            |
| Container | Docker Compose, nginx               |

---

## Quick Start (Docker)

```bash
git clone https://github.com/your-org/OpenMonitor.git  # replace with your repo URL
cd OpenMonitor
docker compose up --build
```

- **Frontend**: http://localhost:5173
- **Backend API**: http://localhost:3001
- **PostgreSQL**: localhost:5432

---

## Manual Setup

### Prerequisites
- Node.js 20+
- PostgreSQL 16+

### Database

```bash
createdb openmonitor
```

### Backend

```bash
cd backend
# Edit .env with your DATABASE_URL if needed
npm install
npm run migrate
npm start
```

The API listens on `http://localhost:3001`.

### Frontend

```bash
cd frontend
npm install
npm run dev
```

The dev server runs on `http://localhost:5173` and proxies `/api` requests to the backend.

---

## Environment Variables

### Backend (`backend/.env`)

| Variable       | Default                                                 | Description              |
|----------------|---------------------------------------------------------|--------------------------|
| `DATABASE_URL` | `postgres://openmonitor:openmonitor@localhost:5432/openmonitor` | PostgreSQL connection URL |
| `PORT`         | `3001`                                                  | HTTP port                |

### Frontend

| Variable        | Default                   | Description     |
|-----------------|---------------------------|-----------------|
| `VITE_API_URL`  | *(empty – uses proxy)*    | API base URL    |

---

## API Reference

| Method | Path                                    | Description                             |
|--------|-----------------------------------------|-----------------------------------------|
| GET    | `/api/monitors`                         | List all monitors + latest status + 24h stats |
| POST   | `/api/monitors`                         | Create a monitor                        |
| PATCH  | `/api/monitors/:id`                     | Update a monitor                        |
| DELETE | `/api/monitors/:id`                     | Delete a monitor                        |
| GET    | `/api/monitors/:id/checks`              | Last 100 checks for a monitor           |
| POST   | `/api/monitors/:id/regenerate-token`    | Regenerate server monitor secret token  |
| POST   | `/api/webhooks/test`                    | Send a test webhook notification        |
| POST   | `/api/heartbeat/:token`                 | Agent heartbeat endpoint                |
| GET    | `/api/health`                           | Health check → `{ status: "ok" }`      |

### Create web/API monitor – request body

```json
{
  "name": "My API",
  "url": "https://api.example.com/status",
  "type": "api",
  "interval_seconds": 60,
  "webhook_url": "https://hooks.example.com/notify",
  "method": "POST",
  "request_headers": { "Authorization": "Bearer token123" },
  "request_body": "{\"ping\": true}",
  "expected_status_codes": "200,201",
  "assert_json_path": "data.status",
  "assert_json_value": "ok"
}
```

Fields `method`, `request_headers`, `request_body`, `expected_status_codes`, `assert_json_path`, and `assert_json_value` are only used when `type` is `api`. For `type: "web"` a plain GET is performed with 2xx/3xx accepted as UP.

### Server monitor

Set `type: "server"` – no `url` needed. After creation you receive a `secret_token`. Install the agent on your server:

```bash
curl -fsSL https://raw.githubusercontent.com/your-org/OpenMonitor/main/agent/openmonitor-agent.sh \
  -o openmonitor-agent.sh
chmod +x openmonitor-agent.sh
sudo ./openmonitor-agent.sh --install \
  --url http://your-openmonitor-host:3001 \
  --token <secret_token> \
  --interval 60
```

The agent sends CPU, memory, disk, I/O, and network metrics. No inbound port needed.

---

## License

See [LICENSE](./LICENSE).
Open Source Web Application to monitor your HW, homeland, servers, webs, APIs and services.
