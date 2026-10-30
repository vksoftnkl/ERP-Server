import { BranchMasterController } from './branch-master.controller';
import { BranchMasterService } from './branch-master.service';
import { BranchMasterPayload } from './types/branch-master-api.types';

const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e201';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e202';
const PAYLOAD = { brId: BRANCH_ID, brName: 'Anna Nagar' } as BranchMasterPayload;

describe('BranchMasterController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
  };
  let controller: BranchMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ brId: BRANCH_ID, deleted: true }),
      restore: jest.fn().mockResolvedValue({ brId: BRANCH_ID, deleted: false }),
    };
    controller = new BranchMasterController(service as unknown as BranchMasterService);
  });

  it('words a save without brId as a create', async () => {
    const dto = { brCompId: COMPANY_ID, brName: 'Anna Nagar', brStateCode: '33' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Branch created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with brId as an update', async () => {
    await expect(
      controller.save({
        brId: BRANCH_ID,
        brCompId: COMPANY_ID,
        brName: 'Anna Nagar',
        brStateCode: '33',
      }),
    ).resolves.toMatchObject({ message: 'Branch updated successfully' });
  });

  it('wraps a single branch', async () => {
    await expect(controller.getById(BRANCH_ID)).resolves.toEqual({
      success: true,
      message: 'Branch fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(BRANCH_ID);
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(BRANCH_ID)).resolves.toEqual({
      success: true,
      message: 'Branch deleted successfully',
      data: { brId: BRANCH_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(BRANCH_ID);
  });

  it('wraps a restore', async () => {
    await expect(controller.restore(BRANCH_ID)).resolves.toEqual({
      success: true,
      message: 'Branch restored successfully',
      data: { brId: BRANCH_ID, deleted: false },
    });
    expect(service.restore).toHaveBeenCalledWith(BRANCH_ID);
  });
});
