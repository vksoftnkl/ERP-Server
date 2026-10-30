import { Prisma } from '@prisma/client';
import { judgeGrnLines, type GrnLineFact } from './purchase-grn-checks';

const D = (v: number) => new Prisma.Decimal(v);
const fact = (o: Partial<GrnLineFact>): GrnLineFact => ({
  index: 0, lineNo: 1, itemId: 'i1', itemName: 'Soap', challan: D(10), received: D(10), damaged: D(0), free: D(0), damageReasonId: null,
  excess: D(0), excessAction: null, rows: [{ bucket: 'SALEABLE', qty: D(10), mfgDate: null, expiryDate: null, serialNo: null }], ...o,
});

describe('GRN strip + Check column', () => {
  it('a clean line is OK with labels = saleable pieces', () => {
    const { issues, checks } = judgeGrnLines([fact({})], new Map(), 'WARN', new Set());
    expect(issues).toEqual([]);
    expect(checks.get(1)!.chips.map((c) => c.code)).toEqual(['OK']);
    expect(checks.get(1)!.labels).toBe(10);
  });
  it('short vs challan and damage with no reason are WARN', () => {
    const f = fact({ challan: D(8), received: D(6), damaged: D(1), rows: [{ bucket: 'SALEABLE', qty: D(6), mfgDate: null, expiryDate: null, serialNo: null }, { bucket: 'DAMAGED', qty: D(1), mfgDate: null, expiryDate: null, serialNo: null }] });
    const { issues, checks } = judgeGrnLines([f], new Map(), 'WARN', new Set());
    expect(issues.map((i) => [i.code, i.level])).toEqual([['PUR_SHORT_VS_CHALLAN', 'WARN'], ['PUR_GRN_DAMAGE_NO_REASON', 'WARN']]);
    expect(checks.get(1)!.chips.map((c) => c.text)).toEqual(['SHORT 1', '1 DAMAGED']);
    expect(checks.get(1)!.labels).toBe(6);
  });
  it('shelf life below the minimum: WARN, or REFUSE that an override may pass', () => {
    const shelf = new Map([[1, { pct: 41, min: 60, expired: false }]]);
    expect(judgeGrnLines([fact({})], shelf, 'WARN', new Set()).issues[0]).toMatchObject({ code: 'PUR_SHELF_LIFE', level: 'WARN', needsRight: null });
    expect(judgeGrnLines([fact({})], shelf, 'REFUSE', new Set()).issues[0]).toMatchObject({ code: 'PUR_SHELF_LIFE', level: 'REFUSE', needsRight: 'OVERRIDE' });
    expect(judgeGrnLines([fact({})], shelf, 'OFF', new Set()).issues).toEqual([]);
    expect(judgeGrnLines([fact({})], shelf, 'OFF', new Set()).checks.get(1)!.shelfLifePct).toBe(41);
  });
  it('serial-tracked: have / need chip and a REFUSE (no override) when short', () => {
    const f = fact({ received: D(2), challan: D(2), rows: [{ bucket: 'SALEABLE', qty: D(1), mfgDate: null, expiryDate: null, serialNo: 'S1' }, { bucket: 'SALEABLE', qty: D(1), mfgDate: null, expiryDate: null, serialNo: null }] });
    const { issues, checks } = judgeGrnLines([f], new Map(), 'WARN', new Set(['i1']));
    expect(checks.get(1)!.serials).toEqual({ have: 1, need: '2' });
    expect(issues.map((i) => [i.code, i.level, i.needsRight])).toEqual([['PUR_SERIAL_COUNT', 'REFUSE', null]]);
  });
  it('serial-tracked with one serial per piece: no issue', () => {
    const f = fact({ received: D(2), challan: D(2), rows: [{ bucket: 'SALEABLE', qty: D(1), mfgDate: null, expiryDate: null, serialNo: 'S1' }, { bucket: 'SALEABLE', qty: D(1), mfgDate: null, expiryDate: null, serialNo: 'S2' }] });
    expect(judgeGrnLines([f], new Map(), 'WARN', new Set(['i1'])).issues).toEqual([]);
  });
});
