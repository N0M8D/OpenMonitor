# OpenMonitor

A lightweight, self-hosted monitoring application for web endpoints, APIs, and servers. Track uptime, response times, and system metrics from a single dark-themed dashboard.

## Features

- **Web monitoring** – HTTP/HTTPS endpoints checked at configurable intervals (30 s – 10 min)
- **API monitoring** – Configurable method, custom headers, request body, expected status codes, and JSON response assertion (dot-notation path + value)
- **Server monitoring** – Push-based heartbeat agent (Bash) reports CPU, memory, disk, I/O, and network metrics; no open ports required
- **Dashboard** – Live overview with UP/DOWN/MAINT status, uptime %, avg response time, 60-day sparkbars, search + DOWN filter
- **Detail view** – Response-time chart with 6h/24h/7d range selector; uptime for 24h/7d/30d; stored incident log with update timeline; server metric gauges; SSL cert expiry badge
- **Incidents** – Automatically logged on every UP→DOWN transition; Reddit-style update feed (investigating → identified → monitoring → resolved) lets you post status messages; auto-closed on recovery; visible on the public status page
- **60-day sparkbars** – Daily uptime bars colour-coded: green (all up), yellow (minor outage or maintenance-covered), red (incident >1 h, unmitigated), muted red (post-creation, no data yet)
- **Maintenance mode** – Per-monitor maintenance windows (start/end time, optional description); DOWN webhooks and incident creation suppressed during maintenance; visible on dashboard cards and public status page
- **Monitor descriptions** – Optional text description shown on the status page beneath each monitor name
- **SSL monitoring** – Certificate expiry tracked on every HTTPS check; colour-coded warning at 30 and 7 days
- **Public status page** – Read-only `/status` page (no login required); shows overall health, per-monitor 60-day sparkbars, active incidents, maintenance info, and incident/maintenance history
- **Webhook notifications** – Per-monitor DOWN/UP alerts sent as HTTP POST; testable from the UI
- **Authentication** – Session-based login (Argon2id passwords, HTTP-only cookies); roles: admin, maintainer, user; per-monitor access control for the `user` role
- **Monitor access management** – Admins assign individual monitors to `user`-role accounts directly from the Edit Monitor dialog
- **Change password** – Any logged-in user can change their own password via the **Change password** button in the navbar
- **Dark UI** – Clean, modern dark theme
- **Docker ready** – Full stack via Docker Compose

## Tech Stack

| Layer     | Technology                                              |
|-----------|----------------------------------------------------------|
| Backend   | Node.js, Express, node-cron, Prisma, argon2, express-session |
| Database  | PostgreSQL 16                                            |
| Frontend  | React 18, Vite, recharts                                 |
| Container | Docker Compose, nginx                                    |

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

On first visit, the setup wizard will guide you through creating the initial administrator account.

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

| Variable          | Default                                                          | Description |
|-------------------|------------------------------------------------------------------|-------------|
| `DATABASE_URL`    | `postgres://openmonitor:openmonitor@localhost:5432/openmonitor`  | PostgreSQL connection URL |
| `PORT`            | `3001`                                                           | HTTP port |
| `SESSION_SECRET`  | `change-me-in-production-use-long-random-string`                 | **Change in production** — signs session cookies |
| `FRONTEND_ORIGIN` | `http://localhost:5173`                                          | Allowed CORS origin (must match your frontend URL) |
| `NODE_ENV`        | `development`                                                    | Set to `production` to enable secure cookies and strict CSRF |
| `CSRF_STRICT`     | *(unset)*                                                        | Set to `true` to enforce Origin header check in development |

### Frontend

| Variable        | Default                   | Description     |
|-----------------|---------------------------|-----------------|
| `VITE_API_URL`  | *(empty – uses proxy)*    | API base URL    |

---

## Authentication

OpenMonitor uses session-based authentication (HTTP-only cookies, Argon2id password hashing).

### First run – setup wizard

On first launch with an empty database, navigate to http://localhost:5173. You will be redirected to the setup wizard (`/setup`) where you create the initial admin account. Once any user exists the setup endpoint is permanently disabled (returns HTTP 409).

### Roles

| Role | Permissions |
|------|-------------|
| `admin` | Full access + user management + monitor access assignment (via Edit Monitor dialog) |
| `maintainer` | Create / edit / delete monitors, view all monitors |
| `user` | Read-only access to explicitly assigned monitors |

All users can change their own password using the **Change password** button in the navigation bar.

---

## API Reference

| Method | Path                                    | Description                             |
|--------|-----------------------------------------|-----------------------------------------|
| GET    | `/api/health`                           | Health check → `{ status: "ok" }`      |
| GET    | `/api/auth/setup-needed`                | `{ needed: bool }` — first-run check (public) |
| POST   | `/api/auth/setup`                       | Create first admin + auto-login (blocked after first user) |
| POST   | `/api/auth/login`                       | `{ username, password }` → session cookie |
| POST   | `/api/auth/logout`                      | Destroy session |
| GET    | `/api/auth/me`                          | Current user object |
| PATCH  | `/api/auth/password`                    | Change own password |
| GET    | `/api/users`                            | List users (admin) |
| POST   | `/api/users`                            | Create user (admin) |
| PATCH  | `/api/users/:id`                        | Update email / role / active (admin) |
| DELETE | `/api/users/:id`                        | Delete user (admin) |
| POST   | `/api/users/:id/reset-password`         | Reset user password (admin) |
| GET    | `/api/monitors`                         | List all monitors + latest status + 60-day daily bars + uptime stats |
| POST   | `/api/monitors`                         | Create a monitor                        |
| PATCH  | `/api/monitors/:id`                     | Update a monitor                        |
| DELETE | `/api/monitors/:id`                     | Delete a monitor                        |
| GET    | `/api/monitors/:id/checks`              | Last 100 checks; `?range=6h|24h|7d` for time-window (max 2000) |
| GET    | `/api/monitors/:id/incidents`           | Stored incident list (newest 50); includes `updates[]` per incident |
| PATCH  | `/api/monitors/:id/incidents/:iId`      | Update incident title / status / resolved_at (maintainer) |
| POST   | `/api/monitors/:id/incidents/:iId/updates` | Add update message to an incident (maintainer) |
| DELETE | `/api/monitors/:id/incidents/:iId/updates/:uId` | Delete an incident update (maintainer) |
| GET    | `/api/monitors/:id/maintenance`         | List maintenance windows for a monitor  |
| POST   | `/api/monitors/:id/maintenance`         | Create a maintenance window             |
| PATCH  | `/api/monitors/:id/maintenance/:mwId`   | Update a maintenance window             |
| POST   | `/api/monitors/:id/maintenance/:mwId/stop` | End active maintenance immediately   |
| DELETE | `/api/monitors/:id/maintenance/:mwId`   | Delete a maintenance window             |
| GET    | `/api/status`                           | Public status summary — no auth required |
| GET    | `/api/public-incidents`                 | Public open + recent incidents (last 30 days) — no auth |
| GET    | `/api/activity`                         | Maintenance window history              |
| GET    | `/api/monitors/:id/access`              | List users with access (admin)          |
| PUT    | `/api/monitors/:id/access`              | Replace access list `{ user_ids: [] }` (admin) |
| POST   | `/api/monitors/:id/regenerate-token`    | Regenerate server monitor secret token  |
| POST   | `/api/webhooks/test`                    | Send a test webhook notification        |
| POST   | `/api/heartbeat/:token`                 | Agent heartbeat endpoint (no auth)      |

> All endpoints except `/api/health`, `/api/auth/setup-needed`, `/api/auth/setup`, `/api/auth/login`, `/api/status`, `/api/public-incidents`, `/api/activity`, and `/api/heartbeat/:token` require an authenticated session.

### Create web/API monitor – request body

```json
{
  "name": "My API",
  "url": "https://api.example.com/status",
  "type": "api",
  "interval_seconds": 60,
  "description": "Production API health check",
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

### Incident update – request body

Post status updates to an open incident (maintainer role required). Posting `status: "resolved"` automatically closes the incident.

```json
{
  "message": "We have identified the root cause and are applying a fix.",
  "status": "identified"
}
```

Valid `status` values: `investigating`, `identified`, `monitoring`, `update`, `resolved`.

### Maintenance window – request body

All fields are optional; omitting `start_at` defaults to now, omitting `end_at` means open-ended.

```json
{
  "start_at": "2026-03-10T02:00:00Z",
  "end_at": "2026-03-10T04:00:00Z",
  "description": "Scheduled DB migration"
}
```

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

OpenMonitor is released under the [PolyForm Noncommercial License 1.0.0](./LICENSE).

**Free for:** personal, educational, non-profit, and home-lab use.

**Commercial use** (paid hosting, SaaS, embedding in a commercial product, etc.) requires
a separate commercial license. See [COMMERCIAL_LICENSE.md](./COMMERCIAL_LICENSE.md) or
contact [info@josefbouse.cz](mailto:info@josefbouse.cz).

---

Open Source Web Application to monitor your HW, homeland, servers, webs, APIs and services.
