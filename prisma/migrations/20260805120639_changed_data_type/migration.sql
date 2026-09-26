-- AlterTable
ALTER TABLE "transaction_hold" ALTER COLUMN "th_locked_by" SET DATA TYPE TEXT,
ALTER COLUMN "th_resumed_by" SET DATA TYPE TEXT,
ALTER COLUMN "th_converted_by" SET DATA TYPE TEXT,
ALTER COLUMN "th_created_by" SET DATA TYPE TEXT,
ALTER COLUMN "th_modified_by" SET DATA TYPE TEXT;
