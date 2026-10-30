import { NotFoundException } from '@nestjs/common';
import { CompanyGroupMasterController } from './company-group-master.controller';
import { CompanyGroupMasterService } from './company-group-master.service';
import { SaveCompanyGroupMasterDto } from './dto/save-company-group-master.dto';
import { CompanyGroupMasterPayload } from './types/company-group-master-api.types';

const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46c001';
const COMPANY_A = '019c6f6c-be87-7a11-8905-36092c46c0a1';

const GROUP: CompanyGroupMasterPayload = {
  cogGroupId: GROUP_ID,
  cogGroupName: 'North Region',
  cogCompanyIds: [COMPANY_A],
  cogIsActive: true,
  cogIsDeleted: false,
  cogSyncDate: null,
  cogCreatedOn: '2026-10-01T09:00:00.000Z',
  cogCreatedBy: null,
  cogModifiedOn: '2026-10-01T09:00:00.000Z',
  cogModifiedBy: null,
};

describe('CompanyGroupMasterController', () => {
  let service: { save: jest.Mock; getById: jest.Mock; softDelete: jest.Mock };
  let controller: CompanyGroupMasterController;

  beforeEach(() => {
    service = {
      save: jest.fn().mockResolvedValue(GROUP),
      getById: jest.fn().mockResolvedValue(GROUP),
      softDelete: jest.fn().mockResolvedValue({ cogGroupId: GROUP_ID, deleted: true }),
    };
    controller = new CompanyGroupMasterController(service as unknown as CompanyGroupMasterService);
  });

  describe('save', () => {
    it('says created when the body has no cogGroupId', async () => {
      const dto = {
        cogGroupName: 'North Region',
        cogCompanyIds: [COMPANY_A],
      } as SaveCompanyGroupMasterDto;

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message: 'Company group created successfully',
        data: GROUP,
      });
      expect(service.save).toHaveBeenCalledWith(dto);
    });

    it('says updated when the body names a cogGroupId', async () => {
      const dto = {
        cogGroupId: GROUP_ID,
        cogGroupName: 'North Region',
        cogCompanyIds: [COMPANY_A],
      } as SaveCompanyGroupMasterDto;

      await expect(controller.save(dto)).resolves.toEqual({
        success: true,
        message: 'Company group updated successfully',
        data: GROUP,
      });
      expect(service.save).toHaveBeenCalledWith(dto);
    });

    it('lets a service refusal through for the filter to word', async () => {
      const refusal = new NotFoundException();
      service.save.mockRejectedValueOnce(refusal);

      await expect(
        controller.save({ cogGroupId: GROUP_ID } as SaveCompanyGroupMasterDto),
      ).rejects.toBe(refusal);
    });
  });

  it('getById fetches by id and wraps the group', async () => {
    await expect(controller.getById(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Company group fetched successfully',
      data: GROUP,
    });
    expect(service.getById).toHaveBeenCalledWith(GROUP_ID);
  });

  it('remove soft-deletes by id and wraps the result', async () => {
    await expect(controller.remove(GROUP_ID)).resolves.toEqual({
      success: true,
      message: 'Company group deleted successfully',
      data: { cogGroupId: GROUP_ID, deleted: true },
    });
    expect(service.softDelete).toHaveBeenCalledWith(GROUP_ID);
  });
});
