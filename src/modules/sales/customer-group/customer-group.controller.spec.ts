import { CustomerGroupController } from './customer-group.controller';
import { CustomerGroupService } from './customer-group.service';
import { CustomerGroupPayload } from './types/customer-group-api.types';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46a401';

const PAYLOAD = { cgrId: GROUP_ID, cgrName: 'Wholesale' } as CustomerGroupPayload;

describe('CustomerGroupController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: CustomerGroupController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ cgrId: GROUP_ID, deleted: true }),
    };
    controller = new CustomerGroupController(service as unknown as CustomerGroupService);
  });

  it('words a save without cgrId as a create', async () => {
    const dto = { cgrName: 'Wholesale' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Customer group created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with cgrId as an update', async () => {
    await expect(controller.save({ cgrId: GROUP_ID, cgrName: 'Wholesale' })).resolves.toMatchObject(
      { message: 'Customer group updated successfully' },
    );
  });

  it('wraps a single group', async () => {
    await expect(controller.getById(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Customer group fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Customer group deleted successfully',
      data: { cgrId: GROUP_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(GROUP_ID);
  });
});
