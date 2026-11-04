-- CreateTable
CREATE TABLE IF NOT EXISTS "meeting_revisions" (
    "id" UUID NOT NULL,
    "organization_id" UUID NOT NULL,
    "meeting_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "saved_by_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "meeting_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "meeting_revisions_organization_id_meeting_id_version_key" ON "meeting_revisions"("organization_id", "meeting_id", "version");

-- AddForeignKey
DO $$ BEGIN IF NOT EXISTS(SELECT 1 FROM pg_constraint WHERE conrelid='meeting_revisions'::regclass AND conname='meeting_revisions_organization_id_meeting_id_fkey') THEN
ALTER TABLE "meeting_revisions" ADD CONSTRAINT "meeting_revisions_organization_id_meeting_id_fkey" FOREIGN KEY ("organization_id", "meeting_id") REFERENCES "meetings"("organization_id", "id") ON DELETE RESTRICT ON UPDATE CASCADE;
END IF; END $$;
