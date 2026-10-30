import { LoyaltyMembersController } from './loyalty-members.controller';
import { LoyaltyMembersService } from './loyalty-members.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e301';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e303';
const MEMBER_ID = '019c6f6c-be87-7a11-8905-36092c46e306';
const APPROVER_ID = '019c6f6c-be87-7a11-8905-36092c46e308';

describe('LoyaltyMembersController', () => {
  let service: { setStatus: jest.Mock; adjust: jest.Mock; history: jest.Mock };
  let controller: LoyaltyMembersController;

  beforeEach(() => {
    service = {
      setStatus: jest.fn().mockResolvedValue({
        memberId: MEMBER_ID,
        fromStatus: 'ACTIVE',
        toStatus: 'SUSPENDED',
        balance: 10,
        drained: null,
      }),
      adjust: jest.fn().mockResolvedValue({
        docId: 'doc-1',
        docRefno: 'ADJ-1',
        rowsWritten: 3,
        balance: 0,
        redeemable: 0,
      }),
      history: jest.fn().mockResolvedValue({ memberId: MEMBER_ID, steps: [{}, {}] }),
    };
    controller = new LoyaltyMembersController(service as unknown as LoyaltyMembersService);
  });

  it('words a status change by the status the member landed on', async () => {
    const dto = {
      companyId: COMPANY_ID,
      memberId: MEMBER_ID,
      status: 'SUSPENDED' as const,
      reason: 'Card lost',
    };

    await expect(controller.status(dto)).resolves.toMatchObject({
      success: true,
      message: 'Member SUSPENDED',
      data: { toStatus: 'SUSPENDED' },
    });
    expect(service.setStatus).toHaveBeenCalledWith(dto);
  });

  it('words an adjustment by the ledger rows it wrote', async () => {
    const dto = {
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      memberId: MEMBER_ID,
      points: -25,
      reason: 'Take back',
      approvedBy: APPROVER_ID,
    };

    await expect(controller.adjust(dto)).resolves.toMatchObject({
      success: true,
      message: '3 ledger row(s) written',
      data: { docRefno: 'ADJ-1' },
    });
    expect(service.adjust).toHaveBeenCalledWith(dto);
  });

  it('words the trail by its step count', async () => {
    await expect(
      controller.history({ companyId: COMPANY_ID, memberId: MEMBER_ID }),
    ).resolves.toEqual({
      success: true,
      message: '2 step(s)',
      data: { memberId: MEMBER_ID, steps: [{}, {}] },
    });
  });
});
