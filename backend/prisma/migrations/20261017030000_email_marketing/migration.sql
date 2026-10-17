-- AlterTable
ALTER TABLE "Subscriber" ADD COLUMN "unsubToken" TEXT,
ADD COLUMN "unsubscribedAt" TIMESTAMP(3),
ADD COLUMN "welcomeCode" TEXT;

-- Backfill: mỗi email đã đăng ký trước đây nhận một mã hủy đăng ký riêng
UPDATE "Subscriber" SET "unsubToken" = md5(random()::text || id || clock_timestamp()::text) WHERE "unsubToken" IS NULL;

ALTER TABLE "Subscriber" ALTER COLUMN "unsubToken" SET NOT NULL;

-- CreateIndex
CREATE UNIQUE INDEX "Subscriber_unsubToken_key" ON "Subscriber"("unsubToken");

-- CreateTable
CREATE TABLE "EmailBlast" (
    "id" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'SENDING',
    "total" INTEGER NOT NULL DEFAULT 0,
    "sent" INTEGER NOT NULL DEFAULT 0,
    "failed" INTEGER NOT NULL DEFAULT 0,
    "createdBy" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),

    CONSTRAINT "EmailBlast_pkey" PRIMARY KEY ("id")
);
