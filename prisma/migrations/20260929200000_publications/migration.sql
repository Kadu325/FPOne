-- CreateEnum
CREATE TYPE "PublicationType" AS ENUM ('ANNOUNCEMENT', 'NEWS');

-- CreateEnum
CREATE TYPE "PublicationStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'ARCHIVED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "AudienceType" AS ENUM ('ALL', 'UNIT', 'DEPARTMENT', 'GROUP', 'USER');

-- CreateTable
CREATE TABLE "publication_category" (
    "id" UUID NOT NULL,
    "type" "PublicationType" NOT NULL,
    "name" TEXT NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_category_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication" (
    "id" UUID NOT NULL,
    "type" "PublicationType" NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL DEFAULT '',
    "content" JSONB NOT NULL,
    "category_id" UUID,
    "author_id" UUID NOT NULL,
    "last_editor_id" UUID NOT NULL,
    "status" "PublicationStatus" NOT NULL DEFAULT 'DRAFT',
    "is_featured" BOOLEAN NOT NULL DEFAULT false,
    "pinned" BOOLEAN NOT NULL DEFAULT false,
    "requires_acknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "version" INTEGER NOT NULL DEFAULT 1,
    "publish_at" TIMESTAMPTZ(3),
    "expires_at" TIMESTAMPTZ(3),
    "published_at" TIMESTAMPTZ(3),
    "archived_at" TIMESTAMPTZ(3),
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(3) NOT NULL,

    CONSTRAINT "publication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_audience" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "audience_type" "AudienceType" NOT NULL,
    "audience_id" TEXT,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_audience_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_read" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "first_viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "last_viewed_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "view_count" INTEGER NOT NULL DEFAULT 1,
    "acknowledged_at" TIMESTAMPTZ(3),
    "acknowledged_version" INTEGER,

    CONSTRAINT "publication_read_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "publication_version" (
    "id" UUID NOT NULL,
    "publication_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "content" JSONB NOT NULL,
    "editor_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "publication_version_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "publication_category_type_name_key" ON "publication_category"("type", "name");

-- CreateIndex
CREATE INDEX "publication_type_status_publish_at_idx" ON "publication"("type", "status", "publish_at");

-- CreateIndex
CREATE INDEX "publication_audience_audience_type_audience_id_idx" ON "publication_audience"("audience_type", "audience_id");

-- CreateIndex
CREATE INDEX "publication_audience_publication_id_idx" ON "publication_audience"("publication_id");

-- CreateIndex
CREATE INDEX "publication_read_user_id_idx" ON "publication_read"("user_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_read_publication_id_user_id_key" ON "publication_read"("publication_id", "user_id");

-- CreateIndex
CREATE UNIQUE INDEX "publication_version_publication_id_version_key" ON "publication_version"("publication_id", "version");

-- AddForeignKey
ALTER TABLE "publication" ADD CONSTRAINT "publication_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "publication_category"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication" ADD CONSTRAINT "publication_author_id_fkey" FOREIGN KEY ("author_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication" ADD CONSTRAINT "publication_last_editor_id_fkey" FOREIGN KEY ("last_editor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_audience" ADD CONSTRAINT "publication_audience_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_read" ADD CONSTRAINT "publication_read_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_read" ADD CONSTRAINT "publication_read_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_version" ADD CONSTRAINT "publication_version_publication_id_fkey" FOREIGN KEY ("publication_id") REFERENCES "publication"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "publication_version" ADD CONSTRAINT "publication_version_editor_id_fkey" FOREIGN KEY ("editor_id") REFERENCES "user"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- RN-NEWS-001: Novidade nunca exige ciência nem é fixada (defesa no banco além do Zod).
ALTER TABLE "publication" ADD CONSTRAINT "publication_news_no_ack"
  CHECK ("type" <> 'NEWS' OR ("requires_acknowledgement" = false AND "pinned" = false));

-- Categorias iniciais (§183 para Novidades; "Geral" para Comunicados). Cadastráveis no FPOne Admin.
INSERT INTO "publication_category" ("id", "type", "name") VALUES
  (gen_random_uuid(), 'NEWS', 'Empresa'),
  (gen_random_uuid(), 'NEWS', 'Sistemas'),
  (gen_random_uuid(), 'NEWS', 'Pessoas'),
  (gen_random_uuid(), 'ANNOUNCEMENT', 'Geral');
