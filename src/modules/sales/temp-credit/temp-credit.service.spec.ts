import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { appendTempCreditStatus } from '../../../common/txn-status-log/temp-credit-status';
import { TxnStatusEvent } from '../../../common/txn-status-log/txn-status-log.helper';
import { TempCreditService } from './temp-credit.service';
import { TempCreditErrorCode } from './types/temp-credit-error-codes';

jest.mock('../../../common/txn-status-log/temp-credit-status', () => ({
  appendTempCreditStatus: jest.fn().mockResolvedValue(undefined),
}));

const ATC_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e303';
const PARTY_ID = '019c6f6c-be87-7a11-8905-36092c46e304';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e305';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e306';
const ACC_YEAR = '2026-2027';
/** 11:30 IST on 19 Oct 2026 — isoToday() reads the UTC date, 2026-10-19. */
const NOW = new Date('2026-10-19T06:00:00.000Z');

/** One row of the open-credits query, as $queryRaw hands it back. */
const gridRow = (overrides: Record<string, unknown> = {}) => ({
  atc_id: ATC_ID,
  atc_acc_year: `${ACC_YEAR} `,
  atc_party_id: PARTY_ID,
  led_name: 'Walk-in',
  atc_src_doc_id: BILL_ID,
  atc_bill_refno: 'SB/0042',
  atc_bill_date: new Date('2026-10-01T00:00:00.000Z'),
  atc_bill_amount: new Prisma.Decimal('1250.50'),
  atc_name: 'Ravi',
  atc_mobile: '9840000001',
  atc_place: 'Anna Nagar',
  atc_days: 10,
  atc_due_date: new Date('2026-10-11T00:00:00.000Z'),
  atc_credit_amount: new Prisma.Decimal('500.00'),
  atc_balance_amount: new Prisma.Decimal('200.25'),
  atc_status: 'PARTIAL',
  atc_promise_date: null,
  atc_followup_on: null,
  atc_remarks: null,
  atc_branch_id: BRANCH_ID,
  ...overrides,
});

/** The register row the follow-up and delete read. */
const creditRow = (overrides: Record<string, unknown> = {}) => ({
  atcId: ATC_ID,
  atcAccYear: ACC_YEAR,
  atcCompanyId: COMPANY_ID,
  atcBranchId: BRANCH_ID,
  atcTenantId: null,
  atcBillRefno: 'SB/0042',
  atcStatus: 'OPEN',
  atcBalanceAmount: new Prisma.Decimal('250'),
  atcPromiseDate: new Date('2026-10-25T00:00:00.000Z'),
  atcFollowupOn: null,
  atcRemarks: 'Will pay Friday',
  atcIsDeleted: false,
  ...overrides,
});

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

type PrismaMock = {
  $queryRaw: jest.Mock;
  accTempCredit: { findFirst: jest.Mock; update: jest.Mock };
  $transaction: jest.Mock;
};

describe('TempCreditService', () => {
  let prisma: PrismaMock;
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: TempCreditService;
  const appendStatus = appendTempCreditStatus as jest.Mock;

  beforeEach(() => {
    jest.useFakeTimers({ now: NOW, doNotFake: ['nextTick', 'setImmediate'] });
    appendStatus.mockClear();
    prisma = {
      $queryRaw: jest.fn().mockResolvedValue([]),
      accTempCredit: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
          ...creditRow(),
          ...data,
        })),
      },
      $transaction: jest.fn(async (callback: (tx: PrismaMock) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new TempCreditService(
      prisma as unknown as PrismaService,
      context as never,
      audit as never,
    );
  });

  afterEach(() => jest.useRealTimers());

  /** The values bound into the tagged-template query, in order. */
  const boundValues = () => (prisma.$queryRaw.mock.calls[0] as unknown[]).slice(1);
  const auditEntry = () => audit.logEntityChange.mock.calls[0][0] as Record<string, unknown>;

  describe('open', () => {
    it('reads OPEN and PARTIAL credits of the company by default, as of today', async () => {
      await service.open({ companyId: COMPANY_ID });

      expect(boundValues()).toEqual([
        COMPANY_ID,
        null,
        null,
        ['OPEN', 'PARTIAL'],
        expect.anything(),
        false,
        '2026-10-19',
      ]);
    });

    it('takes a comma list of statuses, upper-cased and with blanks dropped', async () => {
      await service.open({
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        status: ' settled , written_off ,',
        overdueOnly: true,
      });

      expect(boundValues()).toEqual([
        COMPANY_ID,
        BRANCH_ID,
        BRANCH_ID,
        ['SETTLED', 'WRITTEN_OFF'],
        expect.anything(),
        true,
        '2026-10-19',
      ]);
    });

    it('turns each row into the grid shape, money as plain numbers on the wire', async () => {
      prisma.$queryRaw.mockResolvedValue([
        gridRow({
          atc_promise_date: new Date('2026-10-22T00:00:00.000Z'),
          atc_followup_on: new Date('2026-10-18T09:15:00.000Z'),
          atc_remarks: 'Called',
        }),
      ]);

      await expect(service.open({ companyId: COMPANY_ID })).resolves.toEqual([
        {
          atcId: ATC_ID,
          atcAccYear: ACC_YEAR,
          partyId: PARTY_ID,
          partyName: 'Walk-in',
          billId: BILL_ID,
          billRefno: 'SB/0042',
          billDate: '2026-10-01',
          billAmount: 1250.5,
          name: 'Ravi',
          mobile: '9840000001',
          place: 'Anna Nagar',
          days: 10,
          dueDate: '2026-10-11',
          creditAmount: 500,
          balance: 200.25,
          status: 'PARTIAL',
          daysOverdue: 8,
          promiseDate: '2026-10-22',
          followupOn: '2026-10-18T09:15:00.000Z',
          remarks: 'Called',
          branchId: BRANCH_ID,
        },
      ]);
    });

    it('counts no overdue days on a credit with nothing left to pay', async () => {
      prisma.$queryRaw.mockResolvedValue([
        gridRow({ atc_balance_amount: new Prisma.Decimal(0), atc_status: 'SETTLED' }),
      ]);

      const [row] = await service.open({ companyId: COMPANY_ID });

      expect(row.daysOverdue).toBe(0);
    });

    it('counts no overdue days before the due date', async () => {
      prisma.$queryRaw.mockResolvedValue([
        gridRow({ atc_due_date: new Date('2026-10-30T00:00:00.000Z') }),
      ]);

      const [row] = await service.open({ companyId: COMPANY_ID });

      expect(row.daysOverdue).toBe(0);
    });
  });

  describe('followUp', () => {
    const followUpDto = { atcId: ATC_ID, atcAccYear: ACC_YEAR, remarks: 'Promised Monday' };

    it('refuses a credit that is not on the register', async () => {
      const refusal = await refusalOf(service.followUp(followUpDto));

      expect(prisma.accTempCredit.findFirst).toHaveBeenCalledWith({
        where: { atcId: ATC_ID, atcAccYear: ACC_YEAR, atcIsDeleted: false },
      });
      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'atcId', code: TempCreditErrorCode.NOT_FOUND }] },
      });
      expect(prisma.accTempCredit.update).not.toHaveBeenCalled();
    });

    it('records the promise date, the remark and who followed up', async () => {
      prisma.accTempCredit.findFirst.mockResolvedValue(creditRow());

      const result = await service.followUp({ ...followUpDto, promiseDate: '2026-10-26' });

      expect(prisma.accTempCredit.update).toHaveBeenCalledWith({
        where: { atcId_atcAccYear: { atcId: ATC_ID, atcAccYear: ACC_YEAR } },
        data: {
          atcPromiseDate: new Date('2026-10-26T00:00:00Z'),
          atcFollowupOn: NOW,
          atcFollowupBy: USER_ID,
          atcRemarks: 'Promised Monday',
          atcModifiedOn: NOW,
          atcModifiedBy: USER_ID,
        },
      });
      expect(result).toEqual({
        atcId: ATC_ID,
        promiseDate: '2026-10-26',
        followupOn: NOW.toISOString(),
        remarks: 'Promised Monday',
      });
      expect(auditEntry()).toMatchObject({
        action: 'update',
        tableName: 'acc_temp_credit',
        pk: ATC_ID,
        entityId: ATC_ID,
        displayName: 'SB/0042',
        originalRecord: { atcPromiseDate: '2026-10-25', atcRemarks: 'Will pay Friday' },
        modifiedRecord: { atcPromiseDate: '2026-10-26', atcRemarks: 'Promised Monday' },
        notes: 'Follow-up recorded: Promised Monday',
      });
    });

    it('keeps the stored promise date when the follow-up sends none', async () => {
      prisma.accTempCredit.findFirst.mockResolvedValue(creditRow());

      await service.followUp(followUpDto);

      expect(prisma.accTempCredit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            atcPromiseDate: new Date('2026-10-25T00:00:00.000Z'),
          }) as object,
        }),
      );
    });

    it('stamps a non-uuid user only as the modifier, never as the follow-up user', async () => {
      prisma.accTempCredit.findFirst.mockResolvedValue(creditRow());
      context.getUserId.mockReturnValue('admin');

      await service.followUp(followUpDto);

      expect(prisma.accTempCredit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ atcFollowupBy: null, atcModifiedBy: 'admin' }) as object,
        }),
      );
    });

    it('stamps SYSTEM when nobody is logged in', async () => {
      prisma.accTempCredit.findFirst.mockResolvedValue(creditRow({ atcBillRefno: null }));
      context.getUserId.mockReturnValue(null);

      await service.followUp(followUpDto);

      expect(prisma.accTempCredit.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ atcFollowupBy: null, atcModifiedBy: 'SYSTEM' }) as object,
        }),
      );
      expect(auditEntry()).toMatchObject({ userId: 'SYSTEM', displayName: ATC_ID });
    });
  });

  describe('remove', () => {
    const removeDto = { atcId: ATC_ID, atcAccYear: ACC_YEAR, reason: 'Customer moved away' };

    it('refuses a credit that is not on the register, before opening a transaction', async () => {
      const refusal = await refusalOf(service.remove(removeDto));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ code: TempCreditErrorCode.NOT_FOUND }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('soft-deletes the row only, keeping the reason on it', async () => {
      prisma.accTempCredit.findFirst.mockResolvedValue(creditRow());

      await expect(service.remove(removeDto)).resolves.toEqual({ atcId: ATC_ID, deleted: true });
      expect(prisma.accTempCredit.update).toHaveBeenCalledWith({
        where: { atcId_atcAccYear: { atcId: ATC_ID, atcAccYear: ACC_YEAR } },
        data: {
          atcIsDeleted: true,
          atcRemarks: 'Customer moved away',
          atcModifiedOn: NOW,
          atcModifiedBy: USER_ID,
        },
      });
    });

    it('files a DELETED step that leaves the status where it was', async () => {
      prisma.accTempCredit.findFirst.mockResolvedValue(creditRow({ atcStatus: 'PARTIAL' }));

      await service.remove(removeDto);

      expect(appendStatus).toHaveBeenCalledWith(prisma, {
        credit: {
          atcId: ATC_ID,
          accYear: ACC_YEAR,
          companyId: COMPANY_ID,
          branchId: BRANCH_ID,
          tenantId: null,
          billRefno: 'SB/0042',
        },
        event: TxnStatusEvent.DELETED,
        fromStatus: 'PARTIAL',
        toStatus: 'PARTIAL',
        changedBy: USER_ID,
        changedOn: NOW,
        remarks:
          'Removed from the register: Customer moved away — balance 250.00 stays on the bill',
      });
    });

    it('audits the removal as a cancel inside the same transaction', async () => {
      prisma.accTempCredit.findFirst.mockResolvedValue(creditRow());
      context.getUserId.mockReturnValue(null);

      await service.remove(removeDto);

      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'cancel',
          pk: ATC_ID,
          entityId: ATC_ID,
          originalRecord: { atcIsDeleted: false, atcRemarks: 'Will pay Friday' },
          modifiedRecord: { atcIsDeleted: true, atcRemarks: 'Customer moved away' },
          userId: 'SYSTEM',
          notes: 'Temporary credit deleted: Customer moved away',
        }),
        prisma,
      );
    });
  });
});
