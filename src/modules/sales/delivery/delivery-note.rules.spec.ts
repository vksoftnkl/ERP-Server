import { Prisma } from '@prisma/client';
import type { BillLineFacts } from './core/delivery-pending.service';
import {
  checkDeliveryNote,
  duplicateLineIds,
  firstRefusal,
  noteLoad,
  noteTotals,
  undoBelowReturned,
  yearChangedNote,
  type RuleContext,
  type RuleHeader,
  type RuleLine,
  type UndoLine,
} from './delivery-note.rules';

const D = (v: number | string) => new Prisma.Decimal(v);
const CO = 'co';
const BR = 'br';
const G1 = 'g-cbe';
const G2 = 'g-try';

const facts = (over: Partial<BillLineFacts> = {}): BillLineFacts => ({
  billItemId: 'sbi-1',
  billAccYear: '2026-2027',
  billId: 'sb-1',
  billRefno: 'bil00042',
  billDate: '2026-11-15',
  companyId: CO,
  branchId: BR,
  billStatus: 'POSTED',
  billDeleted: false,
  billMode: 'WHOLESALE',
  deliveryMode: 'PICKUP',
  deliveryStatus: 'PENDING',
  custId: 'c',
  custName: 'ZT-CUST',
  lineNo: 1,
  splitNo: 1,
  lineDeleted: false,
  isService: false,
  srcDocType: null,
  srcDocRefno: null,
  itemId: 'item',
  unitId: 'unit',
  godownId: G1,
  lotId: 'lot-a',
  bucket: 'SALEABLE',
  billedQty: D(20),
  factor: D(25),
  unitKg: D(25),
  settledQty: D(0),
  givenQty: D(0),
  pendingQty: D(20),
  settledBase: D(0),
  givenBase: D(0),
  pendingBase: D(500),
  eligible: true,
  ...over,
});

const line = (over: Partial<RuleLine> = {}, f: Partial<BillLineFacts> = {}): RuleLine => ({
  lineNo: 1,
  billId: 'sb-1',
  billAccYear: '2026-2027',
  billItemId: 'sbi-1',
  qty: D(5),
  facts: facts(f),
  bodyGodownId: null,
  lotId: 'lot-a',
  lotKnown: true,
  shelfBase: D(1000),
  names: { bill: 'bil00042', item: 'ZT rice', unit: 'Bag', billGodown: 'Coimbatore', godown: 'Coimbatore', lot: 'A', billLot: 'A' },
  ...over,
});

const header = (over: Partial<RuleHeader> = {}): RuleHeader => ({
  godownId: G1,
  godownState: 'OK',
  godownName: 'Coimbatore',
  branchName: 'CBE',
  godownLocked: false,
  storedGodownName: '',
  mode: 'SELF',
  vehicleId: null,
  vehicleNo: null,
  vehicleLabel: '',
  capacityKg: null,
  transporterId: null,
  transporterName: null,
  collectedBy: 'Ravi',
  frozen: null,
  ...over,
});

const ctx = (over: Partial<RuleContext> = {}): RuleContext => ({
  phase: 'post',
  companyId: CO,
  branchId: BR,
  canOverride: false,
  overrideWarnings: [],
  ...over,
});

const codes = (h: RuleHeader, lines: RuleLine[], c: RuleContext) =>
  checkDeliveryNote(h, lines, c).map((n) => `${n.severity}:${n.code}`);

describe('Delivery Note rules (plan §8.1, in order)', () => {
  it('a clean note posts with no findings', () => {
    expect(codes(header(), [line()], ctx())).toEqual([]);
  });

  describe('2 · header', () => {
    it.each([
      ['MISSING', 'DN_GODOWN_REQUIRED'],
      ['OTHER_BRANCH', 'DN_GODOWN_NOT_IN_BRANCH'],
    ] as const)('godown %s → %s', (state, code) => {
      expect(codes(header({ godownState: state }), [line()], ctx())).toContain(`REFUSE:${code}`);
    });
    it('the godown is locked once the note has lines (decision 48)', () => {
      expect(codes(header({ godownLocked: true }), [line()], ctx({ phase: 'save' }))).toContain('REFUSE:DN_GODOWN_LOCKED');
    });
    it.each([
      ['VEHICLE', {}, 'DN_VEHICLE_REQUIRED'],
      ['TRANSPORTER', {}, 'DN_TRANSPORTER_REQUIRED'],
      ['SELF', { collectedBy: ' ' }, 'DN_COLLECTED_BY_REQUIRED'],
    ] as const)('mode %s needs its field at post → %s, not at save', (mode, extra, code) => {
      const h = header({ mode, ...extra });
      expect(codes(h, [line()], ctx())).toContain(`REFUSE:${code}`);
      expect(codes(h, [line()], ctx({ phase: 'save' }))).not.toContain(`REFUSE:${code}`);
    });
    it('a typed vehicle no satisfies Vehicle mode', () => {
      expect(codes(header({ mode: 'VEHICLE', vehicleNo: 'TN38AC2579' }), [line()], ctx())).toEqual([]);
    });
  });

  describe('3 · lines', () => {
    it.each([
      ['no such bill line', { facts: null }, {}, 'DN_BILL_NOT_POSTED'],
      ['another company', {}, { companyId: 'other' }, 'DN_BILL_NOT_POSTED'],
      ['another branch', {}, { branchId: 'other' }, 'DN_BILL_OTHER_BRANCH'],
      ['a draft bill', {}, { billStatus: 'DRAFT' }, 'DN_BILL_NOT_POSTED'],
      ['a cancelled bill', {}, { billStatus: 'CANCELLED' }, 'DN_BILL_NOT_POSTED'],
      ['a deleted bill line', {}, { lineDeleted: true }, 'DN_BILL_NOT_POSTED'],
      ['an Instant bill', {}, { deliveryMode: 'INSTANT' }, 'DN_BILL_INSTANT'],
      ['a service / challan line', {}, { eligible: false, srcDocRefno: 'DC/1' }, 'DN_LINE_NOT_GOODS'],
      ['a negative qty', { qty: D(-1) }, {}, 'DN_QTY_NEGATIVE'],
      ['an unreadable qty', { qty: null }, {}, 'DN_QTY_NEGATIVE'],
      ['a line naming another godown', { bodyGodownId: G2 }, {}, 'DN_GODOWN_LOCKED'],
    ] as const)('%s → %s', (_n, l, f, code) => {
      expect(codes(header(), [line(l as Partial<RuleLine>, f as Partial<BillLineFacts>)], ctx())).toContain(`REFUSE:${code}`);
    });
    it('nothing to give at post → DN_NO_LINES; a draft of zeros saves', () => {
      expect(codes(header(), [line({ qty: D(0) })], ctx())).toContain('REFUSE:DN_NO_LINES');
      expect(codes(header(), [line({ qty: D(0) })], ctx({ phase: 'save' }))).toEqual([]);
    });
  });

  describe('4 · not more than pending (under the locks)', () => {
    it('Σ of this note per bill line over pending → DN_QTY_OVER_PENDING with the figures', () => {
      const lines = [line({ qty: D(12) }), line({ lineNo: 2, qty: D(9), lotId: 'lot-c' })];
      const notes = checkDeliveryNote(header(), lines, ctx({ canOverride: true }));
      const over = notes.find((n) => n.code === 'DN_QTY_OVER_PENDING')!;
      expect(over.params).toMatchObject({ n: 1, qty: '21', pending: '20', bill: 'bil00042', unit: 'Bag' });
      expect(notes.filter((n) => n.code === 'DN_QTY_OVER_PENDING')).toHaveLength(1);
    });
    it('exactly the pending passes; a save never checks it (a draft holds nothing)', () => {
      expect(codes(header(), [line({ qty: D(20) })], ctx())).toEqual([]);
      expect(codes(header(), [line({ qty: D(50) })], ctx({ phase: 'save' }))).toEqual([]);
    });
  });

  describe('5 · another godown', () => {
    const away = { godownId: G2 };
    it('without OVERRIDE → DN_GODOWN_RIGHT (also at save)', () => {
      expect(codes(header(), [line({}, away)], ctx({ phase: 'save' }))).toContain('REFUSE:DN_GODOWN_RIGHT');
    });
    it('with OVERRIDE → WARN DN_OTHER_GODOWN, refused at post until ticked', () => {
      const c = ctx({ canOverride: true });
      expect(codes(header(), [line({}, away)], { ...c, phase: 'validate' })).toEqual(['WARN:DN_OTHER_GODOWN']);
      expect(codes(header(), [line({}, away)], c)).toEqual(['WARN:DN_OTHER_GODOWN', 'REFUSE:DN_WARN_NOT_CONFIRMED']);
      expect(codes(header(), [line({}, away)], { ...c, overrideWarnings: ['dn_other_godown'] })).toEqual([
        'WARN:DN_OTHER_GODOWN',
      ]);
    });
  });

  describe('6 · the lot', () => {
    it('a lot the giving godown does not hold → DN_LOT_INVALID', () => {
      expect(codes(header(), [line({ lotId: 'lot-x', lotKnown: false })], ctx())).toContain('REFUSE:DN_LOT_INVALID');
    });
    it('another lot of the item → INFO DN_LOT_SWAP (never blocks)', () => {
      const notes = checkDeliveryNote(header(), [line({ lotId: 'lot-c', names: { ...line().names, lot: 'C' } })], ctx());
      expect(notes.map((n) => n.code)).toEqual(['DN_LOT_SWAP']);
      expect(firstRefusal(notes)).toBeNull();
      expect(notes[0].params).toMatchObject({ given: 'C', billLot: 'A', qty: '5' });
    });
  });

  describe('7 · the shelf', () => {
    it('giving more than Physical → WARN DN_OVER_SHELF (shelf in the line unit)', () => {
      const notes = checkDeliveryNote(header(), [line({ qty: D(5), shelfBase: D(100) })], ctx({ phase: 'validate' }));
      expect(notes.map((n) => n.code)).toEqual(['DN_OVER_SHELF']);
      expect(notes[0].params).toMatchObject({ shelf: '4', qty: '5' });
    });
    it('two lines on one holding are summed against it', () => {
      const lines = [line({ qty: D(3), shelfBase: D(100) }), line({ lineNo: 2, qty: D(3), shelfBase: D(100) })];
      expect(codes(header(), lines, ctx({ phase: 'validate' }))).toEqual(['WARN:DN_OVER_SHELF']);
    });
    it('a blank line whose shelf is short of pending → INFO DN_SHELF_SHORT', () => {
      const lines = [line(), line({ lineNo: 2, billItemId: 'sbi-2', qty: D(0), shelfBase: D(100) }, { billItemId: 'sbi-2' })];
      expect(codes(header(), lines, ctx())).toEqual(['INFO:DN_SHELF_SHORT']);
    });
  });

  describe('8 · the vehicle load (Q14)', () => {
    it('over capacity → WARN DN_VEHICLE_OVERLOAD; the load block', () => {
      const h = header({ mode: 'VEHICLE', vehicleId: 'v', vehicleLabel: 'TN38', capacityKg: D(100) });
      const notes = checkDeliveryNote(h, [line({ qty: D(5) })], ctx({ phase: 'validate' }));
      expect(notes.map((n) => n.code)).toEqual(['DN_VEHICLE_OVERLOAD']);
      expect(notes[0].params).toMatchObject({ kg: '125', cap: '100', vehicle: 'TN38' });
      const load = noteLoad(h, noteTotals([line({ qty: D(5) })]));
      expect(load).toEqual({ capacityKg: '100', weightKg: '125', percent: 125, spareKg: '-25' });
    });
  });

  describe('9 · a count freeze (N4)', () => {
    it('→ DN_GODOWN_FROZEN', () => {
      expect(codes(header({ frozen: { from: 'a', to: 'b' } }), [line()], ctx())).toContain('REFUSE:DN_GODOWN_FROZEN');
    });
  });

  it('refusals come in rule order: header, lines, pending, godown right', () => {
    const lines = [
      line({ qty: D(25) }, { godownId: G2 }), // over pending AND another godown without the right
    ];
    const notes = checkDeliveryNote(header({ godownState: 'OTHER_BRANCH' }), lines, ctx());
    expect(notes.filter((n) => n.severity === 'REFUSE').map((n) => n.code)).toEqual([
      'DN_GODOWN_NOT_IN_BRANCH',
      'DN_QTY_OVER_PENDING',
      'DN_GODOWN_RIGHT',
    ]);
    expect(firstRefusal(notes)!.code).toBe('DN_GODOWN_NOT_IN_BRANCH');
  });

  it('totals: lines given now, packages, bags, kg, bills', () => {
    const t = noteTotals([
      line({ qty: D(4) }),
      line({ lineNo: 2, qty: D(0) }),
      line({ lineNo: 3, billId: 'sb-2', qty: D(2), names: { ...line().names, unit: 'Pkt' } }, { unitKg: D(1) }),
    ]);
    expect(t).toEqual({ lines: 2, qty: '6', bags: '4', weightKg: '102', bills: 2 });
  });
});

describe('P6 review round (2026-11-16)', () => {
  describe('S2 · duplicateLineIds', () => {
    it('a body naming one note line twice → DN_LINE_DUPLICATE on the repeat (never a PK 500)', () => {
      const n = duplicateLineIds([{ sdniId: 'a' }, { sdniId: 'b' }, {}, { sdniId: 'a' }])!;
      expect(n).toMatchObject({ code: 'DN_LINE_DUPLICATE', severity: 'REFUSE', field: 'lines[3].sdniId', lineNo: 4 });
      expect(n.params).toEqual({ n: 4, first: 1 });
    });
    it('distinct ids, or new lines with no id, pass', () => {
      expect(duplicateLineIds([{ sdniId: 'a' }, { sdniId: 'b' }, {}, { sdniId: null }, {}])).toBeNull();
    });
  });

  describe('N3 · yearChangedNote (a note is filed in the year it is posted in)', () => {
    it('a draft saved in 2025-2026 and posted in 2026-2027 → DN_DRAFT_YEAR_CHANGED on sdnId', () => {
      expect(yearChangedNote('2025-2026', '2026-2027', 'DN/2025-2026/D3/00007', true)).toMatchObject({
        code: 'DN_DRAFT_YEAR_CHANGED',
        field: 'sdnId',
        params: { refno: 'DN/2025-2026/D3/00007', year: '2025-2026', yearNow: '2026-2027' },
      });
    });
    it('a fresh post from a session in another year → the field=accYear variant', () => {
      expect(yearChangedNote('2025-2026', '2026-2027', null, false)).toMatchObject({
        code: 'DN_DRAFT_YEAR_CHANGED',
        field: 'accYear',
      });
    });
    it('the same year (char(9) padding trimmed) passes', () => {
      expect(yearChangedNote('2026-2027 ', '2026-2027', 'x', true)).toBeNull();
    });
  });

  describe('S3 / R-1 · undoBelowReturned', () => {
    const undo = (over: Partial<UndoLine> = {}): UndoLine => ({
      noteLineNo: 2,
      field: 'lines[1].qty',
      billRefno: 'bil00042',
      billLineNo: 3,
      unitName: 'Bag',
      factor: D(25),
      givenBase: D(250),
      removeBase: D(250),
      takenBase: D(100),
      returnRefnos: ['SR/2026-2027/D3/00012'],
      ...over,
    });
    it('a cancel of all 10 given while a return took 4 back → DN_UNDO_BELOW_RETURNED, worded per bill line', () => {
      const n = undoBelowReturned([undo()])!;
      expect(n).toMatchObject({ code: 'DN_UNDO_BELOW_RETURNED', severity: 'REFUSE', field: 'lines[1].qty', lineNo: 2 });
      expect(n.params).toEqual({ n: 3, bill: 'bil00042', qty: '4', unit: 'Bag', sr: 'SR/2026-2027/D3/00012', givenAfter: '0' });
    });
    it('goods back down to exactly the taken part passes; one base unit more is refused', () => {
      expect(undoBelowReturned([undo({ removeBase: D(150) })])).toBeNull();
      expect(undoBelowReturned([undo({ removeBase: D(151) })])?.code).toBe('DN_UNDO_BELOW_RETURNED');
    });
    it('no live posted return on the line → nothing to guard', () => {
      expect(undoBelowReturned([undo({ takenBase: D(0), returnRefnos: [] })])).toBeNull();
    });
    it('the first breach in order; many returns are listed three at most', () => {
      const n = undoBelowReturned([
        undo({ noteLineNo: 1, takenBase: D(0) }),
        undo({ noteLineNo: 2, returnRefnos: ['A', 'B', 'C', 'D'] }),
      ])!;
      expect(n.lineNo).toBe(2);
      expect(n.params.sr).toBe('A, B, C, …');
    });
  });
});
