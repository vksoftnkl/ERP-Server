-- ═══════════════════════════════════════════════════════════════════════════
--  public._erp_seed_history — the seed runner's bookkeeping table.
--
--  src/database/seed/seed-runner.ts creates this table itself, at runtime, on
--  every boot with DB_AUTO_SEED set. That made it invisible to the migration
--  history and therefore DRIFT: `prisma migrate dev` saw a table it had never
--  created and demanded a reset of all eleven schemas.
--
--  Declaring it here (and as model SeedHistory in prisma/public/seedHistory
--  .prisma) puts it under Prisma's control. IF NOT EXISTS keeps it a no-op on
--  every database that has already booted the app once; on those, this
--  migration was recorded with `prisma migrate resolve --applied`.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS public._erp_seed_history (
    seed_name    TEXT NOT NULL,
    seed_kind    TEXT NOT NULL,
    checksum     TEXT NOT NULL,
    last_status  TEXT NOT NULL,
    last_error   TEXT,
    duration_ms  INTEGER NOT NULL DEFAULT 0,
    run_count    INTEGER NOT NULL DEFAULT 0,
    first_run_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    last_run_at  TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT _erp_seed_history_pkey PRIMARY KEY (seed_name)
);
