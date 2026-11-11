import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { CLIENT_PLATFORMS, type ClientPlatform } from '../../../common/client-info/client-info';
import { PrismaService } from '../../../database/prisma/prisma.service';
import type { CompatManifest } from '../compat/compat-manifest';

/**
 * Part B Step 2 Rev 2: every SQL statement on public.app_build_policy and
 * public.app_auth_state (migration 20261111103000_app_build_policy).
 *
 * Raw SQL rather than the Prisma models on purpose: the startup step needs an
 * advisory lock, a row lock and a conditional upsert (skip 'manual' rows) in
 * one transaction, and a raw statement keeps this module working on a Prisma
 * client generated before the two models existed (both dev APIs share one).
 */
export type BuildPolicySource = 'manifest' | 'manual';

export interface BuildPolicy {
  platform: ClientPlatform;
  enforce: boolean;
  expectedBuild: number | null;
  message: string | null;
  downloadUrl: string | null;
  source: BuildPolicySource;
  /** Last write: abp_modified_on, else abp_created_on. */
  changedOn: Date | null;
  /** Last writer: a user id, 'system-update' or 'migration'. */
  changedBy: string | null;
}

/** The fields a policy write sets. */
export interface BuildPolicyValues {
  enforce: boolean;
  expectedBuild: number | null;
  message: string | null;
  downloadUrl: string | null;
}

export interface BackendUpdateInput {
  build: number;
  version: string;
  commit: string | null;
  manifest: CompatManifest;
  actor: string;
}

export interface BackendUpdateOutcome {
  /** true = APP_BUILD differed from the stored build: epoch raised, manifest written. */
  bumped: boolean;
  epoch: number;
  previousBuild: number | null;
  /** Platforms whose row the manifest wrote; a 'manual' row is skipped. */
  policiesWritten: ClientPlatform[];
  policiesKeptManual: ClientPlatform[];
}

interface PolicyRow {
  platform: string;
  enforce: boolean;
  expectedBuild: number | null;
  message: string | null;
  downloadUrl: string | null;
  source: string;
  changedOn: Date | null;
  changedBy: string | null;
  live: boolean;
}

/** The columns every policy read selects, as PolicyRow. */
const POLICY_COLUMNS_SQL = Prisma.sql`
  abp_platform                             AS platform,
  abp_enforce                              AS enforce,
  abp_expected_build                       AS "expectedBuild",
  abp_message                              AS message,
  abp_download_url                         AS "downloadUrl",
  abp_source                               AS source,
  COALESCE(abp_modified_on, abp_created_on) AS "changedOn",
  COALESCE(abp_modified_by, abp_created_by) AS "changedBy",
  (abp_is_active AND NOT abp_is_deleted)   AS live`;

/** The startup step serialises on this, so two API processes raise the epoch once. */
const LOCK_NAMESPACE = 'app_version';
const LOCK_KEY = 'backend_update';
/** The startup transaction may wait for another instance's; give it room. */
const UPDATE_TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };

@Injectable()
export class AppVersionStateStore {
  constructor(private readonly prisma: PrismaService) {}

  /** The current token epoch. No row (migration not run yet) reads as 0. */
  async readEpoch(): Promise<number> {
    const rows = await this.prisma.$queryRaw<{ epoch: number }[]>`
      SELECT aas_token_epoch AS epoch
        FROM public.app_auth_state
       WHERE aas_key = 'auth' AND aas_is_deleted = false`;
    return rows.length > 0 ? Number(rows[0].epoch) : 0;
  }

  /** Live policy rows (is_active, not deleted), by platform. */
  async readPolicies(): Promise<BuildPolicy[]> {
    const rows = await this.prisma.$queryRaw<PolicyRow[]>`
      SELECT ${POLICY_COLUMNS_SQL}
        FROM public.app_build_policy
       WHERE abp_is_deleted = false AND abp_is_active = true`;
    return rows.map(toPolicy).filter((policy): policy is BuildPolicy => policy !== null);
  }

  /**
   * §5.1, in one transaction under an advisory lock: if APP_BUILD is not the
   * stored build, raise the epoch, record the build, and write the manifest's
   * expected builds into every platform row whose source is not 'manual'.
   * Same build: nothing changes.
   *
   * `whileLocked` runs after a raise, before the commit, while the advisory
   * lock is still held (it must not throw, and must not use `tx`). A second API
   * process waits on the lock and so cannot open its port and log anyone in
   * until it is done: tidying old sessions there cannot catch a fresh login.
   */
  async applyBackendUpdate(
    input: BackendUpdateInput,
    whileLocked?: (outcome: BackendUpdateOutcome) => Promise<void>,
  ): Promise<BackendUpdateOutcome> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$queryRaw`
        SELECT count(pg_advisory_xact_lock(hashtext(${LOCK_NAMESPACE}), hashtext(${LOCK_KEY})))::int AS locked`;
      await tx.$executeRaw`
        INSERT INTO public.app_auth_state (aas_key, aas_created_by)
        VALUES ('auth', ${input.actor})
        ON CONFLICT (aas_key) DO NOTHING`;
      const [state] = await tx.$queryRaw<{ epoch: number; lastBuild: number | null }[]>`
        SELECT aas_token_epoch AS epoch, aas_last_build AS "lastBuild"
          FROM public.app_auth_state
         WHERE aas_key = 'auth'
           FOR UPDATE`;
      const previousBuild = state.lastBuild === null ? null : Number(state.lastBuild);
      if (previousBuild === input.build) {
        return {
          bumped: false,
          epoch: Number(state.epoch),
          previousBuild,
          policiesWritten: [],
          policiesKeptManual: [],
        };
      }
      const [raised] = await tx.$queryRaw<{ epoch: number }[]>`
        UPDATE public.app_auth_state
           SET aas_token_epoch      = aas_token_epoch + 1,
               aas_last_build       = ${input.build}::int,
               aas_last_version     = ${input.version},
               aas_last_commit      = ${input.commit},
               aas_epoch_changed_on = now(),
               aas_is_deleted       = false,
               aas_modified_on      = now(),
               aas_modified_by      = ${input.actor}
         WHERE aas_key = 'auth'
     RETURNING aas_token_epoch AS epoch`;
      const policiesWritten: ClientPlatform[] = [];
      const policiesKeptManual: ClientPlatform[] = [];
      for (const platform of CLIENT_PLATFORMS) {
        const entry = input.manifest.clients[platform];
        const written = await tx.$executeRaw`
          INSERT INTO public.app_build_policy AS p
                 (abp_platform, abp_enforce, abp_expected_build, abp_message, abp_download_url,
                  abp_source, abp_created_by, abp_modified_on, abp_modified_by)
          VALUES (${platform}, ${entry.enforce}, ${entry.expectedBuild}::int, ${entry.message},
                  ${entry.downloadUrl}, 'manifest', ${input.actor}, now(), ${input.actor})
          ON CONFLICT (abp_platform) DO UPDATE
             SET abp_enforce        = EXCLUDED.abp_enforce,
                 abp_expected_build = EXCLUDED.abp_expected_build,
                 abp_message        = EXCLUDED.abp_message,
                 abp_download_url   = EXCLUDED.abp_download_url,
                 abp_source         = 'manifest',
                 abp_is_active      = true,
                 abp_is_deleted     = false,
                 abp_modified_on    = now(),
                 abp_modified_by    = EXCLUDED.abp_modified_by
           WHERE p.abp_source <> 'manual' OR p.abp_is_deleted OR NOT p.abp_is_active`;
        (written > 0 ? policiesWritten : policiesKeptManual).push(platform);
      }
      const outcome: BackendUpdateOutcome = {
        bumped: true,
        epoch: Number(raised.epoch),
        previousBuild,
        policiesWritten,
        policiesKeptManual,
      };
      if (whileLocked) {
        try {
          await whileLocked(outcome);
        } catch {
          // Best effort by contract: tidying must never undo the raise.
        }
      }
      return outcome;
    }, UPDATE_TX_OPTIONS);
  }

  /**
   * After an epoch raise: mark every open audit.user_login_sessions row logged
   * out (the tokens they name are dead). Bookkeeping only: the `ep` claim is
   * what refuses the tokens. Called from `whileLocked` on the plain client (its
   * own connection, outside the transaction), so a failure here cannot abort
   * the raise. Returns the number of rows closed.
   */
  async closeOpenLoginSessions(actor: string): Promise<number> {
    return this.prisma.$executeRaw`
      UPDATE audit.user_login_sessions
         SET uls_is_active_session = false,
             uls_logout_on         = now(),
             uls_logout_type       = 'BACKEND_UPDATE',
             uls_modified_on       = now(),
             uls_modified_by       = ${actor}
       WHERE uls_is_active_session = true`;
  }

  /**
   * Writes one platform's policy. `change` gets the live row (or null) under a
   * row lock and returns the values to store; it may throw to refuse, which
   * rolls everything back.
   */
  async writePolicy(
    platform: ClientPlatform,
    source: BuildPolicySource,
    actor: string,
    change: (current: BuildPolicy | null) => BuildPolicyValues,
  ): Promise<BuildPolicy> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO public.app_build_policy (abp_platform, abp_created_by)
        VALUES (${platform}, ${actor})
        ON CONFLICT (abp_platform) DO NOTHING`;
      const [row] = await tx.$queryRaw<PolicyRow[]>`
        SELECT ${POLICY_COLUMNS_SQL}
          FROM public.app_build_policy
         WHERE abp_platform = ${platform}
           FOR UPDATE`;
      const next = change(row.live ? toPolicy(row) : null);
      const [updated] = await tx.$queryRaw<PolicyRow[]>`
        UPDATE public.app_build_policy
           SET abp_enforce        = ${next.enforce},
               abp_expected_build = ${next.expectedBuild}::int,
               abp_message        = ${next.message},
               abp_download_url   = ${next.downloadUrl},
               abp_source         = ${source},
               abp_is_active      = true,
               abp_is_deleted     = false,
               abp_modified_on    = now(),
               abp_modified_by    = ${actor}
         WHERE abp_platform = ${platform}
     RETURNING ${POLICY_COLUMNS_SQL}`;
      const policy = toPolicy(updated);
      if (!policy) {
        throw new Error(`app_build_policy row for ${platform} did not read back`);
      }
      return policy;
    });
  }
}

function toPolicy(row: PolicyRow): BuildPolicy | null {
  if (!(CLIENT_PLATFORMS as readonly string[]).includes(row.platform)) {
    return null;
  }
  return {
    platform: row.platform as ClientPlatform,
    enforce: row.enforce === true,
    expectedBuild: row.expectedBuild === null ? null : Number(row.expectedBuild),
    message: row.message,
    downloadUrl: row.downloadUrl,
    source: row.source === 'manual' ? 'manual' : 'manifest',
    changedOn: row.changedOn,
    changedBy: row.changedBy,
  };
}
