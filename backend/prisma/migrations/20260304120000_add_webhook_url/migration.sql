-- AlterTable: add optional webhook_url to monitors
ALTER TABLE "monitors" ADD COLUMN "webhook_url" VARCHAR(2048);
