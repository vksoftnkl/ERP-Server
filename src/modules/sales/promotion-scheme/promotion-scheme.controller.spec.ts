import { NotFoundException } from '@nestjs/common';
import { ListPromotionSchemeQueryDto } from './dto/list-promotion-scheme-query.dto';
import { SavePromotionSchemeDto } from './dto/save-promotion-scheme.dto';
import { PromotionSchemeController } from './promotion-scheme.controller';
import { PromotionSchemeService } from './promotion-scheme.service';
import {
  PromotionSchemeEligibilityPayload,
  PromotionSchemePayload,
} from './types/promotion-scheme-api.types';

const PRM_ID = '019c6f6c-be87-7a11-8905-36092c46e501';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e502';
const CUSTOMER_ID = '019c6f6c-be87-7a11-8905-36092c46e503';

const SCHEME = {
  prm_id: PRM_ID,
  prm_code: 'SUMMER',
  slabs: [],
} as unknown as PromotionSchemePayload;
const VERDICT = {
  prm_id: PRM_ID,
  cus_id: CUSTOMER_ID,
  qualifies: true,
  decided_by: 'ALL',
} as PromotionSchemeEligibilityPayload;

describe('PromotionSchemeController', () => {
  let service: {
    saveScheme: jest.Mock;
    getSchemeById: jest.Mock;
    listSchemes: jest.Mock;
    checkEligibility: jest.Mock;
    softDeleteScheme: jest.Mock;
  };
  let controller: PromotionSchemeController;

  beforeEach(() => {
    service = {
      saveScheme: jest.fn().mockResolvedValue(SCHEME),
      getSchemeById: jest.fn().mockResolvedValue(SCHEME),
      listSchemes: jest.fn().mockResolvedValue([SCHEME]),
      checkEligibility: jest.fn().mockResolvedValue(VERDICT),
      softDeleteScheme: jest.fn().mockResolvedValue({ deleted: true, prm_id: PRM_ID }),
    };
    controller = new PromotionSchemeController(service as unknown as PromotionSchemeService);
  });

  it('words a save without prm_id as a create and hands the whole body over', async () => {
    const dto = { prm_comp_id: COMPANY_ID, prm_code: 'SUMMER' } as SavePromotionSchemeDto;

    await expect(controller.saveScheme(dto)).resolves.toEqual({
      success: true,
      message: 'Promotion scheme created successfully',
      data: SCHEME,
    });
    expect(service.saveScheme).toHaveBeenCalledWith(dto);
  });

  it('words a save with prm_id as an update', async () => {
    await expect(
      controller.saveScheme({ prm_id: PRM_ID, prm_name: 'Renamed' }),
    ).resolves.toMatchObject({ message: 'Promotion scheme updated successfully' });
  });

  it('fetches one scheme by the prm_id on the query', async () => {
    await expect(controller.getScheme({ prm_id: PRM_ID })).resolves.toEqual({
      success: true,
      message: 'Promotion scheme fetched successfully',
      data: SCHEME,
    });
    expect(service.getSchemeById).toHaveBeenCalledWith(PRM_ID);
  });

  it('hands the whole list query to the service', async () => {
    const query = { prm_comp_id: COMPANY_ID } as ListPromotionSchemeQueryDto;

    await expect(controller.listSchemes(query)).resolves.toEqual({
      success: true,
      message: 'Promotion schemes fetched successfully',
      data: [SCHEME],
    });
    expect(service.listSchemes).toHaveBeenCalledWith(query);
  });

  it('asks eligibility with the scheme and the customer', async () => {
    await expect(
      controller.checkEligibility({
        prm_id: PRM_ID,
        cus_id: CUSTOMER_ID,
      }),
    ).resolves.toEqual({
      success: true,
      message: 'Promotion scheme eligibility evaluated successfully',
      data: VERDICT,
    });
    expect(service.checkEligibility).toHaveBeenCalledWith(PRM_ID, CUSTOMER_ID);
  });

  it('forwards the delete actor so the audit row names a person', async () => {
    await expect(
      controller.deleteScheme({
        prm_id: PRM_ID,
        prm_modified_by: 'hq-user',
      }),
    ).resolves.toEqual({
      success: true,
      message: 'Promotion scheme deleted successfully',
      data: { deleted: true, prm_id: PRM_ID },
    });
    expect(service.softDeleteScheme).toHaveBeenCalledWith(PRM_ID, 'hq-user');
  });

  it('lets a service refusal reach the filter unchanged', async () => {
    const refusal = new NotFoundException({
      success: false,
      message: 'Promotion scheme not found',
    });
    service.getSchemeById.mockRejectedValue(refusal);

    await expect(controller.getScheme({ prm_id: PRM_ID })).rejects.toBe(refusal);
  });
});
