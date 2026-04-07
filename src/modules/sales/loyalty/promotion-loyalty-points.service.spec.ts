import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import type { loyaltysch_gift, loyaltysch_list, loyaltysch_points } from '@prisma/client';
import { RequestContextService } from '../../common/request-context/request-context.service';
import { PrismaService } from '../../database/prisma/prisma.service';
import { AuditLogService } from '../audit-log/audit-log.service';
import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';

type PrismaMock = {
  loyaltysch_list: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  loyaltysch_points: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  loyaltysch_gift: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  $transaction: jest.Mock;
};

type LoyaltySchemeRecord = loyaltysch_list;
type LoyaltyPointRecord = loyaltysch_points;
type LoyaltyGiftRecord = loyaltysch_gift;

const makeSchemeRecord = (overrides: Partial<LoyaltySchemeRecord> = {}): LoyaltySchemeRecord =>
  ({
    ls_id: 1,
    ls_code: 'LS001',
    ls_name: 'Summer Rewards',
    ls_type: 'GENERAL',
    ls_apply_on: 'BILL_AMOUNT',
    ls_bill_type: 'ALL',
    ls_cust_type: 'ALL',
    ls_item_type: 'ALL',
    ls_start_date: new Date('2026-04-01T00:00:00.000Z'),
    ls_end_date: new Date('2026-04-30T00:00:00.000Z'),
    ls_comp_id: 1,
    ls_branch_id: null,
    ls_points_per_inr: new Prisma.Decimal('1.5000'),
    ls_points_per_qty: new Prisma.Decimal('0'),
    ls_min_bill_amount: new Prisma.Decimal('100.00'),
    ls_max_points_per_bill: new Prisma.Decimal('500.00'),
    ls_recur_apl: false,
    ls_bal_apl: false,
    ls_allow_point_earn: true,
    ls_allow_point_redeem: false,
    ls_allow_gift_redeem: false,
    ls_is_active: true,
    ls_is_deleted: false,
    created_on: new Date('2026-04-06T12:00:00.000Z'),
    created_by: 1001,
    modified_on: new Date('2026-04-06T12:00:00.000Z'),
    modified_by: 1001,
    ...overrides,
  }) as LoyaltySchemeRecord;

const makePointRecord = (overrides: Partial<LoyaltyPointRecord> = {}): LoyaltyPointRecord =>
  ({
    lspt_id: 11,
    lspt_ls_id: 1,
    lspt_slno: 1,
    lspt_item_id: 101,
    lspt_unit_id: 1,
    lspt_exceeds: new Prisma.Decimal('0.000'),
    lspt_each: new Prisma.Decimal('1.000'),
    lspt_factor: new Prisma.Decimal('1.0000'),
    lspt_points: new Prisma.Decimal('10.00'),
    lspt_is_active: true,
    lspt_is_deleted: false,
    created_on: new Date('2026-04-06T12:00:00.000Z'),
    created_by: 1001,
    modified_on: new Date('2026-04-06T12:00:00.000Z'),
    modified_by: 1001,
    ...overrides,
  }) as LoyaltyPointRecord;

const makeGiftRecord = (overrides: Partial<LoyaltyGiftRecord> = {}): LoyaltyGiftRecord =>
  ({
    gift_ls_id: 1,
    gift_slno: 1,
    gift_item_id: 101,
    gift_unit_id: 1,
    gift_qty: new Prisma.Decimal('1.000'),
    gift_points: new Prisma.Decimal('100.00'),
    gift_repeat: false,
    gift_is_active: true,
    gift_is_deleted: false,
    created_on: new Date('2026-04-06T12:00:00.000Z'),
    created_by: 1001,
    modified_on: new Date('2026-04-06T12:00:00.000Z'),
    modified_by: 1001,
    ...overrides,
  }) as LoyaltyGiftRecord;

const getFirstCreateCallData = <T>(mockFn: jest.Mock): T => {
  const [call] = mockFn.mock.calls as Array<[{ data: T }]>;
  return call[0].data;
};

describe('PromotionLoyaltyPointsService', () => {
  let service: PromotionLoyaltyPointsService;
  let prisma: PrismaMock;
  let auditLogService: Pick<AuditLogService, 'logEntityChange'>;
  let requestContextService: Pick<RequestContextService, 'getUserId'>;

  beforeEach(() => {
    prisma = {
      loyaltysch_list: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      loyaltysch_points: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      loyaltysch_gift: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      $transaction: jest.fn(),
    };

    prisma.$transaction.mockImplementation(
      async (callback: (tx: Prisma.TransactionClient) => Promise<unknown>) =>
        callback(prisma as unknown as Prisma.TransactionClient),
    );

    auditLogService = {
      logEntityChange: jest.fn().mockResolvedValue(undefined),
    };

    requestContextService = {
      getUserId: jest.fn().mockReturnValue('user-1'),
    };

    service = new PromotionLoyaltyPointsService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      requestContextService as RequestContextService,
    );
  });

  it('creates a loyalty scheme', async () => {
    prisma.loyaltysch_list.findFirst.mockResolvedValueOnce(null);
    prisma.loyaltysch_list.create.mockResolvedValueOnce(makeSchemeRecord());

    const input: SaveLoyaltySchemeDto = {
      ls_name: 'Summer Rewards',
      ls_type: 'GENERAL',
      ls_start_date: '2026-04-01',
      ls_end_date: '2026-04-30',
      ls_comp_id: 1,
      created_by: 1001,
    };

    const result = await service.saveScheme(input);

    expect(prisma.loyaltysch_list.create).toHaveBeenCalledTimes(1);
    const createSchemeData = getFirstCreateCallData<Prisma.loyaltysch_listUncheckedCreateInput>(
      prisma.loyaltysch_list.create,
    );
    expect(createSchemeData.ls_name).toBe('Summer Rewards');
    expect(result.ls_id).toBe(1);
    expect(result.points).toEqual([]);
    expect(result.gifts).toEqual([]);
    expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate scheme codes', async () => {
    prisma.loyaltysch_list.findFirst.mockResolvedValueOnce(makeSchemeRecord());

    const input: SaveLoyaltySchemeDto = {
      ls_code: 'LS001',
      ls_name: 'Summer Rewards',
      ls_type: 'GENERAL',
      ls_start_date: '2026-04-01',
      ls_end_date: '2026-04-30',
      ls_comp_id: 1,
    };

    await expect(service.saveScheme(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('lists schemes with decimal fields mapped to numbers', async () => {
    prisma.loyaltysch_list.count.mockResolvedValueOnce(1);
    prisma.loyaltysch_list.findMany.mockResolvedValueOnce([makeSchemeRecord()]);

    const query: ListLoyaltySchemeQueryDto = {
      page: 1,
      limit: 20,
    };

    const result = await service.listSchemes(query);

    expect(result.meta.total).toBe(1);
    expect(result.items[0].ls_points_per_inr).toBe(1.5);
    expect(result.items[0].ls_min_bill_amount).toBe(100);
  });

  it('returns a scheme with nested active points and gifts', async () => {
    prisma.loyaltysch_list.findFirst.mockResolvedValueOnce(makeSchemeRecord());
    prisma.loyaltysch_points.findMany.mockResolvedValueOnce([makePointRecord()]);
    prisma.loyaltysch_gift.findMany.mockResolvedValueOnce([makeGiftRecord()]);

    const result = await service.getSchemeById(1);

    expect(result.ls_id).toBe(1);
    expect(result.points).toHaveLength(1);
    expect(result.gifts).toHaveLength(1);
    expect(result.points[0].lspt_points).toBe(10);
    expect(result.gifts[0].gift_points).toBe(100);
  });

  it('soft deletes a scheme and cascades soft delete to points and gifts', async () => {
    prisma.loyaltysch_list.findFirst.mockResolvedValueOnce(makeSchemeRecord());
    prisma.loyaltysch_list.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.loyaltysch_points.updateMany.mockResolvedValueOnce({ count: 2 });
    prisma.loyaltysch_gift.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.softDeleteScheme(1, 1002);

    expect(result).toEqual({ ls_id: 1, deleted: true });
    expect(prisma.loyaltysch_points.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.loyaltysch_gift.updateMany).toHaveBeenCalledTimes(1);
    expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
  });

  it('creates a loyalty point with auto-assigned sequence number', async () => {
    prisma.loyaltysch_list.findFirst.mockResolvedValueOnce(makeSchemeRecord());
    prisma.loyaltysch_points.findFirst
      .mockResolvedValueOnce(makePointRecord({ lspt_slno: 2 }))
      .mockResolvedValueOnce(null);
    prisma.loyaltysch_points.create.mockResolvedValueOnce(
      makePointRecord({ lspt_id: 12, lspt_slno: 3 }),
    );

    const input: SaveLoyaltyPointDto = {
      lspt_ls_id: 1,
      lspt_points: 10,
      created_by: 1001,
    };

    const result = await service.savePoint(input);

    expect(prisma.loyaltysch_points.create).toHaveBeenCalledTimes(1);
    const createPointData = getFirstCreateCallData<Prisma.loyaltysch_pointsUncheckedCreateInput>(
      prisma.loyaltysch_points.create,
    );
    expect(createPointData.lspt_slno).toBe(3);
    expect(result.lspt_slno).toBe(3);
  });

  it('rejects child writes when the parent scheme is missing', async () => {
    prisma.loyaltysch_list.findFirst.mockResolvedValueOnce(null);

    const input: SaveLoyaltyPointDto = {
      lspt_ls_id: 1,
      lspt_points: 10,
    };

    await expect(service.savePoint(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a loyalty gift with auto-assigned sequence number', async () => {
    prisma.loyaltysch_list.findFirst.mockResolvedValueOnce(makeSchemeRecord());
    prisma.loyaltysch_gift.findFirst.mockResolvedValueOnce(makeGiftRecord({ gift_slno: 2 }));
    prisma.loyaltysch_gift.findFirst.mockResolvedValueOnce(null);
    prisma.loyaltysch_gift.create.mockResolvedValueOnce(
      makeGiftRecord({ gift_slno: 3, gift_item_id: 202 }),
    );

    const input: SaveLoyaltyGiftDto = {
      gift_ls_id: 1,
      gift_item_id: 202,
      gift_unit_id: 1,
      gift_qty: 1,
      gift_points: 150,
      created_by: 1001,
    };

    const result = await service.saveGift(input);

    expect(prisma.loyaltysch_gift.create).toHaveBeenCalledTimes(1);
    const createGiftData = getFirstCreateCallData<Prisma.loyaltysch_giftUncheckedCreateInput>(
      prisma.loyaltysch_gift.create,
    );
    expect(createGiftData.gift_slno).toBe(3);
    expect(result.gift_slno).toBe(3);
  });

  it('throws not found when fetching a missing point', async () => {
    prisma.loyaltysch_points.findFirst.mockResolvedValueOnce(null);

    await expect(service.getPointById(99)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes a point row', async () => {
    prisma.loyaltysch_points.findFirst.mockResolvedValueOnce(makePointRecord());
    prisma.loyaltysch_points.updateMany.mockResolvedValueOnce({ count: 1 });

    const result = await service.softDeletePoint(11, 1002);

    expect(result).toEqual({ lspt_id: 11, deleted: true });
    expect(prisma.loyaltysch_points.updateMany).toHaveBeenCalledTimes(1);
  });
});
