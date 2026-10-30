import { ForbiddenException, HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { assertMenuRight } from '../../../../common/posting/rights';
import {
  appendTxnStatusLog,
  TxnStatusDocType,
  TxnStatusEvent,
  TxnStatusSrcModule,
} from '../../../../common/txn-status-log/txn-status-log.helper';
import { LoyaltyErrorCode } from '../types/loyalty-error-codes';
import { LoyaltyMembersService, LOYALTY_STATUS_MENU_ID } from './loyalty-members.service';

jest.mock('../../../../common/posting/rights', () => ({
  ...jest.requireActual<object>('../../../../common/posting/rights'),
  assertMenuRight: jest.fn(),
}));
jest.mock('../../../../common/txn-status-log/txn-status-log.helper', () => ({
  ...jest.requireActual<object>('../../../../common/txn-status-log/txn-status-log.helper'),
  appendTxnStatusLog: jest.fn(),
}));

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e303';
const HOME_BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e304';
const SESSION_BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e305';
const MEMBER_ID = '019c6f6c-be87-7a11-8905-36092c46e306';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e307';
const APPROVER_ID = '019c6f6c-be87-7a11-8905-36092c46e308';
const DEVICE_ID = '019c6f6c-be87-7a11-8905-36092c46e309';

const mockedAssertMenuRight = assertMenuRight as jest.MockedFunction<typeof assertMenuRight>;
const mockedAppendTxnStatusLog = appendTxnStatusLog as jest.MockedFunction<
  typeof appendTxnStatusLog
>;

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

type MemberRow = {
  lmb_comp_id: string;
  lmb_branch_id: string | null;
  lmb_cust_id: string;
  lmb_card_no: string | null;
  lmb_mobile: string | null;
  lmb_status: string;
  lmb_balance_points: Prisma.Decimal | null;
  lmb_is_deleted: boolean;
};

const memberRow = (overrides: Partial<MemberRow> = {}): MemberRow => ({
  lmb_comp_id: COMPANY_ID,
  lmb_branch_id: HOME_BRANCH_ID,
  lmb_cust_id: '019c6f6c-be87-7a11-8905-36092c46e30a',
  lmb_card_no: 'CARD-77',
  lmb_mobile: '9876543210',
  lmb_status: 'ACTIVE',
  lmb_balance_points: new Prisma.Decimal(0),
  lmb_is_deleted: false,
  ...overrides,
});

/**
 * The raw reads the service makes, answered by what their SQL is about. Each
 * entry may be replaced per test; the defaults describe a healthy member.
 */
type RawAnswers = {
  branch: Array<{ br_comp_id: string | null }>;
  member: MemberRow[];
  today: Array<{ d: string }>;
  year: Array<{ fy_year_name: string }>;
  defaultBranch: Array<{ br_id: string }>;
  login: Array<{ usr_login_name: string }>;
  exists: Array<{ ok: boolean }>;
  history: unknown[];
};

describe('LoyaltyMembersService', () => {
  let answers: RawAnswers;
  let raw: jest.Mock;
  let executeRaw: jest.Mock;
  let ledger: { drain: jest.Mock; adjust: jest.Mock };
  let context: { getUserId: jest.Mock; getDeviceId: jest.Mock; getBranchId: jest.Mock };
  let service: LoyaltyMembersService;

  const answer = (sql: string): unknown[] => {
    if (sql.includes('FOR UPDATE')) return answers.member;
    if (sql.includes('br_is_default')) return answers.defaultBranch;
    if (sql.includes('SELECT br_comp_id')) return answers.branch;
    if (sql.includes('CURRENT_DATE')) return answers.today;
    if (sql.includes('fiscal_years')) return answers.year;
    if (sql.includes('usr_login_name')) return answers.login;
    if (sql.includes('SELECT true AS ok')) return answers.exists;
    if (sql.includes('txn_status_log')) return answers.history;
    throw new Error(`unexpected raw query: ${sql}`);
  };

  /** The values bound into the one UPDATE of sales.loyalty_member. */
  const memberUpdateValues = () => {
    const [, ...values] = executeRaw.mock.calls[0] as [TemplateStringsArray, ...unknown[]];
    return values;
  };
  const statusLogEntry = () => mockedAppendTxnStatusLog.mock.calls[0][1];

  beforeEach(() => {
    jest.clearAllMocks();
    mockedAssertMenuRight.mockResolvedValue({} as never);
    mockedAppendTxnStatusLog.mockResolvedValue({} as never);
    answers = {
      branch: [{ br_comp_id: COMPANY_ID }],
      member: [memberRow()],
      today: [{ d: '2026-10-19' }],
      year: [{ fy_year_name: '2026-2027' }],
      defaultBranch: [{ br_id: HOME_BRANCH_ID }],
      login: [{ usr_login_name: 'cashier1' }],
      exists: [{ ok: true }],
      history: [],
    };
    raw = jest.fn(async (strings: TemplateStringsArray) => answer(strings.join('?')));
    executeRaw = jest.fn().mockResolvedValue(1);
    const tx = { $queryRaw: raw, $executeRaw: executeRaw };
    const prisma = {
      ...tx,
      $transaction: jest.fn(async (callback: (client: typeof tx) => unknown) => callback(tx)),
    };
    ledger = {
      drain: jest.fn().mockResolvedValue({
        docId: 'doc-1',
        docRefno: 'ADJ-1',
        rowsWritten: 2,
        balance: 0,
        redeemable: 0,
      }),
      adjust: jest.fn().mockResolvedValue({
        docId: 'doc-2',
        docRefno: 'ADJ-2',
        rowsWritten: 1,
        balance: 150,
        redeemable: 150,
      }),
    };
    context = {
      getUserId: jest.fn().mockReturnValue(USER_ID),
      getDeviceId: jest.fn().mockReturnValue(DEVICE_ID),
      getBranchId: jest.fn().mockReturnValue(null),
    };
    service = new LoyaltyMembersService(prisma as never, context as never, ledger as never);
  });

  describe('setStatus', () => {
    const suspend = { companyId: COMPANY_ID, memberId: MEMBER_ID, status: 'SUSPENDED' as const };

    it('is judged on the edit right of menu 79 under the LST prefix', async () => {
      await service.setStatus({ ...suspend, reason: 'Card lost' });

      expect(mockedAssertMenuRight).toHaveBeenCalledTimes(1);
      expect(mockedAssertMenuRight).toHaveBeenCalledWith(expect.anything(), {
        userId: USER_ID,
        menuId: LOYALTY_STATUS_MENU_ID,
        right: 'edit',
        codePrefix: 'LST',
        action: expect.any(String) as string,
      });
    });

    it('stops before reading anything when the right is refused', async () => {
      mockedAssertMenuRight.mockRejectedValue(new ForbiddenException('no'));

      await expect(service.setStatus({ ...suspend, reason: 'x' })).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(raw).not.toHaveBeenCalled();
    });

    it('also wants the delete right for a forced close', async () => {
      answers.member = [memberRow({ lmb_balance_points: new Prisma.Decimal(40) })];

      await service.setStatus({
        companyId: COMPANY_ID,
        memberId: MEMBER_ID,
        status: 'CLOSED',
        reason: 'Customer left',
        force: true,
        approvedBy: APPROVER_ID,
      });

      expect(mockedAssertMenuRight.mock.calls.map(([, params]) => params.right)).toEqual([
        'edit',
        'delete',
      ]);
    });

    it.each(['SUSPENDED', 'CLOSED'] as const)('refuses %s without a reason', async (status) => {
      const refusal = await refusalOf(
        service.setStatus({ companyId: COMPANY_ID, memberId: MEMBER_ID, status }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'reason', code: LoyaltyErrorCode.MEMBER_REASON_REQUIRED }],
        },
      });
      expect(raw).not.toHaveBeenCalled();
    });

    it('lets a reactivation go through without a reason, clearing the block', async () => {
      answers.member = [memberRow({ lmb_status: 'SUSPENDED' })];

      const result = await service.setStatus({
        companyId: COMPANY_ID,
        memberId: MEMBER_ID,
        status: 'ACTIVE',
      });

      expect(result).toEqual({
        memberId: MEMBER_ID,
        fromStatus: 'SUSPENDED',
        toStatus: 'ACTIVE',
        balance: 0,
        drained: null,
      });
      expect(memberUpdateValues()).toEqual(['ACTIVE', null, true, 'cashier1', MEMBER_ID]);
      expect(statusLogEntry()).toMatchObject({
        event: TxnStatusEvent.REOPENED,
        fromStatus: 'SUSPENDED',
        toStatus: 'ACTIVE',
        remarks: null,
      });
    });

    it('refuses a branch of another company', async () => {
      answers.branch = [{ br_comp_id: OTHER_COMPANY_ID }];

      const refusal = await refusalOf(
        service.setStatus({ ...suspend, reason: 'x', branchId: BRANCH_ID }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'branchId', code: LoyaltyErrorCode.MEMBER_BRANCH_NOT_IN_COMPANY },
          ],
        },
      });
    });

    it.each([
      ['does not exist', []],
      ['is deleted', [memberRow({ lmb_is_deleted: true })]],
      ['belongs to another company', [memberRow({ lmb_comp_id: OTHER_COMPANY_ID })]],
    ])('answers 404 for a member that %s', async (_label, rows) => {
      answers.member = rows;

      const refusal = await refusalOf(service.setStatus({ ...suspend, reason: 'x' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'memberId', code: LoyaltyErrorCode.MEMBER_NOT_FOUND }] },
      });
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('refuses to move a merged wallet', async () => {
      answers.member = [memberRow({ lmb_status: 'MERGED' })];

      const refusal = await refusalOf(service.setStatus({ ...suspend, reason: 'x' }));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ code: LoyaltyErrorCode.MEMBER_MERGED }] },
      });
    });

    it('refuses a status the member already has', async () => {
      answers.member = [memberRow({ lmb_status: 'SUSPENDED' })];

      const refusal = await refusalOf(service.setStatus({ ...suspend, reason: 'x' }));

      expect(refusal).toMatchObject({
        status: 422,
        body: { errors: [{ field: 'status', code: LoyaltyErrorCode.MEMBER_NO_CHANGE }] },
      });
    });

    it('suspends: writes the reason, deactivates, and logs one STATUS_CHANGED step', async () => {
      await service.setStatus({ ...suspend, reason: 'Card lost' });

      expect(memberUpdateValues()).toEqual(['SUSPENDED', 'Card lost', false, 'cashier1', MEMBER_ID]);
      expect(mockedAppendTxnStatusLog).toHaveBeenCalledTimes(1);
      expect(statusLogEntry()).toEqual({
        companyId: COMPANY_ID,
        branchId: HOME_BRANCH_ID,
        accYear: '2026-2027',
        srcModule: TxnStatusSrcModule.SALES,
        srcDocType: TxnStatusDocType.OTHER,
        srcDocId: MEMBER_ID,
        srcDocRefno: 'CARD-77',
        event: TxnStatusEvent.STATUS_CHANGED,
        fromStatus: 'ACTIVE',
        toStatus: 'SUSPENDED',
        changedBy: USER_ID,
        remarks: 'Card lost',
        deviceId: DEVICE_ID,
      });
      expect(ledger.drain).not.toHaveBeenCalled();
    });

    it('files the step under the mobile number when the member has no card', async () => {
      answers.member = [memberRow({ lmb_card_no: null })];

      await service.setStatus({ ...suspend, reason: 'x' });

      expect(statusLogEntry().srcDocRefno).toBe('9876543210');
    });

    it('takes the branch the caller names over the home branch', async () => {
      await service.setStatus({ ...suspend, reason: 'x', branchId: BRANCH_ID });

      expect(statusLogEntry().branchId).toBe(BRANCH_ID);
    });

    it("falls back to the session's branch for a wallet with no home branch", async () => {
      answers.member = [memberRow({ lmb_branch_id: null })];
      context.getBranchId.mockReturnValue(SESSION_BRANCH_ID);

      await service.setStatus({ ...suspend, reason: 'x' });

      expect(statusLogEntry().branchId).toBe(SESSION_BRANCH_ID);
    });

    it("then to the company's default branch, and refuses when it has none", async () => {
      answers.member = [memberRow({ lmb_branch_id: null })];

      await service.setStatus({ ...suspend, reason: 'x' });
      expect(statusLogEntry().branchId).toBe(HOME_BRANCH_ID);

      answers.defaultBranch = [];
      const refusal = await refusalOf(service.setStatus({ ...suspend, reason: 'x' }));
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: LoyaltyErrorCode.MEMBER_BRANCH_NOT_IN_COMPANY }] },
      });
    });

    it('refuses when no fiscal year holds today', async () => {
      answers.year = [];

      const refusal = await refusalOf(service.setStatus({ ...suspend, reason: 'x' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'txnDate', code: LoyaltyErrorCode.MEMBER_YEAR_UNKNOWN }] },
      });
      expect(executeRaw).not.toHaveBeenCalled();
    });

    it('stamps SYSTEM as the actor when nobody is logged in', async () => {
      context.getUserId.mockReturnValue(null);

      await service.setStatus({ ...suspend, reason: 'x' });

      expect(memberUpdateValues()[3]).toBe('SYSTEM');
      expect(statusLogEntry().changedBy).toBe('');
    });

    describe('closing a wallet', () => {
      const close = {
        companyId: COMPANY_ID,
        memberId: MEMBER_ID,
        status: 'CLOSED' as const,
        reason: 'Customer left',
      };

      it('closes an empty wallet with a CLOSED step and no ledger row', async () => {
        const result = await service.setStatus(close);

        expect(result).toMatchObject({ toStatus: 'CLOSED', balance: 0, drained: null });
        expect(statusLogEntry().event).toBe(TxnStatusEvent.CLOSED);
        expect(ledger.drain).not.toHaveBeenCalled();
      });

      it('refuses a wallet that still holds points unless forced', async () => {
        answers.member = [memberRow({ lmb_balance_points: new Prisma.Decimal('125.5') })];

        const refusal = await refusalOf(service.setStatus(close));

        expect(refusal).toMatchObject({
          status: 422,
          body: { errors: [{ field: 'status', code: LoyaltyErrorCode.MEMBER_HAS_BALANCE }] },
        });
        expect(executeRaw).not.toHaveBeenCalled();
      });

      it('refuses a forced close with no approver', async () => {
        answers.member = [memberRow({ lmb_balance_points: new Prisma.Decimal(10) })];

        const refusal = await refusalOf(service.setStatus({ ...close, force: true }));

        expect(refusal).toMatchObject({
          status: 400,
          body: {
            errors: [
              { field: 'approvedBy', code: LoyaltyErrorCode.MEMBER_APPROVER_REQUIRED },
            ],
          },
        });
        expect(ledger.drain).not.toHaveBeenCalled();
      });

      it('drains the wallet through the ledger writer first, then closes it', async () => {
        answers.member = [memberRow({ lmb_balance_points: new Prisma.Decimal(-20) })];

        const result = await service.setStatus({
          ...close,
          force: true,
          approvedBy: APPROVER_ID,
        });

        expect(ledger.drain).toHaveBeenCalledWith(expect.anything(), {
          companyId: COMPANY_ID,
          branchId: HOME_BRANCH_ID,
          memberId: MEMBER_ID,
          txnDate: '2026-10-19',
          accYear: '2026-2027',
          reason: 'Closed: Customer left',
          approvedBy: APPROVER_ID,
          userId: USER_ID,
          deviceId: DEVICE_ID,
          createdBy: 'cashier1',
        });
        expect(result).toMatchObject({
          fromStatus: 'ACTIVE',
          toStatus: 'CLOSED',
          balance: 0,
          drained: { docRefno: 'ADJ-1', rowsWritten: 2 },
        });
        expect(executeRaw).toHaveBeenCalledTimes(1);
      });
    });
  });

  describe('adjust', () => {
    const adjustment = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      memberId: MEMBER_ID,
      points: 50,
      reason: 'Goodwill',
      approvedBy: APPROVER_ID,
    };

    it.each([0, Number.NaN, Number.POSITIVE_INFINITY])(
      'refuses %p points before touching the ledger',
      async (points) => {
        const refusal = await refusalOf(service.adjust({ ...adjustment, points }));

        expect(refusal).toMatchObject({
          status: 400,
          body: { errors: [{ field: 'points', code: LoyaltyErrorCode.MEMBER_POINTS_ZERO }] },
        });
        expect(ledger.adjust).not.toHaveBeenCalled();
      },
    );

    it('refuses a branch of another company', async () => {
      answers.branch = [];

      const refusal = await refusalOf(service.adjust(adjustment));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: LoyaltyErrorCode.MEMBER_BRANCH_NOT_IN_COMPANY }] },
      });
    });

    it("hands one document to the ledger writer, dated today in today's year", async () => {
      await expect(service.adjust(adjustment)).resolves.toMatchObject({ docRefno: 'ADJ-2' });

      expect(mockedAssertMenuRight).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ right: 'edit', menuId: LOYALTY_STATUS_MENU_ID }),
      );
      expect(ledger.adjust).toHaveBeenCalledWith(expect.anything(), {
        companyId: COMPANY_ID,
        branchId: BRANCH_ID,
        memberId: MEMBER_ID,
        points: 50,
        txnDate: '2026-10-19',
        accYear: '2026-2027',
        reason: 'Goodwill',
        approvedBy: APPROVER_ID,
        expiresOn: null,
        lscId: null,
        userId: USER_ID,
        deviceId: DEVICE_ID,
        createdBy: 'cashier1',
      });
    });

    it('keeps a back-dated movement, its expiry and its scheme', async () => {
      const lscId = '019c6f6c-be87-7a11-8905-36092c46e30b';

      await service.adjust({
        ...adjustment,
        points: -30,
        txnDate: '2026-09-30',
        expiresOn: '2027-03-31',
        lscId,
      });

      expect(raw.mock.calls.some(([strings]) => strings.join('?').includes('CURRENT_DATE'))).toBe(
        false,
      );
      expect(ledger.adjust).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({
          points: -30,
          txnDate: '2026-09-30',
          expiresOn: '2027-03-31',
          lscId,
        }),
      );
    });

    it('refuses a date no fiscal year holds', async () => {
      answers.year = [];

      const refusal = await refusalOf(service.adjust({ ...adjustment, txnDate: '2019-01-01' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              code: LoyaltyErrorCode.MEMBER_YEAR_UNKNOWN,
              message: 'No fiscal year holds 2019-01-01 for this company.',
            },
          ],
        },
      });
    });
  });

  describe('history', () => {
    const query = { companyId: COMPANY_ID, memberId: MEMBER_ID };

    it('is judged on the view right', async () => {
      await service.history(query);

      expect(mockedAssertMenuRight).toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ right: 'view', codePrefix: 'LST' }),
      );
    });

    it('answers 404 for a member that is not live in the company', async () => {
      answers.exists = [];

      const refusal = await refusalOf(service.history(query));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'memberId', code: LoyaltyErrorCode.MEMBER_NOT_FOUND }] },
      });
    });

    it('maps each status step, keeping the changer name when it was joined', async () => {
      const changedOn = new Date('2026-10-18T09:00:00.000Z');
      answers.history = [
        {
          tsl_seq_no: 1,
          tsl_event: 'STATUS_CHANGED',
          tsl_from_status: 'ACTIVE',
          tsl_to_status: 'SUSPENDED',
          tsl_changed_on: changedOn,
          tsl_changed_by: USER_ID,
          usr_display_name: 'Cashier One',
          tsl_remarks: 'Card lost',
        },
      ];

      await expect(service.history(query)).resolves.toEqual({
        memberId: MEMBER_ID,
        steps: [
          {
            seqNo: 1,
            event: 'STATUS_CHANGED',
            fromStatus: 'ACTIVE',
            toStatus: 'SUSPENDED',
            changedOn,
            changedBy: USER_ID,
            changedByName: 'Cashier One',
            remarks: 'Card lost',
          },
        ],
      });
    });
  });
});
