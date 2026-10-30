import { StockReasonsController } from './stock-reasons.controller';
import { StockReasonsService } from './stock-reasons.service';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46b401';
const SRM_ID = '019c6f6c-be87-7a11-8905-36092c46b402';

const ROW = { srmId: SRM_ID, code: 'THEFT', isActive: true };

describe('StockReasonsController', () => {
  let service: {
    pick: jest.Mock;
    list: jest.Mock;
    getOne: jest.Mock;
    usage: jest.Mock;
    save: jest.Mock;
    deactivate: jest.Mock;
  };
  let controller: StockReasonsController;

  beforeEach(() => {
    service = {
      pick: jest.fn().mockResolvedValue([ROW, ROW]),
      list: jest.fn().mockResolvedValue([ROW]),
      getOne: jest.fn().mockResolvedValue(ROW),
      usage: jest.fn().mockResolvedValue({ srmId: SRM_ID, ledgerRows: 0 }),
      save: jest.fn().mockResolvedValue(ROW),
      deactivate: jest.fn().mockResolvedValue(ROW),
    };
    controller = new StockReasonsController(service as unknown as StockReasonsService);
  });

  it('counts the reasons the picker and the list return', async () => {
    const query = { companyId: COMPANY_ID, voucherType: 'ADJUSTMENT' as const };

    await expect(controller.pick(query)).resolves.toMatchObject({
      message: '2 reasons',
      data: [ROW, ROW],
    });
    await expect(controller.list({ companyId: COMPANY_ID })).resolves.toMatchObject({
      message: '1 reasons',
    });
    expect(service.pick).toHaveBeenCalledWith(query);
  });

  it('lists active rows unless inactive ones are asked for', async () => {
    await controller.list({ companyId: COMPANY_ID });
    await controller.list({ companyId: COMPANY_ID, includeInactive: true });

    expect(service.list.mock.calls).toEqual([
      [COMPANY_ID, false],
      [COMPANY_ID, true],
    ]);
  });

  it('wraps one reason and its usage', async () => {
    const ref = { companyId: COMPANY_ID, srmId: SRM_ID };

    await expect(controller.getOne(ref)).resolves.toEqual({
      success: true,
      message: 'Stock reason fetched successfully',
      data: ROW,
    });
    await expect(controller.usage(ref)).resolves.toMatchObject({
      message: 'Stock reason usage fetched successfully',
    });
    expect(service.getOne).toHaveBeenCalledWith(COMPANY_ID, SRM_ID);
    expect(service.usage).toHaveBeenCalledWith(COMPANY_ID, SRM_ID);
  });

  it('words a save without srmId as a create and one with it as an update', async () => {
    const dto = { companyId: COMPANY_ID, code: 'THEFT', name: 'Theft', direction: 'OUT' as const };

    await expect(controller.save(dto)).resolves.toMatchObject({
      message: 'Stock reason created successfully',
    });
    await expect(controller.save({ ...dto, srmId: SRM_ID })).resolves.toMatchObject({
      message: 'Stock reason updated successfully',
    });
  });

  it.each([
    ['deleted', { srmId: SRM_ID, deleted: true }, 'Stock reason deleted'],
    ['reactivated', { ...ROW, isActive: true }, 'Stock reason reactivated'],
    ['deactivated', { ...ROW, isActive: false }, 'Stock reason deactivated'],
  ])('says the reason was %s', async (_label, result, message) => {
    service.deactivate.mockResolvedValue(result);

    await expect(controller.deactivate({ companyId: COMPANY_ID, srmId: SRM_ID })).resolves.toEqual({
      success: true,
      message,
      data: result,
    });
  });
});
