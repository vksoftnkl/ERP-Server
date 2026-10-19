import { BankListController } from './bank-list.controller';
import { BankListService } from './bank-list.service';
import { BankListPayload } from './types/bank-list-api.types';

const BANK_ID = '019c6f6c-be87-7a11-8905-36092c46fb01';

const PAYLOAD = { bnkId: BANK_ID, bnkName: 'State Bank of India' } as BankListPayload;
const META = { page: 1, limit: 20, total: 1, total_pages: 1 };

describe('BankListController', () => {
  let service: {
    save: jest.Mock;
    list: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: BankListController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue({ items: [PAYLOAD], meta: META }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ bnkId: BANK_ID, deleted: true }),
    };
    controller = new BankListController(service as unknown as BankListService);
  });

  it('words a save without bnkId as a create', async () => {
    const dto = { bnkName: 'State Bank of India' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Bank created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with bnkId as an update', async () => {
    await expect(controller.save({ bnkId: BANK_ID, bnkName: 'SBI' })).resolves.toMatchObject({
      message: 'Bank updated successfully',
    });
  });

  it('lifts the list items and meta into the envelope', async () => {
    await expect(controller.list({ page: 1 })).resolves.toEqual({
      success: true,
      message: 'Banks fetched successfully',
      data: [PAYLOAD],
      meta: META,
    });
  });

  it('wraps a single bank', async () => {
    await expect(controller.getById(BANK_ID)).resolves.toEqual({
      success: true,
      message: 'Bank fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(BANK_ID);
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(BANK_ID)).resolves.toEqual({
      success: true,
      message: 'Bank deleted successfully',
      data: { bnkId: BANK_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(BANK_ID);
  });
});
