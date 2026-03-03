# OpenMonitor

A lightweight, self-hosted server and web monitoring application. Track uptime and response times for any HTTP/HTTPS endpoint.

## Features

- **Monitor any URL** – HTTP/HTTPS endpoints checked every 30 seconds
- **Dashboard** – Live overview of all monitors with UP/DOWN status and average response time
- **Detail view** – Response time chart and check history per monitor
- **Dark UI** – Clean, modern dark theme
- **Docker ready** – Full stack via Docker Compose

## Tech Stack

| Layer     | Technology                          |
|-----------|-------------------------------------|
| Backend   | Node.js, Express, node-cron, pg     |
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
psql openmonitor < backend/src/migrations/001_initial.sql
```

### Backend

```bash
cd backend
cp src/.env.example .env
# Edit .env with your DATABASE_URL if needed
npm install
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

| Method | Path                          | Description                      |
|--------|-------------------------------|----------------------------------|
| GET    | `/api/monitors`               | List all monitors + latest status |
| POST   | `/api/monitors`               | Create a monitor                 |
| PATCH  | `/api/monitors/:id`           | Update a monitor                 |
| DELETE | `/api/monitors/:id`           | Delete a monitor                 |
| GET    | `/api/monitors/:id/checks`    | Last 100 checks for a monitor    |
| GET    | `/api/health`                 | Health check                     |

### Create monitor – request body

```json
{
  "name": "My Site",
  "url": "https://example.com",
  "interval_seconds": 60
}
```

---

## License

See [LICENSE](./LICENSE).
Open Source Web Application to monitor your HW, homeland, servers, webs, APIs and services.
