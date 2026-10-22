import { GetBulkItemStockListQueryDto } from './dto/get-bulk-item-stock-list-query.dto';
import { GetItemBatchStockOptionsQueryDto } from './dto/get-item-batch-stock-options-query.dto';
import { GetItemStockBalanceQueryDto } from './dto/get-item-stock-balance-query.dto';
import { ItemStockBalanceController } from './itemStockBalanceController';
import { ItemStockBalanceService } from './itemstockBalanceService';

describe('ItemStockBalanceController', () => {
  let service: {
    getByScope: jest.Mock;
    getBulkList: jest.Mock;
    getBatchOptionsByScope: jest.Mock;
  };
  let controller: ItemStockBalanceController;

  beforeEach(() => {
    service = {
      getByScope: jest.fn().mockResolvedValue([{ isb_id: 'balance' }]),
      getBulkList: jest.fn().mockResolvedValue([{ isb_item_id: 'item' }]),
      getBatchOptionsByScope: jest.fn().mockResolvedValue([{ ibs_id: 'option' }]),
    };
    controller = new ItemStockBalanceController(service as unknown as ItemStockBalanceService);
  });

  it('wraps the balance of a scope', async () => {
    const query = { isb_acc_year: '2026-2027' } as GetItemStockBalanceQueryDto;

    await expect(controller.getByScope(query)).resolves.toEqual({
      success: true,
      message: 'Item stock balance fetched successfully',
      data: [{ isb_id: 'balance' }],
    });
    expect(service.getByScope).toHaveBeenCalledWith(query);
  });

  it('wraps the bulk list', async () => {
    const query = { isb_acc_year: '2026-2027' } as GetBulkItemStockListQueryDto;

    await expect(controller.getBulkList(query)).resolves.toEqual({
      success: true,
      message: 'Bulk item stock list fetched successfully',
      data: [{ isb_item_id: 'item' }],
    });
    expect(service.getBulkList).toHaveBeenCalledWith(query);
  });

  it('wraps the batch options', async () => {
    const query = { ibs_acc_year: '2026-2027' } as GetItemBatchStockOptionsQueryDto;

    await expect(controller.getBatchOptionsByScope(query)).resolves.toEqual({
      success: true,
      message: 'Item batch stock options fetched successfully',
      data: [{ ibs_id: 'option' }],
    });
    expect(service.getBatchOptionsByScope).toHaveBeenCalledWith(query);
  });
});
