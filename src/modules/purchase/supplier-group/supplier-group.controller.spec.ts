import { ConflictException } from '@nestjs/common';
import { SupplierGroupController } from './supplier-group.controller';
import { SupplierGroupService } from './supplier-group.service';
import { SupplierGroupPayload } from './types/supplier-group-api.types';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46f001';
const GROUP = { spgId: GROUP_ID, spgName: 'Fabric Mills' } as SupplierGroupPayload;

describe('SupplierGroupController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: SupplierGroupController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(GROUP),
      getById: jest.fn().mockResolvedValue(GROUP),
      softDelete: jest.fn().mockResolvedValue({ spgId: GROUP_ID, deleted: true }),
    };
    controller = new SupplierGroupController(service as unknown as SupplierGroupService);
  });

  it.each([
    ['created', { spgName: 'Fabric Mills' }, 'Supplier group created successfully'],
    [
      'updated',
      { spgId: GROUP_ID, spgName: 'Fabric Mills' },
      'Supplier group updated successfully',
    ],
  ])('save says %s by whether the body names a spgId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: GROUP });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('save lets a service refusal through for the filter to word', async () => {
    const refusal = new ConflictException();
    service.save.mockRejectedValueOnce(refusal);

    await expect(controller.save({ spgName: 'Fabric Mills' })).rejects.toBe(refusal);
  });

  it('getById fetches by id and wraps the group', async () => {
    await expect(controller.getById(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Supplier group fetched successfully',
      data: GROUP,
    });
    expect(service.getById).toHaveBeenCalledWith(GROUP_ID);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Supplier group deleted successfully',
      data: { spgId: GROUP_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(GROUP_ID);
  });
});
