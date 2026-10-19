import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { StateController } from './state.controller';
import { StateService } from './state.service';
import { StatePayload } from './types/state-api.types';

const STATE_ID = '019c6f6c-be87-7a11-8905-36092c46a101';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46a104';

const PAYLOAD = { stmId: STATE_ID, stmName: 'Kerala' } as StatePayload;

describe('StateController', () => {
  let service: {
    save: jest.Mock;
    createStateMaster: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let context: { getUserId: jest.Mock };
  let controller: StateController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      createStateMaster: jest
        .fn()
        .mockResolvedValue({ stateMaster: PAYLOAD, accGroupId: STATE_ID }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ stmId: STATE_ID, deleted: true }),
    };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    controller = new StateController(service as unknown as StateService, context as never);
  });

  it('creates through createStateMaster as the request user and returns the group id too', async () => {
    const dto = { stmName: 'Kerala' };

    await expect(controller.createStateMaster(dto)).resolves.toEqual({
      success: true,
      message: 'State created successfully',
      data: { stateMaster: PAYLOAD, accGroupId: STATE_ID },
    });
    expect(service.createStateMaster).toHaveBeenCalledWith(dto, USER_ID);
    expect(service.save).not.toHaveBeenCalled();
  });

  it('creates as the default actor when nobody is logged in', async () => {
    context.getUserId.mockReturnValue(null);

    await controller.createStateMaster({ stmName: 'Kerala' });

    expect(service.createStateMaster).toHaveBeenCalledWith({ stmName: 'Kerala' }, DEFAULT_ACTOR);
  });

  it('sends a body with stmId to save and words it as an update', async () => {
    const dto = { stmId: STATE_ID, stmName: 'Kerala' };

    await expect(controller.createStateMaster(dto)).resolves.toEqual({
      success: true,
      message: 'State updated successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
    expect(service.createStateMaster).not.toHaveBeenCalled();
  });

  it('wraps a single state', async () => {
    await expect(controller.getById(STATE_ID)).resolves.toEqual({
      success: true,
      message: 'State fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(STATE_ID)).resolves.toEqual({
      success: true,
      message: 'State deleted successfully',
      data: { stmId: STATE_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(STATE_ID);
  });
});
