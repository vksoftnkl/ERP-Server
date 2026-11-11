import { BadRequestException, ConflictException, Injectable, Logger } from '@nestjs/common';
import { CLIENT_PLATFORMS, type ClientPlatform } from '../../../common/client-info/client-info';
import type { CompatManifest } from '../compat/compat-manifest';
import type { UpdateBuildPolicyDto } from '../dto/build-policy.dto';
import { AppVersionErrorCode, appVersionErrorBody } from '../types/app-version-error-codes';
import { UpdateRequiredException } from '../types/update-required.exception';
import {
  AppVersionStateStore,
  type BuildPolicy,
  type BuildPolicyValues,
} from './app-version-state.store';

/**
 * Part B Step 2 Rev 2 §3B: the enforced frontend build match.
 *
 * One policy per platform (public.app_build_policy). While a platform's
 * `enforce` is true, a login or refresh from that platform must send
 * X-App-Build equal to `expectedBuild`, else 426 UPDATE_REQUIRED. A missing or
 * unreadable build header counts as a mismatch. A newer build is a mismatch
 * too (exact match). Platforms are independent.
 *
 * The policies sit in memory: loaded at startup, re-read every
 * STATE_REFRESH_INTERVAL_MS, and replaced at once when this process's admin API
 * changes one. There is no DB read per request. If the table cannot be read,
 * the last good copy stands (empty before the first read = nothing enforced):
 * a failure here never blocks a login.
 */
@Injectable()
export class BuildPolicyService {
  private readonly logger = new Logger(BuildPolicyService.name);
  private policies = new Map<ClientPlatform, BuildPolicy>();
  private readFailed = false;
  private inFlight: Promise<void> | null = null;
  /** Raised by every local write; a read that started before one is dropped. */
  private generation = 0;

  constructor(private readonly store: AppVersionStateStore) {}

  async reload(): Promise<void> {
    this.inFlight ??= this.read().finally(() => {
      this.inFlight = null;
    });
    return this.inFlight;
  }

  /** All three platforms; a platform with no live row reads as not enforced. */
  list(): BuildPolicy[] {
    return CLIENT_PLATFORMS.map((platform) => this.policies.get(platform) ?? noPolicy(platform));
  }

  get(platform: ClientPlatform): BuildPolicy | null {
    return this.policies.get(platform) ?? null;
  }

  /**
   * §5.2. `platform` null (the client named none, by header, login body or
   * token) means no policy applies. Throws UpdateRequiredException (426).
   */
  assertClientBuild(platform: ClientPlatform | null, clientBuild: number | null): void {
    if (platform === null) {
      return;
    }
    const policy = this.policies.get(platform);
    if (!policy || !policy.enforce || policy.expectedBuild === null) {
      return;
    }
    if (clientBuild === policy.expectedBuild) {
      return;
    }
    throw new UpdateRequiredException({
      platform,
      clientBuild,
      expectedBuild: policy.expectedBuild,
      message: policy.message,
      downloadUrl: policy.downloadUrl,
    });
  }

  /**
   * §5.4 PATCH: only the fields sent change; the row becomes 'manual', so a
   * later backend update leaves it alone (useManifest hands it back).
   */
  async update(
    platform: ClientPlatform,
    dto: UpdateBuildPolicyDto,
    actor: string,
  ): Promise<BuildPolicy> {
    const saved = await this.store.writePolicy(platform, 'manual', actor, (current) => {
      const base = current ?? noPolicy(platform);
      const next: BuildPolicyValues = {
        enforce: dto.enforce ?? base.enforce,
        expectedBuild: dto.expectedBuild === undefined ? base.expectedBuild : dto.expectedBuild,
        message: dto.message === undefined ? base.message : dto.message,
        downloadUrl: dto.downloadUrl === undefined ? base.downloadUrl : dto.downloadUrl,
      };
      if (next.enforce && next.expectedBuild === null) {
        throw new BadRequestException(
          appVersionErrorBody(
            `${platform}: enforce = true needs an expectedBuild`,
            'expectedBuild',
            AppVersionErrorCode.POLICY_BUILD_REQUIRED,
          ),
        );
      }
      return next;
    });
    this.remember(saved);
    return saved;
  }

  /** Hands a platform back to the bundled compat manifest: its values, source 'manifest'. */
  async useManifest(
    platform: ClientPlatform,
    manifest: CompatManifest | null,
    actor: string,
  ): Promise<BuildPolicy> {
    if (!manifest) {
      throw new ConflictException(
        appVersionErrorBody(
          'This server has no valid compat manifest (APP_BUILD + compat-manifest.json); ' +
            'set the policy by hand instead',
          'platform',
          AppVersionErrorCode.POLICY_NO_MANIFEST,
        ),
      );
    }
    const entry = manifest.clients[platform];
    const saved = await this.store.writePolicy(platform, 'manifest', actor, () => ({
      enforce: entry.enforce,
      expectedBuild: entry.expectedBuild,
      message: entry.message,
      downloadUrl: entry.downloadUrl,
    }));
    this.remember(saved);
    return saved;
  }

  private remember(policy: BuildPolicy): void {
    this.generation += 1;
    const next = new Map(this.policies);
    next.set(policy.platform, policy);
    this.policies = next;
  }

  private async read(): Promise<void> {
    const generation = this.generation;
    try {
      const rows = await this.store.readPolicies();
      if (generation !== this.generation) {
        // An admin change landed while this read was out: it may predate it.
        return;
      }
      this.policies = new Map(rows.map((row) => [row.platform, row]));
      if (this.readFailed) {
        this.readFailed = false;
        this.logger.log('Build policy: readable again');
      }
    } catch (error: unknown) {
      if (!this.readFailed) {
        this.readFailed = true;
        const message =
          error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
        this.logger.warn(
          `Build policy: could not read app_build_policy, keeping the last copy: ${message}`,
        );
      }
    }
  }
}

function noPolicy(platform: ClientPlatform): BuildPolicy {
  return {
    platform,
    enforce: false,
    expectedBuild: null,
    message: null,
    downloadUrl: null,
    source: 'manifest',
    changedOn: null,
    changedBy: null,
  };
}
