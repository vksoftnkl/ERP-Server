import { Prisma } from '@prisma/client';
import { TENDER_TYPE } from '../posting/sales-doc.utils';
import {
  retireCounterAllocations,
  syncCounterAllocations,
  type CounterAllocationScope,
} from './bill-counter-allocation.helper';

const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46b401';
const ABL_ID = '019c6f6c-be87-7a11-8905-36092c46b402';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46b403';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46b404';
const ACTOR_ID = '019c6f6c-be87-7a11-8905-36092c46b405';
const SESSION_ID = '019c6f6c-be87-7a11-8905-36092c46b406';
const VOUCHER_ID = '019c6f6c-be87-7a11-8905-36092c46b407';
const APD_ID = '019c6f6c-be87-7a11-8905-36092c46b408';
const ACC_YEAR = '2026-2027';
const NOW = new Date('2026-10-19T06:00:00.000Z');
const NIL = '00000000-0000-0000-0000-000000000000';

const td = (n: number) => `019c6f6c-be87-7a11-8905-36092c46b4${String(n).padStart(2, '0')}`.slice(0, 36);

const tenderRow = (id: string, rowNo: number, typeId: number, amount: string, extra: object = {}) => ({
  td_id: id,
  td_acc_year: ACC_YEAR,
  td_row_no: rowNo,
  td_tender_type_id: typeId,
  td_amount: new Prisma.Decimal(amount),
  td_is_voided: false,
  td_is_deleted: false,
  apd_id: null,
  apd_acc_year: null,
  ...extra,
});

interface Raw {
  tenders: unknown[];
  counterRows: unknown[];
  room: Prisma.Decimal | null;
}

describe('bill-counter-allocation.helper', () => {
  let raw: Raw;
  let adjustment: { updateMany: jest.Mock; create: jest.Mock; aggregate: jest.Mock };
  let queryRaw: jest.Mock;
  let tx: Prisma.TransactionClient;
  let created: number;

  const scopeOf = (overrides: Partial<CounterAllocationScope> = {}): CounterAllocationScope => ({
    bill: {
      sbId: BILL_ID,
      sbAccYear: ACC_YEAR,
      sbCompanyId: 'company',
      sbBranchId: 'branch',
      sbTenantId: null,
      sbBillDate: new Date('2026-10-19T00:00:00.000Z'),
      sbUserId: USER_ID,
      sbSessionId: SESSION_ID,
    },
    abl: { ablId: ABL_ID, ablAccYear: ACC_YEAR },
    partyId: PARTY_ID,
    voucherFor: () => ({ voucherId: VOUCHER_ID, accYear: ACC_YEAR }),
    actor: ACTOR_ID,
    now: NOW,
    ...overrides,
  });

  const createdData = () =>
    adjustment.create.mock.calls.map(([args]) => (args as { data: Record<string, unknown> }).data);

  beforeEach(() => {
    created = 0;
    raw = { tenders: [], counterRows: [], room: new Prisma.Decimal('1000') };
    queryRaw = jest.fn((strings: TemplateStringsArray) => {
      const sql = strings.join('?');
      if (sql.includes('LEFT JOIN LATERAL')) return Promise.resolve(raw.tenders);
      if (sql.includes('AS room')) return Promise.resolve([{ room: raw.room }]);
      if (sql.includes('SELECT abj_id, abj_tender_id')) return Promise.resolve(raw.counterRows);
      return Promise.reject(new Error(`unexpected SQL: ${sql}`));
    });
    adjustment = {
      updateMany: jest.fn().mockResolvedValue({ count: 0 }),
      create: jest.fn(async () => ({ abjId: `abj-${++created}` })),
      aggregate: jest.fn().mockResolvedValue({ _max: { abjRowNo: 4 } }),
    };
    tx = { $queryRaw: queryRaw, accBillAdjustment: adjustment } as unknown as Prisma.TransactionClient;
  });

  describe('syncCounterAllocations', () => {
    it('writes one CR ALLOCATION row per settling tender, numbered after the last row', async () => {
      raw.tenders = [
        tenderRow(td(11), 1, TENDER_TYPE.CASH, '300'),
        tenderRow(td(12), 2, TENDER_TYPE.CHEQUE, '200', { apd_id: APD_ID, apd_acc_year: ACC_YEAR }),
      ];

      const result = await syncCounterAllocations(tx, scopeOf());

      expect(createdData()).toEqual([
        expect.objectContaining({
          abjBillId: ABL_ID,
          abjBillAccYear: ACC_YEAR,
          abjPartyId: PARTY_ID,
          abjRowNo: 5,
          abjVoucherId: VOUCHER_ID,
          abjAdjType: 'ALLOCATION',
          abjDrCr: 'CR',
          abjAmount: new Prisma.Decimal('300'),
          abjSettlementMode: 'CASH',
          abjTenderId: td(11),
          abjChequeId: null,
          abjChequeAccYear: null,
          abjRemarks: 'Paid at the counter',
          abjUserId: USER_ID,
          abjSessionId: SESSION_ID,
          abjCreatedBy: ACTOR_ID,
        }),
        expect.objectContaining({
          abjRowNo: 6,
          abjSettlementMode: 'CHEQUE',
          abjChequeId: APD_ID,
          abjChequeAccYear: ACC_YEAR,
        }),
      ]);
      expect(result).toEqual({
        added: [
          { abjId: 'abj-1', tdId: td(11), amount: new Prisma.Decimal('300'), chequeId: null },
          { abjId: 'abj-2', tdId: td(12), amount: new Prisma.Decimal('200'), chequeId: APD_ID },
        ],
        dropped: 0,
        capped: [],
      });
    });

    it('allocates nothing for what moved no money, nor for voided, deleted or zero rows', async () => {
      raw.tenders = [
        tenderRow(td(21), 1, TENDER_TYPE.CREDIT, '100'),
        tenderRow(td(22), 2, TENDER_TYPE.TEMP_CREDIT, '100'),
        tenderRow(td(23), 3, TENDER_TYPE.RRN, '100'),
        tenderRow(td(24), 4, TENDER_TYPE.CASH, '100', { td_is_voided: true }),
        tenderRow(td(25), 5, TENDER_TYPE.CASH, '100', { td_is_deleted: true }),
        tenderRow(td(26), 6, TENDER_TYPE.CASH, '0'),
      ];

      await expect(syncCounterAllocations(tx, scopeOf())).resolves.toEqual({
        added: [],
        dropped: 0,
        capped: [],
      });
      expect(adjustment.create).not.toHaveBeenCalled();
    });

    it('never over-allocates: the last tender is cut to the headroom left, and one past it is skipped', async () => {
      raw.room = new Prisma.Decimal('450');
      raw.tenders = [
        tenderRow(td(31), 1, TENDER_TYPE.CASH, '300'),
        tenderRow(td(32), 2, TENDER_TYPE.UPI, '200'),
        tenderRow(td(33), 3, TENDER_TYPE.CARD, '50'),
      ];

      const result = await syncCounterAllocations(tx, scopeOf());

      expect(createdData().map((d) => [d.abjTenderId, d.abjAmount])).toEqual([
        [td(31), new Prisma.Decimal('300')],
        [td(32), new Prisma.Decimal('150')],
      ]);
      expect(result.capped).toEqual([
        { tdId: td(32), wanted: new Prisma.Decimal('200'), written: new Prisma.Decimal('150') },
        { tdId: td(33), wanted: new Prisma.Decimal('50'), written: new Prisma.Decimal('0') },
      ]);
    });

    it('takes the smaller of the cap and the headroom', async () => {
      raw.tenders = [tenderRow(td(41), 1, TENDER_TYPE.CASH, '500')];

      await syncCounterAllocations(tx, scopeOf({ cap: new Prisma.Decimal('120') }));

      expect(createdData()[0].abjAmount).toEqual(new Prisma.Decimal('120'));
    });

    it('reads a negative headroom as none', async () => {
      raw.room = new Prisma.Decimal('-10');
      raw.tenders = [tenderRow(td(42), 1, TENDER_TYPE.CASH, '500')];

      const result = await syncCounterAllocations(tx, scopeOf());

      expect(adjustment.create).not.toHaveBeenCalled();
      expect(result.capped[0].written).toEqual(new Prisma.Decimal('0'));
    });

    it('leaves a tender that already has a row alone, even one a bounce reversed', async () => {
      raw.tenders = [tenderRow(td(51), 1, TENDER_TYPE.CHEQUE, '200')];
      raw.counterRows = [
        { abj_id: 'abj-orig', abj_tender_id: td(51), abj_reversal_of_id: null },
        { abj_id: 'abj-rev', abj_tender_id: td(51), abj_reversal_of_id: 'abj-orig' },
      ];

      await expect(syncCounterAllocations(tx, scopeOf())).resolves.toEqual({
        added: [],
        dropped: 0,
        capped: [],
      });
      expect(adjustment.updateMany).not.toHaveBeenCalled();
      expect(adjustment.create).not.toHaveBeenCalled();
    });

    it('drops the row of a tender that was voided, with any reversal of it', async () => {
      raw.tenders = [tenderRow(td(61), 1, TENDER_TYPE.UPI, '200', { td_is_voided: true })];
      raw.counterRows = [{ abj_id: 'abj-upi', abj_tender_id: td(61), abj_reversal_of_id: null }];

      const result = await syncCounterAllocations(tx, scopeOf());

      expect(result.dropped).toBe(1);
      expect(adjustment.updateMany).toHaveBeenCalledWith({
        where: {
          OR: [{ abjId: { in: ['abj-upi'] } }, { abjReversalOfId: { in: ['abj-upi'] } }],
          abjIsDeleted: false,
        },
        data: {
          abjIsDeleted: true,
          abjRemarks: 'Tender no longer on the bill',
          abjModifiedOn: NOW,
          abjModifiedBy: ACTOR_ID,
        },
      });
    });

    it('names no voucher when the scope has none for the row, keeping the bill year', async () => {
      raw.tenders = [tenderRow(td(71), 1, TENDER_TYPE.WALLET, '80')];

      await syncCounterAllocations(tx, scopeOf({ voucherFor: () => null }));

      expect(createdData()[0]).toMatchObject({
        abjAccYear: ACC_YEAR,
        abjVoucherId: null,
        abjVoucherAccYear: null,
        abjSettlementMode: 'WALLET',
      });
    });

    it('files a tender type it has no mode for as MIXED', async () => {
      raw.tenders = [tenderRow(td(72), 1, 99, '80')];

      await syncCounterAllocations(tx, scopeOf());

      expect(createdData()[0].abjSettlementMode).toBe('MIXED');
    });

    it('starts numbering at 1 on a bill with no rows yet', async () => {
      adjustment.aggregate.mockResolvedValue({ _max: { abjRowNo: null } });
      raw.tenders = [tenderRow(td(73), 1, TENDER_TYPE.CASH, '80')];

      await syncCounterAllocations(tx, scopeOf());

      expect(createdData()[0].abjRowNo).toBe(1);
    });

    it('falls back from a login-name user to the actor, then to the nil uuid; a bad session to null', async () => {
      raw.tenders = [tenderRow(td(74), 1, TENDER_TYPE.CASH, '80')];
      const bill = { ...scopeOf().bill, sbUserId: 'raman', sbSessionId: 'not-a-uuid' };

      await syncCounterAllocations(tx, scopeOf({ bill }));
      await syncCounterAllocations(tx, scopeOf({ bill, actor: 'raman' }));

      expect(createdData().map((d) => [d.abjUserId, d.abjSessionId])).toEqual([
        [ACTOR_ID, null],
        [NIL, null],
      ]);
    });
  });

  describe('retireCounterAllocations', () => {
    it('does nothing for a bill with no tender rows', async () => {
      raw.tenders = [];

      await expect(
        retireCounterAllocations(tx, { sbId: BILL_ID, sbAccYear: ACC_YEAR }, { ablId: ABL_ID, ablAccYear: ACC_YEAR }, ACTOR_ID, NOW),
      ).resolves.toBe(0);
      expect(queryRaw).toHaveBeenCalledTimes(1);
      expect(adjustment.updateMany).not.toHaveBeenCalled();
    });

    it('soft-deletes every counter row, reversals included', async () => {
      raw.tenders = [tenderRow(td(81), 1, TENDER_TYPE.CASH, '100')];
      raw.counterRows = [
        { abj_id: 'abj-a', abj_tender_id: td(81), abj_reversal_of_id: null },
        { abj_id: 'abj-b', abj_tender_id: td(81), abj_reversal_of_id: 'abj-a' },
      ];
      adjustment.updateMany.mockResolvedValue({ count: 2 });

      await expect(
        retireCounterAllocations(tx, { sbId: BILL_ID, sbAccYear: ACC_YEAR }, { ablId: ABL_ID, ablAccYear: ACC_YEAR }, ACTOR_ID, NOW),
      ).resolves.toBe(2);
      expect(adjustment.updateMany).toHaveBeenCalledWith({
        where: { abjId: { in: ['abj-a', 'abj-b'] }, abjIsDeleted: false },
        data: { abjIsDeleted: true, abjModifiedOn: NOW, abjModifiedBy: ACTOR_ID },
      });
    });
  });
});
