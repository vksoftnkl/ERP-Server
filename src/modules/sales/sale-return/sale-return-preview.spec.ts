import { Prisma } from '@prisma/client';
import { lineFactsOf } from './sale-return-bill-reader';
import { D, ZERO, zeroParts, type BillLineFacts } from './sale-return-money';
import {
  buildReturnMoney,
  chargeAsksOfBody,
  chargeAsksOfStored,
  chargeRowsOf,
  dbDate,
  headerFieldsOf,
  lineFieldsOf,
  previewOf,
  type MoneyInput,
} from './sale-return-preview';
import { returnRegisterDoc } from './sale-return-register';

/**
 * buildReturnMoney — the reads put together (plan v5 D45 / D51 / D52 / D56 /
 * D57 / D68), on a fake reader. The arithmetic itself is
 * sale-return-money.spec.ts.
 */

const BILL_LINE = 'bl-1';
const UNIT = 'unit-pcs';
const ITEM = 'item-1';

function billLine(over: Partial<BillLineFacts> = {}): BillLineFacts & Record<string, unknown> {
  const parts = zeroParts();
  parts.grossAmt = D(1000);
  parts.netGross = D(1000);
  parts.taxableAmt = D(1000);
  parts.cgstAmt = D(90);
  parts.sgstAmt = D(90);
  parts.cogsAmt = D(600);
  return {
    billItemId: BILL_LINE,
    accYear: '2026-2027',
    lineNo: 1,
    itemId: ITEM,
    itemUnitId: UNIT,
    qty: D(10),
    factor: D(1),
    parts,
    perUnit: {
      rate: D(100),
      ratePreTax: D(100),
      maxPrice: null,
      minPrice: null,
      actPrice: null,
      itemDiscQty: null,
      splDiscQty: null,
      schDiscQty: null,
      billSchQty: null,
      cessPerUnit: null,
      acessPerUnit: null,
    },
    percent: {
      itemDiscPerc: D(0),
      splDiscPerc: D(0),
      schDiscPerc: D(0),
      billSchPerc: D(0),
      addlDisc1Perc: D(0),
      addlDisc2Perc: D(0),
      cashDiscPerc: D(0),
      taxPerc: D(18),
      cgstPerc: D(9),
      sgstPerc: D(9),
      igstPerc: D(0),
      cessPerc: D(0),
      acessPerc: D(0),
    },
    copy: {
      hsnCode: null,
      taxId: 'tax-18',
      isTaxIncl: false,
      isFree: false,
      freeType: null,
      isService: false,
      schemeId: null,
      schemeName: null,
      priceLevel: 1,
      eanCode: null,
      lotId: 'lot-1',
      batchNo: 'B-7',
      batchDate: null,
      expiryDate: '2026-11-01',
      serialNo: null,
      salesmanId: null,
      promoUsageId: null,
      qtyPriceId: null,
      size: null,
      sizeUom: null,
    },
    itemName: 'Rice',
    unitName: 'PCS',
    allowReturn: true,
    godownId: 'g',
    unitWeight: null,
    lotBatchNo: 'B-7',
    lotExpiry: '2026-11-01',
    chrgAfterTax: ZERO,
    netAmt: D(1180),
    ...over,
  };
}

function fakeReader(over: Record<string, jest.Mock> = {}) {
  return {
    billHeader: jest.fn(async () => ({
      sbId: 'sb-1',
      accYear: '2026-2027',
      status: 'POSTED',
      refno: 'bil00042',
      date: '2026-11-05',
      companyId: 'co',
      branchId: 'br',
      posStcd: '33',
      cashDisc: ZERO,
      roundOff: ZERO,
      roundOffStep: D(1),
      freightCalcType: null,
      loadingCalcType: null,
    })),
    company: jest.fn(async () => ({ stateCode: '33', einvoice: false })),
    billLines: jest.fn(async () => [billLine()]),
    priorBack: jest.fn(async () => new Map()),
    priorHeader: jest.fn(async () => ({ roundOff: ZERO, cashDisc: ZERO, refund: ZERO })),
    onDrafts: jest.fn(async () => new Map()),
    billCharges: jest.fn(async () => []),
    units: jest.fn(
      async () =>
        new Map([
          [
            UNIT,
            {
              itemUnitId: UNIT,
              itemId: ITEM,
              unitName: 'PCS',
              factor: D(1),
              weight: null,
              isBase: true,
            },
          ],
          [
            'unit-box',
            {
              itemUnitId: 'unit-box',
              itemId: ITEM,
              unitName: 'BOX',
              factor: D(5),
              weight: null,
              isBase: false,
            },
          ],
          [
            'unit-other',
            {
              itemUnitId: 'unit-other',
              itemId: 'item-9',
              unitName: 'KG',
              factor: D(1),
              weight: null,
              isBase: true,
            },
          ],
        ]),
    ),
    reason: jest.fn(async () => null),
    lots: jest.fn(async () => new Map()),
    lastSale: jest.fn(async () => null),
    todayPrice: jest.fn(async () => ({
      rateWot: D(90),
      rate: D('106.2'),
      taxId: 'tax-18',
      hsnCode: null,
      taxPerc: D(18),
      cessPerc: D(0),
      priceLevel: 1,
    })),
    ...over,
  };
}

const input = (
  over: Partial<MoneyInput> = {},
  items: Record<string, unknown>[] = [{}],
): MoneyInput => ({
  srId: 'sr-1',
  companyId: 'co',
  branchId: 'br',
  custId: 'cust',
  returnDate: '2026-11-13',
  againstBill: true,
  billId: 'sb-1',
  billAccYear: '2026-2027',
  priceLevel: 1,
  posStcd: '33',
  reasonId: null,
  items: items.map((i, idx) => ({
    sriLineNo: idx + 1,
    sriBillItemId: BILL_LINE,
    sriItemId: ITEM,
    sriItemUnitId: UNIT,
    sriReturnQty: D(2),
    sriFreeQty: D(0),
    ...i,
  })),
  chargeAsks: new Map(),
  settings: {
    returnWindowDays: 15,
    roundOffStep: 1,
    freeReturnAllowed: true,
    freightCalcType: null,
    loadingCalcType: null,
    expiredLotDays: 0,
  },
  ...over,
});

const tx = {} as Prisma.TransactionClient;
const codes = (m: { issues: { code: string; level: string }[] }) =>
  m.issues.map((i) => `${i.level} ${i.code}`);

describe('buildReturnMoney', () => {
  it('mirrors a billed line and answers the money in request order', async () => {
    const m = await buildReturnMoney(
      fakeReader() as never,
      tx,
      input({}, [{ sriExpiryDate: null }]),
    );

    expect(m.lines[0].parts.taxableAmt.toString()).toBe('200');
    expect(m.totals.creditNote.toString()).toBe('236');
  });

  it('converts another unit through its own factor and checks in base units (D52)', async () => {
    const m = await buildReturnMoney(
      fakeReader() as never,
      tx,
      input({}, [{ sriItemUnitId: 'unit-box', sriReturnQty: D(1) }]),
    );

    expect(m.lines[0].qtyBase.toString()).toBe('5');
    expect(m.lines[0].parts.taxableAmt.toString()).toBe('500');
    expect(m.lines[0].perUnit.rate?.toString()).toBe('500');
    const over = await buildReturnMoney(
      fakeReader() as never,
      tx,
      input({}, [{ sriItemUnitId: 'unit-box', sriReturnQty: D(3) }]),
    );
    expect(codes(over)).toContain('REFUSE SALES_RETURN_OVER_QTY');
  });

  it("refuses a unit that is not the item's (SALES_RETURN_UNIT) and an item not on the bill, naming the bill", async () => {
    const unit = await buildReturnMoney(
      fakeReader() as never,
      tx,
      input({}, [{ sriItemUnitId: 'unit-other' }]),
    );
    const notOn = await buildReturnMoney(
      fakeReader() as never,
      tx,
      input({}, [{ sriBillItemId: 'nope' }]),
    );

    expect(codes(unit)).toContain('REFUSE SALES_RETURN_UNIT');
    expect(notOn.issues).toContainEqual(
      expect.objectContaining({ code: 'SALES_RETURN_NOT_ON_BILL', params: { bill: 'bil00042' } }),
    );
  });

  it('notes what other drafts hold of the line, as INFO with the figures the wording names (D51)', async () => {
    const reader = fakeReader({
      onDrafts: jest.fn(
        async () => new Map([[BILL_LINE, { base: D(3), refnos: ['SRT/2026-2027/D8/00001'] }]]),
      ),
    });
    const m = await buildReturnMoney(reader as never, tx, input());

    expect(m.issues).toContainEqual(
      expect.objectContaining({
        level: 'INFO',
        code: 'SALES_RETURN_ON_DRAFTS',
        params: { qty: '3', refnos: 'SRT/2026-2027/D8/00001' },
      }),
    );
    expect(previewOf(m, input().items).onOtherDrafts).toEqual([
      { billItemId: BILL_LINE, qtyBase: 3, qty: 3, refnos: ['SRT/2026-2027/D8/00001'] },
    ]);
  });

  it('warns on a lot expired more than N days before the return (D57 / D75)', async () => {
    // The bill line's lot expired 2026-11-01: 12 days before 2026-11-13.
    const any = await buildReturnMoney(fakeReader() as never, tx, input());
    const seven = await buildReturnMoney(
      fakeReader() as never,
      tx,
      input({ settings: { ...input().settings, expiredLotDays: 7 } }),
    );
    const twenty = await buildReturnMoney(
      fakeReader() as never,
      tx,
      input({ settings: { ...input().settings, expiredLotDays: 20 } }),
    );

    expect(any.issues).toContainEqual(
      expect.objectContaining({
        level: 'WARN',
        code: 'SALES_RETURN_LOT_EXPIRED',
        params: { lot: 'B-7', n: 12 },
      }),
    );
    expect(codes(seven)).toContain('WARN SALES_RETURN_LOT_EXPIRED');
    expect(codes(twenty)).not.toContain('WARN SALES_RETURN_LOT_EXPIRED');
  });

  describe('a return with no bill (D5 / D56)', () => {
    const noBill = (
      over: Partial<MoneyInput> = {},
      items: Record<string, unknown>[] = [{ sriBillItemId: null }],
    ) => input({ againstBill: false, billId: null, billAccYear: null, ...over }, items);

    it('prices from the bill line the operator picked on grid 211', async () => {
      const reader = fakeReader({
        lastSale: jest.fn(async () => ({
          facts: billLine({ billItemId: 'picked' }),
          refno: 'bil00007',
          date: '2026-11-02',
        })),
      });
      const m = await buildReturnMoney(
        reader as never,
        tx,
        noBill({}, [
          { sriBillItemId: null, sriRateSrcItemId: 'picked', sriRateSrcAccYear: '2026-2027 ' },
        ]),
      );

      expect(reader.lastSale).toHaveBeenCalledWith(
        tx,
        expect.objectContaining({ srcItemId: 'picked', srcAccYear: '2026-2027', windowDays: 15 }),
      );
      expect(m.lines[0].rateSource).toMatchObject({
        kind: 'LAST_SALE',
        sbRefno: 'bil00007',
        billItemId: 'picked',
      });
      expect(m.lines[0].parts.taxableAmt.toString()).toBe('200');
      expect(m.issues).toEqual([]);
    });

    it("never sold to them: today's price, INFO SALES_RETURN_NEVER_SOLD", async () => {
      const m = await buildReturnMoney(fakeReader() as never, tx, noBill());

      expect(m.lines[0].rateSource.kind).toBe('TODAY_PRICE');
      expect(m.lines[0].parts.taxableAmt.toString()).toBe('180');
      expect(codes(m)).toEqual(['INFO SALES_RETURN_NEVER_SOLD']);
    });

    it('is refused when sales.free_return_allowed is off', async () => {
      const m = await buildReturnMoney(
        fakeReader() as never,
        tx,
        noBill({ settings: { ...input().settings, freeReturnAllowed: false } }),
      );

      expect(codes(m)).toContain('REFUSE SALES_RETURN_NO_BILL_OFF');
    });
  });
});

describe('what /create writes', () => {
  it('writes every money column from the mirror and the resolved factor (D45 / D68)', async () => {
    const m = await buildReturnMoney(fakeReader() as never, tx, input());
    const f = lineFieldsOf(m.lines[0], input().items[0], 1);

    expect(f).toMatchObject({
      sriBillItemId: BILL_LINE,
      sriRateSource: 'BILL',
      sriLotId: 'lot-1',
      sriBatchNo: 'B-7',
    });
    expect(String(f.sriToBaseFactor)).toBe('1');
    expect(String(f.sriNetAmt)).toBe('236');
    expect(String(f.sriCogsAmt)).toBe('120');
    expect(String(f.sriCostPrice)).toBe('60');
    expect(String(headerFieldsOf(m).srReturnAmt)).toBe('236');
  });

  it('hands the lot dates to the @db.Date columns as Dates, never as text (S: post 500 on an expiry date)', async () => {
    // The bill copy holds 'YYYY-MM-DD'. Prisma refuses a string for a DateTime
    // field ("premature end of input"), which 500ed /post on any line with an
    // expiry date (writeMoney's plain update).
    const m = await buildReturnMoney(
      fakeReader({
        billLines: jest.fn(async () => [
          billLine({
            copy: { ...billLine().copy, batchDate: '2026-05-04', expiryDate: '2026-11-01' },
          }),
        ]),
      }) as never,
      tx,
      input(),
    );
    const f = lineFieldsOf(m.lines[0], input().items[0], 1);

    expect(f.sriBatchDate).toBeInstanceOf(Date);
    expect(f.sriExpiryDate).toBeInstanceOf(Date);
    // Midnight UTC: Prisma sends a @db.Date as the UTC calendar day, so the
    // day stays the bill's whatever the session timezone (Asia/Kolkata).
    expect((f.sriBatchDate as Date).toISOString()).toBe('2026-05-04T00:00:00.000Z');
    expect((f.sriExpiryDate as Date).toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('leaves a lot with no dates as null; dbDate keeps only the calendar day', async () => {
    const m = await buildReturnMoney(
      fakeReader({
        billLines: jest.fn(async () => [
          billLine({ copy: { ...billLine().copy, batchDate: null, expiryDate: null } }),
        ]),
      }) as never,
      tx,
      input(),
    );
    const f = lineFieldsOf(m.lines[0], input().items[0], 1);
    expect(f.sriBatchDate).toBeNull();
    expect(f.sriExpiryDate).toBeNull();

    expect(dbDate(null)).toBeNull();
    expect(dbDate(undefined)).toBeNull();
    expect(dbDate('')).toBeNull();
    // A full stamp keeps only its calendar day.
    expect(dbDate('2026-11-01T18:30:00.000Z')!.toISOString()).toBe('2026-11-01T00:00:00.000Z');
  });

  it('reads the client’s give-back choices from /create, and the saved ones at /post', () => {
    expect(
      chargeAsksOfBody([
        { cdSrcCdId: 'a', giveBack: false },
        { cdSrcCdId: 'b', cdAmount: '-12.5' },
        { cdAmount: 3 },
      ]),
    ).toEqual(
      new Map([
        ['a', { giveBack: false, amount: null }],
        ['b', { giveBack: null, amount: D('12.5') }],
      ]),
    );
    expect(
      chargeAsksOfStored([
        { cdSrcCdId: 'a', cdCarryBasis: 'NONE', cdAmount: D(0) },
        { cdSrcCdId: 'b', cdCarryBasis: 'MANUAL', cdAmount: D(20) },
        { cdSrcCdId: 'c', cdCarryBasis: 'PRORATA', cdAmount: D(7) },
      ]),
    ).toEqual(
      new Map([
        ['a', { giveBack: false, amount: null }],
        ['b', { giveBack: true, amount: D(20) }],
        ['c', { giveBack: true, amount: null }],
      ]),
    );
  });

  it('stores a carried charge and a separately posted in-lines charge; never one inside the lines only', async () => {
    const charge = (over: Record<string, unknown>) => ({
      cdId: 'x',
      accYear: '2026-2027',
      chgId: 'c',
      name: 'n',
      type: 'ADD',
      beforeTax: false,
      sepPost: false,
      taxApl: false,
      method: 'FIXED',
      role: null,
      applyOn: null,
      ledgerId: 'l',
      ledgerName: null,
      taxCode: null,
      hsn: null,
      unit: null,
      taxPerc: ZERO,
      cgstPerc: ZERO,
      sgstPerc: ZERO,
      igstPerc: ZERO,
      cessPerc: ZERO,
      onBill: { amount: D(50), cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO },
      backBefore: { amount: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO },
      ...over,
    });
    const reader = fakeReader({
      billCharges: jest.fn(async () => [
        charge({ cdId: 'after' }),
        charge({ cdId: 'cd-in-lines', beforeTax: true, type: 'DEDUCT' }),
        charge({ cdId: 'new-reg', beforeTax: true, sepPost: true, type: 'DEDUCT' }),
      ]),
    });
    const m = await buildReturnMoney(reader as never, tx, input());
    const rows = chargeRowsOf(m, new Map([['after', 'own-1']]));

    expect(rows.map((r) => [r.cdId ?? null, r.cdSrcCdId, r.cdType, r.cdAmount])).toEqual([
      ['own-1', 'after', 'ADD', '10'],
      [null, 'new-reg', 'DEDUCT', '10'],
    ]);
  });
});

describe('the return register (gap 50)', () => {
  it('shows every charge given back so gross − discount + other charge = taxable', async () => {
    const parts = zeroParts();
    parts.grossAmt = D(1250);
    parts.netGross = D(1250);
    parts.chrgBeforeTax = D(-25);
    parts.taxableAmt = D(1225);
    parts.cgstAmt = D('110.25');
    parts.sgstAmt = D('110.25');
    const reader = fakeReader({
      billLines: jest.fn(async () => [billLine({ parts })]),
      billCharges: jest.fn(async () => [
        {
          cdId: 'cd-b',
          accYear: '2026-2027',
          chgId: 'c',
          name: 'CD - BEFORE TAX',
          type: 'DEDUCT',
          beforeTax: true,
          sepPost: false,
          taxApl: false,
          method: 'PERCENT',
          role: 'CASH_DISC',
          applyOn: null,
          ledgerId: 'l',
          ledgerName: null,
          taxCode: null,
          hsn: null,
          unit: null,
          taxPerc: ZERO,
          cgstPerc: ZERO,
          sgstPerc: ZERO,
          igstPerc: ZERO,
          cessPerc: ZERO,
          onBill: { amount: D(25), cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO },
          backBefore: { amount: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO },
        },
        {
          cdId: 'fr',
          accYear: '2026-2027',
          chgId: 'f',
          name: 'FREIGHT CHARGE',
          type: 'ADD',
          beforeTax: false,
          sepPost: true,
          taxApl: true,
          method: 'FIXED',
          role: 'FREIGHT',
          applyOn: null,
          ledgerId: 'lf',
          ledgerName: null,
          taxCode: 'g12',
          hsn: null,
          unit: null,
          taxPerc: D(12),
          cgstPerc: D(6),
          sgstPerc: D(6),
          igstPerc: ZERO,
          cessPerc: ZERO,
          onBill: { amount: D(100), cgst: D(6), sgst: D(6), igst: ZERO, cess: ZERO },
          backBefore: { amount: ZERO, cgst: ZERO, sgst: ZERO, igst: ZERO, cess: ZERO },
        },
      ]),
    });
    const m = await buildReturnMoney(
      reader as never,
      tx,
      input({}, [{ sriReturnQty: D(3), sriExpiryDate: null }]),
    );
    const doc = returnRegisterDoc(
      {
        srId: 'sr-1',
        srCompanyId: 'co',
        srBranchId: 'br',
        srAccYear: '2026-2027',
        srReturnDate: new Date('2026-11-13'),
        srReturnRefno: 'SRT/2026-2027/D8/00001',
        srCustId: 'cust',
      },
      m,
      'v-1',
      77n,
      'actor',
    );

    expect([
      doc.grossValue,
      doc.discountValue,
      doc.otherCharge,
      doc.taxableValue,
      doc.billValue,
    ]).toEqual([375, 7.5, 30, 397.5, 467]);
    expect(doc.grossValue - doc.discountValue + doc.otherCharge).toBe(doc.taxableValue);
    expect(doc).toMatchObject({ docType: 'CREDIT_NOTE', docSign: -1, voucherNo: 77n });
  });
});

describe('lineFactsOf (D68)', () => {
  it("takes the unit conversion's factor when the bill line's own is 0", () => {
    const f = lineFactsOf({
      sbi_id: 'x',
      sbi_acc_year: '2026-2027 ',
      sbi_line_no: 1,
      sbi_item_id: 'i',
      sbi_item_unit_id: 'u',
      sbi_bill_qty: new Prisma.Decimal(2),
      sbi_to_base_factor: new Prisma.Decimal(0),
      unit_factor: new Prisma.Decimal(12),
      sbi_gross_amt: new Prisma.Decimal(100),
      sbi_net_gross: null,
      sbi_item_disc_amt: new Prisma.Decimal(10),
    });

    expect(f.factor.toString()).toBe('12');
    expect(f.accYear).toBe('2026-2027');
    // An older line with no net gross: gross less its own discounts.
    expect(f.parts.netGross.toString()).toBe('90');
  });
});
