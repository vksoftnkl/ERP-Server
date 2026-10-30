import { AccGroupMasterController } from './acc-group-master.controller';
import { AccGroupMasterService } from './acc-group-master.service';
import { AccGroupMasterPayload } from './types/acc-group-master-api.types';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f212';
const PARENT_ID = '019c6f6c-be87-7a11-8905-36092c46f211';
const GROUP = { accGroupId: GROUP_ID, accGroupName: 'Debtors - West' } as AccGroupMasterPayload;

describe('AccGroupMasterController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: AccGroupMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(GROUP),
      getById: jest.fn().mockResolvedValue(GROUP),
      softDelete: jest.fn().mockResolvedValue({ accGroupId: GROUP_ID, deleted: true }),
    };
    controller = new AccGroupMasterController(service as unknown as AccGroupMasterService);
  });

  it.each([
    [
      'created',
      { accGroupName: 'Debtors - West', accGroupParentId: PARENT_ID },
      'Account group created successfully',
    ],
    [
      'updated',
      { accGroupId: GROUP_ID, accGroupName: 'Debtors - West' },
      'Account group updated successfully',
    ],
  ])('save says %s by whether the body names an accGroupId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: GROUP });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('getById fetches by id and wraps the group', async () => {
    await expect(controller.getById(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Account group fetched successfully',
      data: GROUP,
    });
    expect(service.getById).toHaveBeenCalledWith(GROUP_ID);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Account group deleted successfully',
      data: { accGroupId: GROUP_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(GROUP_ID);
  });
});
