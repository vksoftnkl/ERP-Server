import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from '../../settings/appSettings/types/app-settings-api.types';
import { TenderSettingKey } from './types/tender-settlement-enum';

/**
 * The `tender.*` settings 49 seeded (plan §9), read through
 * `AppSettingValueService.resolveEffective` like the till's — never from
 * app_setting_value directly.
 */
export interface TenderSettings {
  /** The same reference on two bills: BLOCK refuses the save, WARN lets it through. */
  duplicateRef: 'BLOCK' | 'WARN';
  /** Card close = one batch total per terminal: a line must name its terminal when there are several. */
  closeByTerminal: boolean;
  /** The amount + time suggestion window. */
  matchWindowMinutes: number;
  /** A reference match may differ by this much; more and it is not a match. */
  matchAmountTolerance: Prisma.Decimal;
  /** Days past td_expected_settle_on before a row is "not received". */
  settleGraceDays: number;
}

export const TENDER_SETTING_DEFAULTS: TenderSettings = {
  duplicateRef: 'BLOCK',
  closeByTerminal: true,
  matchWindowMinutes: 30,
  matchAmountTolerance: new Prisma.Decimal(0),
  settleGraceDays: 2,
};

export function readTenderSettings(effective: readonly AppSettingEffectiveItem[]): TenderSettings {
  const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
  const d = TENDER_SETTING_DEFAULTS;
  const duplicate = byKey.get(TenderSettingKey.DUPLICATE_REF)?.trim().toUpperCase();
  const bool = byKey.get(TenderSettingKey.CLOSE_BY_TERMINAL)?.trim().toLowerCase();
  return {
    duplicateRef: duplicate === 'WARN' || duplicate === 'BLOCK' ? duplicate : d.duplicateRef,
    closeByTerminal:
      bool === undefined || bool === ''
        ? d.closeByTerminal
        : ['true', '1', 'yes', 'y', 'on'].includes(bool),
    matchWindowMinutes: int(byKey.get(TenderSettingKey.MATCH_WINDOW_MINUTES), d.matchWindowMinutes),
    matchAmountTolerance: decimal(
      byKey.get(TenderSettingKey.MATCH_AMOUNT_TOLERANCE),
      d.matchAmountTolerance,
    ),
    settleGraceDays: int(byKey.get(TenderSettingKey.SETTLE_GRACE_DAYS), d.settleGraceDays),
  };
}

function int(value: string | null | undefined, fallback: number): number {
  const parsed = Number.parseInt(value?.trim() ?? '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

function decimal(value: string | null | undefined, fallback: Prisma.Decimal): Prisma.Decimal {
  const token = value?.trim();
  if (!token) return fallback;
  try {
    const parsed = new Prisma.Decimal(token);
    return parsed.isNegative() || !parsed.isFinite() ? fallback : parsed;
  } catch {
    return fallback;
  }
}
