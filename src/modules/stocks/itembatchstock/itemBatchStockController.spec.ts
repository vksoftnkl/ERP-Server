import { ItemBatchStockController } from './itemBatchStockController';
import { ItemBatchStockService } from './itemBatchStockService';
import { GetItemBatchStockQueryDto } from './dto/get-item-batch-stock-query.dto';
import { ItemBatchStockPayload } from './types/item-batch-stock-api.types';

const ROW = { ibs_id: '019c6f6c-be87-7a11-8905-36092c46b009' } as ItemBatchStockPayload;

describe('ItemBatchStockController', () => {
  it('passes the query to the service and wraps the lots it found', async () => {
    const service = { getByScope: jest.fn().mockResolvedValue([ROW]) };
    const controller = new ItemBatchStockController(service as unknown as ItemBatchStockService);
    const query = { ibs_acc_year: '2026-2027' } as GetItemBatchStockQueryDto;

    await expect(controller.getByScope(query)).resolves.toEqual({
      success: true,
      message: 'Item batch stock fetched successfully',
      data: [ROW],
    });
    expect(service.getByScope).toHaveBeenCalledWith(query);
  });

  it("lets the service's refusal through to the filter", async () => {
    const failure = new Error('no stock');
    const service = { getByScope: jest.fn().mockRejectedValue(failure) };
    const controller = new ItemBatchStockController(service as unknown as ItemBatchStockService);

    await expect(controller.getByScope({} as GetItemBatchStockQueryDto)).rejects.toBe(failure);
  });
});
