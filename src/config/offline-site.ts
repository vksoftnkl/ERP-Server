import type { ConfigService } from '@nestjs/config';

/**
 * Is this install an offline site? Voucher Types plan decision 41
 * (Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md): the existing
 * `cloudSync.enabled` flag (CLOUD_SYNC_ENABLED, configuration.ts) says so. An
 * offline site pushes its rows to the cloud; the main (cloud) server leaves the
 * flag unset.
 *
 * The one definition behind every "only on the main server" refusal
 * (VT_OFFLINE): the Voucher Types master's writes (decision 41) and the Sales
 * Bill's child types (decision 64: until a cloud-to-site sync exists, an offline
 * site bills plain Sales Bill only). Review N2 (go-live checklist) may add a
 * second signal here; every caller then follows.
 */
export const OFFLINE_SITE_CONFIG_KEY = 'cloudSync.enabled';

/** No config (a unit test's bare service) reads as "not offline". */
export function isOfflineSite(config: Pick<ConfigService, 'get'> | null | undefined): boolean {
  return Boolean(config?.get<boolean>(OFFLINE_SITE_CONFIG_KEY));
}
