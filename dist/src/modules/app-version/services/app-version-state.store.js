"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppVersionStateStore = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const client_info_1 = require("../../../common/client-info/client-info");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const POLICY_COLUMNS_SQL = client_1.Prisma.sql `
  abp_platform                             AS platform,
  abp_enforce                              AS enforce,
  abp_expected_build                       AS "expectedBuild",
  abp_message                              AS message,
  abp_download_url                         AS "downloadUrl",
  abp_source                               AS source,
  COALESCE(abp_modified_on, abp_created_on) AS "changedOn",
  COALESCE(abp_modified_by, abp_created_by) AS "changedBy",
  (abp_is_active AND NOT abp_is_deleted)   AS live`;
const LOCK_NAMESPACE = 'app_version';
const LOCK_KEY = 'backend_update';
const UPDATE_TX_OPTIONS = { maxWait: 10_000, timeout: 30_000 };
let AppVersionStateStore = class AppVersionStateStore {
    prisma;
    constructor(prisma) {
        this.prisma = prisma;
    }
    async readEpoch() {
        const rows = await this.prisma.$queryRaw `
      SELECT aas_token_epoch AS epoch
        FROM public.app_auth_state
       WHERE aas_key = 'auth' AND aas_is_deleted = false`;
        return rows.length > 0 ? Number(rows[0].epoch) : 0;
    }
    async readPolicies() {
        const rows = await this.prisma.$queryRaw `
      SELECT ${POLICY_COLUMNS_SQL}
        FROM public.app_build_policy
       WHERE abp_is_deleted = false AND abp_is_active = true`;
        return rows.map(toPolicy).filter((policy) => policy !== null);
    }
    async applyBackendUpdate(input, whileLocked) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$queryRaw `
        SELECT count(pg_advisory_xact_lock(hashtext(${LOCK_NAMESPACE}), hashtext(${LOCK_KEY})))::int AS locked`;
            await tx.$executeRaw `
        INSERT INTO public.app_auth_state (aas_key, aas_created_by)
        VALUES ('auth', ${input.actor})
        ON CONFLICT (aas_key) DO NOTHING`;
            const [state] = await tx.$queryRaw `
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
                    policiesNoValue: [],
                    releasesImported: null,
                };
            }
            const [raised] = await tx.$queryRaw `
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
            const policiesWritten = [];
            const policiesKeptManual = [];
            const policiesNoValue = [];
            for (const platform of client_info_1.CLIENT_PLATFORMS) {
                const entry = input.manifest.clients[platform];
                if (entry.expectedBuild === null && entry.message === null && entry.downloadUrl === null) {
                    policiesNoValue.push(platform);
                    continue;
                }
                const written = await tx.$executeRaw `
          INSERT INTO public.app_build_policy AS p
                 (abp_platform, abp_expected_build, abp_message, abp_download_url,
                  abp_source, abp_created_by, abp_modified_on, abp_modified_by)
          VALUES (${platform}, ${entry.expectedBuild}::int, ${entry.message},
                  ${entry.downloadUrl}, 'manifest', ${input.actor}, now(), ${input.actor})
          ON CONFLICT (abp_platform) DO UPDATE
             SET abp_expected_build = COALESCE(EXCLUDED.abp_expected_build, p.abp_expected_build),
                 abp_message        = COALESCE(EXCLUDED.abp_message, p.abp_message),
                 abp_download_url   = COALESCE(EXCLUDED.abp_download_url, p.abp_download_url),
                 abp_source         = 'manifest',
                 abp_is_active      = true,
                 abp_is_deleted     = false,
                 abp_modified_on    = now(),
                 abp_modified_by    = EXCLUDED.abp_modified_by
           WHERE p.abp_source <> 'manual' OR p.abp_is_deleted OR NOT p.abp_is_active`;
                (written > 0 ? policiesWritten : policiesKeptManual).push(platform);
            }
            const releasesImported = input.releases === null ? null : await importReleases(tx, input.releases, input.actor);
            const outcome = {
                bumped: true,
                epoch: Number(raised.epoch),
                previousBuild,
                policiesWritten,
                policiesKeptManual,
                policiesNoValue,
                releasesImported,
            };
            if (whileLocked) {
                try {
                    await whileLocked(outcome);
                }
                catch {
                }
            }
            return outcome;
        }, UPDATE_TX_OPTIONS);
    }
    async closeOpenLoginSessions(actor) {
        return this.prisma.$executeRaw `
      UPDATE audit.user_login_sessions
         SET uls_is_active_session = false,
             uls_logout_on         = now(),
             uls_logout_type       = 'BACKEND_UPDATE',
             uls_modified_on       = now(),
             uls_modified_by       = ${actor}
       WHERE uls_is_active_session = true`;
    }
    async setExpectedBuild(tx, platform, build, downloadUrl, actor) {
        const written = await tx.$executeRaw `
      INSERT INTO public.app_build_policy AS p
             (abp_platform, abp_expected_build, abp_download_url, abp_source,
              abp_created_by, abp_modified_on, abp_modified_by)
      VALUES (${platform}, ${build}::int, ${downloadUrl}, 'manifest', ${actor}, now(), ${actor})
      ON CONFLICT (abp_platform) DO UPDATE
         SET abp_expected_build = EXCLUDED.abp_expected_build,
             abp_download_url   = COALESCE(EXCLUDED.abp_download_url, p.abp_download_url),
             abp_is_active      = true,
             abp_is_deleted     = false,
             abp_modified_on    = now(),
             abp_modified_by    = EXCLUDED.abp_modified_by
       WHERE p.abp_source <> 'manual' OR p.abp_is_deleted OR NOT p.abp_is_active`;
        return written > 0;
    }
    async writePolicy(platform, source, actor, change) {
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `
        INSERT INTO public.app_build_policy (abp_platform, abp_created_by)
        VALUES (${platform}, ${actor})
        ON CONFLICT (abp_platform) DO NOTHING`;
            const [row] = await tx.$queryRaw `
        SELECT ${POLICY_COLUMNS_SQL}
          FROM public.app_build_policy
         WHERE abp_platform = ${platform}
           FOR UPDATE`;
            const next = change(row.live ? toPolicy(row) : null);
            const [updated] = await tx.$queryRaw `
        UPDATE public.app_build_policy
           SET abp_enforce        = ${next.enforce},
               abp_expected_build = ${next.expectedBuild}::int,
               abp_message        = ${next.message},
               abp_download_url   = ${next.downloadUrl},
               abp_source         = COALESCE(${source}::varchar, abp_source),
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
};
exports.AppVersionStateStore = AppVersionStateStore;
exports.AppVersionStateStore = AppVersionStateStore = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], AppVersionStateStore);
function toPolicy(row) {
    if (!client_info_1.CLIENT_PLATFORMS.includes(row.platform)) {
        return null;
    }
    return {
        platform: row.platform,
        enforce: row.enforce === true,
        expectedBuild: row.expectedBuild === null ? null : Number(row.expectedBuild),
        message: row.message,
        downloadUrl: row.downloadUrl,
        source: row.source === 'manual' ? 'manual' : 'manifest',
        changedOn: row.changedOn,
        changedBy: row.changedBy,
    };
}
async function importReleases(tx, releases, actor) {
    if (releases.length === 0) {
        return 0;
    }
    return tx.$executeRaw `
    INSERT INTO public.app_release AS r
           (arl_platform, arl_build, arl_version, arl_commit, arl_severity, arl_notes,
            arl_download_url, arl_released_at, arl_is_deleted, arl_created_by)
    SELECT x.platform, x.build, x.version, x.commit, x.severity, x.notes,
           x."downloadUrl", x."releasedAt", x."isDeleted", ${actor}
      FROM jsonb_to_recordset(${JSON.stringify(releases)}::jsonb) AS x(
           platform text, build int, version text, commit text, severity text, notes text,
           "downloadUrl" text, "releasedAt" timestamptz, "isDeleted" boolean)
    ON CONFLICT (arl_platform, arl_build) DO UPDATE
       SET arl_version      = EXCLUDED.arl_version,
           arl_commit       = EXCLUDED.arl_commit,
           arl_severity     = EXCLUDED.arl_severity,
           arl_notes        = EXCLUDED.arl_notes,
           arl_download_url = EXCLUDED.arl_download_url,
           arl_released_at  = EXCLUDED.arl_released_at,
           arl_is_deleted   = r.arl_is_deleted OR EXCLUDED.arl_is_deleted,
           arl_modified_on  = now(),
           arl_modified_by  = ${actor}
     WHERE (r.arl_version, r.arl_commit, r.arl_severity, r.arl_notes, r.arl_download_url,
            r.arl_released_at, r.arl_is_deleted)
           IS DISTINCT FROM
           (EXCLUDED.arl_version, EXCLUDED.arl_commit, EXCLUDED.arl_severity, EXCLUDED.arl_notes,
            EXCLUDED.arl_download_url, EXCLUDED.arl_released_at,
            r.arl_is_deleted OR EXCLUDED.arl_is_deleted)`;
}
//# sourceMappingURL=app-version-state.store.js.map