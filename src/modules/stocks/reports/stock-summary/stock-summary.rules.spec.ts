import { Prisma } from '@prisma/client';
import {
  branchTotals,
  branchView,
  buildBranchRows,
  buildItemRows,
  chipsText,
  daysBetween,
  drillText,
  filterItemRows,
  godownColumns,
  godownRow,
  godownTotals,
  groupRows,
  isNonSaleable,
  istInstant,
  itemView,
  mergePass,
  monthStart,
  pageOf,
  printedAsOf,
  rateText,
  sortRows,
  tieOfRun,
  tilesOf,
  unitOf,
  viewOf,
  type BuildInput,
  type BuildScope,
  type FactRow,
  type PassRow,
} from './stock-summary.rules';

const dec = (v: number | string) => new Prisma.Decimal(v);

const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
const OTHER_CO = '019cc885-d0f4-771b-a7d1-7c98f9ff3ac1';
const G1 = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const G2 = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c';
const A = '01a161d8-4fd1-78ed-841a-a6e28b641ec2';
const B = '01a0d242-5613-71ef-93af-d41e1cca9f16';
const C = '01a0f72b-d959-759c-ab76-f439114e45a8';
const LOT = 'dd08de2b-18f1-575d-b653-df1765055465';
const GRP = '019c8045-bbc9-77dd-9668-774331e02b4e';
const BRD = '019e9be7-1a04-7325-ad21-9853ced9c54e';

function hold(over: Partial<PassRow> & { item: string }): PassRow {
  return {
    lot: LOT,
    godown: G1,
    bucket: 'SALEABLE',
    oq: dec(0),
    pq: dec(0),
    iq: dec(0),
    xq: dec(0),
    iv: dec(0),
    xv: dec(0),
    n: 0,
    ov_engine: dec(0),
    cv_engine: dec(0),
    vm: 'WAVG',
    ...over,
  };
}

function fact(item: string, over: Partial<FactRow> = {}): FactRow {
  return {
    item_id: item,
    code: `C-${item.slice(-4)}`,
    name: `Item ${item.slice(-4)}`,
    barcode: null,
    sku: null,
    group_id: GRP,
    group_name: 'Bluetooth Speakers',
    brand_id: BRD,
    brand_name: 'Baby Soft',
    section_id: null,
    section_name: null,
    category_id: null,
    category_name: null,
    company_id: COMPANY,
    warn_days: 0,
    base_unit: 'pcs',
    default_iuc_id: null,
    default_factor: null,
    default_unit: null,
    default_is_base: null,
    ...over,
  };
}

const SCOPE: BuildScope = {
  companyId: COMPANY,
  godownId: null,
  bucket: 'SALEABLE',
  qtyIn: 'BASE',
  to: '2026-11-14',
  today: '2026-11-14',
  todayOnly: true,
  noSaleDays: 60,
};

function input(over: Partial<BuildInput> = {}): BuildInput {
  return {
    scope: SCOPE,
    pass: [],
    facts: [],
    lastSale: new Map(),
    balance: [],
    after: [],
    transitIn: [],
    ...over,
  };
}

describe('Stock Summary rules', () => {
  describe('helpers', () => {
    it('dates, instants, rates', () => {
      expect(daysBetween('2026-09-15', '2026-11-14')).toBe(60);
      expect(daysBetween('2026-11-14', '2026-11-12')).toBe(-2);
      expect(istInstant(Date.UTC(2026, 10, 14, 9, 17, 30))).toBe('2026-11-14T14:47:30+05:30');
      expect(monthStart('2026-11-14')).toBe('2026-11-01');
      expect(rateText(dec(79130.77), dec(3320), dec(1))).toBe('23.83');
      expect(rateText(dec(79130.77), dec(3320), dec(10))).toBe('238.35');
      expect(rateText(dec(0), dec(0), dec(1))).toBe('0.00');
      expect(rateText(dec(-13920), dec(-232), dec(1))).toBe('60.00');
    });

    it('the Qty-in unit: base, or the item’s default unit when asked and set', () => {
      const f = fact(A, {
        default_iuc_id: 'iuc-1',
        default_factor: dec(10),
        default_unit: 'Btl',
        default_is_base: false,
      });
      expect(unitOf(f, 'BASE').unit).toEqual({ name: 'pcs', factor: '1.000000', isBase: true });
      expect(unitOf(f, 'DEFAULT').unit).toEqual({
        name: 'Btl',
        factor: '10.000000',
        isBase: false,
      });
      expect(unitOf(fact(A), 'DEFAULT').unit.name).toBe('pcs');
    });

    it('non-saleable = the godown scope’s other buckets the bucket scope leaves out; none at All', () => {
      expect(
        isNonSaleable({ godown: G1, bucket: 'DAMAGED' }, { godownId: null, bucket: 'SALEABLE' }),
      ).toBe(true);
      expect(
        isNonSaleable({ godown: G2, bucket: 'DAMAGED' }, { godownId: G1, bucket: 'SALEABLE' }),
      ).toBe(false);
      expect(
        isNonSaleable({ godown: G1, bucket: 'DAMAGED' }, { godownId: null, bucket: null }),
      ).toBe(false);
      // A Damaged scope never counts Saleable as "non-saleable".
      expect(
        isNonSaleable({ godown: G1, bucket: 'SALEABLE' }, { godownId: null, bucket: 'DAMAGED' }),
      ).toBe(false);
    });

    it('mergePass joins the H / O / C parts by holding; a missing valuation is 0', () => {
      const k = { item: A, lot: LOT, godown: G1, bucket: 'SALEABLE' };
      const none = { oq: null, pq: null, iq: null, xq: null, iv: null, xv: null, n: null };
      const rows = mergePass([
        {
          part: 'H',
          ...k,
          oq: dec(5),
          pq: dec(3),
          iq: dec(4),
          xq: dec(1),
          iv: dec(40),
          xv: dec(10),
          n: 2,
          value: null,
          vm: null,
        },
        { part: 'O', ...k, ...none, value: dec(50), vm: 'WAVG' },
        { part: 'C', ...k, ...none, value: dec(80.5), vm: 'LOT_ACTUAL' },
        {
          part: 'H',
          ...k,
          godown: G2,
          oq: dec(1),
          pq: dec(0),
          iq: dec(0),
          xq: dec(0),
          iv: dec(0),
          xv: dec(0),
          n: 0,
          value: null,
          vm: null,
        },
      ]);
      expect(rows).toHaveLength(2);
      expect(rows[0]).toMatchObject({ godown: G1, n: 2, vm: 'LOT_ACTUAL' });
      expect(rows[0].ov_engine.toString()).toBe('50');
      expect(rows[0].cv_engine.toString()).toBe('80.5');
      expect(rows[1].cv_engine.toString()).toBe('0');
      expect(rows[1].vm).toBe('WAVG');
    });
  });

  describe('buildItemRows', () => {
    it('sums the holdings in scope; opening + inward − outward = closing; costAdj closes the value walk', () => {
      const rows = buildItemRows(
        input({
          pass: [
            hold({
              item: A,
              oq: dec(0),
              pq: dec(3320),
              iq: dec(3320),
              iv: dec(78844.47),
              cv_engine: dec(79130.77),
            }),
            // The damaged 100 shares the pool: out of scope, but its value is non-saleable.
            hold({
              item: A,
              bucket: 'DAMAGED',
              oq: dec(100),
              pq: dec(0),
              ov_engine: dec(2669.75),
              cv_engine: dec(2383.46),
            }),
          ],
          facts: [fact(A)],
          balance: [
            {
              item: A,
              lot: LOT,
              godown: G1,
              bucket: 'SALEABLE',
              on_hand: dec(3320),
              reserved: dec(10),
              available: dec(3310),
              transit_in: dec(0),
              value: dec(79130.77),
              rate: dec(23.834568),
              expiry: null,
            },
          ],
          lastSale: new Map([[A, '2026-11-10']]),
        }),
      );
      expect(rows).toHaveLength(1);
      const w = rows[0].wire;
      expect(w).toMatchObject({
        opening: '0.000',
        inward: '3320.000',
        outward: '0.000',
        closing: '3320.000',
        reserved: '10.000',
        available: '3310.000',
        inTransit: '0.000',
        rate: '23.83',
        value: '79130.77',
        openingValue: '0.00',
        inwardValue: '78844.47',
        outwardValue: '0.00',
        costAdj: '286.30',
        nonSaleableValue: '2383.46',
        lastSale: '2026-11-10',
        chips: [],
        tie: {
          equal: true,
          qtyEqual: true,
          valueEqual: true,
          stockNowQty: '3320.000',
          stockNowValue: '79130.77',
        },
      });
      expect(rows[0].reservedValue?.toString()).toBe('238.35');
      expect(rows[0].nonSaleableByBucket.map((b) => [b.bucket, b.value.toString()])).toEqual([
        ['DAMAGED', '2383.46'],
      ]);
    });

    it('a godown scope keeps only its holdings; the godown cells ignore it (bucket scope only)', () => {
      const rows = buildItemRows(
        input({
          scope: { ...SCOPE, godownId: G1 },
          pass: [
            hold({
              item: A,
              godown: G1,
              oq: dec(10),
              pq: dec(-2),
              xq: dec(2),
              xv: dec(20),
              ov_engine: dec(100),
              cv_engine: dec(80),
            }),
            hold({
              item: A,
              godown: G2,
              oq: dec(5),
              pq: dec(0),
              ov_engine: dec(50),
              cv_engine: dec(50),
            }),
            hold({
              item: A,
              godown: G2,
              bucket: 'DAMAGED',
              oq: dec(1),
              ov_engine: dec(10),
              cv_engine: dec(10),
            }),
          ],
          facts: [fact(A)],
        }),
      );
      const r = rows[0];
      expect([r.wire.opening, r.wire.outward, r.wire.closing, r.wire.value]).toEqual([
        '10.000',
        '2.000',
        '8.000',
        '80.00',
      ]);
      expect(r.godowns.map((g) => [g.godownId, g.qty.toString(), g.value.toString()])).toEqual([
        [G1, '8', '80'],
        [G2, '5', '50'],
      ]);
      // The damaged holding is in G2, outside the godown scope: not non-saleable here.
      expect(r.wire.nonSaleableValue).toBe('0.00');
    });

    it('chips: NEGATIVE, EXPIRY red / amber, NO_SALE, NEVER_SOLD, OTHER_COMPANY, NOT_TIED', () => {
      const bal = (item: string, over: Record<string, unknown> = {}) => ({
        item,
        lot: LOT,
        godown: G1,
        bucket: 'SALEABLE',
        on_hand: dec(5),
        reserved: dec(0),
        available: dec(5),
        transit_in: dec(0),
        value: dec(50),
        rate: dec(10),
        expiry: null,
        ...over,
      });
      const rows = buildItemRows(
        input({
          pass: [
            hold({ item: A, oq: dec(5), cv_engine: dec(50) }),
            hold({ item: B, oq: dec(-12), cv_engine: dec(-1008) }),
            hold({ item: C, oq: dec(5), cv_engine: dec(50) }),
          ],
          facts: [
            fact(A, { warn_days: 10 }),
            fact(B, { company_id: OTHER_CO }),
            fact(C, { warn_days: 30 }),
          ],
          balance: [
            bal(A, { expiry: '2026-11-16' }),
            bal(A, { expiry: '2026-11-10', on_hand: dec(0), value: dec(0) }),
            bal(B, { on_hand: dec(-12), available: dec(-12), value: dec(-1008) }),
            bal(C, { expiry: '2026-11-30', on_hand: dec(4), value: dec(40) }),
          ],
          lastSale: new Map([
            [A, '2026-09-15'],
            [C, '2026-11-13'],
          ]),
        }),
      );
      const chips = Object.fromEntries(rows.map((r) => [r.itemId, r.wire.chips]));
      expect(chips[A]).toEqual([
        { kind: 'EXPIRY', date: '2026-11-16', days: 2, tone: 'RED' },
        { kind: 'NO_SALE', days: 60 },
      ]);
      expect(chips[B]).toEqual([{ kind: 'NEGATIVE' }, { kind: 'OTHER_COMPANY' }]);
      expect(chips[C]).toEqual([
        { kind: 'EXPIRY', date: '2026-11-30', days: 16, tone: 'AMBER' },
        { kind: 'NOT_TIED' },
      ]);
      expect(rows.find((r) => r.itemId === C)?.wire.tie).toMatchObject({
        qtyEqual: false,
        valueEqual: false,
        stockNowQty: '4.000',
      });
      const never = buildItemRows(
        input({ pass: [hold({ item: A, oq: dec(1) })], facts: [fact(A)] }),
      );
      expect(never[0].wire.chips).toEqual([{ kind: 'NEVER_SOLD' }, { kind: 'NOT_TIED' }]);
      expect(never[0].flags.noSale).toBe(true);
    });

    it('rows dated after `to` join the quantity tie and leave the value unchecked', () => {
      const rows = buildItemRows(
        input({
          pass: [hold({ item: A, oq: dec(10), cv_engine: dec(100) })],
          facts: [fact(A)],
          balance: [
            {
              item: A,
              lot: LOT,
              godown: G1,
              bucket: 'SALEABLE',
              on_hand: dec(8),
              reserved: dec(0),
              available: dec(8),
              transit_in: dec(0),
              value: dec(79),
              rate: dec(9.875),
              expiry: null,
            },
          ],
          after: [
            { item: A, godown: G1, bucket: 'SALEABLE', q: dec(-2), n: 1 },
            { item: A, godown: G1, bucket: 'DAMAGED', q: dec(2), n: 1 },
          ],
        }),
      );
      expect(rows[0].wire.tie).toEqual({
        equal: true,
        qtyEqual: true,
        valueEqual: null,
        stockNowQty: '8.000',
        stockNowValue: '79.00',
      });
      expect(tieOfRun(rows, true)).toEqual({
        checked: true,
        items: 1,
        equal: 1,
        differ: 0,
        valueChecked: false,
      });
    });

    it('a past `to`: reserved / available / in transit / tie / EXPIRY are null (D17)', () => {
      const rows = buildItemRows(
        input({
          scope: { ...SCOPE, to: '2026-10-31', todayOnly: false },
          pass: [hold({ item: A, oq: dec(5), cv_engine: dec(50) })],
          facts: [fact(A, { warn_days: 99 })],
          lastSale: new Map([[A, '2026-10-30']]),
        }),
      );
      expect(rows[0].wire).toMatchObject({
        reserved: null,
        available: null,
        inTransit: null,
        tie: null,
        chips: [],
      });
      expect(tieOfRun(rows, false)).toEqual({
        checked: false,
        items: 0,
        equal: 0,
        differ: 0,
        valueChecked: false,
      });
      const tiles = tilesOf(rows, false, true);
      expect(tiles.inTransitIn).toBeNull();
      expect(tiles.reserved).toBeNull();
    });

    it('Qty in the default unit: quantities ÷ factor, rate × factor, values unchanged', () => {
      const rows = buildItemRows(
        input({
          scope: { ...SCOPE, qtyIn: 'DEFAULT' },
          pass: [
            hold({
              item: A,
              oq: dec(0),
              pq: dec(3320),
              iq: dec(3320),
              cv_engine: dec(79130.77),
              iv: dec(78844.47),
            }),
          ],
          facts: [fact(A, { default_iuc_id: 'iuc', default_factor: dec(10), default_unit: 'Btl' })],
        }),
      );
      expect([
        rows[0].wire.inward,
        rows[0].wire.closing,
        rows[0].wire.rate,
        rows[0].wire.value,
      ]).toEqual(['332.000', '332.000', '238.35', '79130.77']);
    });

    it('transit to this branch: the in-scope godown only; the tile names the senders', () => {
      const rows = buildItemRows(
        input({
          scope: { ...SCOPE, godownId: G1 },
          pass: [hold({ item: A, oq: dec(1), cv_engine: dec(10) })],
          facts: [fact(A)],
          transitIn: [
            {
              out_id: 'o1',
              doc_no: 'trf1',
              from_branch: 'b1',
              from_branch_name: 'Head Office',
              to_branch: 'cbe',
              to_branch_name: 'CBE',
              to_godown: G1,
              item: A,
              bucket: 'SALEABLE',
              q: dec(18),
              v: dec(502.2),
            },
            {
              out_id: 'o2',
              doc_no: 'trf2',
              from_branch: 'b2',
              from_branch_name: 'Counter2',
              to_branch: 'cbe',
              to_branch_name: 'CBE',
              to_godown: G2,
              item: A,
              bucket: 'SALEABLE',
              q: dec(5),
              v: dec(50),
            },
          ],
        }),
      );
      expect(rows[0].wire.inTransit).toBe('18.000');
      expect(tilesOf(rows, true, true).inTransitIn).toEqual({
        value: '502.20',
        items: 1,
        fromBranches: ['Head Office'],
      });
    });

    it('"List the item": goods on the road to this branch make a row with no ledger row here', () => {
      const onTheRoad = {
        out_id: 'o9',
        doc_no: 'TRF/9',
        from_branch: 'cbe',
        from_branch_name: 'Acme Foods - Coimbatore Branch',
        to_branch: 'c2',
        to_branch_name: 'Counter2',
        to_godown: G1,
        item: B,
        bucket: 'SALEABLE',
        q: dec(2),
        v: dec(76.19),
      };
      const rows = buildItemRows(
        input({
          pass: [hold({ item: A, oq: dec(5), cv_engine: dec(50) })],
          facts: [fact(A), fact(B, { warn_days: 30 })],
          balance: [
            {
              item: A,
              lot: LOT,
              godown: G1,
              bucket: 'SALEABLE',
              on_hand: dec(5),
              reserved: dec(0),
              available: dec(5),
              transit_in: dec(0),
              value: dec(50),
              rate: dec(10),
              expiry: null,
            },
            {
              item: B,
              lot: LOT,
              godown: G1,
              bucket: 'SALEABLE',
              on_hand: dec(0),
              reserved: dec(1),
              available: dec(-1),
              transit_in: dec(2),
              value: dec(0),
              rate: dec(38.095212),
              expiry: '2026-11-15',
            },
          ],
          transitIn: [onTheRoad],
          lastSale: new Map([[A, '2026-11-13']]),
        }),
      );
      const b = rows.find((r) => r.itemId === B);
      expect(b?.wire).toMatchObject({
        opening: '0.000',
        inward: '0.000',
        outward: '0.000',
        closing: '0.000',
        reserved: '1.000',
        available: '-1.000',
        inTransit: '2.000',
        rate: '0.00',
        value: '0.00',
        costAdj: '0.00',
        lastSale: null,
        // closing 0: no NEGATIVE, no NO SALE / NEVER SOLD (D28), no EXPIRY (no saleable stock)
        chips: [],
        tie: {
          equal: true,
          qtyEqual: true,
          valueEqual: true,
          stockNowQty: '0.000',
          stockNowValue: '0.00',
        },
      });
      expect(b?.flags).toMatchObject({
        zero: false,
        inTransit: true,
        notTied: false,
        noSale: false,
      });
      // Hide zero keeps it; the tile and its click filter count it; the tie holds.
      const v = viewOf({});
      expect(itemView(rows, v).map((r) => r.itemId)).toEqual(expect.arrayContaining([A, B]));
      expect(filterItemRows(rows, { ...v, show: 'IN_TRANSIT' }).map((r) => r.itemId)).toEqual([B]);
      expect(tilesOf(rows, true, true).inTransitIn).toEqual({
        value: '76.19',
        items: 1,
        fromBranches: ['Acme Foods - Coimbatore Branch'],
      });
      expect(tieOfRun(rows, true)).toEqual({
        checked: true,
        items: 2,
        equal: 2,
        differ: 0,
        valueChecked: true,
      });
      // Out of scope (another godown) it is not a row; with no transit read (a past To) neither.
      const other = buildItemRows(
        input({ scope: { ...SCOPE, godownId: G2 }, facts: [fact(B)], transitIn: [onTheRoad] }),
      );
      expect(other).toEqual([]);
      expect(
        buildItemRows(input({ scope: { ...SCOPE, todayOnly: false }, facts: [fact(B)] })),
      ).toEqual([]);
    });
  });

  describe('views of a run (no SQL)', () => {
    const rows = buildItemRows(
      input({
        pass: [
          hold({ item: A, oq: dec(10), cv_engine: dec(300) }),
          hold({ item: B, oq: dec(-12), cv_engine: dec(-1008) }),
          hold({ item: C, oq: dec(0) }),
          hold({ item: C, bucket: 'DAMAGED', oq: dec(2), cv_engine: dec(20) }),
        ],
        facts: [
          fact(A, { name: 'Bake House', code: 'SM-1', barcode: '8901', group_id: GRP }),
          fact(B, { name: 'apple', code: 'ZT-B', sku: 'SKU-77', group_id: null, group_name: null }),
          fact(C, { name: 'Cumin', code: 'ZT-C' }),
        ],
        lastSale: new Map([[A, '2026-11-13']]),
      }),
    );

    it('hide zero, only negative, each tile filter, find (code / name / barcode / SKU)', () => {
      const v = viewOf({});
      expect(itemView(rows, v).map((r) => r.wire.name)).toEqual(['apple', 'Bake House']);
      expect(itemView(rows, { ...v, hideZero: false }).map((r) => r.wire.name)).toEqual([
        'apple',
        'Bake House',
        'Cumin',
      ]);
      expect(itemView(rows, { ...v, onlyNegative: true }).map((r) => r.itemId)).toEqual([B]);
      // C holds only DAMAGED stock (a zero row in the Saleable scope): the click lists it under Hide zero too.
      expect(filterItemRows(rows, { ...v, show: 'NON_SALEABLE' }).map((r) => r.itemId)).toEqual([C]);
      expect(
        filterItemRows(rows, { ...v, hideZero: false, show: 'NON_SALEABLE' }).map((r) => r.itemId),
      ).toEqual([C]);
      expect(filterItemRows(rows, { ...v, show: 'NEGATIVE' }).map((r) => r.itemId)).toEqual([B]);
      expect(filterItemRows(rows, { ...v, show: 'IN_TRANSIT' })).toEqual([]);
      expect(filterItemRows(rows, { ...v, find: 'sku-77' }).map((r) => r.itemId)).toEqual([B]);
      expect(filterItemRows(rows, { ...v, find: '8901' }).map((r) => r.itemId)).toEqual([A]);
      expect(filterItemRows(rows, { ...v, find: 'sm-' }).map((r) => r.itemId)).toEqual([A]);
    });

    it('the drill as words for printedAs', () => {
      expect(drillText(rows, 'GROUP', GRP)).toBe('Group: Bluetooth Speakers');
      expect(drillText(rows, 'GROUP', 'NONE')).toBe('Group: (No group)');
      expect(drillText(rows, null, null)).toBeNull();
      expect(drillText(rows, 'BRAND', null)).toBeNull();
    });

    it('the group drill: a key, or NONE for "(No group)"', () => {
      const v = viewOf({ groupBy: 'GROUP', groupKey: 'NONE' });
      expect(filterItemRows(rows, v).map((r) => r.itemId)).toEqual([B]);
      expect(
        filterItemRows(rows, viewOf({ groupBy: 'GROUP', groupKey: GRP })).map((r) => r.itemId),
      ).toEqual([A]);
    });

    it('sort: the key, nulls last both ways, then name, then id; stable', () => {
      const v = viewOf({ hideZero: false });
      expect(itemView(rows, { ...v, sort: 'value', dir: 'desc' }).map((r) => r.wire.value)).toEqual(
        ['300.00', '0.00', '-1008.00'],
      );
      expect(itemView(rows, { ...v, sort: 'value' }).map((r) => r.wire.value)).toEqual([
        '-1008.00',
        '0.00',
        '300.00',
      ]);
      expect(itemView(rows, { ...v, sort: 'lastSale' }).map((r) => r.wire.name)).toEqual([
        'Bake House',
        'apple',
        'Cumin',
      ]);
      expect(
        itemView(rows, { ...v, sort: 'lastSale', dir: 'desc' }).map((r) => r.wire.name),
      ).toEqual(['Bake House', 'apple', 'Cumin']);
      const ties = sortRows(
        [
          { nameKey: 'b', itemId: '2', k: 1 },
          { nameKey: 'a', itemId: '3', k: 1 },
          { nameKey: 'a', itemId: '1', k: 1 },
        ],
        () => dec(1),
        'desc',
      );
      expect(ties.map((t) => t.itemId)).toEqual(['1', '3', '2']);
    });

    it('pages', () => {
      const { slice, page } = pageOf([1, 2, 3, 4, 5], { page: 2, limit: 2 });
      expect(slice).toEqual([3, 4]);
      expect(page).toEqual({ page: 2, limit: 2, totalRows: 5, hasMore: true });
      expect(pageOf([1, 2, 3], { page: 2, limit: 2 }).page.hasMore).toBe(false);
    });

    it('tiles over the whole run', () => {
      const t = tilesOf(rows, true, true);
      expect(t.closingValue).toBe('-708.00');
      expect(t.items).toEqual({ listed: 2, inStock: 1, hiddenZero: 1 });
      expect(t.negative).toMatchObject({
        count: 1,
        value: '-1008.00',
        first: { itemId: B, closing: '-12.000' },
      });
      expect(t.nonSaleable).toEqual({
        value: '20.00',
        items: 1,
        byBucket: [{ bucket: 'DAMAGED', value: '20.00', items: 1 }],
      });
    });

    it('non-saleable stock at cost 0: the tile counts it and its click lists it (review N6)', () => {
      const D = '01a0f72b-d959-759c-ab76-f439114e45a9';
      const E = '01a0f72b-d959-759c-ab76-f439114e45aa';
      const zeroCost = buildItemRows(
        input({
          pass: [
            hold({ item: A, oq: dec(10), cv_engine: dec(300) }),
            // 5 pcs DAMAGED at cost 0
            hold({ item: D, bucket: 'DAMAGED', oq: dec(5), cv_engine: dec(0) }),
            // a DAMAGED holding with no stock and no value: not non-saleable
            hold({ item: E, oq: dec(1), cv_engine: dec(10) }),
            hold({ item: E, bucket: 'DAMAGED', oq: dec(0), cv_engine: dec(0) }),
          ],
          facts: [fact(A), fact(D), fact(E)],
        }),
      );
      expect(tilesOf(zeroCost, true, true).nonSaleable).toEqual({
        value: '0.00',
        items: 1,
        byBucket: [{ bucket: 'DAMAGED', value: '0.00', items: 1 }],
      });
      const d = zeroCost.find((r) => r.itemId === D);
      expect(d?.flags.nonSaleable).toBe(true);
      expect(d?.wire.nonSaleableValue).toBe('0.00');
      expect(zeroCost.find((r) => r.itemId === E)?.flags.nonSaleable).toBe(false);
      expect(
        filterItemRows(zeroCost, { ...viewOf({}), hideZero: false, show: 'NON_SALEABLE' }).map(
          (r) => r.itemId,
        ),
      ).toEqual([D]);
      expect(
        filterItemRows(zeroCost, viewOf({ show: 'NON_SALEABLE' })).map((r) => r.itemId),
      ).toEqual([D]);
    });

    it('Hide zero keeps the non-saleable rows under the NON_SALEABLE click only; tile = click (user 2026-11-14)', () => {
      const t = tilesOf(rows, true, true);
      const click = filterItemRows(rows, viewOf({ show: 'NON_SALEABLE' }));
      expect(viewOf({}).hideZero).toBe(true);
      expect(click.map((r) => r.itemId)).toEqual([C]);
      expect(click).toHaveLength(t.nonSaleable.items);
      expect(click[0].flags.zero).toBe(true);
      // other filters keep Hide zero: ALL hides C, NEGATIVE / NO_SALE never list it
      expect(itemView(rows, viewOf({})).map((r) => r.itemId)).not.toContain(C);
      expect(filterItemRows(rows, viewOf({ show: 'NEGATIVE' })).map((r) => r.itemId)).toEqual([B]);
      expect(filterItemRows(rows, viewOf({ show: 'NO_SALE' })).map((r) => r.itemId)).not.toContain(C);
      // the rest of the view still applies to the click
      expect(filterItemRows(rows, viewOf({ show: 'NON_SALEABLE', onlyNegative: true }))).toEqual([]);
      expect(filterItemRows(rows, viewOf({ show: 'NON_SALEABLE', find: 'nothing' }))).toEqual([]);
      expect(
        filterItemRows(rows, viewOf({ show: 'NON_SALEABLE', find: 'zt-c' })).map((r) => r.itemId),
      ).toEqual([C]);
    });

    it('group summary: by value, "(No group)" named, share of the closing value', () => {
      const g = groupRows(rows, 'GROUP');
      expect(g.rows.map((r) => [r.key, r.name, r.items, r.closingValue, r.share])).toEqual([
        [GRP, 'Bluetooth Speakers', 2, '300.00', '-42.37'],
        [null, '(No group)', 1, '-1008.00', '142.37'],
      ]);
      expect(g.total).toMatchObject({ items: 3, closingValue: '-708.00' });
    });

    it('godown columns: only godowns with a non-zero cell, in the branch’s order', () => {
      const cols = godownColumns(rows, [
        { godownId: G2, name: 'Trichy' },
        { godownId: G1, name: 'Coimbatore' },
      ]);
      expect(cols).toEqual([{ godownId: G1, name: 'Coimbatore' }]);
      expect(godownRow(rows[0], cols)).toMatchObject({
        otherCompany: false,
        defaultUnitId: null,
        cells: [{ godownId: G1, qty: '10.000', value: '300.00' }],
        qty: '10.000',
        value: '300.00',
      });
      expect(godownTotals(rows, cols)).toEqual({
        byGodown: [{ godownId: G1, value: '-708.00' }],
        value: '-708.00',
      });
    });
  });

  describe('Branch-wise', () => {
    const B1 = 'br-1';
    const B2 = 'br-2';
    const rows = buildBranchRows({
      cells: [
        { branch: B1, item: A, q: dec(128), v: dec(3632.8) },
        { branch: B2, item: A, q: dec(136), v: dec(3800) },
        { branch: B2, item: B, q: dec(-2), v: dec(-20) },
      ],
      transit: [
        {
          out_id: 'o1',
          doc_no: 'trf',
          from_branch: B1,
          from_branch_name: 'CBE',
          to_branch: B2,
          to_branch_name: 'Counter2',
          to_godown: null,
          item: A,
          bucket: 'SALEABLE',
          q: dec(18),
          v: dec(502.2),
        },
      ],
      facts: [
        fact(A, { name: 'Alpha', default_iuc_id: 'iuc-a', default_factor: dec(10) }),
        fact(B, { name: 'Beta' }),
      ],
      columns: [{ branchId: B1 }, { branchId: B2 }],
      qtyIn: 'BASE',
      companyId: COMPANY,
    });

    it('cells per branch, transit once, chain = Σ cells + transit', () => {
      const a = rows.find((r) => r.itemId === A)?.wire;
      expect([a?.otherCompany, a?.defaultUnitId]).toEqual([false, 'iuc-a']);
      expect(rows.find((r) => r.itemId === B)?.wire.defaultUnitId).toBeNull();
      expect(a?.cells).toEqual([
        { branchId: B1, qty: '128.000', value: '3632.80' },
        { branchId: B2, qty: '136.000', value: '3800.00' },
      ]);
      expect(a?.inTransit).toEqual({ qty: '18.000', value: '502.20' });
      expect(a?.chain).toEqual({ qty: '282.000', value: '7935.00' });
      expect(branchTotals(rows, [{ branchId: B1 }, { branchId: B2 }], 1)).toEqual({
        byBranch: [
          { branchId: B1, value: '3632.80' },
          { branchId: B2, value: '3780.00' },
        ],
        inTransit: { value: '502.20', transfers: 1 },
        chain: { value: '7915.00' },
      });
    });

    it('view: negative, in transit, sort by chain value', () => {
      const v = viewOf({});
      expect(branchView(rows, { ...v, show: 'NEGATIVE' }).map((r) => r.itemId)).toEqual([B]);
      expect(branchView(rows, { ...v, show: 'IN_TRANSIT' }).map((r) => r.itemId)).toEqual([A]);
      expect(branchView(rows, { ...v, sort: 'value' }).map((r) => r.itemId)).toEqual([B, A]);
      expect(branchView(rows, { ...v, onlyNegative: true }).map((r) => r.itemId)).toEqual([B]);
    });
  });

  describe('words', () => {
    it('printedAs and the chips', () => {
      expect(
        printedAsOf({
          branchName: 'Acme Foods - Coimbatore Branch',
          from: '2026-11-01',
          to: '2026-11-13',
          godownName: null,
          groupName: null,
          brandName: 'Daily Choice',
          bucket: 'SALEABLE',
          valueAt: 'WITHOUT_TAX',
          qtyIn: 'BASE',
          hideZero: true,
          onlyNegative: false,
          show: 'ALL',
          find: '',
        }),
      ).toBe(
        'Acme Foods - Coimbatore Branch · 01/11/2026 → 13/11/2026 · All godowns · Brand: Daily Choice · Saleable · cost without tax · hide zero',
      );
      expect(
        chipsText([
          { kind: 'NEGATIVE' },
          { kind: 'EXPIRY', date: '2026-11-16', days: 2, tone: 'RED' },
          { kind: 'NO_SALE', days: 61 },
          { kind: 'NEVER_SOLD' },
          { kind: 'OTHER_COMPANY' },
          { kind: 'NOT_TIED' },
        ]),
      ).toBe('NEGATIVE · EXP 16/11 · NO SALE 61 D · NEVER SOLD · OTHER COMPANY · NOT TIED');
    });
  });
});
