import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import type {
  StockVoucherType,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';

/**
 * The adjustment family — ONE module, ONE screen with a Type selector, four
 * `svh_voucher_type`s (plan-nestjs-stock-adjustments §0). A re-lot is an
 * ADJUSTMENT carrying a RELOT_OUT / RELOT_IN pair, not a fifth type.
 */
export const STOCK_ADJUSTMENT_KINDS = ['ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF'] as const;
export type StockAdjustmentKind = (typeof STOCK_ADJUSTMENT_KINDS)[number];

export function isStockAdjustmentKind(value: unknown): value is StockAdjustmentKind {
  return typeof value === 'string' && (STOCK_ADJUSTMENT_KINDS as readonly string[]).includes(value);
}

const EVERY_OTHER_TYPE: readonly StockVoucherType[] = [
  'OPENING',
  'RECEIPT',
  'TRANSFER_OUT',
  'TRANSFER_IN',
  'PHYSICAL',
  'REPACK_IN',
  'REPACK_OUT',
];

/**
 * What the four kinds share, and where they differ:
 *
 *   postShape SIMPLE + lineDirection REASON   the engine lays one row per line,
 *       its direction and txn type from the LINE's reason (19:93 fn_svh_txn_map
 *       with the plan's two changes: ADJUSTMENT per line, ISSUE only trusts a
 *       reason that lists exactly one issue type).
 *   allowsLot     an outward line is picked from the balance and names its lot;
 *                 an inward line states identity and the engine resolves it.
 *   blockNegative decision D-A1: writing off stock you do not have is a data
 *                 error, whatever the item's policy says.
 *   allowsRepeatHolding   the "already opened this year" preflight is an
 *                 OPENING's rule; an adjustment touches opened holdings by nature.
 *   defaultRateSource AVG_COST   an inward line with no keyed cost is worth
 *                 what the rest of the item is worth.
 *   refnoVchrTypeId  none: the stock refno is per kind (ADJ / ISS / DMG / EXP,
 *                 device scheme). The ACCOUNTS voucher the four share is the
 *                 'StkAdj' Stock Journal, numbered SADJ00001.
 */
function rules(
  voucherType: StockAdjustmentKind,
  overrides: Partial<StockVoucherTypeRules> & Pick<StockVoucherTypeRules, 'typeCode' | 'displayName' | 'ledgerTxnTypes'>,
): StockVoucherTypeRules {
  return {
    voucherType,
    requiresToGodown: false,
    requiresFromGodown: true,
    isInward: false,
    quantityMode: 'QTY',
    defaultRateSource: 'AVG_COST',
    allowsRepeatHolding: true,
    allowsCount: false,
    allowsToBranch: false,
    postShape: 'SIMPLE',
    lineDirection: 'REASON',
    allowsLot: true,
    blockNegative: true,
    auditScreenName: 'Stock Adjustment',
    statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
    refuseTypes: EVERY_OTHER_TYPE,
    ...overrides,
  };
}

export const STOCK_ADJUSTMENT_RULES: Readonly<Record<StockAdjustmentKind, StockVoucherTypeRules>> = {
  ADJUSTMENT: rules('ADJUSTMENT', {
    typeCode: 'ADJ',
    displayName: 'Stock adjustment',
    ledgerTxnTypes: ['ADJUST_PLUS', 'ADJUST_MINUS'],
    // Either godown may be named: an outward sheet fills `from`, an inward one
    // `to`, a sheet with both signs uses ONE godown, in `from`. The service
    // demands exactly one and that every line sits in it.
    requiresFromGodown: false,
  }),
  ISSUE: rules('ISSUE', {
    typeCode: 'ISS',
    displayName: 'Stock issue',
    // The reason's own type when it lists exactly one issue type, else ADJUST_MINUS.
    ledgerTxnTypes: ['ADJUST_MINUS', 'SAMPLE_ISSUE', 'GIFT_ISSUE'],
  }),
  DAMAGE: rules('DAMAGE', {
    typeCode: 'DMG',
    displayName: 'Damage write-off',
    ledgerTxnTypes: ['DAMAGE'],
  }),
  EXPIRY_WRITEOFF: rules('EXPIRY_WRITEOFF', {
    typeCode: 'EXP',
    displayName: 'Expiry write-off',
    ledgerTxnTypes: ['EXPIRY_WRITEOFF'],
  }),
};

/** The two reason codes of a re-lot pair, as the seed ships them. */
export const RELOT_OUT_CODE = 'RELOT_OUT';
export const RELOT_IN_CODE = 'RELOT_IN';

/** `stock.expiry_writeoff_grace_days` — decision D-A2. */
export const EXPIRY_GRACE_SETTING_KEY = 'stock.expiry_writeoff_grace_days';
