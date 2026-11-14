import { Prisma } from '@prisma/client';
import { TillEventCode } from '../types/till-enum';
import { TillApprovalService } from './till-approval.service';

/**
 * Review 11-14 S4 — withdrawForDocument: an amended Sale Return withdraws the
 * post-hoc review its earlier revision filed, inside the amend's transaction,
 * as approvals/cancel would (CANCELLED + APPROVAL_DECIDED with status
 * CANCELLED). Only PENDING rows of that document are touched.
 */
describe('TillApprovalService.withdrawForDocument', () => {
  const COMPANY = '019c6f6c-be87-7a11-8905-36092c46e002';
  const DOC = '019c6f6c-be87-7a11-8905-36092c46e001';
  const USER = '019c6f6c-be87-7a11-8905-36092c46e004';
  const pending = (tapId: string, event: string) => ({
    tapId,
    tapAccYear: '2026-2027',
    tapCompanyId: COMPANY,
    tapBranchId: 'branch',
    tapSessionId: null,
    tapCounterId: null,
    tapSrcDocType: 'SALE_RETURN',
    tapSrcDocId: DOC,
    tapSrcRefno: 'SRT/2026-2027/D7/00001',
    tapAmount: new Prisma.Decimal('590.00'),
    tapReasonId: null,
    tapEventCode: event,
    tapStatus: 'PENDING',
  });

  it('cancels each PENDING request of the document with the note, and journals the decision', async () => {
    const tx = {
      tillApproval: {
        findMany: jest
          .fn()
          .mockResolvedValue([
            pending('tap-1', 'RETURN_NO_RECEIPT'),
            pending('tap-2', 'SALE_RETURN'),
          ]),
        update: jest.fn().mockResolvedValue({}),
      },
    };
    const events = { log: jest.fn().mockResolvedValue(undefined) };
    const service = new TillApprovalService({} as never, events as never);

    const ids = await service.withdrawForDocument(tx as never, {
      companyId: COMPANY,
      srcDocType: 'SALE_RETURN',
      srcDocId: DOC,
      userId: USER,
      deviceId: null,
      note: 'Withdrawn by vkpos: the return was amended to revision 2',
    });

    expect(ids).toEqual(['tap-1', 'tap-2']);
    expect(tx.tillApproval.findMany).toHaveBeenCalledWith({
      where: {
        tapCompanyId: COMPANY,
        tapSrcDocType: 'SALE_RETURN',
        tapSrcDocId: DOC,
        tapStatus: 'PENDING',
        tapIsDeleted: false,
      },
    });
    expect(tx.tillApproval.update).toHaveBeenCalledWith({
      where: { tapId_tapAccYear: { tapId: 'tap-1', tapAccYear: '2026-2027' } },
      data: {
        tapStatus: 'CANCELLED',
        tapDecisionNote: 'Withdrawn by vkpos: the return was amended to revision 2',
        tapModifiedOn: expect.any(Date),
      },
    });
    expect(events.log).toHaveBeenCalledTimes(2);
    expect(events.log).toHaveBeenCalledWith(
      tx,
      expect.objectContaining({
        code: TillEventCode.APPROVAL_DECIDED,
        approvalId: 'tap-2',
        userId: USER,
        srcDocType: 'SALE_RETURN',
        srcDocId: DOC,
        payload: {
          event: 'SALE_RETURN',
          status: 'CANCELLED',
          note: 'Withdrawn by vkpos: the return was amended to revision 2',
        },
      }),
    );
  });

  it('writes nothing when no request is pending', async () => {
    const tx = {
      tillApproval: { findMany: jest.fn().mockResolvedValue([]), update: jest.fn() },
    };
    const events = { log: jest.fn() };
    const service = new TillApprovalService({} as never, events as never);

    await expect(
      service.withdrawForDocument(tx as never, {
        companyId: COMPANY,
        srcDocType: 'SALE_RETURN',
        srcDocId: DOC,
        userId: USER,
        deviceId: null,
        note: 'x',
      }),
    ).resolves.toEqual([]);
    expect(tx.tillApproval.update).not.toHaveBeenCalled();
    expect(events.log).not.toHaveBeenCalled();
  });
});
