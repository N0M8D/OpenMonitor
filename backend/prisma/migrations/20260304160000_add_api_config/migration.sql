-- Add API monitor configuration fields
ALTER TABLE "monitors" ADD COLUMN "method"                VARCHAR(10)  NOT NULL DEFAULT 'GET';
ALTER TABLE "monitors" ADD COLUMN "request_headers"       JSONB;
ALTER TABLE "monitors" ADD COLUMN "request_body"          TEXT;
ALTER TABLE "monitors" ADD COLUMN "expected_status_codes" VARCHAR(100);
ALTER TABLE "monitors" ADD COLUMN "assert_json_path"      VARCHAR(500);
ALTER TABLE "monitors" ADD COLUMN "assert_json_value"     VARCHAR(500);
