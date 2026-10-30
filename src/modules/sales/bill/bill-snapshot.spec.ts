import { partyDebitOf, snapshotFromDto } from './bill-snapshot';
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
