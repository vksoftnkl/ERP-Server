#!/usr/bin/env bash
# Verifies that erp_app has exactly the access the app needs -- and no more.
set -euo pipefail
. /root/.erp-deploy-secrets

echo "--- role attributes (erp_app must show super=f) ---"
sudo -u postgres psql -d erp -tAc \
  "SELECT rolname || ' super=' || rolsuper || ' createdb=' || rolcreatedb || ' bypassrls=' || rolbypassrls
   FROM pg_roles WHERE rolname IN ('erp_app','postgres') ORDER BY rolname;"

echo "--- schemas created by migrations ---"
sudo -u postgres psql -d erp -tAc \
  "SELECT string_agg(nspname, ', ' ORDER BY nspname) FROM pg_namespace
   WHERE nspname NOT LIKE 'pg\_%' AND nspname <> 'information_schema';"

echo "--- table count visible to erp_app ---"
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U erp_app -d erp -tAc \
  "SELECT count(*) FROM information_schema.tables
   WHERE table_schema NOT IN ('pg_catalog','information_schema');"

echo "--- erp_app can CREATE in public (needed by the seed runner) ---"
PGPASSWORD="$DB_PASSWORD" psql -h 127.0.0.1 -U erp_app -d erp -q -v ON_ERROR_STOP=1 \
  -c "CREATE TABLE IF NOT EXISTS public._perm_probe(x int);" \
  -c "INSERT INTO public._perm_probe VALUES (1);" \
  -c "DROP TABLE public._perm_probe;"
echo "    OK"

echo "--- erp_app can write to postgres-owned migrated tables ---"
sudo -u postgres psql -d erp -tAc \
  "SELECT c.relname || ' insert=' || has_table_privilege('erp_app', c.oid, 'INSERT')
   FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
   WHERE (n.nspname, c.relname) IN (('accounts','acc_bill_balance'),
                                    ('accounts','acc_voucher_header'),
                                    ('sales','sale_bill'),
                                    ('sales','promotion_scheme'))
   ORDER BY 1;"

echo "--- migrations recorded ---"
sudo -u postgres psql -d erp -tAc \
  "SELECT count(*) || ' applied, ' || count(*) FILTER (WHERE finished_at IS NULL) || ' unfinished'
   FROM _prisma_migrations;"

echo "--- acc_year partitions present (bill saves 500 without them) ---"
sudo -u postgres psql -d erp -tAc \
  "SELECT COALESCE(string_agg(DISTINCT right(relname, 9), ', '), '(none)')
   FROM pg_class WHERE relname LIKE 'sale_bill\_2%';"
