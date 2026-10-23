import { ItemsCustRatesMasterController } from './items-cust-rates-master.controller';
import { ItemsCustRatesMasterService } from './items-cust-rates-master.service';
import { ItemCustRatePayload } from './types/item-cust-rate-api.types';

const RATE_ID = '019c6f6c-be87-7a11-8905-36092c46c101';
const CUSTOMER_ID = '019c6f6c-be87-7a11-8905-36092c46c102';
const UNIT_RATE_ID = '019c6f6c-be87-7a11-8905-36092c46c103';
const RATE = { csr_id: RATE_ID, csr_customer_id: CUSTOMER_ID } as ItemCustRatePayload;

describe('ItemsCustRatesMasterController', () => {
  let service: { save: jest.Mock; list: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: ItemsCustRatesMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(RATE),
      list: jest.fn(),
      getById: jest.fn().mockResolvedValue(RATE),
      softDelete: jest.fn().mockResolvedValue({ csr_id: RATE_ID, deleted: true }),
    };
    controller = new ItemsCustRatesMasterController(
      service as unknown as ItemsCustRatesMasterService,
    );
  });

  it.each([
    ['created', {}, 'Item customer rate created successfully'],
    ['updated', { csr_id: RATE_ID }, 'Item customer rate updated successfully'],
  ])('save says %s by whether the body names a csr_id', async (_label, extra, message) => {
    const dto = { csr_customer_id: CUSTOMER_ID, csr_unit_rate_id: UNIT_RATE_ID, ...extra };

    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: RATE });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('list spreads the items into data and the paging into meta', async () => {
    const meta = { page: 1, limit: 20, total: 1, total_pages: 1 };
    service.list.mockResolvedValue({ items: [RATE], meta });
    const query = { search: 'fixed' };

    await expect(controller.list(query)).resolves.toEqual({
      success: true,
      message: 'Item customer rates fetched successfully',
      data: [RATE],
      meta,
    });
    expect(service.list).toHaveBeenCalledWith(query);
  });

  it('getById fetches by id and wraps the row', async () => {
    await expect(controller.getById(RATE_ID)).resolves.toEqual({
      success: true,
      message: 'Item customer rate fetched successfully',
      data: RATE,
    });
    expect(service.getById).toHaveBeenCalledWith(RATE_ID);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(RATE_ID)).resolves.toEqual({
      success: true,
      message: 'Item customer rate deleted successfully',
      data: { csr_id: RATE_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(RATE_ID);
  });
});
