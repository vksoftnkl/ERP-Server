import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import { RELOT_REASON_CODES } from '../stock-voucher/types/stock-voucher.types';
import type {
  StockVoucherType,
  StockVoucherTypeRules,
} from '../stock-voucher/types/stock-voucher.types';

/**
 * The adjustment family — ONE module, ONE screen with a Type selector, four
 * `svh_voucher_type`s (plan-nestjs-stock-adjustments §0). A re-lot is an
 * ADJUSTMENT carrying a RELOT_OUT / RELOT_IN pair, not a fifth type; a bucket
 * move is an ADJUSTMENT whose lines name a `toBucket` (see BUCKET_MOVE_KIND).
 */
export const STOCK_ADJUSTMENT_KINDS = ['ADJUSTMENT', 'ISSUE', 'DAMAGE', 'EXPIRY_WRITEOFF'] as const;
export type StockAdjustmentKind = (typeof STOCK_ADJUSTMENT_KINDS)[number];

export function isStockAdjustmentKind(value: unknown): value is StockAdjustmentKind {
  return typeof value === 'string' && (STOCK_ADJUSTMENT_KINDS as readonly string[]).includes(value);
}

/**
 * "Move stock" (adjustments plan D-A3, notes 60): the same lot moved between
 * buckets of one godown — SALEABLE → DAMAGED to hold it for a supplier return,
 * or back. Stored as `svh_voucher_type = 'ADJUSTMENT'` the way a re-lot is: no
 * new document type, no CHECK change. The screen sends it as a sixth
 * `voucherType` on a save; a loaded document is recognised by its lines.
 */
export const BUCKET_MOVE_KIND = 'BUCKET_MOVE' as const;

/** What `header.voucherType` may say on a SAVE: the four stored kinds, plus a move. */
export const STOCK_ADJUSTMENT_SAVE_KINDS = [...STOCK_ADJUSTMENT_KINDS, BUCKET_MOVE_KIND] as const;
export type StockAdjustmentSaveKind = (typeof STOCK_ADJUSTMENT_SAVE_KINDS)[number];

/**
 * What a loaded document IS, for the Type selector and the list grid
 * (grid 122's `kind_code`): the stored kind, or RELOT / BUCKET_MOVE for the two
 * ADJUSTMENT shapes told apart by their lines.
 */
export const STOCK_ADJUSTMENT_DOC_KINDS = [
  ...STOCK_ADJUSTMENT_KINDS,
  'RELOT',
  BUCKET_MOVE_KIND,
] as const;
export type StockAdjustmentDocKind = (typeof STOCK_ADJUSTMENT_DOC_KINDS)[number];

/** The ledger txn types a move writes, and the only ones a move reason may name. */
export const BUCKET_MOVE_TXN_TYPES = ['BUCKET_OUT', 'BUCKET_IN'] as const;

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
  overrides: Partial<StockVoucherTypeRules> &
    Pick<StockVoucherTypeRules, 'typeCode' | 'displayName' | 'ledgerTxnTypes'>,
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

export const STOCK_ADJUSTMENT_RULES: Readonly<
  Record<StockAdjustmentSaveKind, StockVoucherTypeRules>
> = {
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
  // An ADJUSTMENT row, numbered in the ADJ series like every adjustment. The
  // shape does the work: per line BUCKET_OUT from `bucket` and BUCKET_IN into
  // `toBucket`, same lot, godown, quantity and cost. lineDirection stays
  // REASON so the line's own direction (−1, stamped by the service) rides on
  // `svi_direction` and the engine values it as an outward line — at what the
  // stock cost: the lot's own cost for a tracked item, the branch average for
  // plain stock (notes 92). The accounts writer posts no leg for the pair.
  BUCKET_MOVE: rules('ADJUSTMENT', {
    typeCode: 'ADJ',
    displayName: 'Stock move',
    ledgerTxnTypes: [...BUCKET_MOVE_TXN_TYPES],
    postShape: 'BUCKET_MOVE',
  }),
};

/** The two reason codes of a re-lot pair, as the seed ships them — owned by the engine's types (notes 92). */
export const RELOT_OUT_CODE: string = RELOT_REASON_CODES.out;
export const RELOT_IN_CODE: string = RELOT_REASON_CODES.in;

/**
 * The two move reasons the seed ships, and the to-bucket the screen defaults
 * from each (the operator may change it). Any reason whose allowed types name
 * BUCKET_OUT / BUCKET_IN is a move reason; these are the shared ones.
 */
export const MOVE_REASON_DEFAULT_BUCKET = {
  MOVE_DAMAGED: 'DAMAGED',
  MOVE_SALEABLE: 'SALEABLE',
} as const;

/** `stock.expiry_writeoff_grace_days` — decision D-A2. */
export const EXPIRY_GRACE_SETTING_KEY = 'stock.expiry_writeoff_grace_days';
