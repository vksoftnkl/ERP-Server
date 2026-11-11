/**
 * Part B Step 2: the rules the app-version services share.
 * Tables (Step 1, migration 20261110170000_app_versioning): public.app_release,
 * public.client_installation, public.app_legacy_usage.
 */
export const RELEASE_SEVERITIES = ['normal', 'recommended', 'critical'] as const;
export type ReleaseSeverity = (typeof RELEASE_SEVERITIES)[number];

/** Higher = more urgent. The severity of an update = the most urgent build the client missed. */
export const SEVERITY_RANK: Readonly<Record<ReleaseSeverity, number>> = {
  normal: 1,
  recommended: 2,
  critical: 3,
};

/** app_legacy_usage.alu_platform also takes 'unknown' (the client sent no platform). */
export const LEGACY_USAGE_PLATFORMS = ['web', 'desktop', 'mobile', 'unknown'] as const;
export type LegacyUsagePlatform = (typeof LEGACY_USAGE_PLATFORMS)[number];
/** app_legacy_usage.alu_build when the client sent no build. */
export const LEGACY_UNKNOWN_BUILD = -1;

/** A token refresh records the installation at most this often per device. Login always records. */
export const REFRESH_RECORD_INTERVAL_MS = 10 * 60 * 1000;
/** Legacy-field counts are kept in memory and written this often. */
export const LEGACY_FLUSH_INTERVAL_MS = 60 * 1000;
/** Distinct (field, platform, build) counters held between flushes; past this, new keys are dropped. */
export const LEGACY_MAX_PENDING_KEYS = 5_000;

/** *_created_by / *_modified_by for a write the server makes on its own (legacy-usage flush). */
export const SYSTEM_ACTOR = 'app-version';
/** *_created_by / *_modified_by for what the backend writes at startup after a build change. */
export const SYSTEM_UPDATE_ACTOR = 'system-update';

/**
 * User roles (user_master.usr_type) that may change the build policy, register
 * releases and read the support routes (decision D5). Read from user_master on
 * every call, never from the token's user_type claim.
 */
export const APP_VERSION_ADMIN_TYPES: readonly string[] = ['ADMIN', 'SUPER ADMIN'];

/**
 * The token epoch and the build policy are cached in memory. Each API process
 * re-reads them this often, so a change made by another process (a second PM2
 * instance, the dev box's second API) reaches it within this time. A change
 * made through this process's own admin API applies at once.
 */
export const STATE_REFRESH_INTERVAL_MS = 30 * 1000;

/** The bundled compat manifest's file name (see compat/compat-manifest.ts). */
export const COMPAT_MANIFEST_FILE = 'compat-manifest.json';
