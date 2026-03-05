-- Users table
CREATE TABLE "users" (
  "id"            SERIAL PRIMARY KEY,
  "username"      VARCHAR(100) NOT NULL UNIQUE,
  "email"         VARCHAR(255) UNIQUE,
  "password_hash" VARCHAR(255) NOT NULL,
  "role"          VARCHAR(20)  NOT NULL DEFAULT 'user',
  "is_active"     BOOLEAN      NOT NULL DEFAULT true,
  "created_at"    TIMESTAMPTZ  NOT NULL DEFAULT NOW(),
  "last_login_at" TIMESTAMPTZ,
  "created_by_id" INTEGER REFERENCES "users"("id") ON DELETE SET NULL
);

-- Sessions table (used by connect-pg-simple)
CREATE TABLE "sessions" (
  "sid"    VARCHAR     NOT NULL PRIMARY KEY,
  "sess"   JSONB       NOT NULL,
  "expire" TIMESTAMPTZ NOT NULL
);
CREATE INDEX "sessions_expire_idx" ON "sessions" ("expire");

-- Monitor access table (M:N, only meaningful for role = 'user')
CREATE TABLE "monitor_access" (
  "monitor_id" INTEGER     NOT NULL REFERENCES "monitors"("id") ON DELETE CASCADE,
  "user_id"    INTEGER     NOT NULL REFERENCES "users"("id")    ON DELETE CASCADE,
  "granted_at" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY ("monitor_id", "user_id")
);
