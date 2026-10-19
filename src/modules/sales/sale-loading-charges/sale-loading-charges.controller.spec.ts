import { DEFAULT_ACTOR } from '../../../common/utils/module-shared.utils';
import { SaleLoadingChargeController } from './sale-loading-charges.controller';
import { SaleLoadingChargeService } from './sale-loading-charges.service';
import { SaleLoadingChargePayload } from './types/sale-loading-charges-api.types';

const ILC_ID = '019c6f6c-be87-7a11-8905-36092c46a201';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a204';

const PAYLOAD = { ilcId: ILC_ID, ilcFromWeight: 100, ilcToWeight: 200 } as SaleLoadingChargePayload;

describe('SaleLoadingChargeController', () => {
  let service: {
    save: jest.Mock;
    createSaleLoadingCharge: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let controller: SaleLoadingChargeController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      createSaleLoadingCharge: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ ilcId: ILC_ID, deleted: true }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    controller = new SaleLoadingChargeController(
      service as unknown as SaleLoadingChargeService,
      context as never,
    );
  });

  it('creates under the request user when the body has no ilcId', async () => {
    const dto = { ilcFromWeight: 100, ilcToWeight: 200 };

    await expect(controller.createSaleLoadingCharge(dto)).resolves.toEqual({
      success: true,
      message: 'Sale loading charge created successfully',
      data: PAYLOAD,
    });
    expect(service.createSaleLoadingCharge).toHaveBeenCalledWith(dto, USER_ID);
    expect(service.save).not.toHaveBeenCalled();
  });

  it('creates under the default actor when nobody is logged in', async () => {
    context.getUserId.mockReturnValue(null);

    await controller.createSaleLoadingCharge({});

    expect(service.createSaleLoadingCharge).toHaveBeenCalledWith({}, DEFAULT_ACTOR);
  });

  it('routes a body with ilcId to save and words it as an update', async () => {
    const dto = { ilcId: ILC_ID, ilcLoadChrg: 40 };

    await expect(controller.createSaleLoadingCharge(dto)).resolves.toEqual({
      success: true,
      message: 'Sale loading charge updated successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
    expect(service.createSaleLoadingCharge).not.toHaveBeenCalled();
  });

  it('wraps a single slab', async () => {
    await expect(controller.getById(ILC_ID)).resolves.toEqual({
      success: true,
      message: 'Sale loading charge fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(ILC_ID)).resolves.toEqual({
      success: true,
      message: 'Sale loading charge deleted successfully',
      data: { ilcId: ILC_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(ILC_ID);
  });
});
