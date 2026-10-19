import { EmployeeDesignationMasterController } from './employee-designation-master.controller';
import { EmployeeDesignationMasterService } from './employee-designation-master.service';
import { EmployeeDesignationMasterPayload } from './types/employee-designation-master-api.types';

const DESIG_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const PAYLOAD = { edId: DESIG_ID, edName: 'Cashier' } as EmployeeDesignationMasterPayload;

describe('EmployeeDesignationMasterController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: EmployeeDesignationMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ edId: DESIG_ID, deleted: true }),
    };
    controller = new EmployeeDesignationMasterController(
      service as unknown as EmployeeDesignationMasterService,
    );
  });

  it('words a save without edId as a create', async () => {
    const dto = { edName: 'Cashier' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Employee designation created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with edId as an update', async () => {
    await expect(controller.save({ edId: DESIG_ID, edName: 'Cashier' })).resolves.toMatchObject({
      message: 'Employee designation updated successfully',
    });
  });

  it('wraps a single designation', async () => {
    await expect(controller.getById(DESIG_ID)).resolves.toEqual({
      success: true,
      message: 'Employee designation fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(DESIG_ID)).resolves.toEqual({
      success: true,
      message: 'Employee designation deleted successfully',
      data: { edId: DESIG_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(DESIG_ID);
  });
});
