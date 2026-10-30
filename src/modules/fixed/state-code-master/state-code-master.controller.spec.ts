import { StateCodeMasterController } from './state-code-master.controller';
import { StateCodeMasterService } from './state-code-master.service';
import { StateCodeMasterPayload } from './types/state-code-master-api.types';

const PAYLOAD = { stateCode: 'TN', stateName: 'Tamil Nadu' } as StateCodeMasterPayload;
const META = { page: 1, limit: 20, total: 1, total_pages: 1 };

describe('StateCodeMasterController', () => {
  let service: {
    save: jest.Mock;
    list: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
  };
  let controller: StateCodeMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      list: jest.fn().mockResolvedValue({ items: [PAYLOAD], meta: META }),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ stateCode: 'TN', deleted: true }),
    };
    controller = new StateCodeMasterController(service as unknown as StateCodeMasterService);
  });

  it('words every save the same way, since the code decides create or update', async () => {
    const dto = { stateCode: 'TN', stateName: 'Tamil Nadu' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'State code saved successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('lifts the list items and meta into the envelope', async () => {
    await expect(controller.list({})).resolves.toEqual({
      success: true,
      message: 'State codes fetched successfully',
      data: [PAYLOAD],
      meta: META,
    });
  });

  it('passes the raw code through to the service, which normalises it', async () => {
    await expect(controller.getById('tn')).resolves.toEqual({
      success: true,
      message: 'State code fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith('tn');
  });

  it('wraps a delete', async () => {
    await expect(controller.remove('TN')).resolves.toEqual({
      success: true,
      message: 'State code deleted successfully',
      data: { stateCode: 'TN', deleted: true },
    });
  });
});
