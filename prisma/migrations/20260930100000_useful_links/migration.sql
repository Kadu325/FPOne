-- CreateTable
CREATE TABLE "useful_link" (
    "id" UUID NOT NULL,
    "label" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "url" TEXT NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "owner_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "useful_link_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "useful_link_audience" (
    "id" UUID NOT NULL,
    "link_id" UUID NOT NULL,
    "audience_type" "AudienceType" NOT NULL,
    "audience_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "useful_link_audience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "useful_link_active_sort_order_idx" ON "useful_link"("active", "sort_order");

-- CreateIndex
CREATE INDEX "useful_link_audience_audience_type_audience_id_idx" ON "useful_link_audience"("audience_type", "audience_id");

-- CreateIndex
CREATE INDEX "useful_link_audience_link_id_idx" ON "useful_link_audience"("link_id");

-- AddForeignKey
ALTER TABLE "useful_link" ADD CONSTRAINT "useful_link_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "useful_link_audience" ADD CONSTRAINT "useful_link_audience_link_id_fkey" FOREIGN KEY ("link_id") REFERENCES "useful_link"("id") ON DELETE CASCADE ON UPDATE CASCADE;
