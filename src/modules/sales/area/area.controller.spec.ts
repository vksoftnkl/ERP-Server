import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { AreaController } from './area.controller';
import { AreaService } from './area.service';
import { AreaPayload } from './types/area-api.types';

const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46a301';
const CITY_ID = '019c6f6c-be87-7a11-8905-36092c46a303';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a306';

const PAYLOAD = { armId: AREA_ID, armName: 'Kakkanad' } as AreaPayload;

describe('AreaController', () => {
  let service: {
    save: jest.Mock;
    createAreaMaster: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let controller: AreaController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      createAreaMaster: jest.fn().mockResolvedValue({ areaMaster: PAYLOAD, accGroupId: AREA_ID }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ armId: AREA_ID, deleted: true }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    controller = new AreaController(service as unknown as AreaService, context as never);
  });

  it('creates through createAreaMaster as the request user', async () => {
    const dto = { armName: 'Kakkanad', armCityId: CITY_ID };

    await expect(controller.createAreaMaster(dto)).resolves.toEqual({
      success: true,
      message: 'Area created successfully',
      data: { areaMaster: PAYLOAD, accGroupId: AREA_ID },
    });
    expect(service.createAreaMaster).toHaveBeenCalledWith(dto, USER_ID);
  });

  it('creates as the default actor when nobody is logged in', async () => {
    context.getUserId.mockReturnValue(null);
    const dto = { armName: 'Kakkanad', armCityId: CITY_ID };

    await controller.createAreaMaster(dto);

    expect(service.createAreaMaster).toHaveBeenCalledWith(dto, DEFAULT_ACTOR);
  });

  it('sends a body with armId to save and words it as an update', async () => {
    const dto = { armId: AREA_ID, armName: 'Kakkanad', armCityId: CITY_ID };

    await expect(controller.createAreaMaster(dto)).resolves.toEqual({
      success: true,
      message: 'Area updated successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
    expect(service.createAreaMaster).not.toHaveBeenCalled();
  });

  it('wraps a single area and a delete', async () => {
    await expect(controller.getById(AREA_ID)).resolves.toEqual({
      success: true,
      message: 'Area fetched successfully',
      data: PAYLOAD,
    });
    await expect(controller.remove(AREA_ID)).resolves.toEqual({
      success: true,
      message: 'Area deleted successfully',
      data: { armId: AREA_ID, deleted: true },
    });
  });
});
