import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from 'src/modules/settings/appSettings/types/app-settings-api.types';
import { parsePpdSlabs, type PpdSlab } from './ppd-slab';
import { PdcPostingMode, ReceiptBillSort, ReceiptSettingKey, TcsBasis } from './types/receipt-enum';

/**
 * §2.8's seven settings, picked out of what
 * `AppSettingValueService.resolveEffective` answered.
 *
 * Reading goes through the resolver and never through `app_setting_value`
 * directly: the resolver applies the GLOBAL < COMPANY < BRANCH < DEVICE < USER
 * precedence that `public.fn_app_settings_effective` defines, and re-merging it
 * here would make the receipt screen and the settings screen disagree about
 * what is configured — which is worse than having no setting.
 *
 * Every getter falls back to the SEEDED default rather than to an extreme. A
 * blank value, a value outside the catalogue's own list, or a key the catalogue
 * has not got yet (a database one migration behind) must not stop an operator
 * taking money.
 */

/** Every setting this module reads, resolved once per request. */
export interface ReceiptSettings {
  /** R2 — ON_RECEIPT is the only mode this plan implements. */
  pdcPostingMode: PdcPostingMode;
  /** R12 — the order open bills are listed, and therefore filled, in. */
  billSort: ReceiptBillSort;
  /** R6 — refuse a post whose receipt names no employee. */
  salesmanMandatory: boolean;
  /** A write-off strictly above this needs an approver. 0 = every write-off does. */
  writeoffApprovalAbove: Prisma.Decimal;
  /** R15 — whether the receipt seeds a TCS line for a TCS-applicable party. */
  tcsBasis: TcsBasis;
  /** R16 — what the prompt-payment discount suggests. */
  ppdSlabs: PpdSlab[];
}

export const RECEIPT_SETTING_DEFAULTS: ReceiptSettings = {
  pdcPostingMode: PdcPostingMode.ON_RECEIPT,
  billSort: ReceiptBillSort.DUE_DATE,
  salesmanMandatory: false,
  // Zero, not "unlimited": the safe end of this setting is the one where a
  // human has to look at every write-off, and raising it is a deliberate act.
  writeoffApprovalAbove: new Prisma.Decimal(0),
  tcsBasis: TcsBasis.RECEIPT,
  ppdSlabs: [],
};

/**
 * Turn the whole resolved catalogue into this module's seven answers.
 *
 * Takes the catalogue rather than a company / branch, so the caller resolves
 * once and every part of one request sees the same configuration — a post whose
 * approval rule changed halfway through would be a genuinely confusing bug.
 */
export function readReceiptSettings(
  effective: readonly AppSettingEffectiveItem[],
): ReceiptSettings {
  const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));

  return {
    pdcPostingMode: pickEnum(
      byKey.get(ReceiptSettingKey.PDC_POSTING_MODE),
      Object.values(PdcPostingMode),
      RECEIPT_SETTING_DEFAULTS.pdcPostingMode,
    ),
    billSort: pickEnum(
      byKey.get(ReceiptSettingKey.BILL_SORT),
      Object.values(ReceiptBillSort),
      RECEIPT_SETTING_DEFAULTS.billSort,
    ),
    salesmanMandatory: pickBoolean(
      byKey.get(ReceiptSettingKey.SALESMAN_MANDATORY),
      RECEIPT_SETTING_DEFAULTS.salesmanMandatory,
    ),
    writeoffApprovalAbove: pickDecimal(
      byKey.get(ReceiptSettingKey.WRITEOFF_APPROVAL_ABOVE),
      RECEIPT_SETTING_DEFAULTS.writeoffApprovalAbove,
    ),
    tcsBasis: pickEnum(
      byKey.get(ReceiptSettingKey.TCS_BASIS),
      Object.values(TcsBasis),
      RECEIPT_SETTING_DEFAULTS.tcsBasis,
    ),
    ppdSlabs: parsePpdSlabs(byKey.get(ReceiptSettingKey.PPD_SLABS) ?? null),
  };
}

function pickEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly T[],
  fallback: T,
): T {
  const token = value?.trim().toUpperCase();
  return token && (allowed as readonly string[]).includes(token) ? (token as T) : fallback;
}

/**
 * `public.app_setting_value` stores everything as text, so a BOOL arrives as
 * 'true' / 'false'. Anything else — including the 1 / 0 and yes / no a hand-made
 * row might carry — is read generously, because the alternative is silently
 * treating a configured `1` as false.
 */
function pickBoolean(value: string | null | undefined, fallback: boolean): boolean {
  const token = value?.trim().toLowerCase();
  if (token === undefined || token === '') {
    return fallback;
  }
  if (['true', '1', 'yes', 'y', 'on'].includes(token)) {
    return true;
  }
  if (['false', '0', 'no', 'n', 'off'].includes(token)) {
    return false;
  }
  return fallback;
}

function pickDecimal(value: string | null | undefined, fallback: Prisma.Decimal): Prisma.Decimal {
  const token = value?.trim();
  if (!token) {
    return fallback;
  }
  try {
    const parsed = new Prisma.Decimal(token);
    return parsed.isNegative() || !parsed.isFinite() ? fallback : parsed;
  } catch {
    return fallback;
  }
}
