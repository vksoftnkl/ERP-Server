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

/** The ops-key header the release and support APIs require. */
export const OPS_KEY_HEADER = 'x-ops-key';
/** Optional: who is calling (e.g. "ci:github-run-123"), stamped into *_created_by / *_modified_by. */
export const OPS_ACTOR_HEADER = 'x-ops-actor';
/** *_created_by / *_modified_by for a write the server makes on its own. */
export const SYSTEM_ACTOR = 'app-version';
