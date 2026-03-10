-- Stored incidents (auto-created by checker on DOWN transition, closed on UP recovery)
CREATE TABLE IF NOT EXISTS incidents (
  id            SERIAL PRIMARY KEY,
  monitor_id    INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  started_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  resolved_at   TIMESTAMPTZ,
  title         VARCHAR(255),
  status        VARCHAR(32) NOT NULL DEFAULT 'open',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_incidents_monitor ON incidents(monitor_id);
CREATE INDEX IF NOT EXISTS idx_incidents_started ON incidents(started_at DESC);

-- Update timeline entries authored by users (Reddit-style)
CREATE TABLE IF NOT EXISTS incident_updates (
  id            SERIAL PRIMARY KEY,
  incident_id   INTEGER NOT NULL REFERENCES incidents(id) ON DELETE CASCADE,
  message       TEXT NOT NULL,
  status        VARCHAR(32) NOT NULL DEFAULT 'update',
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_id INTEGER
);

CREATE INDEX IF NOT EXISTS idx_incident_updates_incident ON incident_updates(incident_id);
