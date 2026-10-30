import { ChargeMasterController } from './charge-master.controller';
import { ChargeMasterService } from './charge-master.service';
import { ChargeMasterPayload } from './types/charge-master-api.types';

const CHG_ID = '019c6f6c-be87-7a11-8905-36092c46f601';
const CHARGE = { chgId: CHG_ID, chgName: 'Freight' } as ChargeMasterPayload;
const BODY = {
  chgName: 'Freight',
  chgModule: 'P',
  chgMethod: 'FIXED',
  chgType: 'ADD',
  chgApplyOn: 'VALUE',
  chgLedgerCode: '019c6f6c-be87-7a11-8905-36092c46f603',
};

describe('ChargeMasterController', () => {
  let service: { save: jest.Mock; get: jest.Mock; softDelete: jest.Mock };
  let controller: ChargeMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(CHARGE),
      get: jest.fn(),
      softDelete: jest.fn().mockResolvedValue({ chgId: CHG_ID, deleted: true }),
    };
    controller = new ChargeMasterController(service as unknown as ChargeMasterService);
  });

  it.each([
    ['created', BODY, 'Charge created successfully'],
    ['updated', { ...BODY, chgId: CHG_ID }, 'Charge updated successfully'],
  ])('save says %s by whether the body names a chgId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: CHARGE });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it.each([
    ['one charge', CHARGE, 'Charge fetched successfully'],
    ['a module list', [CHARGE], 'Charges fetched successfully'],
  ])('get words %s by its shape', async (_label, data, message) => {
    service.get.mockResolvedValue(data);
    const query = { chgModule: 'P' };

    await expect(controller.get(query)).resolves.toEqual({ success: true, message, data });
    expect(service.get).toHaveBeenCalledWith(query);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(CHG_ID)).resolves.toEqual({
      success: true,
      message: 'Charge deleted successfully',
      data: { chgId: CHG_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(CHG_ID);
  });
});
