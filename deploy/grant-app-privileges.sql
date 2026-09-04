-- Re-grant erp_app everything it needs on objects created by the `postgres`
-- role during `prisma migrate deploy`.
--
-- Why this file exists: seven migrations carry pgAdmin-style
-- `ALTER TABLE ... OWNER to postgres` statements, so migrations can only be
-- applied by a superuser. The application itself must NOT be a superuser (a
-- SQL injection under a superuser role reaches COPY ... PROGRAM and therefore
-- shell), so it connects as erp_app and is granted access explicitly.
--
-- Idempotent. Run after every `prisma migrate deploy`.

DO
$$
    DECLARE
        v_schema text;
    BEGIN
        FOR v_schema IN
            SELECT nspname
            FROM pg_namespace
            WHERE nspname NOT LIKE 'pg\_%'
              AND nspname <> 'information_schema'
            LOOP
                -- CREATE is required, not just USAGE: the seed runner creates
                -- public._erp_seed_history on first boot (src/database/seed/seed-runner.ts).
                EXECUTE format('GRANT USAGE, CREATE ON SCHEMA %I TO erp_app', v_schema);

                EXECUTE format(
                        'GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON ALL TABLES IN SCHEMA %I TO erp_app',
                        v_schema);
                EXECUTE format(
                        'GRANT USAGE, SELECT, UPDATE ON ALL SEQUENCES IN SCHEMA %I TO erp_app',
                        v_schema);
                EXECUTE format(
                        'GRANT EXECUTE ON ALL FUNCTIONS IN SCHEMA %I TO erp_app',
                        v_schema);

                -- Objects a FUTURE migration creates as postgres -- including new
                -- acc_year partitions from ensure_acc_year_partitions() -- are
                -- covered without re-running this file.
                EXECUTE format(
                        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT SELECT, INSERT, UPDATE, DELETE, TRUNCATE, REFERENCES ON TABLES TO erp_app',
                        v_schema);
                EXECUTE format(
                        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT USAGE, SELECT, UPDATE ON SEQUENCES TO erp_app',
                        v_schema);
                EXECUTE format(
                        'ALTER DEFAULT PRIVILEGES FOR ROLE postgres IN SCHEMA %I GRANT EXECUTE ON FUNCTIONS TO erp_app',
                        v_schema);
            END LOOP;
    END
$$;
