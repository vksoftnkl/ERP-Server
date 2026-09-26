-- AlterTable
-- Drop the uuidv7() default so state_master.stm_id can be assigned explicitly to its parent
-- acc_group_id (1:1 shared-PK link). With a default in place Prisma would generate its own id
-- and silently ignore the assigned value.
ALTER TABLE "sales"."state_master" ALTER COLUMN "stm_id" DROP DEFAULT;
