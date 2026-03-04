-- Add secret_token and last_heartbeat_at to monitors table
-- secret_token: unique token used by the server agent to authenticate heartbeats
-- last_heartbeat_at: timestamp of the most recent received heartbeat (server monitors only)
ALTER TABLE "monitors" ADD COLUMN "secret_token" VARCHAR(64) UNIQUE;
ALTER TABLE "monitors" ADD COLUMN "last_heartbeat_at" TIMESTAMPTZ;

-- Add metadata JSONB column to checks table
-- Used to store server metrics (cpu_pct, mem_pct, disk_pct, load_1, uptime_seconds)
ALTER TABLE "checks" ADD COLUMN "metadata" JSONB;
