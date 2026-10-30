import { TxnStatusDocType } from 'src/common/txn-status-log/txn-status-log.helper';
import {
  BUCKET_MOVE_KIND,
  RELOT_IN_CODE,
  RELOT_OUT_CODE,
  STOCK_ADJUSTMENT_KINDS,
  STOCK_ADJUSTMENT_RULES,
  isStockAdjustmentKind,
} from './stock-adjustment.rules';

describe('stock-adjustment.rules', () => {
  it.each([...STOCK_ADJUSTMENT_KINDS])('knows %s as a stored adjustment kind', (kind) => {
    expect(isStockAdjustmentKind(kind)).toBe(true);
  });

  it.each([BUCKET_MOVE_KIND, 'RELOT', 'OPENING', 'adjustment', '', null, undefined, 7])(
    'does not take %p for a stored kind',
    (value) => {
      expect(isStockAdjustmentKind(value)).toBe(false);
    },
  );

  it('stores a move as an ADJUSTMENT in the ADJ series, laid by the move shape', () => {
    expect(STOCK_ADJUSTMENT_RULES.BUCKET_MOVE).toMatchObject({
      voucherType: 'ADJUSTMENT',
      typeCode: 'ADJ',
      postShape: 'BUCKET_MOVE',
      ledgerTxnTypes: ['BUCKET_OUT', 'BUCKET_IN'],
    });
  });

  it.each(Object.entries(STOCK_ADJUSTMENT_RULES))(
    '%s takes reason-led directions, blocks negatives and files its trail as a stock adjustment',
    (_kind, rules) => {
      expect(rules).toMatchObject({
        lineDirection: 'REASON',
        blockNegative: true,
        allowsLot: true,
        allowsRepeatHolding: true,
        defaultRateSource: 'AVG_COST',
        statusDocType: TxnStatusDocType.STOCK_ADJUSTMENT,
      });
    },
  );

  it('lets only a plain adjustment leave the from-godown empty', () => {
    expect(
      Object.entries(STOCK_ADJUSTMENT_RULES)
        .filter(([, rules]) => !rules.requiresFromGodown)
        .map(([kind]) => kind),
    ).toEqual(['ADJUSTMENT']);
  });

  it("takes the re-lot codes from the engine's own vocabulary", () => {
    expect([RELOT_OUT_CODE, RELOT_IN_CODE]).toEqual(['RELOT_OUT', 'RELOT_IN']);
  });
});
