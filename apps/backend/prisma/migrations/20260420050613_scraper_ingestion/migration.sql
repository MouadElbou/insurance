-- CreateEnum
CREATE TYPE "TransformerVerdict" AS ENUM ('PENDING', 'TRANSFORMED', 'IGNORED', 'ERROR');

-- CreateTable
CREATE TABLE "scraper_events" (
    "id" TEXT NOT NULL,
    "employee_id" TEXT NOT NULL,
    "insurer_code" TEXT,
    "host" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "status_code" INTEGER,
    "request_headers" JSONB,
    "request_body" TEXT,
    "response_headers" JSONB,
    "response_body" TEXT,
    "captured_at" TIMESTAMP(3) NOT NULL,
    "processed_at" TIMESTAMP(3),
    "transformer_verdict" "TransformerVerdict" NOT NULL DEFAULT 'PENDING',
    "transformer_notes" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scraper_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "insurer_domains" (
    "id" TEXT NOT NULL,
    "insurer_code" TEXT NOT NULL,
    "host_pattern" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "capture_enabled" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "insurer_domains_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "scraper_events_employee_id_idx" ON "scraper_events"("employee_id");

-- CreateIndex
CREATE INDEX "scraper_events_host_idx" ON "scraper_events"("host");

-- CreateIndex
CREATE INDEX "scraper_events_insurer_code_idx" ON "scraper_events"("insurer_code");

-- CreateIndex
CREATE INDEX "scraper_events_captured_at_idx" ON "scraper_events"("captured_at");

-- CreateIndex
CREATE INDEX "scraper_events_transformer_verdict_idx" ON "scraper_events"("transformer_verdict");

-- CreateIndex
CREATE INDEX "scraper_events_processed_at_idx" ON "scraper_events"("processed_at");

-- CreateIndex
CREATE UNIQUE INDEX "insurer_domains_host_pattern_key" ON "insurer_domains"("host_pattern");

-- CreateIndex
CREATE INDEX "insurer_domains_insurer_code_idx" ON "insurer_domains"("insurer_code");

-- CreateIndex
CREATE INDEX "insurer_domains_capture_enabled_idx" ON "insurer_domains"("capture_enabled");

-- AddForeignKey
ALTER TABLE "scraper_events" ADD CONSTRAINT "scraper_events_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "employees"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "insurer_domains" ADD CONSTRAINT "insurer_domains_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;
