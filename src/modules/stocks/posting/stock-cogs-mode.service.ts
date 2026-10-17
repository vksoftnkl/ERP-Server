import { Injectable } from '@nestjs/common';
import { AppSettingValueService } from '../../settings/appSettings/app-setting-value.service';

export type CogsMode = 'PERPETUAL' | 'PERIODIC';

/** What the accounts posting asks before it writes a leg. Small on purpose, so a test can hand in a literal. */
export interface CogsModeResolver {
  cogsMode(companyId: string, branchId: string): Promise<CogsMode>;
}

/**
 * `accounts.cogs_mode`, through the same resolver the sales module reads it
 * with (`SalesContextService`): PERPETUAL is the default and the only mode in
 * which a stock document touches the Stock-in-Hand ledger. Under PERIODIC no
 * stock voucher posts a leg — the year-end stock journal does that.
 */
@Injectable()
export class StockCogsModeService implements CogsModeResolver {
  constructor(private readonly appSettings: AppSettingValueService) {}

  async cogsMode(companyId: string, branchId: string): Promise<CogsMode> {
    const effective = await this.appSettings.resolveEffective({
      companyId,
      branchId,
      deviceId: null,
      userId: null,
    });
    const value = (effective.find((i) => i.asdKey === 'accounts.cogs_mode')?.value ?? '')
      .trim()
      .toUpperCase();
    return value === 'PERIODIC' ? 'PERIODIC' : 'PERPETUAL';
  }
}
