import { Prisma } from '@prisma/client';
import type { AppSettingEffectiveItem } from 'src/modules/settings/appSettings/types/app-settings-api.types';
import { PaymentSettingKey, PdcPostingMode, ReceiptBillSort } from './types/payment-enum';

/**
 * The settings the payment reads — the receipt's, reused (plan §2.5), plus
 * `accounts.payment_salesman_mandatory` for the "paid by" rule. Read through
 * the resolver and never through `app_setting_value` directly, for the reason
 * `receipt.settings.ts` gives.
 *
 * NOT `accounts.ppd_slabs` (notes 62 A4): that is the discount WE give our
 * customers. What a supplier gives us for paying early is on the supplier —
 * `sup_cash_disc_perc` within `sup_credit_days` — and is read with the bills
 * (`payment-open-items.service.ts`).
 */
export interface PaymentSettings {
  pdcPostingMode: PdcPostingMode;
  billSort: ReceiptBillSort;
  salesmanMandatory: boolean;
  writeoffApprovalAbove: Prisma.Decimal;
  allowPostedAmend: boolean;
}

export const PAYMENT_SETTING_DEFAULTS: PaymentSettings = {
  pdcPostingMode: PdcPostingMode.ON_RECEIPT,
  billSort: ReceiptBillSort.DUE_DATE,
  salesmanMandatory: false,
  writeoffApprovalAbove: new Prisma.Decimal(0),
  allowPostedAmend: false,
};

export function readPaymentSettings(
  effective: readonly AppSettingEffectiveItem[],
): PaymentSettings {
  const byKey = new Map(effective.map((item) => [item.asdKey, item.value]));
  return {
    pdcPostingMode: pickEnum(
      byKey.get(PaymentSettingKey.PDC_POSTING_MODE),
      Object.values(PdcPostingMode),
      PAYMENT_SETTING_DEFAULTS.pdcPostingMode,
    ),
    billSort: pickEnum(
      byKey.get(PaymentSettingKey.BILL_SORT),
      Object.values(ReceiptBillSort),
      PAYMENT_SETTING_DEFAULTS.billSort,
    ),
    salesmanMandatory: pickBoolean(
      byKey.get(PaymentSettingKey.SALESMAN_MANDATORY),
      PAYMENT_SETTING_DEFAULTS.salesmanMandatory,
    ),
    writeoffApprovalAbove: pickDecimal(
      byKey.get(PaymentSettingKey.WRITEOFF_APPROVAL_ABOVE),
      PAYMENT_SETTING_DEFAULTS.writeoffApprovalAbove,
    ),
    allowPostedAmend: pickBoolean(
      byKey.get(PaymentSettingKey.ALLOW_POSTED_AMEND),
      PAYMENT_SETTING_DEFAULTS.allowPostedAmend,
    ),
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
