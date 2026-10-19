import { EmployeeDepartmentMasterController } from './employee-department-master.controller';
import { EmployeeDepartmentMasterService } from './employee-department-master.service';
import { EmployeeDepartmentMasterPayload } from './types/employee-department-master-api.types';

const DEPT_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const PAYLOAD = { edptId: DEPT_ID, edptName: 'Accounts' } as EmployeeDepartmentMasterPayload;

describe('EmployeeDepartmentMasterController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: EmployeeDepartmentMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ edptId: DEPT_ID, deleted: true }),
    };
    controller = new EmployeeDepartmentMasterController(
      service as unknown as EmployeeDepartmentMasterService,
    );
  });

  it('words a save without edptId as a create', async () => {
    const dto = { edptName: 'Accounts' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Employee department created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with edptId as an update', async () => {
    await expect(controller.save({ edptId: DEPT_ID, edptName: 'Accounts' })).resolves.toMatchObject(
      { message: 'Employee department updated successfully' },
    );
  });

  it('wraps a single department', async () => {
    await expect(controller.getById(DEPT_ID)).resolves.toEqual({
      success: true,
      message: 'Employee department fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(DEPT_ID);
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(DEPT_ID)).resolves.toEqual({
      success: true,
      message: 'Employee department deleted successfully',
      data: { edptId: DEPT_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(DEPT_ID);
  });
});
