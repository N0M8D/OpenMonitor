-- CreateTable
CREATE TABLE "monitors" (
    "id" SERIAL NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "url" VARCHAR(2048) NOT NULL,
    "type" VARCHAR(50) NOT NULL DEFAULT 'web',
    "interval_seconds" INTEGER NOT NULL DEFAULT 60,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "monitors_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "checks" (
    "id" SERIAL NOT NULL,
    "monitor_id" INTEGER NOT NULL,
    "checked_at" TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status_code" INTEGER,
    "response_time_ms" INTEGER,
    "is_up" BOOLEAN NOT NULL,
    "error" TEXT,

    CONSTRAINT "checks_pkey" PRIMARY KEY ("id")
);

-- AddForeignKey
ALTER TABLE "checks" ADD CONSTRAINT "checks_monitor_id_fkey" FOREIGN KEY ("monitor_id") REFERENCES "monitors"("id") ON DELETE CASCADE ON UPDATE CASCADE;
