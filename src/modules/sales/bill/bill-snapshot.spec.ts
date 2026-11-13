import {
  chargeLegsOf,
  docTaxOf,
  partyDebitOf,
  registerChargesOf,
  salesAmountOf,
  snapshotFromDto,
  snapshotFromRows,
  type BillSnapshot,
} from './bill-snapshot';
import { Prisma, type SaleBill, type SaleBillItem } from '@prisma/client';
import type { BillChargePayload } from './types/bill-api.types';
import { bucketTaxes, round2 } from '../posting/sales-doc.utils';
import { buildBillLegs } from '../posting/sales-leg.sources';
import type { SalesLeg } from '../posting/types/sales-leg.types';
import type { SaveBillDto } from './dto/save-bill.dto';

// E-WAY-DB — /validate used to read the transport band from the database only,
// so an unsaved draft was always told "transport missing". The snapshot now
// carries the band the body sends; the guard reads that first.
describe('snapshotFromDto — the transport band the body carries', () => {
  const dto = (overrides: Partial<SaveBillDto> = {}): SaveBillDto =>
    ({
      sbCompanyId: '019c0000-0000-7000-8000-000000000001',
      sbBranchId: '019c0000-0000-7000-8000-000000000002',
      sbAccYear: '2026-2027',
      sbBillDate: '2026-09-25',
      ...overrides,
    }) as SaveBillDto;

  it('is undefined when the body says nothing about transport, so the stored band is read', () => {
    expect(snapshotFromDto(dto(), new Map()).transport).toBeUndefined();
  });

  it('carries the transporter and LR the body names', () => {
    const snap = snapshotFromDto(
      dto({ sbTransporterName: 'VRL Logistics', sbLrNo: 'LR-1001' }),
      new Map(),
    );
    expect(snap.transport).toEqual({
      transporterId: null,
      transporterName: 'VRL Logistics',
      lrNo: 'LR-1001',
    });
  });

  it('is all-null when the body clears the band, which the guard treats as empty', () => {
    const snap = snapshotFromDto(
      dto({ sbTransporterId: null, sbTransporterName: null, sbLrNo: null }),
      new Map(),
    );
    expect(snap.transport).toEqual({ transporterId: null, transporterName: null, lrNo: null });
  });
});

// A bill with an after-tax charge that was not marked cd_sep_post refused with
// SALES_AMOUNT_MISMATCH: SALES only absorbs before-tax charges, so the after-tax
// ones fell out of the party debit. They now always post to their own ledger.
describe('snapshotFromDto — after-tax charges post separately', () => {
  const charge = (o: Record<string, unknown>) => ({
    cdLedgerCode: '019c0000-0000-7000-8000-0000000000aa',
    cdSepPost: false,
    cdTaxApl: false,
    ...o,
  });
  const snap = snapshotFromDto(
    {
      sbCompanyId: '019c0000-0000-7000-8000-000000000001',
      sbBranchId: '019c0000-0000-7000-8000-000000000002',
      sbAccYear: '2026-2027',
      sbBillDate: '2026-10-08',
      sbTaxableAmt: 9386.67,
      sbRoundOff: -0.33,
      sbBillAmt: 9912,
      charges: [
        charge({ cdChgName: 'Other Charge', cdBeforeTax: true, cdAmount: 6257.78 }),
        charge({ cdChgName: 'Discount', cdBeforeTax: false, cdAmount: -100.12 }),
        charge({ cdChgName: 'Plaining Charges', cdBeforeTax: false, cdAmount: 625.78 }),
      ],
    } as unknown as SaveBillDto,
    new Map(),
  );

  it('keeps a before-tax charge inside SALES and posts the after-tax ones on their own', () => {
    expect(snap.charges.map((c) => c.separatelyPosted)).toEqual([false, true, true]);
  });

  it('makes the party debit equal the bill amount', () => {
    expect(partyDebitOf(snap, false)).toBe(9912);
  });
});

// ─── P0 charge matrix (plan-sale-return-qt-2026-11-13-v5 §4.4, M1–M7) ───────
//
// Each bill is built the way Qt sends it (charge_grid_controller.cpp:628/789,
// sale_bill_entry.cpp:2090-2096): a DEDUCT row keeps a POSITIVE cdAmount and
// its own GST, and Qt signs it in its totals; sbTaxableAmt and sbTaxAmt carry
// an after-tax charge's own taxable value and GST. One goods line throughout:
// taxable 1000.00, CGST 90.00 + SGST 90.00 (18 %), intra-state.
//
// The three wrappers do what BillLifecycleService does with a snapshot:
// the money guard of runGuards (§8), the leg input of postCore (§3) and the
// register split of registerDoc.
describe('P0 charge matrix — a bill Qt built validates, posts balanced and files right', () => {
  const PARTY = 'led-party';
  const LED = {
    cd: 'led-cash-disc',
    newReg: 'led-new-reg',
    freight: 'led-freight',
    add: 'led-add-charges',
  };
  const GST18 = 'tax-gst18';
  const GST12 = 'tax-gst12';

  const goods = (taxable: number, cgst: number, sgst: number) => ({
    sbiItemId: 'item-1',
    sbiItemUnitId: 'unit-1',
    sbiGodownId: 'gdn-1',
    sbiBillQty: 1,
    sbiTaxableAmt: taxable,
    sbiCgstAmt: cgst,
    sbiSgstAmt: sgst,
    sbiIgstAmt: 0,
    sbiCessAmt: 0,
    sbiTaxId: GST18,
  });

  const charge = (o: Record<string, unknown>) => ({
    cdChgId: 'chg-1',
    cdBeforeTax: false,
    cdTaxApl: false,
    cdSepPost: false,
    cdCgstAmt: 0,
    cdSgstAmt: 0,
    cdIgstAmt: 0,
    cdCessAmt: 0,
    ...o,
  });

  const qtBill = (b: {
    line?: ReturnType<typeof goods>;
    charges?: Record<string, unknown>[];
    taxable: number;
    cgst: number;
    sgst: number;
    bill: number;
  }) =>
    snapshotFromDto(
      {
        sbCompanyId: '019c0000-0000-7000-8000-000000000001',
        sbBranchId: '019c0000-0000-7000-8000-000000000002',
        sbAccYear: '2026-2027',
        sbBillDate: '2026-11-13',
        sbTaxableAmt: b.taxable,
        sbCgstAmt: b.cgst,
        sbSgstAmt: b.sgst,
        sbTaxAmt: Math.round((b.cgst + b.sgst) * 100) / 100,
        sbRoundOff: 0,
        sbBillAmt: b.bill,
        items: [b.line ?? goods(1000, 90, 90)],
        charges: b.charges ?? [],
      } as unknown as SaveBillDto,
      new Map(),
    );

  /** runGuards §8 — the money and the tax total. */
  const guardMoney = (snap: BillSnapshot) => {
    const debit = partyDebitOf(snap, false);
    return {
      debit,
      amountOk: Math.abs(debit - snap.billAmt) <= 0.01,
      taxOk: Math.abs(docTaxOf(snap) - snap.taxAmt) <= 0.01,
    };
  };

  /** postCore §3 — the leg list. */
  const legsOf = (snap: BillSnapshot) =>
    buildBillLegs({
      partyLedgerId: PARTY,
      supplyNature: 'INTRA',
      salesAmount: salesAmountOf(snap),
      taxes: bucketTaxes(
        snap.items.map((i) => ({
          taxId: i.taxId,
          cgst: i.cgstAmt,
          sgst: i.sgstAmt,
          igst: i.igstAmt,
          cess: i.cessAmt,
          acess: i.acessAmt,
        })),
      ),
      charges: chargeLegsOf(snap),
      cashDiscount: snap.cashDisc,
      schemeDiscount: 0,
      roundOff: snap.roundOff,
      tcsAmount: snap.tcsAmt,
      setOffs: [],
      tenders: [],
      cogsAmount: 0,
    });

  /** registerDoc — the register's other charge / deduction. */
  const registerOf = (snap: BillSnapshot) => registerChargesOf(snap);

  const side = (legs: SalesLeg[], s: 'DR' | 'CR') =>
    round2(legs.filter((l) => l.drCr === s).reduce((t, l) => t + l.amount, 0));
  const legOf = (legs: SalesLeg[], ledgerId: string) => legs.filter((l) => l.ledgerId === ledgerId);
  const taxLegs = (legs: SalesLeg[], role: string) =>
    legs.filter((l) => l.roleTag === role).map((l) => `${l.drCr} ${l.amount} ${l.taxId ?? '-'}`);

  /** What every row must show: the guard passes, the voucher balances, the party carries the bill. */
  const expectPosts = (snap: BillSnapshot) => {
    const money = guardMoney(snap);
    expect(money).toMatchObject({ amountOk: true, taxOk: true });
    const legs = legsOf(snap);
    expect(side(legs, 'DR')).toBe(side(legs, 'CR'));
    expect(legs[0]).toMatchObject({ ledgerId: PARTY, drCr: 'DR', amount: snap.billAmt });
    for (const l of legs) {
      expect(l.amount).toBeGreaterThan(0);
    }
    return legs;
  };

  it('M1 — after-tax DEDUCT, no GST (CD after tax 2 %): DR its ledger, register deduction', () => {
    // 2 % of the line's net 1180.00 = 23.60, after tax, so outside the taxable value.
    const snap = qtBill({
      charges: [charge({ cdType: 'DEDUCT', cdAmount: 23.6, cdLedgerCode: LED.cd })],
      taxable: 1000,
      cgst: 90,
      sgst: 90,
      bill: 1156.4,
    });
    const legs = expectPosts(snap);
    expect(legOf(legs, LED.cd)).toEqual([expect.objectContaining({ drCr: 'DR', amount: 23.6 })]);
    expect(legs[1]).toMatchObject({ roleTag: 'SALES', drCr: 'CR', amount: 1000 });
    expect(registerOf(snap)).toEqual({ other: 0, deduction: 23.6 });
  });

  it('M2 — after-tax DEDUCT with its own GST (CD after tax as shipped): + GST legs on the DR side', () => {
    // 25.00 off after tax, carrying 18 % of its own: 2.25 + 2.25. Qt nets both
    // into sbTaxableAmt (975.00) and sbTaxAmt (175.50).
    const snap = qtBill({
      charges: [
        charge({
          cdType: 'DEDUCT',
          cdAmount: 25,
          cdTaxApl: true,
          cdTaxCode: GST18,
          cdCgstAmt: 2.25,
          cdSgstAmt: 2.25,
          cdLedgerCode: LED.cd,
        }),
      ],
      taxable: 975,
      cgst: 87.75,
      sgst: 87.75,
      bill: 1150.5,
    });
    const legs = expectPosts(snap);
    expect(legs[1]).toMatchObject({ roleTag: 'SALES', drCr: 'CR', amount: 1000 });
    expect(legOf(legs, LED.cd)).toEqual([expect.objectContaining({ drCr: 'DR', amount: 25 })]);
    expect(taxLegs(legs, 'OUTPUT_CGST')).toEqual([`CR 90 ${GST18}`, `DR 2.25 ${GST18}`]);
    expect(taxLegs(legs, 'OUTPUT_SGST')).toEqual([`CR 90 ${GST18}`, `DR 2.25 ${GST18}`]);
    // Net of its own GST (P0 R1): the 4.50 is in the tax columns already.
    expect(registerOf(snap)).toEqual({ other: 0, deduction: 25 });
  });

  it('M3 — before-tax DEDUCT, not sep_post (CD before tax): inside the lines, no leg of its own', () => {
    // 2 % of the goods value (20.00) comes off the line's taxable before GST.
    const snap = qtBill({
      line: goods(980, 88.2, 88.2),
      charges: [
        charge({ cdType: 'DEDUCT', cdAmount: 20, cdBeforeTax: true, cdLedgerCode: LED.cd }),
      ],
      taxable: 980,
      cgst: 88.2,
      sgst: 88.2,
      bill: 1156.4,
    });
    const legs = expectPosts(snap);
    expect(legs[1]).toMatchObject({ roleTag: 'SALES', drCr: 'CR', amount: 980 });
    expect(legOf(legs, LED.cd)).toEqual([]);
    expect(registerOf(snap)).toEqual({ other: 0, deduction: 0 });
  });

  it('M4 — before-tax DEDUCT, sep_post ("New Reg"): SALES grossed up, DR its own ledger', () => {
    // Qt put the 20.00 into the line taxable (980.00); posting it separately
    // means SALES shows the gross 1000.00 and the deduction its own ledger.
    const snap = qtBill({
      line: goods(980, 88.2, 88.2),
      charges: [
        charge({
          cdType: 'DEDUCT',
          cdAmount: 20,
          cdBeforeTax: true,
          cdSepPost: true,
          cdLedgerCode: LED.newReg,
        }),
      ],
      taxable: 980,
      cgst: 88.2,
      sgst: 88.2,
      bill: 1156.4,
    });
    const legs = expectPosts(snap);
    expect(legs[1]).toMatchObject({ roleTag: 'SALES', drCr: 'CR', amount: 1000 });
    expect(legOf(legs, LED.newReg)).toEqual([expect.objectContaining({ drCr: 'DR', amount: 20 })]);
    expect(guardMoney(snap).debit).toBe(1156.4);
  });

  it('M5 — after-tax ADD, no GST (the bil00054 shape): unchanged', () => {
    const snap = qtBill({
      charges: [charge({ cdType: 'ADD', cdAmount: 80, cdLedgerCode: LED.add })],
      taxable: 1000,
      cgst: 90,
      sgst: 90,
      bill: 1260,
    });
    const legs = expectPosts(snap);
    expect(legs[1]).toMatchObject({ roleTag: 'SALES', drCr: 'CR', amount: 1000 });
    expect(legOf(legs, LED.add)).toEqual([expect.objectContaining({ drCr: 'CR', amount: 80 })]);
    expect(registerOf(snap)).toEqual({ other: 80, deduction: 0 });
  });

  it('M6 — after-tax ADD with its own GST (FREIGHT CHARGE): counted once, its own GST legs', () => {
    // As the open order sor00132 carries it: 100.00 + 6.00 + 6.00 at 12 %.
    // Qt adds it to sbTaxableAmt (1100.00) and its GST to sbTaxAmt (192.00).
    const snap = qtBill({
      charges: [
        charge({
          cdType: 'ADD',
          cdAmount: 100,
          cdTaxApl: true,
          cdSepPost: true,
          cdTaxCode: GST12,
          cdCgstAmt: 6,
          cdSgstAmt: 6,
          cdLedgerCode: LED.freight,
        }),
      ],
      taxable: 1100,
      cgst: 96,
      sgst: 96,
      bill: 1292,
    });
    const legs = expectPosts(snap);
    expect(legs[1]).toMatchObject({ roleTag: 'SALES', drCr: 'CR', amount: 1000 });
    expect(legOf(legs, LED.freight)).toEqual([
      expect.objectContaining({ drCr: 'CR', amount: 100 }),
    ]);
    expect(taxLegs(legs, 'OUTPUT_CGST')).toEqual([`CR 90 ${GST18}`, `CR 6 ${GST12}`]);
    expect(taxLegs(legs, 'OUTPUT_SGST')).toEqual([`CR 90 ${GST18}`, `CR 6 ${GST12}`]);
    // Net of its own GST (P0 R1): gross 1000 + other 100 = taxable 1100.
    expect(registerOf(snap)).toEqual({ other: 100, deduction: 0 });
  });

  it('M7 — DEDUCT rows at 0.00 (the 12 posted bills): no leg, the same totals', () => {
    const snap = qtBill({
      charges: [
        charge({ cdType: 'DEDUCT', cdAmount: 0, cdTaxApl: true, cdLedgerCode: LED.cd }),
        charge({
          cdType: 'DEDUCT',
          cdAmount: 0,
          cdBeforeTax: true,
          cdSepPost: true,
          cdLedgerCode: LED.newReg,
        }),
      ],
      taxable: 1000,
      cgst: 90,
      sgst: 90,
      bill: 1180,
    });
    const legs = expectPosts(snap);
    expect(legs.map((l) => l.roleTag ?? l.ledgerId)).toEqual([
      PARTY,
      'SALES',
      'OUTPUT_CGST',
      'OUTPUT_SGST',
    ]);
    expect(registerOf(snap)).toEqual({ other: 0, deduction: 0 });
  });

  it("M1 from a row that does not say its cdType: the master's chg_type signs it", () => {
    const snap = snapshotFromDto(
      {
        sbCompanyId: '019c0000-0000-7000-8000-000000000001',
        sbBranchId: '019c0000-0000-7000-8000-000000000002',
        sbAccYear: '2026-2027',
        sbBillDate: '2026-11-13',
        sbTaxableAmt: 1000,
        sbTaxAmt: 180,
        sbBillAmt: 1156.4,
        items: [goods(1000, 90, 90)],
        charges: [charge({ cdChgId: 'chg-cd-after', cdAmount: 23.6, cdLedgerCode: LED.cd })],
      } as unknown as SaveBillDto,
      new Map(),
      new Map([['chg-cd-after', 'DEDUCT']]),
    );
    expect(snap.charges[0]).toMatchObject({ type: 'DEDUCT', amount: -23.6 });
    expect(guardMoney(snap)).toMatchObject({ amountOk: true, taxOk: true });
  });

  it('reads a stored DEDUCT row (snapshotFromRows) with the same sign', () => {
    const fromDto = qtBill({
      charges: [
        charge({
          cdType: 'DEDUCT',
          cdAmount: 25,
          cdTaxApl: true,
          cdTaxCode: GST18,
          cdCgstAmt: 2.25,
          cdSgstAmt: 2.25,
          cdLedgerCode: LED.cd,
        }),
      ],
      taxable: 975,
      cgst: 87.75,
      sgst: 87.75,
      bill: 1150.5,
    });
    const D = (v: number) => new Prisma.Decimal(v);
    const fromRows = snapshotFromRows(
      {
        sbId: 'bill-1',
        sbCompanyId: 'c',
        sbBranchId: 'b',
        sbAccYear: '2026-2027',
        sbBillDate: new Date('2026-11-13T00:00:00.000Z'),
        sbTaxableAmt: D(975),
        sbTaxAmt: D(175.5),
        sbBillAmt: D(1150.5),
        sbRoundOff: D(0),
        sbCashDisc: D(0),
        sbTcsAmt: D(0),
      } as unknown as SaleBill,
      [
        {
          sbiItemId: 'item-1',
          sbiTaxableAmt: D(1000),
          sbiCgstAmt: D(90),
          sbiSgstAmt: D(90),
          sbiIgstAmt: D(0),
          sbiCessAmt: D(0),
          sbiAcessAmt: D(0),
          sbiTaxId: GST18,
        } as unknown as SaleBillItem,
      ],
      [
        {
          cdId: 'cd-1',
          cdType: 'DEDUCT',
          cdLedgerCode: LED.cd,
          cdChgName: 'CD - AFTER TAX',
          cdBeforeTax: false,
          cdTaxApl: true,
          cdSepPost: false,
          cdTaxCode: GST18,
          cdAmount: 25,
          cdCgstAmt: 2.25,
          cdSgstAmt: 2.25,
          cdIgstAmt: 0,
          cdCessAmt: 0,
        } as unknown as BillChargePayload,
      ],
      [],
    );
    expect(fromRows.charges[0]).toMatchObject({
      type: 'DEDUCT',
      amount: -25,
      cgst: -2.25,
      taxApl: true,
      insideTaxable: true,
      taxId: GST18,
    });
    expect(partyDebitOf(fromRows, false)).toBe(partyDebitOf(fromDto, false));
    expect(salesAmountOf(fromRows)).toBe(1000);
    expect(docTaxOf(fromRows)).toBe(175.5);
  });

  it('refuses the old sign: the same M1 bill with the deduction ADDED to sbBillAmt', () => {
    const snap = qtBill({
      charges: [charge({ cdType: 'DEDUCT', cdAmount: 23.6, cdLedgerCode: LED.cd })],
      taxable: 1000,
      cgst: 90,
      sgst: 90,
      bill: 1203.6,
    });
    expect(guardMoney(snap).amountOk).toBe(false);
  });
});
