import type { AppSettingEffectiveItem } from '../../settings/appSettings/types/app-settings-api.types';

/**
 * The sales settings the posting services read, picked out of what
 * `AppSettingValueService.resolveEffective` answered.
 *
 * Reading goes THROUGH the resolver and never through `app_setting_value`
 * directly: the resolver applies the GLOBAL < COMPANY < BRANCH < DEVICE < USER
 * precedence `public.fn_app_settings_effective` defines, and re-merging it here
 * would make the till and the settings screen disagree about what is
 * configured — which is worse than having no setting at all.
 *
 * Every getter falls back to the SEEDED default rather than to an extreme. A
 * blank value, a value outside the catalogue's list, or a key a database one
 * migration behind has not got yet must never stop an operator taking money.
 */

/** `sales.backdate_mode` — what a date before today does. */
export type BackdateMode = 'ALLOW' | 'WARN' | 'REFUSE';

/** `sales.credit_limit_mode` — and the safe end is WARN, not OFF. */
export type CreditLimitMode = 'OFF' | 'WARN' | 'REFUSE';

/** `sales.rate_below_min_mode` */
export type RateBelowMinMode = 'ALLOW' | 'WARN' | 'REFUSE';

/** `sales.temp_credit_block_open` */
export type TempCreditBlockOpen = 'OFF' | 'WARN' | 'REFUSE';

export interface SalesSettings {
  backdateMode: BackdateMode;
  creditLimitMode: CreditLimitMode;
  rateBelowMinMode: RateBelowMinMode;
  allowExcessTender: boolean;
  allowPostedAmend: boolean;
  allowDuplicateItem: boolean;
  allowBillOverOrderQty: boolean;
  salesmanMandatory: boolean;
  maxBillDiscPerc: number;
  maxLineDiscPerc: number;
  postSchemeDiscSeparately: boolean;
  stockFromAnyGodown: boolean;
  loyaltyAutoEnrol: boolean;
  loyaltyRedeemAsTender: boolean;
  defaultCustomerId: string | null;
  returnWindowDays: number;
  freeReturnAllowed: boolean;
  tempCreditMaxDays: number;
  tempCreditMaxAmount: number;
  tempCreditBlockOpen: TempCreditBlockOpen;
  posSeriesPerDevice: boolean;
  roundOffStep: number;
}

/**
 * The fallbacks, and each is the SEEDED default, not a convenient one.
 *
 * `allowPostedAmend` is TRUE here where the receipt's is false, and that is
 * `sales.allow_posted_amend`'s own default: a bill is corrected far more often
 * than a receipt, and the IRN lock already blocks the case that matters.
 */
export const SALES_SETTING_DEFAULTS: SalesSettings = {
  backdateMode: 'WARN',
  creditLimitMode: 'WARN',
  rateBelowMinMode: 'WARN',
  allowExcessTender: false,
  allowPostedAmend: true,
  allowDuplicateItem: true,
  allowBillOverOrderQty: false,
  salesmanMandatory: false,
  maxBillDiscPerc: 100,
  maxLineDiscPerc: 100,
  postSchemeDiscSeparately: false,
  stockFromAnyGodown: false,
  loyaltyAutoEnrol: true,
  loyaltyRedeemAsTender: true,
  defaultCustomerId: null,
  returnWindowDays: 0,
  freeReturnAllowed: true,
  tempCreditMaxDays: 0,
  tempCreditMaxAmount: 0,
  tempCreditBlockOpen: 'WARN',
  posSeriesPerDevice: true,
  roundOffStep: 1,
};

export const SALES_SETTING_KEYS = {
  BACKDATE_MODE: 'sales.backdate_mode',
  CREDIT_LIMIT_MODE: 'sales.credit_limit_mode',
  RATE_BELOW_MIN_MODE: 'sales.rate_below_min_mode',
  ALLOW_EXCESS_TENDER: 'sales.allow_excess_tender',
  ALLOW_POSTED_AMEND: 'sales.allow_posted_amend',
  ALLOW_DUPLICATE_ITEM: 'sales.allow_duplicate_item',
  ALLOW_BILL_OVER_ORDER_QTY: 'sales.allow_bill_over_order_qty',
  SALESMAN_MANDATORY: 'sales.salesman_mandatory',
  MAX_BILL_DISC_PERC: 'sales.max_bill_disc_perc',
  MAX_LINE_DISC_PERC: 'sales.max_line_disc_perc',
  POST_SCHEME_DISC_SEPARATELY: 'sales.post_scheme_disc_separately',
  STOCK_FROM_ANY_GODOWN: 'sales.stock_from_any_godown',
  LOYALTY_AUTO_ENROL: 'sales.loyalty_auto_enrol',
  LOYALTY_REDEEM_AS_TENDER: 'sales.loyalty_redeem_as_tender',
  DEFAULT_CUSTOMER_ID: 'sales.default_customer_id',
  RETURN_WINDOW_DAYS: 'sales.return_window_days',
  FREE_RETURN_ALLOWED: 'sales.free_return_allowed',
  TEMP_CREDIT_MAX_DAYS: 'sales.temp_credit_max_days',
  TEMP_CREDIT_MAX_AMOUNT: 'sales.temp_credit_max_amount',
  TEMP_CREDIT_BLOCK_OPEN: 'sales.temp_credit_block_open',
  POS_SERIES_PER_DEVICE: 'sales.pos_series_per_device',
  ROUND_OFF_STEP: 'sales.round_off_step',
} as const;

/**
 * Turn the whole resolved catalogue into this module's answers.
 *
 * Takes the catalogue rather than a company / branch, so ONE request resolves
 * once and every part of it sees the same configuration — a post whose
 * discount cap changed halfway through would be a genuinely confusing bug.
 */
export function readSalesSettings(effective: readonly AppSettingEffectiveItem[]): SalesSettings {
  const by = new Map(effective.map((i) => [i.asdKey, i.value]));
  const d = SALES_SETTING_DEFAULTS;

  return {
    backdateMode: pickEnum(
      by.get(SALES_SETTING_KEYS.BACKDATE_MODE),
      ['ALLOW', 'WARN', 'REFUSE'],
      d.backdateMode,
    ),
    creditLimitMode: pickEnum(
      by.get(SALES_SETTING_KEYS.CREDIT_LIMIT_MODE),
      ['OFF', 'WARN', 'REFUSE'],
      d.creditLimitMode,
    ),
    rateBelowMinMode: pickEnum(
      by.get(SALES_SETTING_KEYS.RATE_BELOW_MIN_MODE),
      ['ALLOW', 'WARN', 'REFUSE'],
      d.rateBelowMinMode,
    ),
    allowExcessTender: pickBool(
      by.get(SALES_SETTING_KEYS.ALLOW_EXCESS_TENDER),
      d.allowExcessTender,
    ),
    allowPostedAmend: pickBool(by.get(SALES_SETTING_KEYS.ALLOW_POSTED_AMEND), d.allowPostedAmend),
    allowDuplicateItem: pickBool(
      by.get(SALES_SETTING_KEYS.ALLOW_DUPLICATE_ITEM),
      d.allowDuplicateItem,
    ),
    allowBillOverOrderQty: pickBool(
      by.get(SALES_SETTING_KEYS.ALLOW_BILL_OVER_ORDER_QTY),
      d.allowBillOverOrderQty,
    ),
    salesmanMandatory: pickBool(by.get(SALES_SETTING_KEYS.SALESMAN_MANDATORY), d.salesmanMandatory),
    maxBillDiscPerc: pickNumber(by.get(SALES_SETTING_KEYS.MAX_BILL_DISC_PERC), d.maxBillDiscPerc),
    maxLineDiscPerc: pickNumber(by.get(SALES_SETTING_KEYS.MAX_LINE_DISC_PERC), d.maxLineDiscPerc),
    postSchemeDiscSeparately: pickBool(
      by.get(SALES_SETTING_KEYS.POST_SCHEME_DISC_SEPARATELY),
      d.postSchemeDiscSeparately,
    ),
    stockFromAnyGodown: pickBool(
      by.get(SALES_SETTING_KEYS.STOCK_FROM_ANY_GODOWN),
      d.stockFromAnyGodown,
    ),
    loyaltyAutoEnrol: pickBool(by.get(SALES_SETTING_KEYS.LOYALTY_AUTO_ENROL), d.loyaltyAutoEnrol),
    loyaltyRedeemAsTender: pickBool(
      by.get(SALES_SETTING_KEYS.LOYALTY_REDEEM_AS_TENDER),
      d.loyaltyRedeemAsTender,
    ),
    defaultCustomerId: pickText(
      by.get(SALES_SETTING_KEYS.DEFAULT_CUSTOMER_ID),
      d.defaultCustomerId,
    ),
    returnWindowDays: pickNumber(by.get(SALES_SETTING_KEYS.RETURN_WINDOW_DAYS), d.returnWindowDays),
    freeReturnAllowed: pickBool(
      by.get(SALES_SETTING_KEYS.FREE_RETURN_ALLOWED),
      d.freeReturnAllowed,
    ),
    tempCreditMaxDays: pickNumber(
      by.get(SALES_SETTING_KEYS.TEMP_CREDIT_MAX_DAYS),
      d.tempCreditMaxDays,
    ),
    tempCreditMaxAmount: pickNumber(
      by.get(SALES_SETTING_KEYS.TEMP_CREDIT_MAX_AMOUNT),
      d.tempCreditMaxAmount,
    ),
    tempCreditBlockOpen: pickEnum(
      by.get(SALES_SETTING_KEYS.TEMP_CREDIT_BLOCK_OPEN),
      ['OFF', 'WARN', 'REFUSE'],
      d.tempCreditBlockOpen,
    ),
    posSeriesPerDevice: pickBool(
      by.get(SALES_SETTING_KEYS.POS_SERIES_PER_DEVICE),
      d.posSeriesPerDevice,
    ),
    roundOffStep: pickNumber(by.get(SALES_SETTING_KEYS.ROUND_OFF_STEP), d.roundOffStep),
  };
}

function pickEnum<T extends string>(
  value: string | null | undefined,
  allowed: readonly string[],
  fallback: T,
): T {
  const v = (value ?? '').trim().toUpperCase();
  return (allowed.includes(v) ? v : fallback) as T;
}

function pickBool(value: string | null | undefined, fallback: boolean): boolean {
  const v = (value ?? '').trim().toLowerCase();
  if (v === 'true' || v === '1' || v === 'yes') return true;
  if (v === 'false' || v === '0' || v === 'no') return false;
  return fallback;
}

function pickNumber(value: string | null | undefined, fallback: number): number {
  const n = Number.parseFloat((value ?? '').trim());
  return Number.isFinite(n) ? n : fallback;
}

function pickText(value: string | null | undefined, fallback: string | null): string | null {
  const v = (value ?? '').trim();
  return v.length > 0 ? v : fallback;
}
