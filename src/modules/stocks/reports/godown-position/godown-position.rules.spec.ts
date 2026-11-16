import { Prisma } from '@prisma/client';
import {
  behindBillRows,
  buildRows,
  byLotOf,
  filterRows,
  printedAsOf,
  sortRows,
  tilesOf,
  totalsOf,
  unitOf,
} from './godown-position.rules';
import type { ItemFactDbRow, PositionDbRow } from './godown-position.sql';

const dec = (v: number | string) => new Prisma.Decimal(v);

const RICE = '01a161d8-4fd1-78ed-841a-a6e28b641ec2';
const MAIDA = '01a0d242-5613-71ef-93af-d41e1cca9f16';
const G1 = '019daae6-c65c-7eb8-9ba2-7659611b0a01';
const G2 = '019d2e48-7af3-7d5c-82a7-2eb57fdabf1c';
const BILL1 = '01a20000-0000-7000-8000-000000000001';
const BILL2 = '01a20000-0000-7000-8000-000000000002';

/** Base unit kg; selling unit Bag of 25 kg (rice) / Pkt of 5 kg (maida). */
const FACTS: ItemFactDbRow[] = [
  {
    item_id: RICE,
    item_code: 'RICE-25',
    item_name: 'Annapurna Rice 25 kg',
    barcode: '8901000001411',
    sell_factor: dec(25),
    sell_unit: 'Bag',
    base_unit: 'Kg',
    kg_per_base: dec(1),
  },
  {
    item_id: MAIDA,
    item_code: 'MAIDA-5',
    item_name: 'Classic Maida 5 kg',
    barcode: null,
    sell_factor: dec(5),
    sell_unit: 'Pkt',
    base_unit: 'Kg',
    kg_per_base: dec(1),
  },
];

const GODOWNS = new Map([
  [G1, { name: 'Coimbatore', sort: 1 }],
  [G2, { name: 'Trichy', sort: 2 }],
]);

function row(over: Partial<PositionDbRow> & { item_id: string; godown_id: string }): PositionDbRow {
  return {
    owned: dec(0),
    reserved: dec(0),
    free: dec(0),
    bnd: dec(0),
    bnd_ev: dec(0),
    over_given: dec(0),
    bill_ids: [],
    dc_open: dec(0),
    dc_ids: [],
    last_refno: null,
    last_date: null,
    last_doc_id: null,
    last_doc_year: null,
    ...over,
  };
}

/** The explainer's step 7 for rice at Coimbatore (in kg): Owned 60 bags, BND 40, Reserved 15. */
const RICE_CBE = row({
  item_id: RICE,
  godown_id: G1,
  owned: dec(1500),
  reserved: dec(375),
  free: dec(1125),
  bnd: dec(1000),
  bnd_ev: dec(1000),
  bill_ids: [BILL1, BILL2],
  last_refno: 'DN/2026-2027/D3/00040',
  last_date: '2026-11-15',
  last_doc_id: '01a20000-0000-7000-8000-0000000000aa',
  last_doc_year: '2026-2027',
});
/** Maida: the books say −30 kg (billed ahead of stock), 50 kg billed to give. */
const MAIDA_CBE = row({
  item_id: MAIDA,
  godown_id: G1,
  owned: dec(-30),
  free: dec(-30),
  bnd: dec(50),
  bnd_ev: dec(50),
  bill_ids: [BILL2],
});
const RICE_TRY = row({ item_id: RICE, godown_id: G2, owned: dec(375), free: dec(375), dc_open: dec(50), dc_ids: ['dc1'] });

describe('Godown Stock Position rules', () => {
  it('Physical = Owned + Billed not delivered, in the selling unit (Q16)', () => {
    const [r] = buildRows({ rows: [RICE_CBE], facts: FACTS, godowns: GODOWNS, qtyIn: 'SELLING' });
    expect(r.wire).toMatchObject({
      itemCode: 'RICE-25',
      godownName: 'Coimbatore',
      unitName: 'Bag',
      unitFactor: '25.000000',
      owned: '60.000',
      billedNotDelivered: '40.000',
      physical: '100.000',
      reserved: '15.000',
      freeToSell: '45.000',
      onVehicle: null,
      challanOut: '0.000',
      physicalKg: '2500.000',
      short: '0.000',
      overGiven: '0.000',
      tie: true,
      lastGiven: {
        refno: 'DN/2026-2027/D3/00040',
        date: '2026-11-15',
        sdnId: '01a20000-0000-7000-8000-0000000000aa',
        accYear: '2026-2027',
      },
    });
    const [b] = buildRows({ rows: [RICE_CBE], facts: FACTS, godowns: GODOWNS, qtyIn: 'BASE' });
    expect(b.wire).toMatchObject({ unitName: 'Kg', physical: '2500.000', billedNotDelivered: '1000.000' });
  });

  it('Short: the books below 0 — the shelf holds less than is billed to go', () => {
    const [m] = buildRows({ rows: [MAIDA_CBE], facts: FACTS, godowns: GODOWNS, qtyIn: 'SELLING' });
    expect(m.wire).toMatchObject({ owned: '-6.000', billedNotDelivered: '10.000', physical: '4.000', short: '6.000' });
  });

  it('tie: false when BND from the line qty differs from BND from the events’ base columns', () => {
    const [r] = buildRows({
      rows: [{ ...RICE_CBE, bnd_ev: dec(999) }],
      facts: FACTS,
      godowns: GODOWNS,
      qtyIn: 'SELLING',
    });
    expect(r.wire.tie).toBe(false);
    expect(totalsOf([r]).tie).toBe(false);
  });

  it('over-given lines (decision 46) show as a positive overGiven', () => {
    const [r] = buildRows({
      rows: [row({ item_id: RICE, godown_id: G1, owned: dec(100), bnd: dec(-25), bnd_ev: dec(-25), over_given: dec(25) })],
      facts: FACTS,
      godowns: GODOWNS,
      qtyIn: 'SELLING',
    });
    expect(r.wire).toMatchObject({ billedNotDelivered: '-1.000', physical: '3.000', overGiven: '1.000' });
  });

  it('tiles: kg, packages, distinct bills / challans, short, reserved items; totals in kg', () => {
    const rows = sortRows(
      buildRows({ rows: [RICE_TRY, MAIDA_CBE, RICE_CBE], facts: FACTS, godowns: GODOWNS, qtyIn: 'SELLING' }),
    );
    expect(rows.map((r) => [r.wire.itemName, r.wire.godownName])).toEqual([
      ['Annapurna Rice 25 kg', 'Coimbatore'],
      ['Annapurna Rice 25 kg', 'Trichy'],
      ['Classic Maida 5 kg', 'Coimbatore'],
    ]);
    const t = tilesOf(rows);
    expect(t.physical).toEqual({ kg: '2895.000', pkgs: '119.000', rows: 3 });
    expect(t.billedNotDelivered).toEqual({ kg: '1050.000', pkgs: '50.000', bills: 2 });
    expect(t.owned).toEqual({ kg: '1845.000', pkgs: '69.000' });
    expect(t.reserved).toEqual({ kg: '375.000', pkgs: '15.000', items: 1 });
    expect(t.challanOut).toEqual({ kg: '50.000', pkgs: '2.000', challans: 1 });
    expect(t.short.items).toBe(1);
    expect(t.short.first).toMatchObject({ itemName: 'Classic Maida 5 kg', physical: '4.000', billedNotDelivered: '10.000' });
    expect(totalsOf(rows)).toEqual({
      physicalKg: '2895.000',
      bndKg: '1050.000',
      ownedKg: '1845.000',
      reservedKg: '375.000',
      freeKg: '1470.000',
      challanKg: '50.000',
      rows: 3,
      tie: true,
    });
  });

  it('filters: hide zero, only with goods to give, find by code / name / barcode', () => {
    const zero = row({ item_id: MAIDA, godown_id: G2 });
    const rows = buildRows({
      rows: [RICE_CBE, RICE_TRY, zero],
      facts: FACTS,
      godowns: GODOWNS,
      qtyIn: 'SELLING',
    });
    expect(filterRows(rows, { hideZero: true, onlyToGive: false, find: '' })).toHaveLength(2);
    expect(filterRows(rows, { hideZero: false, onlyToGive: false, find: '' })).toHaveLength(3);
    expect(filterRows(rows, { hideZero: true, onlyToGive: true, find: '' }).map((r) => r.wire.godownName)).toEqual([
      'Coimbatore',
    ]);
    expect(filterRows(rows, { hideZero: false, onlyToGive: false, find: '890100000' })).toHaveLength(2);
    expect(filterRows(rows, { hideZero: false, onlyToGive: false, find: 'maida' })).toHaveLength(1);
  });

  it('unitOf: no default unit falls back to the base', () => {
    expect(unitOf(undefined, 'SELLING')).toEqual({ name: '', factor: dec(1) });
    expect(unitOf({ ...FACTS[0], sell_factor: dec(0) }, 'SELLING').factor.toString()).toBe('1');
  });

  it('behind BND: each line in the row’s unit, whatever unit the bill used', () => {
    const rows = behindBillRows(
      [
        {
          bill_id: BILL1,
          bill_acc_year: '2026-2027',
          bill_refno: 'WS/0016',
          bill_date: '2026-11-10',
          days: 5,
          cust_id: null,
          cust_name: 'ZT-Customer',
          area_name: 'MUSIRI',
          mode: 'PICKUP',
          line_id: 'l1',
          line_no: 2,
          lot_id: null,
          lot_no: 'AN2610B',
          factor: dec(25),
          billed_qty: dec(40),
          given_qty: dec(20),
          pending_qty: dec(20),
          pending_base: dec(500),
          last_refno: null,
          last_date: null,
          last_doc_id: null,
          last_doc_year: null,
        },
      ],
      dec(25),
    );
    expect(rows[0]).toMatchObject({ billed: '40.000', given: '20.000', pending: '20.000', lastGiven: null, days: 5 });
  });

  it('by lot: owned + not delivered = physical per lot; the sum = the row', () => {
    const r = byLotOf(
      [
        { lot_id: 'a', lot_no: 'AN2610B', owned: dec(1000), reserved: dec(375), free: dec(625), bnd: dec(750) },
        { lot_id: 'b', lot_no: 'AN2609C', owned: dec(500), reserved: dec(0), free: dec(500), bnd: dec(250) },
        { lot_id: 'c', lot_no: 'OLD', owned: dec(0), reserved: dec(0), free: dec(0), bnd: dec(0) },
      ],
      dec(25),
    );
    expect(r.byLot).toEqual([
      { lotId: 'a', lotNo: 'AN2610B', owned: '40.000', notDelivered: '30.000', physical: '70.000' },
      { lotId: 'b', lotNo: 'AN2609C', owned: '20.000', notDelivered: '10.000', physical: '30.000' },
    ]);
    expect(r.sum).toEqual({
      owned: '60.000',
      billedNotDelivered: '40.000',
      physical: '100.000',
      reserved: '15.000',
      freeToSell: '45.000',
    });
  });

  it('printedAs names the scope', () => {
    expect(
      printedAsOf({
        branchName: 'Acme Foods - Coimbatore Branch',
        godownName: null,
        groupName: null,
        brandName: 'Daily Choice',
        asOf: '15/11/2026 07:42 PM',
        qtyIn: 'SELLING',
        bucket: 'SALEABLE',
        onlyToGive: true,
        hideZero: true,
        find: '',
      }),
    ).toBe(
      'Acme Foods - Coimbatore Branch · All godowns · Brand: Daily Choice · qty in the selling unit · saleable · ' +
        'only with goods to give · hide zero · as of 15/11/2026 07:42 PM',
    );
  });
});
