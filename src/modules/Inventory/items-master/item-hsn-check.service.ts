import { Injectable } from '@nestjs/common';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { StatutoryService } from 'src/common/posting/statutory.service';
import { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import type { AppSettingEffectiveItem } from 'src/modules/settings/appSettings/types/app-settings-api.types';
import { throwInventoryBadRequest } from 'src/common/utils/module-service.utils';
import { ItemErrorCode } from './types/item-error-codes';
import type { SaveItemCompositeDto } from './dto/save-item-composite.dto';

/**
 * Item master review point 1 (user 2026-11-23, option 1 "our own table"): a saved
 * item's HSN / SAC code is checked against the GST list in fixed.hsn_master (the
 * GST portal's HSN_SAC.xlsx, migration 20261123120000) and against the digits GST
 * asks of the company (rule 46 by turnover class, StatutoryService.hsnDigits; or
 * inventory.hsn_min_length when that asks more).
 *
 * inventory.hsn_check decides what a miss does:
 *   OFF   nothing;
 *   WARN  refused with `confirmable: true` until the request says
 *         item_hsn_confirmed — the item card asks "Save anyway?" and re-posts;
 *   BLOCK refused, `confirmable: false`: the code must be fixed.
 * Only a code the request sends is checked (a group / category default is the
 * admin's own), and only on /items/create (saveComposite), the one route that
 * saves an item.
 */
export const HSN_CHECK_SETTING_KEY = 'inventory.hsn_check';
export const HSN_MIN_LENGTH_SETTING_KEY = 'inventory.hsn_min_length';
export const HSN_CHECK_MODES = ['OFF', 'WARN', 'BLOCK'] as const;
export type HsnCheckMode = (typeof HSN_CHECK_MODES)[number];
export const DEFAULT_HSN_CHECK_MODE: HsnCheckMode = 'WARN';

export interface HsnProblem {
  code: ItemErrorCode.HSN_NOT_IN_LIST | ItemErrorCode.HSN_TOO_SHORT;
  message: string;
}

/** inventory.hsn_check as the resolver answers it; anything unknown = the default. */
export function resolveHsnCheckMode(effective: readonly AppSettingEffectiveItem[]): HsnCheckMode {
  const value = effective.find((e) => e.asdKey === HSN_CHECK_SETTING_KEY)?.value?.trim().toUpperCase();
  return (HSN_CHECK_MODES as readonly string[]).includes(value ?? '') ? (value as HsnCheckMode) : DEFAULT_HSN_CHECK_MODE;
}

/** The pure rule: what is wrong with `code`, given whether the list holds it and the digits asked. */
export function hsnProblem(code: string, inList: boolean, minDigits: number): HsnProblem | null {
  if (!inList) {
    return {
      code: ItemErrorCode.HSN_NOT_IN_LIST,
      message: `HSN / SAC ${code} is not in the GST HSN / SAC list.`,
    };
  }
  if (minDigits > 0 && code.length < minDigits) {
    return {
      code: ItemErrorCode.HSN_TOO_SHORT,
      message: `HSN / SAC ${code} has ${code.length} digits; this company must use at least ${minDigits}.`,
    };
  }
  return null;
}

/** Today in India (the law rows are dated in IST). */
function istToday(now: Date = new Date()): string {
  return new Date(now.getTime() + 330 * 60_000).toISOString().slice(0, 10);
}

@Injectable()
export class ItemHsnCheckService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly statutory: StatutoryService,
    private readonly appSettingValueService: AppSettingValueService,
  ) {}

  /** Refuses the save (400, field item_hsn_code) when the code fails the company's check. */
  async assertHsn(dto: SaveItemCompositeDto): Promise<void> {
    const code = (dto.item_hsn_code ?? '').trim();
    const companyId = dto.item_company_id || this.requestContext.getCompanyId();
    if (!code || !companyId) {
      return;
    }
    const effective = await this.appSettingValueService.resolveEffective({
      companyId,
      branchId: dto.item_branch_id || this.requestContext.getBranchId() || undefined,
      deviceId: this.requestContext.getDeviceId() ?? undefined,
      userId: this.requestContext.getUserId() ?? undefined,
    });
    const mode = resolveHsnCheckMode(effective);
    if (mode === 'OFF') {
      return;
    }
    const rows = await this.prisma.$queryRaw<{ found: boolean }[]>`
      SELECT EXISTS (SELECT 1 FROM fixed.hsn_master WHERE hsn_code = ${code} AND hsn_is_active) AS found`;
    const { digits } = await this.statutory.hsnDigits(companyId, istToday());
    const ownMin = Number.parseInt(
      effective.find((e) => e.asdKey === HSN_MIN_LENGTH_SETTING_KEY)?.value ?? '0',
      10,
    );
    const minDigits = Math.max(digits ?? 0, Number.isNaN(ownMin) ? 0 : ownMin);
    const problem = hsnProblem(code, rows[0]?.found === true, minDigits);
    if (!problem || (mode === 'WARN' && dto.item_hsn_confirmed === true)) {
      return;
    }
    throwInventoryBadRequest('HSN / SAC check', [
      {
        field: 'item_hsn_code',
        code: problem.code,
        message:
          mode === 'WARN'
            ? `${problem.message} Save anyway, or pick the right code from the list.`
            : `${problem.message} Pick the right code from the list.`,
        // WARN: the screen may ask and re-post with item_hsn_confirmed.
        confirmable: mode === 'WARN',
      },
    ]);
  }
}
