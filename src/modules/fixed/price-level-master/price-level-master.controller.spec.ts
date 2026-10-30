import { PriceLevelMasterController } from './price-level-master.controller';
import { PriceLevelMasterService } from './price-level-master.service';
import { PriceLevelMasterPayload } from './types/price-level-master-api.types';

const ITEM = { priceLvlId: 1, priceLvlName: 'Retail' } as PriceLevelMasterPayload;

describe('PriceLevelMasterController', () => {
  let service: { get: jest.Mock; update: jest.Mock };
  let controller: PriceLevelMasterController;

  beforeEach(() => {
    service = {
      get: jest.fn().mockResolvedValue({ items: [ITEM], meta: { count: 1 } }),
      update: jest.fn().mockResolvedValue([ITEM]),
    };
    controller = new PriceLevelMasterController(service as unknown as PriceLevelMasterService);
  });

  it('words an unfiltered fetch in the plural', async () => {
    await expect(controller.get({})).resolves.toEqual({
      success: true,
      message: 'Price levels fetched successfully',
      data: [ITEM],
      meta: { count: 1 },
    });
  });

  it('words a fetch by id in the singular', async () => {
    await expect(controller.get({ priceLvlId: 1 })).resolves.toMatchObject({
      message: 'Price level fetched successfully',
    });
  });

  it('passes the bulk body through and wraps the updated rows', async () => {
    const body = { priceLevels: [{ priceLvlId: 1, priceLvlName: 'Retail' }] };

    await expect(controller.update(body)).resolves.toEqual({
      success: true,
      message: 'Price levels updated successfully',
      data: [ITEM],
    });
    expect(service.update).toHaveBeenCalledWith(body);
  });
});
