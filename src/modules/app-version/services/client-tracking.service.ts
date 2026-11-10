import { Injectable, Logger } from '@nestjs/common';
import { hasClientBuild, type ClientInfo } from '../../../common/client-info/client-info';
import type { AppUpdateInfoDto } from '../dto/check-update.dto';
import { AppUpdateService } from './app-update.service';
import { ClientInstallationService } from './client-installation.service';
import { LegacyUsageService } from './legacy-usage.service';

export interface SessionTrackingContext {
  client: ClientInfo | null | undefined;
  userId: string;
  /** Login name, stamped into cin_created_by / cin_modified_by. */
  userName: string;
  companyId: string | null;
  branchId: string | null;
  ip: string | null;
}

/**
 * What /auth/login and /auth/refresh call. Every method is a no-op for a client
 * that did not send BOTH X-App-Platform and X-App-Build, so an old build gets
 * byte-for-byte the response it always got. Nothing here throws: a failed write
 * or check is logged and the login goes on without it.
 */
@Injectable()
export class ClientTrackingService {
  private readonly logger = new Logger(ClientTrackingService.name);

  constructor(
    private readonly installations: ClientInstallationService,
    private readonly updates: AppUpdateService,
    private readonly legacyUsage: LegacyUsageService,
  ) {}

  /** Records the installation and returns the update notice, or null: then the response carries no `appUpdate`. */
  async onLogin(context: SessionTrackingContext): Promise<AppUpdateInfoDto | null> {
    try {
      const { client } = context;
      if (!hasClientBuild(client)) {
        return null;
      }
      const sighting = { ...context, client, actor: context.userName };
      const [, update] = await Promise.all([
        this.guard('record the login installation', () => this.installations.recordLogin(sighting)),
        this.guard('check for an update', () => this.updates.check(client.platform, client.build)),
      ]);
      return update;
    } catch (error: unknown) {
      this.warn('track the login', error);
      return null;
    }
  }

  /** Records the installation, at most once per 10 minutes per device. */
  async onRefresh(context: SessionTrackingContext): Promise<void> {
    try {
      const { client } = context;
      if (!hasClientBuild(client)) {
        return;
      }
      await this.guard('record the refresh installation', () =>
        this.installations.recordRefresh({ ...context, client, actor: context.userName }),
      );
    } catch (error: unknown) {
      this.warn('track the refresh', error);
    }
  }

  /** Counts one use of a legacy request field (see LegacyUsageService). */
  legacyField(name: string, client: ClientInfo | null | undefined): void {
    this.legacyUsage.record(name, client);
  }

  private async guard<T>(what: string, work: () => Promise<T>): Promise<T | null> {
    try {
      return await work();
    } catch (error: unknown) {
      this.warn(what, error);
      return null;
    }
  }

  private warn(what: string, error: unknown): void {
    const message =
      error instanceof Error && error.message.trim() ? error.message.trim() : 'unknown error';
    this.logger.warn(`App version: could not ${what} (the request goes on): ${message}`);
  }
}
