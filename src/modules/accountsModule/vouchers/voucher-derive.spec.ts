import { Prisma } from '@prisma/client';
import type { ResolvedRoleLedger } from '../ledgerRole/ledger-map.helper';
import type { VoucherTypeRules } from './types/vouchers-api.types';
import { derive, roleKey, toWire, type DeriveInput, type TypedLineInput } from './voucher-derive';
import type {
  BillFacts,
  LedgerFacts,
  TaxRateFacts,
  TdsRateFacts,
  TenderFacts,
} from './voucher-facts';
import { newGuardContext } from './vouchers.errors';

/**
 * §11.1 as unit tests over the pure derivation — the PNG example (#5), the
 * inter-state and reverse-charge variants (#6, #7), the typed tax ledger
 * (#8), the credit note (#9), the short receipt allocation (#10), the
 * instrument ledger (#11), the Contra side rule (#3), the unbalanced Journal
 * (#1) and the multi-party Journal (#4).
 */

const D = (v: number | string) => new Prisma.Decimal(v);

// ─── the chart, as ids ───────────────────────────────────────────────────────
const G = {
  CURRENT_LIABILITIES: 'g-current-liabilities',
  SUNDRY_CREDITORS: 'g-sundry-creditors',
  SUPPLIERS: 'g-suppliers',
  CURRENT_ASSETS: 'g-current-assets',
  SUNDRY_DEBTORS: 'g-sundry-debtors',
  CUSTOMERS: 'g-customers',
  CASH: 'g-cash',
  BANK: 'g-bank',
  INDIRECT_EXPENSES: 'g-indirect-expenses',
  OFFICE_EXPENSES: 'g-office-expenses',
  DUTIES: 'g-duties',
  SALES_ACCOUNTS: 'g-sales-accounts',
  INDIRECT_INCOMES: 'g-indirect-incomes',
};

function ledger(
  id: string,
  name: string,
  path: [string, string][],
  extra: Partial<LedgerFacts> = {},
): LedgerFacts {
  const names = path.map((p) => p[1]);
  return {
    ledId: id,
    name,
    isActive: true,
    isDeleted: false,
    groupId: path[0][0],
    groupName: path[0][1],
    groupPath: path.map((p) => p[0]),
    groupNames: names,
    isParty: names.some((n) => ['Sundry Debtors', 'Sundry Creditors'].includes(n)),
    isBillByBill: false,
    taxId: null,
    itcEligibility: null,
    isTdsApplicable: false,
    tdsSection: null,
    tdsDeducteeType: null,
    pan: null,
    gstin: null,
    gstType: null,
    stateCode: '33',
    stateName: 'Tamil Nadu',
    addr1: null,
    addr2: null,
    addr3: null,
    city: null,
    pin: null,
    ...extra,
  };
}

const L = {
  HOUSEKEEPING: ledger(
    'l-housekeeping',
    'Housekeeping Charges',
    [
      [G.OFFICE_EXPENSES, 'Office Expenses'],
      [G.INDIRECT_EXPENSES, 'Indirect Expenses'],
    ],
    { isTdsApplicable: true, itcEligibility: 'INPUT_SERVICES' },
  ),
  STATIONERY: ledger(
    'l-stationery',
    'Printing & Stationery',
    [[G.INDIRECT_EXPENSES, 'Indirect Expenses']],
    {
      itcEligibility: 'ELIGIBLE',
    },
  ),
  SUNDARAM: ledger(
    'l-sundaram',
    'Sundaram Facility Services',
    [
      [G.SUPPLIERS, 'Suppliers'],
      [G.SUNDRY_CREDITORS, 'Sundry Creditors'],
      [G.CURRENT_LIABILITIES, 'Current Liabilities'],
    ],
    {
      isBillByBill: true,
      isTdsApplicable: true,
      tdsSection: '194C',
      tdsDeducteeType: 'FIRM',
      pan: 'AAAFS1234A',
      gstin: '33AAAFS1234A1Z5',
    },
  ),
  KRISHNA: ledger(
    'l-krishna',
    'Sri Krishna Traders',
    [
      [G.CUSTOMERS, 'Customers'],
      [G.SUNDRY_DEBTORS, 'Sundry Debtors'],
      [G.CURRENT_ASSETS, 'Current Assets'],
    ],
    { isBillByBill: true, gstin: '33AABCK1234A1Z5' },
  ),
  RAVI: ledger(
    'l-ravi',
    'Ravi Traders',
    [
      [G.CUSTOMERS, 'Customers'],
      [G.SUNDRY_DEBTORS, 'Sundry Debtors'],
      [G.CURRENT_ASSETS, 'Current Assets'],
    ],
    { isBillByBill: true },
  ),
  CASH: ledger('l-cash', 'Cash — Counter 1', [
    [G.CASH, 'Cash-in-Hand'],
    [G.CURRENT_ASSETS, 'Current Assets'],
  ]),
  HDFC: ledger('l-hdfc', 'HDFC Bank — 004312', [
    [G.BANK, 'Bank Accounts'],
    [G.CURRENT_ASSETS, 'Current Assets'],
  ]),
  RATE_DIFF: ledger('l-rate-diff', 'Rate Difference Allowed', [
    [G.INDIRECT_EXPENSES, 'Indirect Expenses'],
  ]),
  INPUT_CGST: ledger('l-in-cgst', 'Input CGST', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  INPUT_SGST: ledger('l-in-sgst', 'Input SGST', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  INPUT_IGST: ledger('l-in-igst', 'Input IGST', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  OUTPUT_CGST: ledger('l-out-cgst', 'Output CGST', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  OUTPUT_SGST: ledger('l-out-sgst', 'Output SGST', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  TDS_PAYABLE: ledger('l-tds', 'TDS Payable', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  RCM_CGST: ledger('l-rcm-cgst', 'RCM CGST Payable', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  RCM_SGST: ledger('l-rcm-sgst', 'RCM SGST Payable', [
    [G.DUTIES, 'Duties & Taxes'],
    [G.CURRENT_LIABILITIES, 'Current Liabilities'],
  ]),
  CHEQUES_IN_HAND: ledger('l-ciH', 'Cheques In Hand', [[G.CURRENT_ASSETS, 'Current Assets']]),
};
const LEDGERS = new Map(Object.values(L).map((l) => [l.ledId, l]));

const TAX18: TaxRateFacts = {
  taxId: 't-18',
  name: 'GST 18%',
  ratePerc: D(18),
  cgstPerc: D(9),
  sgstPerc: D(9),
  igstPerc: D(18),
  cessPerc: D(0),
  cessBasis: 'NONE',
  taxability: 'TAXABLE',
  isReverseCharge: false,
  isActive: true,
};
const TAX12: TaxRateFacts = {
  ...TAX18,
  taxId: 't-12',
  name: 'GST 12%',
  ratePerc: D(12),
  cgstPerc: D(6),
  sgstPerc: D(6),
  igstPerc: D(12),
};
const TAX_RATES = new Map([
  [TAX18.taxId, TAX18],
  [TAX12.taxId, TAX12],
]);

function mapped(role: string, l: LedgerFacts): [string, ResolvedRoleLedger] {
  return [
    roleKey(role, null, null),
    {
      role,
      roleLabel: role,
      ledgerId: l.ledId,
      ledgerName: l.name,
      supplyNature: null,
      source: 'LEDGER_MAP',
      sourceRowId: 'x',
    },
  ];
}
const ROLE_LEDGERS = new Map<string, ResolvedRoleLedger | null>([
  mapped('INPUT_CGST', L.INPUT_CGST),
  mapped('INPUT_SGST', L.INPUT_SGST),
  mapped('INPUT_IGST', L.INPUT_IGST),
  mapped('OUTPUT_CGST', L.OUTPUT_CGST),
  mapped('OUTPUT_SGST', L.OUTPUT_SGST),
  mapped('TDS_PAYABLE', L.TDS_PAYABLE),
  mapped('RCM_CGST_PAYABLE', L.RCM_CGST),
  mapped('RCM_SGST_PAYABLE', L.RCM_SGST),
]);
const GENERATED = new Set(
  [
    L.INPUT_CGST,
    L.INPUT_SGST,
    L.INPUT_IGST,
    L.OUTPUT_CGST,
    L.OUTPUT_SGST,
    L.TDS_PAYABLE,
    L.RCM_CGST,
    L.RCM_SGST,
  ].map((l) => l.ledId),
);

const TDS_194C: TdsRateFacts = {
  section: '194C',
  sectionName: 'Payment to contractors',
  deducteeType: 'ANY',
  rate: D(2),
  noPanRate: D(20),
  thresholdSingle: D(0),
  thresholdAnnual: D(0),
};

function type(over: Partial<VoucherTypeRules>): VoucherTypeRules {
  return {
    instruments: false,
    typeId: 1,
    typeCode: 'X',
    typeName: 'X',
    nature: 'JOURNAL',
    numberPrefix: 'x',
    menuId: 103,
    partyMode: 'MANY',
    partySide: 'ANY',
    billwiseMode: 'OPTIONAL',
    raiseBillType: 'JOURNAL',
    drGroups: [],
    crGroups: [],
    gstRegister: null,
    gstSide: null,
    tdsMode: 'OFF',
    inRegister: true,
    affectsInventory: false,
    ...over,
  };
}
const grp = (ids: string[]) => ids.map((groupId) => ({ groupId, name: groupId }));
const PURA = type({
  typeId: 28,
  typeCode: 'PurA',
  typeName: 'Purchase (Accounting)',
  nature: 'PURCHASE',
  menuId: 163,
  partyMode: 'ONE',
  partySide: 'CR',
  billwiseMode: 'RAISE',
  raiseBillType: 'PURCHASE',
  drGroups: grp([G.INDIRECT_EXPENSES, G.DUTIES]),
  crGroups: grp([G.SUNDRY_CREDITORS, G.DUTIES]),
  gstRegister: 'GSTR2',
  gstSide: 'INPUT',
  tdsMode: 'DEDUCT',
});
const CRN = type({
  typeId: 27,
  typeCode: 'CrN',
  typeName: 'Credit Note',
  nature: 'CREDIT_NOTE',
  menuId: 102,
  partyMode: 'ONE',
  partySide: 'CR',
  billwiseMode: 'RAISE',
  raiseBillType: 'JOURNAL',
  drGroups: grp([G.INDIRECT_INCOMES, G.SALES_ACCOUNTS, G.INDIRECT_EXPENSES, G.DUTIES]),
  crGroups: [],
  gstRegister: 'GSTR1_9B',
  gstSide: 'OUTPUT',
});
const CON = type({
  typeId: 25,
  typeCode: 'Con',
  typeName: 'Contra',
  nature: 'CONTRA',
  menuId: 104,
  partyMode: 'NONE',
  billwiseMode: 'OFF',
  raiseBillType: null,
  drGroups: grp([G.CASH, G.BANK]),
  crGroups: grp([G.CASH, G.BANK]),
});
const JRL = type({ typeId: 24, typeCode: 'Jrl', typeName: 'Journal' });
const RCPV = type({
  typeId: 30,
  typeCode: 'RcpV',
  typeName: 'Receipt Voucher',
  nature: 'RECEIPT',
  menuId: 260,
  partyMode: 'ONE',
  partySide: 'CR',
  billwiseMode: 'DEMAND',
  raiseBillType: null,
  drGroups: grp([G.CASH, G.BANK]),
  crGroups: [],
});

function line(
  rowNo: number,
  drCr: 'DR' | 'CR',
  l: LedgerFacts,
  amount: number,
  extra: Partial<TypedLineInput> = {},
): TypedLineInput {
  return {
    rowNo,
    drCr,
    ledgerId: l.ledId,
    amount: D(amount),
    remarks: null,
    gst: null,
    tdsBase: null,
    ...extra,
  };
}

function input(over: Partial<DeriveInput>): DeriveInput {
  return {
    type: JRL,
    header: {
      date: '2026-09-15',
      partyId: null,
      posStcd: null,
      reverseCharge: false,
      docRefno: null,
    },
    lines: [],
    allocations: [],
    newBill: null,
    company: {
      companyId: 'c-1',
      name: 'Acme',
      stateCode: '33',
      gstin: '33ABNPL5414F1ZU',
      einvoiceApplicable: false,
    },
    ledgers: LEDGERS,
    instrumentLedgers: new Set([L.CHEQUES_IN_HAND.ledId]),
    generatedRoleLedgers: GENERATED,
    taxRates: TAX_RATES,
    roleLedgers: ROLE_LEDGERS,
    party: null,
    creditDaysByLedger: new Map([[L.SUNDARAM.ledId, 30]]),
    tds: null,
    bills: new Map(),
    docRefnoClash: null,
    backdateMode: 'OFF',
    today: '2026-09-26',
    ctx: newGuardContext({ dryRun: true, overrides: [], canOverride: false }),
    ...over,
  };
}

const legOf = (d: ReturnType<typeof derive>, ledId: string) =>
  d.legs.find((l) => l.ledger.ledId === ledId);
const codes = (i: DeriveInput) => i.ctx.refusals.map((r) => r.code);

describe('derive — the PNG example (§4.1, §11.1 #5)', () => {
  const pngLines = () => [
    line(1, 'DR', L.HOUSEKEEPING, 25000, {
      gst: { taxId: 't-18', hsn: '998533', itcEligibility: 'INPUT_SERVICES' },
      tdsBase: true,
    }),
    line(2, 'DR', L.STATIONERY, 4000, {
      gst: { taxId: 't-12', hsn: '4820', itcEligibility: 'INPUTS' },
      tdsBase: false,
    }),
  ];

  it('generates Input CGST 2,490 / Input SGST 2,490 / TDS 500 / party 33,480 and a PURCHASE bill due +30', () => {
    const i = input({
      type: PURA,
      header: {
        date: '2026-09-15',
        partyId: L.SUNDARAM.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: 'SFS/2026/451',
      },
      lines: pngLines(),
      party: L.SUNDARAM,
      tds: { rate: TDS_194C, annualBaseSoFar: D(0) },
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(legOf(d, L.INPUT_CGST.ledId)?.amount.toFixed(2)).toBe('2490.00');
    expect(legOf(d, L.INPUT_SGST.ledId)?.amount.toFixed(2)).toBe('2490.00');
    expect(legOf(d, L.INPUT_CGST.ledId)?.drCr).toBe('DR');
    expect(legOf(d, L.TDS_PAYABLE.ledId)?.amount.toFixed(2)).toBe('500.00');
    expect(legOf(d, L.TDS_PAYABLE.ledId)?.drCr).toBe('CR');
    expect(d.party?.amount.toFixed(2)).toBe('33480.00');
    expect(d.party?.side).toBe('CR');
    expect(d.totals.debit.toFixed(2)).toBe('33980.00');
    expect(d.totals.difference.isZero()).toBe(true);
    expect(d.legs.filter((l) => l.generated)).toHaveLength(4);
    expect(d.legs[d.legs.length - 1].source).toBe('PARTY');
    expect(d.bills).toHaveLength(1);
    expect(d.bills[0]).toMatchObject({
      billType: 'PURCHASE',
      side: 'CR',
      dueDays: 30,
      dueDate: '2026-10-15',
      docRefno: 'SFS/2026/451',
    });
    expect(d.bills[0].amount.toFixed(2)).toBe('33480.00');
    expect(d.gst?.lines).toHaveLength(2);
    expect(d.gst?.lines.map((l) => l.rowNo)).toEqual([1, 2]);
    expect(d.gst?.lines[0].itcEligibility).toBe('INPUT_SERVICES');
    expect(d.tds).toMatchObject({
      section: '194C',
      deducted: true,
      registerDeductee: 'NON_COMPANY',
      rateSource: 'MASTER',
    });
    expect(d.tds?.base.toFixed(2)).toBe('25000.00');
    // every non-party leg names the party as its opposite ledger
    expect(legOf(d, L.HOUSEKEEPING.ledId)?.oppLedgerId).toBe(L.SUNDARAM.ledId);
    expect(legOf(d, L.SUNDARAM.ledId)?.oppLedgerId).toBeNull();
    const wire = toWire('PurA', '2026-09-15', d);
    expect(wire.totals).toEqual({ debit: 33980, credit: 33980, difference: 0 });
    expect(wire.gst?.rows.map((r) => [r.ratePerc, r.cgst])).toEqual([
      [18, 2250],
      [12, 240],
    ]);
  });

  it('#6 · place of supply outside the company state → IGST only', () => {
    const i = input({
      type: PURA,
      header: {
        date: '2026-09-15',
        partyId: L.SUNDARAM.ledId,
        posStcd: '29',
        reverseCharge: false,
        docRefno: 'X/1',
      },
      lines: pngLines(),
      party: L.SUNDARAM,
      tds: { rate: TDS_194C, annualBaseSoFar: D(0) },
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(legOf(d, L.INPUT_IGST.ledId)?.amount.toFixed(2)).toBe('4980.00');
    expect(legOf(d, L.INPUT_CGST.ledId)).toBeUndefined();
    expect(d.gst?.supplyNature).toBe('INTER');
    expect(d.party?.amount.toFixed(2)).toBe('33480.00');
  });

  it('#7 · reverse charge → DR Input, CR RCM payable, the party is owed the taxable less TDS', () => {
    const i = input({
      type: PURA,
      header: {
        date: '2026-09-15',
        partyId: L.SUNDARAM.ledId,
        posStcd: null,
        reverseCharge: true,
        docRefno: 'X/2',
      },
      lines: pngLines(),
      party: L.SUNDARAM,
      tds: { rate: TDS_194C, annualBaseSoFar: D(0) },
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(legOf(d, L.INPUT_CGST.ledId)?.drCr).toBe('DR');
    expect(legOf(d, L.RCM_CGST.ledId)?.drCr).toBe('CR');
    expect(legOf(d, L.RCM_CGST.ledId)?.amount.toFixed(2)).toBe('2490.00');
    expect(d.party?.amount.toFixed(2)).toBe('28500.00');
    expect(d.gst?.reverseCharge).toBe(true);
  });

  it('#8 · a typed Input CGST line on PurA is refused; the same ledger on a Journal is accepted', () => {
    const bad = input({
      type: PURA,
      header: {
        date: '2026-09-15',
        partyId: L.SUNDARAM.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: 'X/3',
      },
      lines: [line(1, 'DR', L.STATIONERY, 4000), line(2, 'DR', L.INPUT_CGST, 360)],
      party: L.SUNDARAM,
    });
    derive(bad);
    expect(codes(bad)).toContain('VCH_GST_LEDGER_TYPED');

    const ok = input({
      type: JRL,
      lines: [line(1, 'DR', L.INPUT_CGST, 100), line(2, 'CR', L.INPUT_SGST, 100)],
    });
    derive(ok);
    expect(codes(ok)).toEqual([]);
  });

  it('TDS · below the section threshold → no leg, a WARN; no PAN → 20%', () => {
    const rate: TdsRateFacts = {
      ...TDS_194C,
      thresholdSingle: D(30000),
      thresholdAnnual: D(100000),
    };
    const i = input({
      type: PURA,
      header: {
        date: '2026-09-15',
        partyId: L.SUNDARAM.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: 'X/4',
      },
      lines: pngLines(),
      party: L.SUNDARAM,
      tds: { rate, annualBaseSoFar: D(0) },
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(i.ctx.warnings.map((w) => w.code)).toEqual(['VCH_TDS_BELOW_THRESHOLD']);
    expect(legOf(d, L.TDS_PAYABLE.ledId)).toBeUndefined();
    expect(d.tds?.rateSource).toBe('BELOW_THRESHOLD');
    expect(d.party?.amount.toFixed(2)).toBe('33980.00');

    const noPan = input({
      type: PURA,
      header: {
        date: '2026-09-15',
        partyId: L.SUNDARAM.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: 'X/5',
      },
      lines: pngLines(),
      party: { ...L.SUNDARAM, pan: null },
      ledgers: new Map([...LEDGERS, [L.SUNDARAM.ledId, { ...L.SUNDARAM, pan: null }]]),
      tds: { rate: TDS_194C, annualBaseSoFar: D(0) },
    });
    const d2 = derive(noPan);
    expect(legOf(d2, L.TDS_PAYABLE.ledId)?.amount.toFixed(2)).toBe('5000.00');
    expect(d2.tds?.rateSource).toBe('NO_PAN');
  });
});

describe('derive — the other types', () => {
  it('#9 · a Credit Note puts output tax on DR; without GST lines there is no GST document', () => {
    const i = input({
      type: CRN,
      header: {
        date: '2026-09-15',
        partyId: L.KRISHNA.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: null,
      },
      lines: [
        line(1, 'DR', L.RATE_DIFF, 4000, {
          gst: { taxId: 't-18', hsn: null, itcEligibility: null },
        }),
      ],
      party: L.KRISHNA,
      creditDaysByLedger: new Map([[L.KRISHNA.ledId, 0]]),
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(legOf(d, L.OUTPUT_CGST.ledId)).toMatchObject({ drCr: 'DR' });
    expect(legOf(d, L.OUTPUT_CGST.ledId)?.amount.toFixed(2)).toBe('360.00');
    expect(d.party).toMatchObject({ side: 'CR' });
    expect(d.party?.amount.toFixed(2)).toBe('4720.00');
    expect(d.gst?.docType).toBe('CREDIT_NOTE');
    expect(d.gst?.docSign).toBe(-1);
    expect(d.bills[0]).toMatchObject({ billType: 'JOURNAL', side: 'CR' });

    const plain = input({
      type: CRN,
      header: {
        date: '2026-09-15',
        partyId: L.KRISHNA.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: null,
      },
      lines: [line(1, 'DR', L.RATE_DIFF, 4000)],
      party: L.KRISHNA,
    });
    const d2 = derive(plain);
    expect(d2.gst).toBeNull();
    expect(d2.party?.amount.toFixed(2)).toBe('4000.00');
  });

  it('#3 · a Contra with a Sundry Debtors ledger is refused on the side rule; a plain one has no party', () => {
    const bad = input({
      type: CON,
      lines: [line(1, 'CR', L.CASH, 85000), line(2, 'DR', L.KRISHNA, 85000)],
    });
    derive(bad);
    expect(codes(bad)).toEqual(['VCH_LEDGER_SIDE']);
    expect(bad.ctx.refusals[0].line).toBe(2);

    const ok = input({
      type: CON,
      lines: [line(1, 'CR', L.CASH, 85000), line(2, 'DR', L.HDFC, 85000)],
    });
    const d = derive(ok);
    expect(codes(ok)).toEqual([]);
    expect(d.party).toBeNull();
    expect(d.bills).toEqual([]);
    expect(d.legs.every((l) => !l.generated)).toBe(true);
  });

  it('#1 · a Journal out by 0.01 is refused; balanced it posts with no generated leg', () => {
    const bad = input({
      type: JRL,
      lines: [line(1, 'DR', L.RAVI, 10000), line(2, 'CR', L.KRISHNA, 9999.99)],
    });
    derive(bad);
    expect(codes(bad)).toEqual(['VCH_UNBALANCED']);
    expect(bad.ctx.refusals[0].message).toContain('0.01');

    const ok = input({
      type: JRL,
      lines: [line(1, 'DR', L.RAVI, 10000), line(2, 'CR', L.KRISHNA, 10000)],
    });
    const d = derive(ok);
    expect(codes(ok)).toEqual([]);
    expect(d.legs).toHaveLength(2);
  });

  it('#4 · a multi-party Journal raises a JOURNAL bill per bill-by-bill party line, each on its own side', () => {
    const i = input({
      type: JRL,
      lines: [line(1, 'DR', L.RAVI, 10000), line(2, 'CR', L.KRISHNA, 10000)],
    });
    const d = derive(i);
    expect(d.bills.map((b) => [b.lineRowNo, b.party.ledId, b.side])).toEqual([
      [1, L.RAVI.ledId, 'DR'],
      [2, L.KRISHNA.ledId, 'CR'],
    ]);
    // two parties → no single opposite ledger
    expect(d.legs.every((l) => l.oppLedgerId === null)).toBe(true);
  });

  it('#2 · a zero or negative amount is refused', () => {
    const i = input({ type: JRL, lines: [line(1, 'DR', L.RAVI, 0), line(2, 'CR', L.KRISHNA, 0)] });
    derive(i);
    expect(codes(i)).toEqual(['VCH_LINE_AMOUNT', 'VCH_LINE_AMOUNT']);
  });

  it('#11 · a Cheques-in-Hand ledger is refused on any type, naming menu 51 / 52', () => {
    const i = input({
      type: JRL,
      lines: [line(1, 'DR', L.CHEQUES_IN_HAND, 100), line(2, 'CR', L.KRISHNA, 100)],
    });
    derive(i);
    expect(codes(i)).toEqual(['VCH_INSTRUMENT_LEDGER']);
    expect(i.ctx.refusals[0].message).toMatch(/51 \/ 52/);
  });

  it('#10 · a Receipt Voucher allocated short keeps the remainder as an ADVANCE (notes 57); strict under the setting', () => {
    const bill: BillFacts = {
      ablId: 'b-1',
      ablAccYear: '2026-2027',
      partyId: L.KRISHNA.ledId,
      billType: 'SALES',
      docRefno: 'bil00214',
      docDate: new Date('2026-08-01T00:00:00Z'),
      side: 'DR',
      billAmount: D(12000),
      pendingAmount: D(12000),
      isDeleted: false,
      isActive: true,
      companyId: 'c-1',
    };
    const short = input({
      type: RCPV,
      header: {
        date: '2026-09-15',
        partyId: L.KRISHNA.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: null,
      },
      lines: [line(1, 'DR', L.HDFC, 10000)],
      allocations: [
        { index: 0, lineRowNo: 0, billId: 'b-1', billAccYear: '2026-2027', amount: D(5000) },
      ],
      party: L.KRISHNA,
      bills: new Map([['b-1|2026-2027', bill]]),
    });
    const ds = derive(short);
    expect(codes(short)).toEqual([]);
    expect(ds.bills.map((b) => [b.lineRowNo, b.party.ledId, b.billType, b.side, b.amount.toFixed(2), b.dueDate, b.isAdvance])).toEqual([
      [0, L.KRISHNA.ledId, 'ADVANCE', 'CR', '5000.00', null, true],
    ]);
    expect(toWire('RcpV', '2026-09-15', ds).bills[0]).toMatchObject({
      billType: 'ADVANCE',
      side: 'CR',
      amount: 5000,
      dueDays: 0,
      dueDate: null,
      isAdvance: true,
    });

    // the brake: accounts.voucher_allow_advance = false keeps the strict rule
    const strict = input({ ...short, allowAdvance: false, ctx: input({}).ctx });
    derive(strict);
    expect(codes(strict)).toEqual(['VCH_BILLWISE_SHORT']);
    expect(strict.ctx.refusals[0].message).toContain('must be allocated bill by bill');

    const exact = input({
      type: RCPV,
      header: {
        date: '2026-09-15',
        partyId: L.KRISHNA.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: null,
      },
      lines: [line(1, 'DR', L.HDFC, 10000)],
      allocations: [
        { index: 0, lineRowNo: 0, billId: 'b-1', billAccYear: '2026-2027', amount: D(10000) },
      ],
      party: L.KRISHNA,
      bills: new Map([['b-1|2026-2027', bill]]),
    });
    const d = derive(exact);
    expect(codes(exact)).toEqual([]);
    expect(d.allocations[0]).toMatchObject({ adjType: 'ALLOCATION', settlementMode: 'BANK' });
    expect(d.bills).toEqual([]);

    const over = input({
      type: RCPV,
      header: {
        date: '2026-09-15',
        partyId: L.KRISHNA.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: null,
      },
      lines: [line(1, 'DR', L.HDFC, 13000)],
      allocations: [
        { index: 0, lineRowNo: 0, billId: 'b-1', billAccYear: '2026-2027', amount: D(13000) },
      ],
      party: L.KRISHNA,
      bills: new Map([['b-1|2026-2027', bill]]),
    });
    derive(over);
    expect(codes(over)).toEqual(['VCH_BILL_OVERSPENT']);
  });

  it('a Credit Note allocated against an invoice pairs NOTE_ADJUST rows with its own JOURNAL bill', () => {
    const bill: BillFacts = {
      ablId: 'b-214',
      ablAccYear: '2026-2027',
      partyId: L.KRISHNA.ledId,
      billType: 'SALES',
      docRefno: 'bil00214',
      docDate: new Date('2026-08-01T00:00:00Z'),
      side: 'DR',
      billAmount: D(50000),
      pendingAmount: D(50000),
      isDeleted: false,
      isActive: true,
      companyId: 'c-1',
    };
    const i = input({
      type: CRN,
      header: {
        date: '2026-09-15',
        partyId: L.KRISHNA.ledId,
        posStcd: null,
        reverseCharge: false,
        docRefno: null,
      },
      lines: [
        line(1, 'DR', L.RATE_DIFF, 4000, {
          gst: { taxId: 't-18', hsn: null, itcEligibility: null },
        }),
      ],
      allocations: [
        { index: 0, lineRowNo: 0, billId: 'b-214', billAccYear: '2026-2027', amount: D(4720) },
      ],
      party: L.KRISHNA,
      bills: new Map([['b-214|2026-2027', bill]]),
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(d.allocations[0]).toMatchObject({
      adjType: 'NOTE_ADJUST',
      settlementMode: 'CREDIT_NOTE',
    });
    expect(d.bills[0].amount.toFixed(2)).toBe('4720.00');
  });

  it('WARNs · a backdated voucher warns or refuses per the setting; an override with the right passes', () => {
    const w = input({
      type: JRL,
      lines: [line(1, 'DR', L.RAVI, 1), line(2, 'CR', L.KRISHNA, 1)],
      backdateMode: 'WARN',
    });
    derive(w);
    expect(codes(w)).toEqual([]);
    expect(w.ctx.warnings.map((x) => x.code)).toEqual(['VCH_BACKDATED']);

    const posting = input({
      type: JRL,
      lines: [line(1, 'DR', L.RAVI, 1), line(2, 'CR', L.KRISHNA, 1)],
      backdateMode: 'WARN',
      ctx: newGuardContext({ dryRun: false, overrides: [], canOverride: false }),
    });
    derive(posting);
    expect(codes(posting)).toEqual(['VCH_BACKDATED']);

    const overridden = input({
      type: JRL,
      lines: [line(1, 'DR', L.RAVI, 1), line(2, 'CR', L.KRISHNA, 1)],
      backdateMode: 'WARN',
      ctx: newGuardContext({ dryRun: false, overrides: ['VCH_BACKDATED'], canOverride: true }),
    });
    derive(overridden);
    expect(codes(overridden)).toEqual([]);
    expect(overridden.ctx.warnings[0].level).toBe('INFO');
  });
});

// ─── notes (53): Receipt / Payment Voucher with MANY parties ─────────────────
describe('derive — notes (56) the cash/bank side of a Receipt and a Payment', () => {
  const RCPV_MANY = type({ ...RCPV, partyMode: 'MANY' });
  const PMTV = type({
    typeId: 31,
    typeCode: 'PmtV',
    typeName: 'Payment Voucher',
    nature: 'PAYMENT',
    menuId: 261,
    partyMode: 'MANY',
    partySide: 'DR',
    billwiseMode: 'DEMAND',
    raiseBillType: null,
    drGroups: [],
    crGroups: grp([G.CASH, G.BANK]),
  });
  /** RcpV as the register held it before 20260928170000: no group list at all. */
  const RCPV_UNLISTED = type({ ...RCPV_MANY, drGroups: [], crGroups: [] });
  const SALES = ledger('l-sales', 'Sales A/c', [[G.SALES_ACCOUNTS, 'Sales Accounts']]);
  /** The reserved id of Bank OD A/c (prisma/seed/Account_Groups.sql) — matched by id, not name. */
  const OD_GROUP = '019eee86-f34b-7d50-af11-254d259a8440';
  const OD = ledger('l-od', 'SBI OD — 7781', [
    [OD_GROUP, 'Overdraft'],
    ['g-loans', 'Loans (Liability)'],
  ]);
  const WITH_MORE = new Map([...LEDGERS, [SALES.ledId, SALES], [OD.ledId, OD]]);
  const kBill = (): [string, BillFacts] => [
    'k-1|2026-2027',
    {
      ablId: 'k-1',
      ablAccYear: '2026-2027',
      partyId: L.KRISHNA.ledId,
      billType: 'SALES',
      docRefno: 'k-1',
      docDate: new Date('2026-08-01T00:00:00Z'),
      side: 'DR',
      billAmount: D(6000),
      pendingAmount: D(6000),
      isDeleted: false,
      isActive: true,
      companyId: 'c-1',
    },
  ];
  const messages = (i: DeriveInput) => i.ctx.refusals.map((r) => r.message);

  it('RcpV with Cr Cash is refused — cash to bank is a Contra, even with no group list on the type', () => {
    const i = input({
      type: RCPV_UNLISTED,
      ledgers: WITH_MORE,
      lines: [line(1, 'DR', L.HDFC, 5000), line(2, 'CR', L.CASH, 5000)],
    });
    derive(i);
    expect(codes(i)).toEqual(['VCH_LEDGER_SIDE']);
    expect(i.ctx.refusals[0].line).toBe(2);
    expect(messages(i)[0]).toMatch(/Cash — Counter 1 may not be credited on a Receipt Voucher — cash to bank is a Contra/);
  });

  it('RcpV with Dr Sales A/c is refused — the DR side takes cash or bank only', () => {
    const i = input({
      type: RCPV_UNLISTED,
      ledgers: WITH_MORE,
      lines: [line(1, 'DR', SALES, 6000), line(2, 'CR', L.KRISHNA, 6000)],
      allocations: [{ index: 0, lineRowNo: 2, billId: 'k-1', billAccYear: '2026-2027', amount: D(6000) }],
      bills: new Map([kBill()]),
    });
    derive(i);
    expect(codes(i)).toEqual(['VCH_LEDGER_SIDE']);
    expect(i.ctx.refusals[0].line).toBe(1);
    expect(messages(i)[0]).toMatch(/Sales A\/c \(Sales Accounts\) may not be debited on a Receipt Voucher — the DR side takes cash or bank only/);
  });

  it('RcpV with Dr Bank / Cr customer passes, and so does Dr Bank OD (any of the three money groups)', () => {
    /** RcpV as 20260928170000 leaves it: the DR list names all three money groups. */
    const RCPV_THREE = type({ ...RCPV_MANY, drGroups: grp([G.CASH, G.BANK, OD_GROUP]) });
    for (const money of [L.HDFC, OD]) {
      const i = input({
        type: RCPV_THREE,
        ledgers: WITH_MORE,
        lines: [line(1, 'DR', money, 6000), line(2, 'CR', L.KRISHNA, 6000)],
        allocations: [{ index: 0, lineRowNo: 2, billId: 'k-1', billAccYear: '2026-2027', amount: D(6000) }],
        bills: new Map([kBill()]),
      });
      const d = derive(i);
      expect(codes(i)).toEqual([]);
      expect(d.legs).toHaveLength(2);
    }
  });

  it('PmtV with Dr Cash / Cr Bank is refused on the DR side — a withdrawal is a Contra', () => {
    const i = input({
      type: PMTV,
      ledgers: WITH_MORE,
      lines: [line(1, 'DR', L.CASH, 2000), line(2, 'CR', L.HDFC, 2000)],
    });
    derive(i);
    expect(codes(i)).toEqual(['VCH_LEDGER_SIDE']);
    expect(i.ctx.refusals[0].line).toBe(1);
    expect(messages(i)[0]).toMatch(/bank to cash is a Contra/);
  });

  it('PmtV with Cr Sales A/c is refused as the money rule, not as a list of group names', () => {
    const i = input({
      type: PMTV,
      ledgers: WITH_MORE,
      lines: [line(1, 'DR', L.STATIONERY, 2000), line(2, 'CR', SALES, 2000)],
    });
    derive(i);
    expect(codes(i)).toEqual(['VCH_LEDGER_SIDE']);
    expect(i.ctx.refusals[0].line).toBe(2);
    expect(messages(i)[0]).toMatch(/Sales A\/c \(Sales Accounts\) may not be credited on a Payment Voucher — the CR side takes cash or bank only/);
  });

  it('a Contra keeps the group-list message — it has no money side', () => {
    const i = input({
      type: CON,
      ledgers: WITH_MORE,
      lines: [line(1, 'DR', L.CASH, 2000), line(2, 'CR', SALES, 2000)],
    });
    derive(i);
    expect(codes(i)).toEqual(['VCH_LEDGER_SIDE']);
    expect(messages(i)[0]).toMatch(/may not be credited on a Contra/);
    expect(messages(i)[0]).not.toMatch(/cash or bank only/);
  });

  it('Jrl with Dr Cash / Cr Bank still passes — the rule is keyed on nature, and a Journal has no money side', () => {
    const i = input({
      type: JRL,
      lines: [line(1, 'DR', L.CASH, 2000), line(2, 'CR', L.HDFC, 2000)],
    });
    derive(i);
    expect(codes(i)).toEqual([]);
  });
});

describe('derive — multi-party Receipt and Payment (notes 53)', () => {
  const RCPV_MANY = type({ ...RCPV, partyMode: 'MANY' });
  const PMTV_MANY = type({
    typeId: 31,
    typeCode: 'PmtV',
    typeName: 'Payment Voucher',
    nature: 'PAYMENT',
    menuId: 261,
    partyMode: 'MANY',
    partySide: 'DR',
    billwiseMode: 'DEMAND',
    raiseBillType: null,
    drGroups: [],
    crGroups: grp([G.CASH, G.BANK]),
    tdsMode: 'DEDUCT',
  });
  const supplier = (id: string, name: string, extra: Partial<LedgerFacts>) =>
    ledger(
      id,
      name,
      [
        [G.SUPPLIERS, 'Suppliers'],
        [G.SUNDRY_CREDITORS, 'Sundry Creditors'],
        [G.CURRENT_LIABILITIES, 'Current Liabilities'],
      ],
      { isBillByBill: true, ...extra },
    );
  // 194C, but no PAN on file → the 206AA rate.
  const MURUGAN = supplier('l-murugan', 'Murugan Transport', {
    isTdsApplicable: true,
    tdsSection: '194C',
    tdsDeducteeType: 'INDIVIDUAL',
  });
  // Not TDS-applicable: paid as typed.
  const LAKSHMI = supplier('l-lakshmi', 'Lakshmi Stores', {});
  const MANY_LEDGERS = new Map([...LEDGERS, [MURUGAN.ledId, MURUGAN], [LAKSHMI.ledId, LAKSHMI]]);

  const bill = (
    id: string,
    partyId: string,
    side: 'DR' | 'CR',
    amount: number,
    billType = 'SALES',
  ): [string, BillFacts] => [
    `${id}|2026-2027`,
    {
      ablId: id,
      ablAccYear: '2026-2027',
      partyId,
      billType,
      docRefno: id,
      docDate: new Date('2026-08-01T00:00:00Z'),
      side,
      billAmount: D(amount),
      pendingAmount: D(amount),
      isDeleted: false,
      isActive: true,
      companyId: 'c-1',
    },
  ];
  const alloc = (index: number, lineRowNo: number, billId: string, amount: number) => ({
    index,
    lineRowNo,
    billId,
    billAccYear: '2026-2027',
    amount: D(amount),
  });

  // Dr Cash 15,000; Cr Krishna 10,000 (6,000 + 4,000); Cr Ravi 5,000 (one bill).
  const receipt = (raviAllocated: number) =>
    input({
      type: RCPV_MANY,
      lines: [
        line(1, 'DR', L.CASH, 15000),
        line(2, 'CR', L.KRISHNA, 10000),
        line(3, 'CR', L.RAVI, 5000),
      ],
      allocations: [
        alloc(0, 2, 'k-1', 6000),
        alloc(1, 2, 'k-2', 4000),
        alloc(2, 3, 'r-1', raviAllocated),
      ],
      bills: new Map([
        bill('k-1', L.KRISHNA.ledId, 'DR', 6000),
        bill('k-2', L.KRISHNA.ledId, 'DR', 4000),
        bill('r-1', L.RAVI.ledId, 'DR', 5000),
      ]),
    });

  it('a Receipt settles each customer’s bills against that customer’s own line', () => {
    const i = receipt(5000);
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(d.party).toBeNull();
    expect(d.bills).toEqual([]);
    expect(
      d.allocations.map((a) => [a.lineRowNo, a.party.ledId, a.bill.ablId, a.amount.toFixed(2)]),
    ).toEqual([
      [2, L.KRISHNA.ledId, 'k-1', '6000.00'],
      [2, L.KRISHNA.ledId, 'k-2', '4000.00'],
      [3, L.RAVI.ledId, 'r-1', '5000.00'],
    ]);
    expect(d.allocations.every((a) => a.adjType === 'ALLOCATION')).toBe(true);
    expect(d.allocations.every((a) => a.settlementMode === 'CASH')).toBe(true);
    // two parties → no single opposite ledger on the legs
    expect(d.legs.every((l) => l.oppLedgerId === null)).toBe(true);
    expect(toWire('RcpV', '2026-09-15', d).totals).toEqual({
      debit: 15000,
      credit: 15000,
      difference: 0,
    });
  });

  it('a Receipt with one customer short keeps that customer’s remainder as an ADVANCE, and no other (notes 57)', () => {
    const i = receipt(4000);
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(d.bills.map((b) => [b.lineRowNo, b.party.ledId, b.billType, b.side, b.amount.toFixed(2)])).toEqual([
      [3, L.RAVI.ledId, 'ADVANCE', 'CR', '1000.00'],
    ]);
    expect(d.allocations).toHaveLength(3);
    expect(toWire('RcpV', '2026-09-15', d).totals).toEqual({ debit: 15000, credit: 15000, difference: 0 });
  });

  it('a Receipt over-allocated on one customer is refused, naming that customer only (notes 57)', () => {
    const base = receipt(5000);
    const i = input({
      ...base,
      allocations: [...base.allocations, alloc(3, 3, 'r-2', 500)],
      bills: new Map([...base.bills, bill('r-2', L.RAVI.ledId, 'DR', 500)]),
    });
    derive(i);
    expect(codes(i)).toEqual(['VCH_BILLWISE_SHORT']);
    expect(i.ctx.refusals[0].message).toContain(`${L.RAVI.name}: 5500.00 is allocated against a party amount of 5000.00`);
    expect(i.ctx.refusals[0].message).not.toContain(L.KRISHNA.name);
  });

  it('a header party on a multi-party Receipt is refused', () => {
    const i = receipt(5000);
    i.header.partyId = L.KRISHNA.ledId;
    derive(i);
    expect(codes(i)).toEqual(['VCH_PARTY_MODE']);
  });

  // Dr Sundaram 9,800 (net; PAN → 2%), Dr Murugan 8,000 (net; no PAN → 20%),
  // Dr Lakshmi 3,000 (no TDS); Cr HDFC 20,800.
  const payment = (over: Partial<DeriveInput> = {}) =>
    input({
      type: PMTV_MANY,
      ledgers: MANY_LEDGERS,
      lines: [
        line(1, 'DR', L.SUNDARAM, 9800),
        line(2, 'DR', MURUGAN, 8000),
        line(3, 'DR', LAKSHMI, 3000),
        line(4, 'CR', L.HDFC, 20800),
      ],
      allocations: [alloc(0, 1, 's-1', 10000), alloc(1, 2, 'm-1', 10000), alloc(2, 3, 'l-1', 3000)],
      bills: new Map([
        bill('s-1', L.SUNDARAM.ledId, 'CR', 10000, 'PURCHASE'),
        bill('m-1', MURUGAN.ledId, 'CR', 10000, 'PURCHASE'),
        bill('l-1', LAKSHMI.ledId, 'CR', 3000, 'PURCHASE'),
      ]),
      tdsByParty: new Map([
        [L.SUNDARAM.ledId, { rate: TDS_194C, annualBaseSoFar: D(0) }],
        [MURUGAN.ledId, { rate: TDS_194C, annualBaseSoFar: D(0) }],
      ]),
      ...over,
    });

  it('a Payment deducts TDS per party line: grossed up, one TDS leg and one register entry each', () => {
    const i = payment();
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(d.tds).toBeNull();
    // each TDS party's line is grossed up to what discharges the bill
    expect(legOf(d, L.SUNDARAM.ledId)?.amount.toFixed(2)).toBe('10000.00');
    expect(legOf(d, MURUGAN.ledId)?.amount.toFixed(2)).toBe('10000.00');
    expect(legOf(d, LAKSHMI.ledId)?.amount.toFixed(2)).toBe('3000.00');
    const tdsLegs = d.legs.filter((l) => l.source === 'TDS');
    expect(tdsLegs.map((l) => [l.drCr, l.ledger.ledId, l.amount.toFixed(2), l.fromRows])).toEqual([
      ['CR', L.TDS_PAYABLE.ledId, '200.00', [1]],
      ['CR', L.TDS_PAYABLE.ledId, '2000.00', [2]],
    ]);
    expect(
      d.tdsLines.map((t) => [
        t.party.ledId,
        t.lineRowNo,
        t.rateSource,
        t.rate.toString(),
        t.base.toFixed(2),
        t.tax.toFixed(2),
        t.deducted,
      ]),
    ).toEqual([
      [L.SUNDARAM.ledId, 1, 'MASTER', '2', '10000.00', '200.00', true],
      [MURUGAN.ledId, 2, 'NO_PAN', '20', '10000.00', '2000.00', true],
    ]);
    const wire = toWire('PmtV', '2026-09-15', d);
    expect(wire.totals).toEqual({ debit: 23000, credit: 23000, difference: 0 });
    expect(wire.tds).toBeNull();
    expect(wire.tdsLines.map((t) => [t.lineRowNo, t.partyId, t.base, t.tax])).toEqual([
      [1, L.SUNDARAM.ledId, 10000, 200],
      [2, MURUGAN.ledId, 10000, 2000],
    ]);
  });

  it('a Payment allocated only the net on a TDS party line keeps gross − allocated as a DR ADVANCE on the supplier (notes 57)', () => {
    const i = payment({
      allocations: [alloc(0, 1, 's-1', 9800), alloc(1, 2, 'm-1', 10000), alloc(2, 3, 'l-1', 3000)],
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    // the leg is the GROSS 10,000; 9,800 set against the bill; 200 we still owe
    expect(legOf(d, L.SUNDARAM.ledId)?.amount.toFixed(2)).toBe('10000.00');
    expect(d.bills.map((b) => [b.lineRowNo, b.party.ledId, b.billType, b.side, b.amount.toFixed(2), b.isAdvance])).toEqual([
      [1, L.SUNDARAM.ledId, 'ADVANCE', 'DR', '200.00', true],
    ]);
    // the deduction is the leg's, unchanged by how it was allocated
    expect(d.tdsLines.find((t) => t.party.ledId === L.SUNDARAM.ledId)?.tax.toFixed(2)).toBe('200.00');

    const strict = payment({
      allocations: [alloc(0, 1, 's-1', 9800), alloc(1, 2, 'm-1', 10000), alloc(2, 3, 'l-1', 3000)],
      allowAdvance: false,
    });
    derive(strict);
    expect(codes(strict)).toEqual(['VCH_BILLWISE_SHORT']);
    expect(strict.ctx.refusals[0].message).toContain(L.SUNDARAM.name);
  });

  it('thresholds are judged per party: one under deducts nothing and WARNs, the other still deducts', () => {
    const high: TdsRateFacts = {
      ...TDS_194C,
      thresholdSingle: D(30000),
      thresholdAnnual: D(100000),
    };
    const i = payment({
      allocations: [alloc(0, 1, 's-1', 10000), alloc(1, 2, 'm-1', 8000), alloc(2, 3, 'l-1', 3000)],
      tdsByParty: new Map([
        // Sundaram is past the annual threshold already this year
        [L.SUNDARAM.ledId, { rate: high, annualBaseSoFar: D(95000) }],
        [MURUGAN.ledId, { rate: high, annualBaseSoFar: D(0) }],
      ]),
      lines: [
        line(1, 'DR', L.SUNDARAM, 9800),
        line(2, 'DR', MURUGAN, 8000),
        line(3, 'DR', LAKSHMI, 3000),
        line(4, 'CR', L.HDFC, 20800),
      ],
    });
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    expect(i.ctx.warnings.map((w) => [w.code, w.line])).toEqual([['VCH_TDS_BELOW_THRESHOLD', 2]]);
    expect(legOf(d, MURUGAN.ledId)?.amount.toFixed(2)).toBe('8000.00');
    expect(
      d.tdsLines.map((t) => [t.party.ledId, t.rateSource, t.base.toFixed(2), t.tax.toFixed(2)]),
    ).toEqual([
      [L.SUNDARAM.ledId, 'MASTER', '10000.00', '200.00'],
      [MURUGAN.ledId, 'BELOW_THRESHOLD', '8000.00', '0.00'],
    ]);
  });

  it('a TDS party with no rate in force is refused on its own line', () => {
    const i = payment({
      tdsByParty: new Map([
        [L.SUNDARAM.ledId, { rate: TDS_194C, annualBaseSoFar: D(0) }],
        [MURUGAN.ledId, { rate: null, annualBaseSoFar: D(0) }],
      ]),
    });
    derive(i);
    expect(i.ctx.refusals.map((r) => [r.code, r.line])).toContainEqual(['VCH_TDS_RATE_MISSING', 2]);
  });
});

// ─── notes (54) · instruments on a Receipt Voucher ───────────────────────────

const RCPV_INS = type({
  ...RCPV,
  instruments: true,
  partyMode: 'MANY',
  partySide: 'CR',
  billwiseMode: 'DEMAND',
  drGroups: [],
  crGroups: [],
});

function tender(
  id: string,
  name: string,
  typeId: number,
  ledger: LedgerFacts,
  extra: Partial<TenderFacts> = {},
): TenderFacts {
  return {
    tndId: id,
    name,
    shortName: name,
    typeId,
    typeName: name,
    isCash: typeId === 1,
    needsRef: typeId !== 1,
    ledgerId: ledger.ledId,
    ledgerName: ledger.name,
    settlementLedgerId: null,
    isActive: true,
    isDeleted: false,
    companyId: 'c-1',
    branchId: null,
    hotkey: null,
    displayPosition: 0,
    ...extra,
  };
}
const T = {
  CASH: tender('t-cash', 'CASH', 1, L.CASH),
  CHEQUE: tender('t-chq', 'CHEQUE', 5, L.CHEQUES_IN_HAND),
  UPI: tender('t-upi', 'UPI', 3, L.HDFC),
  TEMP_CR: tender('t-tmp', 'TEMP.CR', 8, L.HDFC),
};
const TENDERS = new Map(Object.values(T).map((t) => [t.tndId, t]));

const bill = (id: string, party: LedgerFacts, amount: number): BillFacts => ({
  ablId: id,
  ablAccYear: '2026-2027',
  partyId: party.ledId,
  billType: 'JOURNAL',
  docRefno: id,
  docDate: new Date('2026-08-01T00:00:00Z'),
  side: 'DR',
  billAmount: D(amount),
  pendingAmount: D(amount),
  isDeleted: false,
  isActive: true,
  companyId: 'c-1',
});

describe('derive — notes (54) instruments', () => {
  const run = (over: Partial<DeriveInput> = {}) =>
    input({
      type: RCPV_INS,
      tenders: TENDERS,
      lines: [
        line(1, 'CR', L.KRISHNA, 6000, {
          instrument: {
            tenderId: 't-chq',
            refNo: '445123',
            instrumentDate: '2026-09-15',
            bankName: 'KVB',
            cheque: null,
          },
        }),
        line(2, 'CR', L.RAVI, 5000, {
          instrument: {
            tenderId: 't-cash',
            refNo: null,
            instrumentDate: null,
            bankName: null,
            cheque: null,
          },
        }),
        line(3, 'CR', L.SUNDARAM, 4000, {
          instrument: {
            tenderId: 't-chq',
            refNo: '445124',
            instrumentDate: '2026-10-05',
            bankName: 'KVB',
            cheque: { drawerName: 'S', bankBranch: null, ifsc: null, micr: null },
          },
        }),
      ],
      allocations: [
        { index: 0, lineRowNo: 1, billId: 'b-k', billAccYear: '2026-2027', amount: D(6000) },
        { index: 1, lineRowNo: 2, billId: 'b-r', billAccYear: '2026-2027', amount: D(5000) },
        { index: 2, lineRowNo: 3, billId: 'b-s', billAccYear: '2026-2027', amount: D(4000) },
      ],
      bills: new Map([
        ['b-k|2026-2027', bill('b-k', L.KRISHNA, 6000)],
        ['b-r|2026-2027', bill('b-r', L.RAVI, 5000)],
        ['b-s|2026-2027', bill('b-s', L.SUNDARAM, 4000)],
      ]),
      ...over,
    });

  it('generates one Dr leg per instrument from the tender’s ledger; a post-dated cheque marks its pair', () => {
    const i = run();
    const d = derive(i);
    expect(codes(i)).toEqual([]);
    const ins = d.legs.filter((l) => l.source === 'INSTRUMENT');
    expect(ins.map((l) => [l.drCr, l.ledger.ledId, l.amount.toNumber(), l.postDated])).toEqual([
      ['DR', L.CHEQUES_IN_HAND.ledId, 6000, false],
      ['DR', L.CASH.ledId, 5000, false],
      ['DR', L.CHEQUES_IN_HAND.ledId, 4000, true],
    ]);
    expect(ins.every((l) => l.generated)).toBe(true);
    // the party line and its Dr leg name each other
    expect(legOf(d, L.KRISHNA.ledId)?.oppLedgerId).toBe(L.CHEQUES_IN_HAND.ledId);
    expect(ins[0].oppLedgerId).toBe(L.KRISHNA.ledId);
    // totals are TODAY's voucher only
    expect(d.totals.debit.toNumber()).toBe(11000);
    expect(d.totals.credit.toNumber()).toBe(11000);
    expect(d.totals.difference.isZero()).toBe(true);
    expect(d.postDated).toHaveLength(1);
    expect(d.postDated[0]).toMatchObject({
      lineRowNo: 3,
      postsOn: '2026-10-05',
      accYear: '2026-2027',
    });
    expect(d.postDated[0].amount.toNumber()).toBe(4000);
    // allocations: the cheque's settle as CHEQUE, cash as CASH; the post-dated one counts from its date
    expect(
      d.allocations.map((a) => [a.lineRowNo, a.settlementMode, a.postDated, a.adjDate]),
    ).toEqual([
      [1, 'CHEQUE', false, '2026-09-15'],
      [2, 'CASH', false, '2026-09-15'],
      [3, 'CHEQUE', true, '2026-10-05'],
    ]);
    const w = toWire('RcpV', '2026-09-15', d);
    expect(w.postDated).toEqual([
      expect.objectContaining({
        lineRowNo: 3,
        partyId: L.SUNDARAM.ledId,
        amount: 4000,
        postsOn: '2026-10-05',
        refNo: '445124',
      }),
    ]);
    expect(w.legs.find((l) => l.source === 'INSTRUMENT')?.instrument).toMatchObject({
      tenderName: 'CHEQUE',
      isCheque: true,
      refNo: '445123',
    });
  });

  it('a typed Dr cash line still works beside instrument lines (the older shape)', () => {
    const i = input({
      type: RCPV_INS,
      tenders: TENDERS,
      lines: [line(1, 'DR', L.CASH, 500), line(2, 'CR', L.RAVI, 500)],
    });
    const d = derive(i);
    // the unallocated party line is kept as an advance (notes 57); nothing about the instrument is refused
    expect(codes(i)).toEqual([]);
    expect(d.bills.map((b) => [b.party.ledId, b.billType, b.amount.toFixed(2)])).toEqual([[L.RAVI.ledId, 'ADVANCE', '500.00']]);
    expect(d.legs.filter((l) => l.source === 'INSTRUMENT')).toHaveLength(0);
    expect(d.totals.debit.toNumber()).toBe(500);
  });

  it('refuses an instrument on a type without them, on the wrong side, and a credit-shaped tender', () => {
    const jrl = input({
      type: JRL,
      tenders: TENDERS,
      lines: [
        line(1, 'DR', L.RAVI, 100, {
          instrument: {
            tenderId: 't-cash',
            refNo: null,
            instrumentDate: null,
            bankName: null,
            cheque: null,
          },
        }),
        line(2, 'CR', L.KRISHNA, 100),
      ],
    });
    derive(jrl);
    expect(codes(jrl)).toContain('VCH_INSTRUMENT_NOT_ALLOWED');

    const side = run({
      lines: [
        line(1, 'DR', L.CASH, 100, {
          instrument: {
            tenderId: 't-cash',
            refNo: null,
            instrumentDate: null,
            bankName: null,
            cheque: null,
          },
        }),
        line(2, 'CR', L.RAVI, 100),
      ],
      allocations: [],
    });
    derive(side);
    expect(codes(side)).toContain('VCH_INSTRUMENT_NOT_ALLOWED');

    const tmp = run({
      lines: [
        line(1, 'CR', L.RAVI, 100, {
          instrument: {
            tenderId: 't-tmp',
            refNo: 'x',
            instrumentDate: null,
            bankName: null,
            cheque: null,
          },
        }),
      ],
      allocations: [],
    });
    derive(tmp);
    expect(codes(tmp)).toContain('VCH_INSTRUMENT_TENDER');

    const upi = run({
      lines: [
        line(1, 'CR', L.RAVI, 100, {
          instrument: {
            tenderId: 't-upi',
            refNo: null,
            instrumentDate: null,
            bankName: null,
            cheque: null,
          },
        }),
      ],
      allocations: [],
    });
    derive(upi);
    expect(codes(upi)).toContain('VCH_INSTRUMENT_TENDER');
  });

  it('a cheque needs its date, number and bank; a number already registered is refused; all post-dated posts nothing', () => {
    const missing = run({
      lines: [
        line(1, 'CR', L.RAVI, 100, {
          instrument: {
            tenderId: 't-chq',
            refNo: '9',
            instrumentDate: null,
            bankName: null,
            cheque: null,
          },
        }),
      ],
      allocations: [],
    });
    derive(missing);
    expect(codes(missing)).toContain('VCH_CHEQUE_DETAILS');
    expect(missing.ctx.refusals[0].message).toMatch(/instrumentDate, bankName/);

    const dup = run({ registeredCheques: new Set([`${L.KRISHNA.ledId}|445123|2026-2027`]) });
    derive(dup);
    expect(codes(dup)).toEqual(['VCH_CHEQUE_DETAILS']);

    const allPdc = run({
      lines: [
        line(3, 'CR', L.SUNDARAM, 4000, {
          instrument: {
            tenderId: 't-chq',
            refNo: '445124',
            instrumentDate: '2026-10-05',
            bankName: 'KVB',
            cheque: null,
          },
        }),
      ],
      allocations: [
        { index: 0, lineRowNo: 3, billId: 'b-s', billAccYear: '2026-2027', amount: D(4000) },
      ],
    });
    derive(allPdc);
    expect(codes(allPdc)).toContain('VCH_NO_LINES');

    const locked = run({ closedYears: new Map([['2026-2027', 'locked up to 2026-12-31']]) });
    derive(locked);
    expect(codes(locked)).toContain('VCH_PERIOD_LOCKED');
  });
});
