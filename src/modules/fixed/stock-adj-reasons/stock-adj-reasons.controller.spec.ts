import { StockAdjReasonsController } from './stock-adj-reasons.controller';
import { StockAdjReasonsService } from './stock-adj-reasons.service';
import { StockAdjReasonsPayload } from './types/stock-adj-reasons-api.types';

const REASON_ID = '019c6f6c-be87-7a11-8905-36092c46fe01';
const ITEM = { sarId: REASON_ID, sarCode: 'DAMAGE' } as StockAdjReasonsPayload;
const META = { activeOnly: true, includeDeleted: false, count: 1 };

describe('StockAdjReasonsController', () => {
  let get: jest.Mock;
  let controller: StockAdjReasonsController;

  beforeEach(() => {
    get = jest.fn().mockResolvedValue({ items: [ITEM], meta: META });
    controller = new StockAdjReasonsController({ get } as unknown as StockAdjReasonsService);
  });

  it('words a filtered or unfiltered fetch in the plural', async () => {
    await expect(controller.get({ sarCode: 'DAMAGE' })).resolves.toEqual({
      success: true,
      message: 'Stock adjustment reasons fetched successfully',
      data: [ITEM],
      meta: META,
    });
  });

  it('words a fetch by sarId in the singular', async () => {
    await expect(controller.get({ sarId: REASON_ID })).resolves.toMatchObject({
      message: 'Stock adjustment reason fetched successfully',
    });
    expect(get).toHaveBeenCalledWith({ sarId: REASON_ID });
  });
});
