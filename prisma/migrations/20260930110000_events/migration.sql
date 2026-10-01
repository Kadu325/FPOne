-- CreateEnum
CREATE TYPE "EventStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'CANCELLED', 'FINISHED');

-- CreateTable
CREATE TABLE "event" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "start_at" TIMESTAMPTZ(3) NOT NULL,
    "end_at" TIMESTAMPTZ(3) NOT NULL,
    "status" "EventStatus" NOT NULL DEFAULT 'DRAFT',
    "cancelled_at" TIMESTAMPTZ(3),
    "cancel_reason" TEXT,
    "created_by_id" UUID NOT NULL,
    "updated_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "event_audience" (
    "id" UUID NOT NULL,
    "event_id" UUID NOT NULL,
    "audience_type" "AudienceType" NOT NULL,
    "audience_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "event_audience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "event_status_start_at_idx" ON "event"("status", "start_at");

-- CreateIndex
CREATE INDEX "event_audience_audience_type_audience_id_idx" ON "event_audience"("audience_type", "audience_id");

-- CreateIndex
CREATE INDEX "event_audience_event_id_idx" ON "event_audience"("event_id");

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event" ADD CONSTRAINT "event_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "event_audience" ADD CONSTRAINT "event_audience_event_id_fkey" FOREIGN KEY ("event_id") REFERENCES "event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RN-EVT-002: término não pode ser anterior ao início.
ALTER TABLE "event" ADD CONSTRAINT "event_dates_valid" CHECK ("end_at" >= "start_at");
