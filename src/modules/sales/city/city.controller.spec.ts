import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { CityController } from './city.controller';
import { CityService } from './city.service';
import { CityPayload } from './types/city-api.types';

const CITY_ID = '019c6f6c-be87-7a11-8905-36092c46a201';
const STATE_ID = '019c6f6c-be87-7a11-8905-36092c46a203';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a206';

const PAYLOAD = { ctmId: CITY_ID, ctmName: 'Kochi' } as CityPayload;

describe('CityController', () => {
  let service: {
    save: jest.Mock;
    createCityMaster: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let controller: CityController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      createCityMaster: jest.fn().mockResolvedValue({ cityMaster: PAYLOAD, accGroupId: CITY_ID }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ ctmId: CITY_ID, deleted: true }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    controller = new CityController(service as unknown as CityService, context as never);
  });

  it('creates through createCityMaster as the request user', async () => {
    const dto = { ctmName: 'Kochi', ctmStateId: STATE_ID };

    await expect(controller.createCityMaster(dto)).resolves.toEqual({
      success: true,
      message: 'City created successfully',
      data: { cityMaster: PAYLOAD, accGroupId: CITY_ID },
    });
    expect(service.createCityMaster).toHaveBeenCalledWith(dto, USER_ID);
  });

  it('creates as the default actor when nobody is logged in', async () => {
    context.getUserId.mockReturnValue(null);
    const dto = { ctmName: 'Kochi', ctmStateId: STATE_ID };

    await controller.createCityMaster(dto);

    expect(service.createCityMaster).toHaveBeenCalledWith(dto, DEFAULT_ACTOR);
  });

  it('sends a body with ctmId to save and words it as an update', async () => {
    const dto = { ctmId: CITY_ID, ctmName: 'Kochi', ctmStateId: STATE_ID };

    await expect(controller.createCityMaster(dto)).resolves.toEqual({
      success: true,
      message: 'City updated successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
    expect(service.createCityMaster).not.toHaveBeenCalled();
  });

  it('wraps a single city and a delete', async () => {
    await expect(controller.getById(CITY_ID)).resolves.toEqual({
      success: true,
      message: 'City fetched successfully',
      data: PAYLOAD,
    });
    await expect(controller.remove(CITY_ID)).resolves.toEqual({
      success: true,
      message: 'City deleted successfully',
      data: { ctmId: CITY_ID, deleted: true },
    });
  });
});
