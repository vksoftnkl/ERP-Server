import { DcReturnController } from './dc-return.controller';
import { DcReturnService } from './dc-return.service';
import type { SaveDcReturnDto } from './dto/save-dc-return.dto';

const SDR_ID = '019c6f6c-be87-7a11-8905-36092c46b001';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b002';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b003';
const DC_ID = '019c6f6c-be87-7a11-8905-36092c46b004';
const ACC_YEAR = '2026-2027';

const KEYS = {
  sdrId: SDR_ID,
  sdrCompanyId: COMPANY_ID,
  sdrBranchId: BRANCH_ID,
  sdrAccYear: ACC_YEAR,
};
const DOC = { sdrId: SDR_ID, sdrStatus: 'DRAFT' };

describe('DcReturnController', () => {
  let service: {
    save: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    delete: jest.Mock;
    get: jest.Mock;
    openLines: jest.Mock;
    transport: jest.Mock;
  };
  let controller: DcReturnController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(DOC),
      post: jest.fn().mockResolvedValue({ ...DOC, sdrStatus: 'POSTED' }),
      cancel: jest.fn().mockResolvedValue({ sdrStatus: 'CANCELLED' }),
      delete: jest.fn().mockResolvedValue({ sdrId: SDR_ID, deleted: true }),
      get: jest.fn().mockResolvedValue(DOC),
      openLines: jest.fn().mockResolvedValue([{ dcItemId: 'x', openQty: 4 }]),
      transport: jest.fn().mockResolvedValue({ vehicleNo: 'TN01AB1234' }),
    };
    controller = new DcReturnController(service as unknown as DcReturnService);
  });

  it('words a save without sdrId as a create', async () => {
    const dto = { ...KEYS, sdrId: undefined, sdrDcId: DC_ID } as unknown as SaveDcReturnDto;

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'DC return created successfully',
      data: DOC,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with sdrId as an update', async () => {
    const dto = { ...KEYS, sdrDcId: DC_ID } as unknown as SaveDcReturnDto;

    await expect(controller.save(dto)).resolves.toMatchObject({
      message: 'DC return updated successfully',
    });
  });

  it('wraps post, cancel and delete', async () => {
    await expect(controller.post(KEYS)).resolves.toEqual({
      success: true,
      message: 'DC return posted successfully',
      data: { ...DOC, sdrStatus: 'POSTED' },
    });
    await expect(controller.cancel({ ...KEYS, reason: 'Wrong challan' })).resolves.toEqual({
      success: true,
      message: 'DC return cancelled successfully',
      data: { sdrStatus: 'CANCELLED' },
    });
    await expect(controller.remove(KEYS)).resolves.toEqual({
      success: true,
      message: 'Draft DC return deleted successfully',
      data: { sdrId: SDR_ID, deleted: true },
    });
    expect(service.post).toHaveBeenCalledWith(KEYS);
    expect(service.cancel).toHaveBeenCalledWith({ ...KEYS, reason: 'Wrong challan' });
    expect(service.delete).toHaveBeenCalledWith(KEYS);
  });

  it('maps the sdr-prefixed query keys onto the store keys for get', async () => {
    await expect(controller.get(SDR_ID, COMPANY_ID, BRANCH_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'DC return fetched successfully',
      data: DOC,
    });
    expect(service.get).toHaveBeenCalledWith({
      id: SDR_ID,
      companyId: COMPANY_ID,
      branchId: BRANCH_ID,
      accYear: ACC_YEAR,
    });
  });

  it('wraps the open challan lines', async () => {
    await expect(controller.openLines(DC_ID, ACC_YEAR)).resolves.toEqual({
      success: true,
      message: 'Open challan lines fetched',
      data: [{ dcItemId: 'x', openQty: 4 }],
    });
    expect(service.openLines).toHaveBeenCalledWith(DC_ID, ACC_YEAR);
  });

  it('wraps the transport band', async () => {
    const dto = { ...KEYS, transport: { direction: 'INWARD' as const } };

    await expect(controller.transport(dto)).resolves.toEqual({
      success: true,
      message: 'Transport details saved',
      data: { vehicleNo: 'TN01AB1234' },
    });
    expect(service.transport).toHaveBeenCalledWith(dto);
  });
});
