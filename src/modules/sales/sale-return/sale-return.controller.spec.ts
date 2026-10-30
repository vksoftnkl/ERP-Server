import { SaleReturnController } from './sale-return.controller';
import { SaleReturnService } from './sale-return.service';
import type { SaveSaleReturnDto } from './dto/save-sale-return.dto';

const SR_ID = '019c6f6c-be87-7a11-8905-36092c46e001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e003';
const BILL_ID = '019c6f6c-be87-7a11-8905-36092c46e006';
const ACC_YEAR = '2026-2027';

const KEYS = { srId: SR_ID, srCompanyId: COMPANY_ID, srBranchId: BRANCH_ID, srAccYear: ACC_YEAR };
const DOC = { srId: SR_ID, srStatus: 'DRAFT' };
const POSTED = { srId: SR_ID, srStatus: 'POSTED' };

describe('SaleReturnController', () => {
  let service: {
    save: jest.Mock;
    validate: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    amend: jest.Mock;
    delete: jest.Mock;
    get: jest.Mock;
    billLines: jest.Mock;
    transport: jest.Mock;
  };
  let controller: SaleReturnController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(DOC),
      validate: jest.fn().mockResolvedValue({ ok: false, refusals: [{ code: 'X' }] }),
      post: jest.fn().mockResolvedValue(POSTED),
      cancel: jest.fn().mockResolvedValue({ srStatus: 'CANCELLED' }),
      amend: jest.fn().mockResolvedValue({ ...POSTED, srRevisionNo: 2 }),
      delete: jest.fn().mockResolvedValue({ srId: SR_ID, deleted: true }),
      get: jest.fn().mockResolvedValue(DOC),
      billLines: jest.fn().mockResolvedValue([{ billItemId: 'line-1', returnedQty: 0 }]),
      transport: jest.fn().mockResolvedValue({ direction: 'INWARD' }),
    };
    controller = new SaleReturnController(service as unknown as SaleReturnService);
  });

  it('words a save without srId as a create', async () => {
    const dto = { ...KEYS, srId: undefined, srBillId: BILL_ID } as unknown as SaveSaleReturnDto;

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Sale return created successfully',
      data: DOC,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with srId as an update', async () => {
    await expect(
      controller.save({ ...KEYS, srBillId: BILL_ID } as unknown as SaveSaleReturnDto),
    ).resolves.toMatchObject({ message: 'Sale return updated successfully' });
  });

  it('answers a failed validate as a successful call carrying the refusals', async () => {
    const dto = { ...KEYS, items: [] } as never;

    await expect(controller.validate(dto)).resolves.toEqual({
      success: true,
      message: 'Sale return validated',
      data: { ok: false, refusals: [{ code: 'X' }] },
    });
    expect(service.validate).toHaveBeenCalledWith(dto);
  });

  it('wraps post, cancel, amend and delete', async () => {
    const amendDto = { ...KEYS, baseRevision: 1, editRemark: 'Wrong qty' } as never;

    await expect(controller.post(KEYS)).resolves.toEqual({
      success: true,
      message: 'Sale return posted successfully',
      data: POSTED,
    });
    await expect(controller.cancel({ ...KEYS, reason: 'Posted twice' })).resolves.toEqual({
      success: true,
      message: 'Sale return cancelled successfully',
      data: { srStatus: 'CANCELLED' },
    });
    await expect(controller.amend(amendDto)).resolves.toMatchObject({
      message: 'Sale return amended successfully',
      data: { srRevisionNo: 2 },
    });
    await expect(controller.remove(KEYS)).resolves.toEqual({
      success: true,
      message: 'Draft sale return deleted successfully',
      data: { srId: SR_ID, deleted: true },
    });
    expect(service.post).toHaveBeenCalledWith(KEYS);
    expect(service.cancel).toHaveBeenCalledWith({ ...KEYS, reason: 'Posted twice' });
    expect(service.amend).toHaveBeenCalledWith(amendDto);
    expect(service.delete).toHaveBeenCalledWith(KEYS);
  });

  it('hands get the four keys the store reads', async () => {
    await expect(controller.get(SR_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Sale return fetched successfully',
      data: DOC,
    });
    expect(service.get).toHaveBeenCalledWith({
      id: SR_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: ACC_YEAR,
    });
  });

  it('wraps the returnable bill lines', async () => {
    await expect(controller.billLines(BILL_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Bill lines fetched',
      data: [{ billItemId: 'line-1', returnedQty: 0 }],
    });
    expect(service.billLines).toHaveBeenCalledWith(BILL_ID, ACC_YEAR);
  });

  it('wraps the transport band', async () => {
    const dto = { ...KEYS, transport: { transporterName: 'VRL' } } as never;

    await expect(controller.transport(dto)).resolves.toEqual({
      success: true,
      message: 'Transport details saved',
      data: { direction: 'INWARD' },
    });
    expect(service.transport).toHaveBeenCalledWith(dto);
  });
});
