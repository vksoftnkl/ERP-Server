import { TenderMasterController } from './tender-master.controller';
import { TenderMasterService } from './tender-master.service';
import { TenderMasterPayload } from './types/tender-master-api.types';

const TND_ID = '019c6f6c-be87-7a11-8905-36092c46f701';
const TENDER = { tndId: TND_ID, tndName: 'Cash' } as TenderMasterPayload;
const BODY = {
  tndCompanyId: '019c6f6c-be87-7a11-8905-36092c46f703',
  tndTypeId: '1',
  tndName: 'Cash',
  tndMinAmount: 0,
};

describe('TenderMasterController', () => {
  let service: { save: jest.Mock; list: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: TenderMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(TENDER),
      list: jest.fn().mockResolvedValue([TENDER]),
      getById: jest.fn().mockResolvedValue(TENDER),
      softDelete: jest.fn().mockResolvedValue({ tndId: TND_ID, deleted: true }),
    };
    controller = new TenderMasterController(service as unknown as TenderMasterService);
  });

  it.each([
    ['created', BODY, 'Tender created successfully'],
    ['updated', { ...BODY, tndId: TND_ID }, 'Tender updated successfully'],
  ])('save says %s by whether the body names a tndId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: TENDER });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('list wraps every tender', async () => {
    await expect(controller.list()).resolves.toEqual({
      success: true,
      message: 'Tenders fetched successfully',
      data: [TENDER],
    });
  });

  it('getById fetches by id and wraps the tender', async () => {
    await expect(controller.getById(TND_ID)).resolves.toEqual({
      success: true,
      message: 'Tender fetched successfully',
      data: TENDER,
    });
    expect(service.getById).toHaveBeenCalledWith(TND_ID);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(TND_ID)).resolves.toEqual({
      success: true,
      message: 'Tender deleted successfully',
      data: { tndId: TND_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(TND_ID);
  });
});
