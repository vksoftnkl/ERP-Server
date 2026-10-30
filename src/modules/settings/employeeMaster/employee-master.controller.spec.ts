import { EmployeeMasterController } from './employee-master.controller';
import { EmployeeMasterService } from './employee-master.service';
import { EmployeeLedgerBackfillReport, EmployeeMasterPayload } from './types/employee-master-api.types';

const EMP_ID = '019c6f6c-be87-7a11-8905-36092c46e401';
const PAYLOAD = { empId: EMP_ID, empName: 'Ravi Kumar' } as EmployeeMasterPayload;

describe('EmployeeMasterController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
    backfillStaffAdvanceLedgers: jest.Mock;
  };
  let controller: EmployeeMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ empId: EMP_ID, deleted: true }),
      backfillStaffAdvanceLedgers: jest.fn(),
    };
    controller = new EmployeeMasterController(service as unknown as EmployeeMasterService);
  });

  it('words a save without empId as a create', async () => {
    const dto = { empName: 'Ravi Kumar', empSalaryType: 'MONTHLY' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Employee created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with empId as an update', async () => {
    await expect(
      controller.save({ empId: EMP_ID, empName: 'Ravi Kumar', empSalaryType: 'MONTHLY' }),
    ).resolves.toMatchObject({ message: 'Employee updated successfully' });
  });

  it('wraps a single employee', async () => {
    await expect(controller.getById(EMP_ID)).resolves.toEqual({
      success: true,
      message: 'Employee fetched successfully',
      data: PAYLOAD,
    });
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(EMP_ID)).resolves.toEqual({
      success: true,
      message: 'Employee deleted successfully',
      data: { empId: EMP_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(EMP_ID);
  });

  it('counts what the backfill created', async () => {
    const report: EmployeeLedgerBackfillReport = {
      walked: 2,
      created: [{ empId: EMP_ID, empName: 'Ravi', ledId: 'l1', ledName: 'Ravi - Staff Advance' }],
      failed: [],
    };
    service.backfillStaffAdvanceLedgers.mockResolvedValue(report);

    await expect(controller.backfillStaffAdvanceLedgers()).resolves.toEqual({
      success: true,
      message: '1 staff advance ledgers created for 2 employees',
      data: report,
    });
  });

  it('adds the failures to the backfill message when there are any', async () => {
    service.backfillStaffAdvanceLedgers.mockResolvedValue({
      walked: 3,
      created: [],
      failed: [
        { empId: 'a', empName: 'A', message: 'x' },
        { empId: 'b', empName: 'B', message: 'y' },
      ],
    });

    await expect(controller.backfillStaffAdvanceLedgers()).resolves.toMatchObject({
      message: '0 staff advance ledgers created for 3 employees, 2 failed',
    });
  });
});
