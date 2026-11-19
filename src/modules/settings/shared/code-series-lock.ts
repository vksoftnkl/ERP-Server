import type { SettingsWriteClient } from 'src/common/utils/module-service.utils';

/**
 * Company + Branch master plan C1 / C9a (18/11/2026) — one transaction at a
 * time reads and takes a company code or a Branch Code: a company create (its
 * code and its Main Branch's code), and, since the 19/11 review (N2), a branch
 * save that sets a typed brCode, so it cannot take the Main Branch code a
 * company create is about to write. Held until the transaction ends; the
 * unique indexes stay the last word.
 */
export async function lockCodeSeries(tx: SettingsWriteClient): Promise<void> {
  await tx.$queryRaw`SELECT count(pg_advisory_xact_lock(hashtext('public.companys'), hashtext('comp_code')))::int AS locked`;
}
