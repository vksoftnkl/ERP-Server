import { CompanyMasterController } from './company-master.controller';
import { CompanyMasterService } from './company-master.service';
import { CompanyMasterPayload } from './types/company-master-api.types';

const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e101';
const PAYLOAD = { compId: COMPANY_ID, compName: 'Zeta Traders' } as CompanyMasterPayload;

describe('CompanyMasterController', () => {
  let service: {
    save: jest.Mock;
    getById: jest.Mock;
    softDelete: jest.Mock;
    restore: jest.Mock;
  };
  let controller: CompanyMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(PAYLOAD),
      getById: jest.fn().mockResolvedValue(PAYLOAD),
      softDelete: jest.fn().mockResolvedValue({ compId: COMPANY_ID, deleted: true }),
      restore: jest.fn().mockResolvedValue({ compId: COMPANY_ID, deleted: false }),
    };
    controller = new CompanyMasterController(service as unknown as CompanyMasterService);
  });

  it('words a save without compId as a create', async () => {
    const dto = { compName: 'Zeta Traders', compStateCode: '33' };

    await expect(controller.save(dto)).resolves.toEqual({
      success: true,
      message: 'Company created successfully',
      data: PAYLOAD,
    });
    expect(service.save).toHaveBeenCalledWith(dto);
  });

  it('words a save with compId as an update', async () => {
    await expect(
      controller.save({ compId: COMPANY_ID, compName: 'Zeta Traders', compStateCode: '33' }),
    ).resolves.toMatchObject({ message: 'Company updated successfully' });
  });

  it('wraps a single company', async () => {
    await expect(controller.getById(COMPANY_ID)).resolves.toEqual({
      success: true,
      message: 'Company fetched successfully',
      data: PAYLOAD,
    });
    expect(service.getById).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('wraps a delete', async () => {
    await expect(controller.remove(COMPANY_ID)).resolves.toEqual({
      success: true,
      message: 'Company deleted successfully',
      data: { compId: COMPANY_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(COMPANY_ID);
  });

  it('wraps a restore', async () => {
    await expect(controller.restore(COMPANY_ID)).resolves.toEqual({
      success: true,
      message: 'Company restored successfully',
      data: { compId: COMPANY_ID, deleted: false },
    });
    expect(service.restore).toHaveBeenCalledWith(COMPANY_ID);
  });
});
