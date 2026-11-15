import { Prisma, type TillApproval } from '@prisma/client';
import { tillErrorCodeOf } from '../till-errors';
import { TillErrorCode } from '../types/till-enum';
import { TillApprovalGateService } from './till-approval-gate.service';
import { TillApprovalService, type GateAsk } from './till-approval.service';

/**
 * 11-14 G R — the review the WARN gate files when a document posts must carry
 * till.single_operator's self-approval (tap_self_allowed, REV 2 §2.12) as an
 * explicit approvals/request does, so the owner-cashier of a single-operator
 * branch decides their own review on approvals/decide. Without single_operator
 * the rule's no-self flag still refuses them TILL_APPROVER_SELF.
 *
 * Driven through the real TillApprovalService (assessGate → settleGate) and the
 * real TillApprovalGateService.decide, with the database mocked.
 */
describe('TillApprovalService — a WARN review under till.single_operator', () => {
  const COMPANY = '019c8ea6-19e9-78a8-b15f-749e1cde7292';
  const BRANCH = '019c8ea7-b0f5-72d5-96a5-1abfc80cc8ab';
  const VKPOS = '019e441b-6e48-7918-b246-b857ffb35db1';
  const DEVICE = '019ea5d1-261f-7f3d-b350-93a30c147788';
  const DOC = '01a1d922-74dd-7520-8474-455d33088724';
  const TAP = '01a1d922-7564-7f56-9110-611e5bbfdb4a';
  const ACC_YEAR = '2026-2027';

  // The shipped SALE_CLAIM rule as the run hit it: ALWAYS, STORE_MANAGER, EITHER, no self.
  const rule = {
    tar_id: '01a1d507-0321-7865-b79a-7ce04d798e1d',
    tar_event_code: 'SALE_CLAIM',
    tar_mode: 'ALWAYS',
    tar_threshold_amount: new Prisma.Decimal(0),
    tar_threshold_count: 0,
    tar_channel: 'EITHER',
    tar_min_role: 'STORE_MANAGER',
    tar_two_person: false,
    tar_allow_self: false,
    tar_blocks_till: true,
    tar_expire_minutes: 0,
  };

  const ask: GateAsk = {
    companyId: COMPANY,
    branchId: BRANCH,
    tenantId: null,
    accYear: ACC_YEAR,
    event: 'SALE_CLAIM',
    onDate: '2026-11-14',
    amount: new Prisma.Decimal('590.00'),
    requesterId: VKPOS,
    deviceId: DEVICE,
    sessionId: null,
    counterId: null,
    srcDocType: 'SALE_RETURN',
    srcDocId: DOC,
    srcRefno: 'SRT/2026-2027/D7/00564',
    approvalId: null,
    field: 'approvalIds',
  };

  /** assessGate + settleGate under the given settings; answers the till_approval row filed. */
  async function fileReview(singleOperator: boolean) {
    const settings = jest.fn().mockResolvedValue({ approvalGate: 'WARN', singleOperator });
    const events = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new TillApprovalService({ settings } as never, events as never);
    const client = { $queryRaw: jest.fn().mockResolvedValue([rule]) };
    let filed: Record<string, unknown> = {};
    const tx = {
      tillApproval: {
        findFirst: jest.fn().mockResolvedValue(null),
        count: jest.fn().mockResolvedValue(0),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          filed = data;
          return { tapId: TAP };
        }),
      },
    };

    const verdict = await service.assessGate(client as never, ask);
    const tapId = await service.settleGate(tx as never, ask, verdict);

    expect(settings).toHaveBeenCalledWith({
      companyId: COMPANY,
      branchId: BRANCH,
      deviceId: DEVICE,
      userId: VKPOS,
    });
    expect(tapId).toBe(TAP);
    const row = {
      ...filed,
      tapId: TAP,
      tapIsDeleted: false,
      tapDecidedBy: null,
      tapSecondBy: null,
      tapExpiresOn: null,
    } as unknown as TillApproval;
    return { service, events, verdict, row };
  }

  /** approvals/decide by VKPOS (a SUPER ADMIN: implicit remote HO_FINANCE grant, no PIN typed). */
  async function decideAsVkpos(
    service: TillApprovalService,
    events: { log: jest.Mock },
    row: TillApproval,
    decision: 'APPROVE' | 'REJECT',
    update: jest.Mock = jest.fn().mockResolvedValue({}),
  ) {
    const tx = {
      $queryRaw: jest.fn().mockResolvedValue([{ tap_id: TAP }]),
      tillApproval: { findUniqueOrThrow: jest.fn().mockResolvedValue(row), update },
    };
    const prisma = {
      tillApproval: { findFirst: jest.fn().mockResolvedValue(row) },
      userMaster: {
        findUnique: jest.fn().mockResolvedValue({
          usrLoginName: 'VKPOS',
          usrPinHash: null,
          usrType: 'SUPER ADMIN',
          usrIsActive: true,
        }),
      },
      // till_approval_authority: none — the SUPER ADMIN's implicit grant carries it.
      $queryRaw: jest.fn().mockResolvedValue([]),
      $transaction: jest.fn(async (fn: (t: typeof tx) => Promise<unknown>) => fn(tx)),
    };
    const context = {
      caller: jest.fn().mockResolvedValue({ userId: VKPOS, actorName: 'VKPOS', deviceId: DEVICE }),
    };
    const gate = new TillApprovalGateService(
      prisma as never,
      context as never,
      service,
      events as never,
    );
    jest.spyOn(gate, 'get').mockResolvedValue({ tapId: TAP } as never);
    await gate.decide({
      companyId: COMPANY,
      branchId: BRANCH,
      accYear: ACC_YEAR,
      tapId: TAP,
      decision,
      note: 'ZT sale return suite',
    } as never);
    return update;
  }

  it('files the review self-allowed, and its own cashier decides it (REJECT and APPROVE)', async () => {
    for (const decision of ['REJECT', 'APPROVE'] as const) {
      const { service, events, verdict, row } = await fileReview(true);

      expect(verdict).toMatchObject({ state: 'WARN', selfAllowed: true });
      expect(row).toMatchObject({
        tapStatus: 'PENDING',
        tapSelfAllowed: true,
        tapRequestedBy: VKPOS,
        tapSrcDocType: 'SALE_RETURN',
        tapSrcDocId: DOC,
      });

      const update = await decideAsVkpos(service, events, row, decision);

      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { tapId_tapAccYear: { tapId: TAP, tapAccYear: ACC_YEAR } },
          data: expect.objectContaining({
            tapStatus: decision === 'APPROVE' ? 'APPROVED' : 'REJECTED',
            tapDecidedBy: VKPOS,
            tapChannel: 'REMOTE',
          }),
        }),
      );
    }
  });

  it('without single_operator the review is not self-allowed: 403 TILL_APPROVER_SELF, nothing written', async () => {
    const { service, events, verdict, row } = await fileReview(false);

    expect(verdict).toMatchObject({ state: 'WARN', selfAllowed: false });
    expect(row).toMatchObject({ tapStatus: 'PENDING', tapSelfAllowed: false });

    const update = jest.fn();
    const failure = await decideAsVkpos(service, events, row, 'REJECT', update).then(
      () => null,
      (e: unknown) => e,
    );
    expect(tillErrorCodeOf(failure)).toBe(TillErrorCode.APPROVER_SELF);
    expect((failure as { getStatus(): number }).getStatus()).toBe(403);
    expect(update).not.toHaveBeenCalled();
    expect(events.log).toHaveBeenCalledTimes(1); // APPROVAL_REQUESTED only — no APPROVAL_DECIDED
  });

  it('a rule that allows self files it self-allowed whatever the setting', async () => {
    const settings = jest.fn().mockResolvedValue({ approvalGate: 'WARN', singleOperator: false });
    const service = new TillApprovalService({ settings } as never, { log: jest.fn() } as never);
    const client = { $queryRaw: jest.fn().mockResolvedValue([{ ...rule, tar_allow_self: true }]) };

    await expect(service.assessGate(client as never, ask)).resolves.toMatchObject({
      state: 'WARN',
      selfAllowed: true,
    });
  });
});
