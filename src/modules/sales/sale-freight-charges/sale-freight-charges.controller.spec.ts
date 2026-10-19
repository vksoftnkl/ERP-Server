import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { SaleFreightChargeController } from './sale-freight-charges.controller';
import { SaleFreightChargeService } from './sale-freight-charges.service';
import { SaleFreightChargePayload } from './types/sale-freight-charges-api.types';

const FR_ID = '019c6f6c-be87-7a11-8905-36092c46a101';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a104';

const PAYLOAD = { frId: FR_ID, frFromKm: 0, frToKm: 50 } as SaleFreightChargePayload;

describe('SaleFreightChargeController', () => {
  let service: {
    save: jest.Mock;
    createSaleFreightCharge: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let controller: SaleFreightChargeController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      createSaleFreightCharge: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ frId: FR_ID, deleted: true }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    controller = new SaleFreightChargeController(
      service as unknown as SaleFreightChargeService,
      context as never,
    );
  });

  it('creates under the request user when the body has no frId', async () => {
    const dto = { frFromKm: 0, frToKm: 50 };

    await expect(controller.createSaleFreightCharge(dto)).resolves.toEqual({
      success: true,
      message: 'Sale freight charge created successfully',
      data: PAYLOAD,
    });
    expect(service.createSaleFreightCharge).toHaveBeenCalledWith(dto, USER_ID);
    expect(service.save).not.toHaveBeenCalled();
  });

  it('creates under the default actor when nobody is logged in', async () => {
    context.getUserId.mockReturnValue(null);

    await controller.createSaleFreightCharge({});

    expect(service.createSaleFreightCharge).toHaveBeenCalledWith({}, DEFAULT_ACTOR);
  });

  it('routes a body with frId to save and words it as an update', async () => {
    const dto = { frId: FR_ID, frToKm: 60 };

    await expect(controller.createSaleFreightCharge(dto)).resolves.toEqual({
      success: true,
      message: 'Sale freight charge updated successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
    expect(service.createSaleFreightCharge).not.toHaveBeenCalled();
  });

  it('wraps a single slab', async () => {
    await expect(controller.getById(FR_ID)).resolves.toEqual({
      success: true,
      message: 'Sale freight charge fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(FR_ID);
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(FR_ID)).resolves.toEqual({
      success: true,
      message: 'Sale freight charge deleted successfully',
      data: { frId: FR_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(FR_ID);
  });
});
