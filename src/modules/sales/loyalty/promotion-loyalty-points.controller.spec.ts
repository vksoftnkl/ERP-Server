import { Test, TestingModule } from '@nestjs/testing';
import { DeleteLoyaltyGiftQueryDto } from './dto/delete-loyalty-gift-query.dto';
import { DeleteLoyaltyPointQueryDto } from './dto/delete-loyalty-point-query.dto';
import { DeleteLoyaltySchemeQueryDto } from './dto/delete-loyalty-scheme-query.dto';
import { LoyaltyGiftIdQueryDto } from './dto/loyalty-gift-id-query.dto';
import { LoyaltyPointIdQueryDto } from './dto/loyalty-point-id-query.dto';
import { LoyaltySchemeIdQueryDto } from './dto/loyalty-scheme-id-query.dto';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsController } from './promotion-loyalty-points.controller';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';

const SCHEME_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const POINT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5f';
const GIFT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d61';
const COMPANY_ID = '01963d86-caf0-7b26-89f0-58ac380a2d63';
const ITEM_ID = '01963d86-caf0-7b26-89f0-58ac380a2d64';
const UNIT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d66';
const USER_ID = '01963d86-caf0-7b26-89f0-58ac380a2d67';

const schemePayload = {
  ls_id: SCHEME_ID,
  ls_code: 'LS001',
  ls_name: 'Summer Rewards',
  ls_type: 'REDEEM',
  ls_status: 'DRAFT',
  ls_auto_apply: true,
  ls_apply_on: 'BILL_AMOUNT',
  ls_calc_on_amount_type: 'NET_AMOUNT',
  ls_bill_type: 'ALL',
  ls_cust_type: 'ALL',
  ls_item_type: 'ALL',
  ls_start_date: '2026-04-01T00:00:00.000Z',
  ls_end_date: '2026-04-30T00:00:00.000Z',
  ls_valid_from_time: null,
  ls_valid_to_time: null,
  ls_valid_weekdays: null,
  ls_comp_id: COMPANY_ID,
  ls_branch_id: null,
  ls_include_tax_for_points: false,
  ls_rounding_method: 'FLOOR',
  ls_recur_apl: false,
  ls_bal_apl: false,
  ls_allow_point_redeem: false,
  ls_allow_gift_redeem: false,
  ls_redeem_value_per_point: 1.5,
  ls_min_redeem_points: 100,
  ls_max_redeem_points_per_bill: 500,
  ls_max_redeem_percent_per_bill: 25,
  ls_redeem_min_bill_amount: 100,
  ls_points_valid_days: 30,
  ls_expiry_basis: 'EARN_DATE',
  ls_remarks: null,
  ls_is_active: true,
  ls_is_deleted: false,
  ls_sync_date: null,
  ls_created_on: '2026-04-06T12:00:00.000Z',
  ls_created_by: USER_ID,
  ls_updated_on: '2026-04-06T12:00:00.000Z',
  ls_updated_by: USER_ID,
  ls_approved_on: null,
  ls_approved_by: null,
  parties: [],
  points: [],
  gifts: [],
};

const pointPayload = {
  lspt_id: POINT_ID,
  lspt_ls_id: SCHEME_ID,
  lspt_slno: 1,
  lspt_item_id: ITEM_ID,
  lspt_unit_id: UNIT_ID,
  lspt_exceeds: 0,
  lspt_each: 1,
  lspt_factor: 10,
  lspt_points: 10,
  lspt_notes: null,
  lspt_is_active: true,
  lspt_is_deleted: false,
  lspt_sync_date: null,
  lspt_created_on: '2026-04-06T12:00:00.000Z',
  lspt_created_by: USER_ID,
  lspt_updated_on: '2026-04-06T12:00:00.000Z',
  lspt_updated_by: USER_ID,
};

const giftPayload = {
  lsg_id: GIFT_ID,
  lsg_ls_id: SCHEME_ID,
  lsg_slno: 1,
  lsg_item_id: ITEM_ID,
  lsg_unit_id: UNIT_ID,
  lsg_item_qty: 1,
  lsg_redeem_points: 100,
  lsg_repeat: false,
  lsg_notes: null,
  lsg_is_active: true,
  lsg_is_deleted: false,
  lsg_sync_date: null,
  lsg_created_on: '2026-04-06T12:00:00.000Z',
  lsg_created_by: USER_ID,
  lsg_updated_on: '2026-04-06T12:00:00.000Z',
  lsg_updated_by: USER_ID,
};

describe('PromotionLoyaltyPointsController', () => {
  let controller: PromotionLoyaltyPointsController;

  const serviceMock = {
    saveScheme: jest.fn(),
    getSchemeById: jest.fn(),
    softDeleteScheme: jest.fn(),
    savePoint: jest.fn(),
    getPointById: jest.fn(),
    softDeletePoint: jest.fn(),
    saveGift: jest.fn(),
    getGiftById: jest.fn(),
    softDeleteGift: jest.fn(),
  };

  beforeEach(async () => {
    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PromotionLoyaltyPointsController],
      providers: [
        {
          provide: PromotionLoyaltyPointsService,
          useValue: serviceMock,
        },
      ],
    }).compile();

    controller = moduleRef.get<PromotionLoyaltyPointsController>(PromotionLoyaltyPointsController);
    jest.clearAllMocks();
  });

  it('wraps scheme create response', async () => {
    serviceMock.saveScheme.mockResolvedValue(schemePayload);

    const payload: SaveLoyaltySchemeDto = {
      ls_name: 'Summer Rewards',
      ls_type: 'REDEEM',
      ls_start_date: '2026-04-01',
      ls_end_date: '2026-04-30',
      ls_comp_id: COMPANY_ID,
    };

    await expect(controller.saveScheme(payload)).resolves.toEqual({
      success: true,
      message: 'Loyalty scheme created successfully',
      data: schemePayload,
    });
  });

  it('wraps scheme get response', async () => {
    serviceMock.getSchemeById.mockResolvedValue(schemePayload);

    const query: LoyaltySchemeIdQueryDto = { ls_id: SCHEME_ID };

    await expect(controller.getSchemeById(query)).resolves.toEqual({
      success: true,
      message: 'Loyalty scheme fetched successfully',
      data: schemePayload,
    });
  });

  it('wraps scheme delete response', async () => {
    serviceMock.softDeleteScheme.mockResolvedValue({ ls_id: SCHEME_ID, deleted: true });

    const query: DeleteLoyaltySchemeQueryDto = { ls_id: SCHEME_ID, ls_updated_by: USER_ID };

    await expect(controller.deleteScheme(query)).resolves.toEqual({
      success: true,
      message: 'Loyalty scheme deleted successfully',
      data: { ls_id: SCHEME_ID, deleted: true },
    });
  });

  it('wraps point create response', async () => {
    serviceMock.savePoint.mockResolvedValue(pointPayload);

    const payload: SaveLoyaltyPointDto = {
      lspt_ls_id: SCHEME_ID,
      lspt_each: 1,
      lspt_points: 10,
    };

    await expect(controller.savePoint(payload)).resolves.toEqual({
      success: true,
      message: 'Loyalty point created successfully',
      data: pointPayload,
    });
  });

  it('wraps point get and delete responses', async () => {
    serviceMock.getPointById.mockResolvedValue(pointPayload);
    serviceMock.softDeletePoint.mockResolvedValue({ lspt_id: POINT_ID, deleted: true });

    const getQuery: LoyaltyPointIdQueryDto = { lspt_id: POINT_ID };
    const deleteQuery: DeleteLoyaltyPointQueryDto = {
      lspt_id: POINT_ID,
      lspt_updated_by: USER_ID,
    };

    await expect(controller.getPointById(getQuery)).resolves.toEqual({
      success: true,
      message: 'Loyalty point fetched successfully',
      data: pointPayload,
    });

    await expect(controller.deletePoint(deleteQuery)).resolves.toEqual({
      success: true,
      message: 'Loyalty point deleted successfully',
      data: { lspt_id: POINT_ID, deleted: true },
    });
  });

  it('wraps gift create response', async () => {
    serviceMock.saveGift.mockResolvedValue(giftPayload);
    const payload: SaveLoyaltyGiftDto = {
      lsg_ls_id: SCHEME_ID,
      lsg_item_id: ITEM_ID,
      lsg_unit_id: UNIT_ID,
      lsg_item_qty: 1,
      lsg_redeem_points: 100,
    };
    await expect(controller.saveGift(payload)).resolves.toEqual({
      success: true,
      message: 'Loyalty gift created successfully',
      data: giftPayload,
    });
  });

  it('wraps gift get and delete responses', async () => {
    serviceMock.getGiftById.mockResolvedValue(giftPayload);
    serviceMock.softDeleteGift.mockResolvedValue({
      lsg_id: GIFT_ID,
      deleted: true,
    });

    const getQuery: LoyaltyGiftIdQueryDto = { lsg_id: GIFT_ID };
    const deleteQuery: DeleteLoyaltyGiftQueryDto = {
      lsg_id: GIFT_ID,
      lsg_updated_by: USER_ID,
    };

    await expect(controller.getGiftById(getQuery)).resolves.toEqual({
      success: true,
      message: 'Loyalty gift fetched successfully',
      data: giftPayload,
    });

    await expect(controller.deleteGift(deleteQuery)).resolves.toEqual({
      success: true,
      message: 'Loyalty gift deleted successfully',
      data: {
        lsg_id: GIFT_ID,
        deleted: true,
      },
    });
  });
});
