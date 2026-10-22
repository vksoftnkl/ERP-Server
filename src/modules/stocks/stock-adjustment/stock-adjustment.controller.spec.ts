import { StockAdjustmentController } from './stock-adjustment.controller';
import { StockAdjustmentService } from './stock-adjustment.service';
import type { SaveStockAdjustmentDto } from './dto/save-stock-adjustment.dto';

const SVH_ID = '019c6f6c-be87-7a11-8905-36092c46b301';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b302';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46b303';
const GODOWN_ID = '019c6f6c-be87-7a11-8905-36092c46b304';
const ACC_YEAR = '2026-2027';

const REF = { svhId: SVH_ID, accYear: ACC_YEAR, companyId: COMPANY_ID, branchId: BRANCH_ID };

describe('StockAdjustmentController', () => {
  let service: {
    save: jest.Mock;
    getOne: jest.Mock;
    validate: jest.Mock;
    post: jest.Mock;
    cancel: jest.Mock;
    remove: jest.Mock;
    pickStock: jest.Mock;
  };
  let controller: StockAdjustmentController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue({ svhId: SVH_ID }),
      getOne: jest.fn().mockResolvedValue({ kind: 'RELOT' }),
      validate: jest.fn().mockResolvedValue([]),
      post: jest.fn().mockResolvedValue({ svhId: SVH_ID, rowsPosted: 4 }),
      cancel: jest.fn().mockResolvedValue({ svhId: SVH_ID, rowsReversed: 4 }),
      remove: jest.fn().mockResolvedValue({ svhId: SVH_ID, deleted: true }),
      pickStock: jest.fn().mockResolvedValue([{ sblId: 'a' }, { sblId: 'b' }]),
    };
    controller = new StockAdjustmentController(service as unknown as StockAdjustmentService);
  });

  const body = (header: Record<string, unknown>) =>
    ({
      header: { voucherType: 'ADJUSTMENT', ...header },
      lines: [],
    }) as unknown as SaveStockAdjustmentDto;

  it('words a save without svhId as a create and one with it as an update', async () => {
    await expect(controller.save(body({}))).resolves.toEqual({
      success: true,
      message: 'Stock adjustment created successfully',
      data: { svhId: SVH_ID },
    });
    await expect(controller.save(body({ svhId: SVH_ID }))).resolves.toMatchObject({
      message: 'Stock adjustment updated successfully',
    });
  });

  it('loads one document by its reference', async () => {
    await expect(controller.load(REF)).resolves.toEqual({
      success: true,
      message: 'Stock adjustment fetched successfully',
      data: { kind: 'RELOT' },
    });
    expect(service.getOne).toHaveBeenCalledWith(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID);
  });

  it('counts the lines with problems in the validate message', async () => {
    service.validate.mockResolvedValueOnce([
      { problem: null },
      { problem: 'short' },
      { problem: 'x' },
    ]);
    await expect(controller.validate(REF)).resolves.toMatchObject({
      message: '2 of 3 lines have problems',
    });

    service.validate.mockResolvedValueOnce([{ problem: null }, { problem: null }]);
    await expect(controller.validate(REF)).resolves.toMatchObject({
      message: 'All 2 lines are clean',
    });
  });

  it('reports the ledger rows a post wrote and a cancel reversed', async () => {
    await expect(controller.post(REF)).resolves.toMatchObject({
      message: 'Stock adjustment posted — 4 ledger rows',
    });
    await expect(controller.cancel({ ...REF, reason: 'Keyed twice' })).resolves.toMatchObject({
      message: 'Stock adjustment cancelled — 4 reversal rows',
    });
    expect(service.post).toHaveBeenCalledWith(REF);
    expect(service.cancel).toHaveBeenCalledWith({ ...REF, reason: 'Keyed twice' });
  });

  it('deletes by reference', async () => {
    await expect(controller.remove(REF)).resolves.toEqual({
      success: true,
      message: 'Stock adjustment deleted successfully',
      data: { svhId: SVH_ID, deleted: true },
    });
    expect(service.remove).toHaveBeenCalledWith(SVH_ID, ACC_YEAR, COMPANY_ID, BRANCH_ID);
  });

  it('counts the holdings the picker found', async () => {
    const query = { companyId: COMPANY_ID, branchId: BRANCH_ID, godownId: GODOWN_ID };

    await expect(controller.pickStock(query)).resolves.toMatchObject({ message: '2 holdings' });
    expect(service.pickStock).toHaveBeenCalledWith(query);
  });
});
