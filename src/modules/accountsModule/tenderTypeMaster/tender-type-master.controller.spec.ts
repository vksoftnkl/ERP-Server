import { BadRequestException } from '@nestjs/common';
import { TenderTypeMasterController } from './tender-type-master.controller';
import { TenderTypeMasterService } from './tender-type-master.service';
import { TenderTypeMasterPayload } from './types/tender-type-master-api.types';

const TYPE = { ttmTypeId: '12', ttmTypeName: 'WALLET' } as TenderTypeMasterPayload;

describe('TenderTypeMasterController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: TenderTypeMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(TYPE),
      getById: jest.fn().mockResolvedValue(TYPE),
      softDelete: jest.fn().mockResolvedValue({ ttmTypeId: '12', deleted: true }),
    };
    controller = new TenderTypeMasterController(service as unknown as TenderTypeMasterService);
  });

  it.each([
    ['created', { ttmTypeName: 'WALLET' }, 'Tender type created successfully'],
    ['updated', { ttmTypeId: '12', ttmTypeName: 'WALLET' }, 'Tender type updated successfully'],
  ])('save says %s by whether the body names a ttmTypeId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: TYPE });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('getById passes the raw id through for the service to parse', async () => {
    await expect(controller.getById(' 12 ')).resolves.toEqual({
      success: true,
      message: 'Tender type fetched successfully',
      data: TYPE,
    });
    expect(service.getById).toHaveBeenCalledWith(' 12 ');
  });

  it('getById lets an invalid-id refusal through', async () => {
    const refusal = new BadRequestException();
    service.getById.mockRejectedValueOnce(refusal);

    await expect(controller.getById('abc')).rejects.toBe(refusal);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove('12')).resolves.toEqual({
      success: true,
      message: 'Tender type deleted successfully',
      data: { ttmTypeId: '12', deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith('12');
  });
});
