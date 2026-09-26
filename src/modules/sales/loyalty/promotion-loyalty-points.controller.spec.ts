import { Test, TestingModule } from '@nestjs/testing';
import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import {
  DeleteLoyaltySchemeQueryDto,
  LoyaltySchemeEligibilityQueryDto,
  LoyaltySchemeIdQueryDto,
} from './dto/loyalty-scheme-id-query.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsController } from './promotion-loyalty-points.controller';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';
import { LoyaltySchemePayload } from './types/promotion-loyalty-points-api.types';

const SCHEME_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const COMPANY_ID = '01963d86-caf0-7b26-89f0-58ac380a2d63';
const CUSTOMER_ID = '01963d86-caf0-7b26-89f0-58ac380a2d64';

const schemePayload = { lsc_id: SCHEME_ID, lsc_name: 'Diwali 2025' } as LoyaltySchemePayload;

describe('PromotionLoyaltyPointsController', () => {
  let controller: PromotionLoyaltyPointsController;

  const service = {
    saveScheme: jest.fn(),
    getSchemeById: jest.fn(),
    listSchemes: jest.fn(),
    checkEligibility: jest.fn(),
    softDeleteScheme: jest.fn(),
  };

  beforeEach(async () => {
    jest.resetAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PromotionLoyaltyPointsController],
      providers: [{ provide: PromotionLoyaltyPointsService, useValue: service }],
    }).compile();

    controller = module.get(PromotionLoyaltyPointsController);
  });

  // The message is how the screen tells the operator what happened, and it
  // turns on nothing but the presence of lsc_id.
  it('says "created" when the body carries no lsc_id', async () => {
    service.saveScheme.mockResolvedValue(schemePayload);
    const dto: SaveLoyaltySchemeDto = {
      lsc_comp_id: COMPANY_ID,
      lsc_code: 'DIWALI25',
      lsc_name: 'Diwali 2025',
      lsc_start_date: '2025-10-01',
      lsc_end_date: '2025-10-31',
    };

    const result = await controller.saveScheme(dto);

    expect(service.saveScheme).toHaveBeenCalledWith(dto);
    expect(result).toEqual({
      success: true,
      message: 'Loyalty scheme created successfully',
      data: schemePayload,
    });
  });

  it('says "updated" when the body carries one', async () => {
    service.saveScheme.mockResolvedValue(schemePayload);

    const result = await controller.saveScheme({ lsc_id: SCHEME_ID, lsc_status: 'SUSPENDED' });

    expect(result.message).toBe('Loyalty scheme updated successfully');
  });

  it('passes the five grids straight through to the service', async () => {
    service.saveScheme.mockResolvedValue(schemePayload);
    const dto: SaveLoyaltySchemeDto = {
      lsc_id: SCHEME_ID,
      branches: [],
      parties: [{ lsp_kind: 'CUSTOMER', lsp_scope_id: CUSTOMER_ID }],
      items: [],
      slabs: [{ lss_exceeds: 1000, lss_each: 100, lss_points: 2 }],
      gifts: [],
    };

    await controller.saveScheme(dto);

    expect(service.saveScheme).toHaveBeenCalledWith(dto);
  });

  it('fetches one scheme by lsc_id', async () => {
    service.getSchemeById.mockResolvedValue(schemePayload);
    const query: LoyaltySchemeIdQueryDto = { lsc_id: SCHEME_ID };

    const result = await controller.getScheme(query);

    expect(service.getSchemeById).toHaveBeenCalledWith(SCHEME_ID);
    expect(result).toEqual({
      success: true,
      message: 'Loyalty scheme fetched successfully',
      data: schemePayload,
    });
  });

  it('hands the whole list query to the service, aliases resolved', async () => {
    service.listSchemes.mockResolvedValue([schemePayload]);
    const query: ListLoyaltySchemeQueryDto = { lsc_comp_id: COMPANY_ID };

    const result = await controller.listSchemes(query);

    expect(service.listSchemes).toHaveBeenCalledWith(query);
    expect(result.data).toEqual([schemePayload]);
  });

  it('asks eligibility with both ids', async () => {
    const payload = { lsc_id: SCHEME_ID, cus_id: CUSTOMER_ID, qualifies: true };
    service.checkEligibility.mockResolvedValue(payload);
    const query: LoyaltySchemeEligibilityQueryDto = { lsc_id: SCHEME_ID, cus_id: CUSTOMER_ID };

    const result = await controller.checkEligibility(query);

    expect(service.checkEligibility).toHaveBeenCalledWith(SCHEME_ID, CUSTOMER_ID);
    expect(result.data).toEqual(payload);
  });

  it('forwards the delete actor so the audit row names a person', async () => {
    service.softDeleteScheme.mockResolvedValue({ deleted: true, lsc_id: SCHEME_ID });
    const query: DeleteLoyaltySchemeQueryDto = {
      lsc_id: SCHEME_ID,
      lsc_modified_by: 'counter-1',
    };

    const result = await controller.deleteScheme(query);

    expect(service.softDeleteScheme).toHaveBeenCalledWith(SCHEME_ID, 'counter-1');
    expect(result).toEqual({
      success: true,
      message: 'Loyalty scheme deleted successfully',
      data: { deleted: true, lsc_id: SCHEME_ID },
    });
  });
});
