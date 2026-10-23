import { SuppliersController } from './suppliers.controller';
import { SuppliersService } from './suppliers.service';
import { SupplierPayload } from './types/supplier-api.types';

const SUP_ID = '019c6f6c-be87-7a11-8905-36092c46f501';
const SUPPLIER = { supId: SUP_ID, supName: 'Sri Ganesh Mills' } as SupplierPayload;
const BODY = {
  supGroupId: '019c6f6c-be87-7a11-8905-36092c46f503',
  supPurchaseType: 'LOCAL',
  supName: 'Sri Ganesh Mills',
  supStateName: 'Tamil Nadu',
  supStateCode: '33',
  supGstType: 'REGULAR',
};

describe('SuppliersController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: SuppliersController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(SUPPLIER),
      getById: jest.fn().mockResolvedValue(SUPPLIER),
      softDelete: jest.fn().mockResolvedValue({ supId: SUP_ID, deleted: true }),
    };
    controller = new SuppliersController(service as unknown as SuppliersService);
  });

  it.each([
    ['created', BODY, 'Supplier created successfully'],
    ['updated', { ...BODY, supId: SUP_ID }, 'Supplier updated successfully'],
  ])('save says %s by whether the body names a supId', async (_label, dto, message) => {
    await expect(controller.save(dto)).resolves.toEqual({ success: true, message, data: SUPPLIER });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('getById fetches by id and wraps the supplier', async () => {
    await expect(controller.getById(SUP_ID)).resolves.toEqual({
      success: true,
      message: 'Supplier fetched successfully',
      data: SUPPLIER,
    });
    expect(service.getById).toHaveBeenCalledWith(SUP_ID);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(SUP_ID)).resolves.toEqual({
      success: true,
      message: 'Supplier deleted successfully',
      data: { supId: SUP_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(SUP_ID);
  });
});
