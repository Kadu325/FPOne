-- CreateEnum
CREATE TYPE "DocumentStatus" AS ENUM ('DRAFT', 'PUBLISHED', 'SUPERSEDED', 'ARCHIVED');

-- CreateTable
CREATE TABLE "document" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "category" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "current_version" INTEGER NOT NULL DEFAULT 0,
    "owner_id" UUID NOT NULL,
    "effective_at" TIMESTAMPTZ(3),
    "review_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_version" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "file_name" TEXT NOT NULL,
    "storage_key" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "size_bytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "status" "DocumentStatus" NOT NULL DEFAULT 'DRAFT',
    "uploaded_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "published_at" TIMESTAMPTZ(3),

    CONSTRAINT "document_version_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "document_audience" (
    "id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "audience_type" "AudienceType" NOT NULL,
    "audience_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "document_audience_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "document_status_published_at_idx" ON "document"("status", "published_at");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_storage_key_key" ON "document_version"("storage_key");

-- CreateIndex
CREATE UNIQUE INDEX "document_version_document_id_version_key" ON "document_version"("document_id", "version");

-- CreateIndex
CREATE INDEX "document_audience_audience_type_audience_id_idx" ON "document_audience"("audience_type", "audience_id");

-- CreateIndex
CREATE INDEX "document_audience_document_id_idx" ON "document_audience"("document_id");

-- AddForeignKey
ALTER TABLE "document" ADD CONSTRAINT "document_owner_id_fkey" FOREIGN KEY ("owner_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_version" ADD CONSTRAINT "document_version_uploaded_by_id_fkey" FOREIGN KEY ("uploaded_by_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "document_audience" ADD CONSTRAINT "document_audience_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "document"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- RN-DOC-002: um documento publicado sempre tem versão; versão vigente não pode ser negativa.
ALTER TABLE "document" ADD CONSTRAINT "document_version_valid" CHECK ("current_version" >= 0 AND ("status" = 'DRAFT' OR "current_version" > 0));
