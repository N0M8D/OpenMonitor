-- Add description to monitors
ALTER TABLE monitors ADD COLUMN IF NOT EXISTS description TEXT;

-- Maintenance windows table
CREATE TABLE IF NOT EXISTS maintenance_windows (
  id            SERIAL PRIMARY KEY,
  monitor_id    INTEGER NOT NULL REFERENCES monitors(id) ON DELETE CASCADE,
  description   TEXT,
  start_at      TIMESTAMPTZ NOT NULL,
  end_at        TIMESTAMPTZ,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by_id INTEGER
);

CREATE INDEX IF NOT EXISTS maintenance_windows_monitor_idx ON maintenance_windows(monitor_id);
CREATE INDEX IF NOT EXISTS maintenance_windows_start_at_idx ON maintenance_windows(start_at);
