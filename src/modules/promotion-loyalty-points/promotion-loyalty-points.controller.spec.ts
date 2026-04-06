import { Test, TestingModule } from '@nestjs/testing';
import { DeleteLoyaltyGiftQueryDto } from './dto/delete-loyalty-gift-query.dto';
import { DeleteLoyaltyPointQueryDto } from './dto/delete-loyalty-point-query.dto';
import { DeleteLoyaltySchemeQueryDto } from './dto/delete-loyalty-scheme-query.dto';
import { ListLoyaltyGiftQueryDto } from './dto/list-loyalty-gift-query.dto';
import { ListLoyaltyPointQueryDto } from './dto/list-loyalty-point-query.dto';
import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import { LoyaltyGiftIdQueryDto } from './dto/loyalty-gift-id-query.dto';
import { LoyaltyPointIdQueryDto } from './dto/loyalty-point-id-query.dto';
import { LoyaltySchemeIdQueryDto } from './dto/loyalty-scheme-id-query.dto';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsController } from './promotion-loyalty-points.controller';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';

const schemePayload = {
  ls_id: 1,
  ls_code: 'LS001',
  ls_name: 'Summer Rewards',
  ls_type: 'GENERAL',
  ls_apply_on: 'BILL_AMOUNT',
  ls_bill_type: 'ALL',
  ls_cust_type: 'ALL',
  ls_item_type: 'ALL',
  ls_start_date: '2026-04-01T00:00:00.000Z',
  ls_end_date: '2026-04-30T00:00:00.000Z',
  ls_comp_id: 1,
  ls_branch_id: null,
  ls_points_per_inr: 1.5,
  ls_points_per_qty: 0,
  ls_min_bill_amount: 100,
  ls_max_points_per_bill: 500,
  ls_recur_apl: false,
  ls_bal_apl: false,
  ls_allow_point_earn: true,
  ls_allow_point_redeem: false,
  ls_allow_gift_redeem: false,
  ls_is_active: true,
  ls_is_deleted: false,
  created_on: '2026-04-06T12:00:00.000Z',
  created_by: 1001,
  modified_on: '2026-04-06T12:00:00.000Z',
  modified_by: 1001,
  points: [],
  gifts: [],
};

const schemeSummaryPayload = {
  ...schemePayload,
  points: undefined,
  gifts: undefined,
};

const pointPayload = {
  lspt_id: 11,
  lspt_ls_id: 1,
  lspt_slno: 1,
  lspt_item_id: 101,
  lspt_unit_id: 1,
  lspt_exceeds: 0,
  lspt_each: 1,
  lspt_factor: 1,
  lspt_points: 10,
  lspt_is_active: true,
  lspt_is_deleted: false,
  created_on: '2026-04-06T12:00:00.000Z',
  created_by: 1001,
  modified_on: '2026-04-06T12:00:00.000Z',
  modified_by: 1001,
};

const giftPayload = {
  gift_ls_id: 1,
  gift_slno: 1,
  gift_item_id: 101,
  gift_unit_id: 1,
  gift_qty: 1,
  gift_points: 100,
  gift_repeat: false,
  gift_is_active: true,
  gift_is_deleted: false,
  created_on: '2026-04-06T12:00:00.000Z',
  created_by: 1001,
  modified_on: '2026-04-06T12:00:00.000Z',
  modified_by: 1001,
};

describe('PromotionLoyaltyPointsController', () => {
  let controller: PromotionLoyaltyPointsController;

  const serviceMock = {
    saveScheme: jest.fn(),
    listSchemes: jest.fn(),
    getSchemeById: jest.fn(),
    softDeleteScheme: jest.fn(),
    savePoint: jest.fn(),
    listPoints: jest.fn(),
    getPointById: jest.fn(),
    softDeletePoint: jest.fn(),
    saveGift: jest.fn(),
    listGifts: jest.fn(),
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
      ls_type: 'GENERAL',
      ls_start_date: '2026-04-01',
      ls_end_date: '2026-04-30',
      ls_comp_id: 1,
    };

    await expect(controller.saveScheme(payload)).resolves.toEqual({
      success: true,
      message: 'Loyalty scheme created successfully',
      data: schemePayload,
    });
  });

  it('wraps scheme list response', async () => {
    serviceMock.listSchemes.mockResolvedValue({
      items: [schemeSummaryPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListLoyaltySchemeQueryDto = { page: 1, limit: 20 };

    await expect(controller.listSchemes(query)).resolves.toEqual({
      success: true,
      message: 'Loyalty schemes fetched successfully',
      data: [schemeSummaryPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('wraps scheme get response', async () => {
    serviceMock.getSchemeById.mockResolvedValue(schemePayload);

    const query: LoyaltySchemeIdQueryDto = { ls_id: 1 };

    await expect(controller.getSchemeById(query)).resolves.toEqual({
      success: true,
      message: 'Loyalty scheme fetched successfully',
      data: schemePayload,
    });
  });

  it('wraps scheme delete response', async () => {
    serviceMock.softDeleteScheme.mockResolvedValue({ ls_id: 1, deleted: true });

    const query: DeleteLoyaltySchemeQueryDto = { ls_id: 1, modified_by: 1001 };

    await expect(controller.deleteScheme(query)).resolves.toEqual({
      success: true,
      message: 'Loyalty scheme deleted successfully',
      data: { ls_id: 1, deleted: true },
    });
  });

  it('wraps point create response', async () => {
    serviceMock.savePoint.mockResolvedValue(pointPayload);

    const payload: SaveLoyaltyPointDto = {
      lspt_ls_id: 1,
      lspt_points: 10,
    };

    await expect(controller.savePoint(payload)).resolves.toEqual({
      success: true,
      message: 'Loyalty point created successfully',
      data: pointPayload,
    });
  });

  it('wraps point list response', async () => {
    serviceMock.listPoints.mockResolvedValue({
      items: [pointPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const query: ListLoyaltyPointQueryDto = { lspt_ls_id: 1, page: 1, limit: 20 };

    await expect(controller.listPoints(query)).resolves.toEqual({
      success: true,
      message: 'Loyalty points fetched successfully',
      data: [pointPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('wraps point get and delete responses', async () => {
    serviceMock.getPointById.mockResolvedValue(pointPayload);
    serviceMock.softDeletePoint.mockResolvedValue({ lspt_id: 11, deleted: true });

    const getQuery: LoyaltyPointIdQueryDto = { lspt_id: 11 };
    const deleteQuery: DeleteLoyaltyPointQueryDto = { lspt_id: 11, modified_by: 1001 };

    await expect(controller.getPointById(getQuery)).resolves.toEqual({
      success: true,
      message: 'Loyalty point fetched successfully',
      data: pointPayload,
    });

    await expect(controller.deletePoint(deleteQuery)).resolves.toEqual({
      success: true,
      message: 'Loyalty point deleted successfully',
      data: { lspt_id: 11, deleted: true },
    });
  });

  it('wraps gift create and list responses', async () => {
    serviceMock.saveGift.mockResolvedValue(giftPayload);
    serviceMock.listGifts.mockResolvedValue({
      items: [giftPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });

    const payload: SaveLoyaltyGiftDto = {
      gift_ls_id: 1,
      gift_item_id: 101,
      gift_unit_id: 1,
      gift_qty: 1,
      gift_points: 100,
    };
    const query: ListLoyaltyGiftQueryDto = { gift_ls_id: 1, page: 1, limit: 20 };

    await expect(controller.saveGift(payload)).resolves.toEqual({
      success: true,
      message: 'Loyalty gift created successfully',
      data: giftPayload,
    });

    await expect(controller.listGifts(query)).resolves.toEqual({
      success: true,
      message: 'Loyalty gifts fetched successfully',
      data: [giftPayload],
      meta: {
        page: 1,
        limit: 20,
        total: 1,
        total_pages: 1,
      },
    });
  });

  it('wraps gift get and delete responses', async () => {
    serviceMock.getGiftById.mockResolvedValue(giftPayload);
    serviceMock.softDeleteGift.mockResolvedValue({
      gift_ls_id: 1,
      gift_slno: 1,
      deleted: true,
    });

    const getQuery: LoyaltyGiftIdQueryDto = { gift_ls_id: 1, gift_slno: 1 };
    const deleteQuery: DeleteLoyaltyGiftQueryDto = {
      gift_ls_id: 1,
      gift_slno: 1,
      modified_by: 1001,
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
        gift_ls_id: 1,
        gift_slno: 1,
        deleted: true,
      },
    });
  });
});
