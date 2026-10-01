-- CreateTable
CREATE TABLE "user_activity_day" (
    "user_id" UUID NOT NULL,
    "day" DATE NOT NULL,

    CONSTRAINT "user_activity_day_pkey" PRIMARY KEY ("user_id","day")
);

-- CreateTable
CREATE TABLE "search_event" (
    "id" BIGSERIAL NOT NULL,
    "result_count" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "search_event_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "link_click" (
    "id" BIGSERIAL NOT NULL,
    "link_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "link_click_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "user_activity_day_day_idx" ON "user_activity_day"("day");

-- CreateIndex
CREATE INDEX "search_event_created_at_idx" ON "search_event"("created_at");

-- CreateIndex
CREATE INDEX "link_click_created_at_idx" ON "link_click"("created_at");

-- CreateIndex
CREATE INDEX "link_click_link_id_idx" ON "link_click"("link_id");

-- AddForeignKey
ALTER TABLE "user_activity_day" ADD CONSTRAINT "user_activity_day_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "link_click" ADD CONSTRAINT "link_click_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "useful_link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
