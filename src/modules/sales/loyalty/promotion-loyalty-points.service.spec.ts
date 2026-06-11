import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { LoyaltyScheme, LoyaltySchemeGift, LoyaltySchemePoint, Prisma } from '@prisma/client';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { SaveLoyaltyGiftDto } from './dto/save-loyalty-gift.dto';
import { SaveLoyaltyPointDto } from './dto/save-loyalty-point.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';

type PrismaMock = {
  loyaltyScheme: {
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
  };
  loyaltySchemePoint: {
    aggregate: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  loyaltySchemeGift: {
    aggregate: jest.Mock;
    create: jest.Mock;
    findFirst: jest.Mock;
    findMany: jest.Mock;
    count: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  loyaltySchemeParty: {
    create: jest.Mock;
    findMany: jest.Mock;
    update: jest.Mock;
    updateMany: jest.Mock;
  };
  itemMaster: {
    findFirst: jest.Mock;
  };
  unit: {
    findFirst: jest.Mock;
  };
  $transaction: jest.Mock;
};

const SCHEME_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const POINT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d5f';
const NEXT_POINT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d60';
const GIFT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d61';
const NEXT_GIFT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d62';
const COMPANY_ID = '01963d86-caf0-7b26-89f0-58ac380a2d63';
const ITEM_ID = '01963d86-caf0-7b26-89f0-58ac380a2d64';
const NEXT_ITEM_ID = '01963d86-caf0-7b26-89f0-58ac380a2d65';
const UNIT_ID = '01963d86-caf0-7b26-89f0-58ac380a2d66';
const USER_ID = '01963d86-caf0-7b26-89f0-58ac380a2d67';
const BASE_DATE = new Date('2026-04-06T12:00:00.000Z');

const makeSchemeRecord = (overrides: Partial<LoyaltyScheme> = {}): LoyaltyScheme =>
  ({
    lsId: SCHEME_ID,
    lsCode: 'LS001',
    lsName: 'Summer Rewards',
    lsType: 'REDEEM',
    lsStatus: 'DRAFT',
    lsAutoApply: true,
    lsApplyOn: 'BILL_AMOUNT',
    lsCalcOnAmountType: 'NET_AMOUNT',
    lsBillType: 'ALL',
    lsCustType: 'ALL',
    lsItemType: 'ALL',
    lsStartDate: new Date('2026-04-01T00:00:00.000Z'),
    lsEndDate: new Date('2026-04-30T00:00:00.000Z'),
    lsValidFromTime: null,
    lsValidToTime: null,
    lsValidWeekdays: null,
    lsCompId: COMPANY_ID,
    lsBranchId: null,
    lsIncludeTaxForPoints: false,
    lsRoundingMethod: 'FLOOR',
    lsRecurApl: false,
    lsBalApl: false,
    lsAllowPointRedeem: false,
    lsAllowGiftRedeem: false,
    lsRedeemValuePerPoint: new Prisma.Decimal('1.5000'),
    lsMinRedeemPoints: new Prisma.Decimal('100.00'),
    lsMaxRedeemPointsPerBill: new Prisma.Decimal('500.00'),
    lsMaxRedeemPercentPerBill: new Prisma.Decimal('25.00'),
    lsRedeemMinBillAmount: new Prisma.Decimal('100.00'),
    lsPointsValidDays: 30,
    lsExpiryBasis: 'EARN_DATE',
    lsRemarks: null,
    lsIsActive: true,
    lsIsDeleted: false,
    lsSyncDate: null,
    lsCreatedOn: BASE_DATE,
    lsCreatedBy: USER_ID,
    lsUpdatedOn: BASE_DATE,
    lsUpdatedBy: USER_ID,
    lsApprovedOn: null,
    lsApprovedBy: null,
    ...overrides,
  }) as LoyaltyScheme;

const makePointRecord = (overrides: Partial<LoyaltySchemePoint> = {}): LoyaltySchemePoint =>
  ({
    lsptId: POINT_ID,
    lsptLsId: SCHEME_ID,
    lsptSlno: 1,
    lsptItemId: ITEM_ID,
    lsptUnitId: UNIT_ID,
    lsptExceeds: new Prisma.Decimal('0.000'),
    lsptEach: new Prisma.Decimal('1.000'),
    lsptFactor: new Prisma.Decimal('10.0000'),
    lsptPoints: new Prisma.Decimal('10.00'),
    lsptNotes: null,
    lsptIsActive: true,
    lsptIsDeleted: false,
    lsptSyncDate: null,
    lsptCreatedOn: BASE_DATE,
    lsptCreatedBy: USER_ID,
    lsptUpdatedOn: BASE_DATE,
    lsptUpdatedBy: USER_ID,
    ...overrides,
  }) as LoyaltySchemePoint;

const makeGiftRecord = (overrides: Partial<LoyaltySchemeGift> = {}): LoyaltySchemeGift =>
  ({
    lsgId: GIFT_ID,
    lsgLsId: SCHEME_ID,
    lsgSlno: 1,
    lsgItemId: ITEM_ID,
    lsgUnitId: UNIT_ID,
    lsgItemQty: new Prisma.Decimal('1.000'),
    lsgRedeemPoints: new Prisma.Decimal('100.00'),
    lsgRepeat: false,
    lsgNotes: null,
    lsgIsActive: true,
    lsgIsDeleted: false,
    lsgSyncDate: null,
    lsgCreatedOn: BASE_DATE,
    lsgCreatedBy: USER_ID,
    lsgUpdatedOn: BASE_DATE,
    lsgUpdatedBy: USER_ID,
    ...overrides,
  }) as LoyaltySchemeGift;

const makeSchemeWithChildren = (
  overrides: Partial<LoyaltyScheme> = {},
  children: {
    points?: LoyaltySchemePoint[];
    gifts?: LoyaltySchemeGift[];
  } = {},
) => ({
  ...makeSchemeRecord(overrides),
  parties: [],
  points: children.points ?? [],
  gifts: children.gifts ?? [],
});

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
      loyaltyScheme: {
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
      },
      loyaltySchemePoint: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      loyaltySchemeGift: {
        aggregate: jest.fn(),
        create: jest.fn(),
        findFirst: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      loyaltySchemeParty: {
        create: jest.fn(),
        findMany: jest.fn().mockResolvedValue([]),
        update: jest.fn(),
        updateMany: jest.fn(),
      },
      itemMaster: {
        findFirst: jest.fn(),
      },
      unit: {
        findFirst: jest.fn(),
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
      getUserId: jest.fn().mockReturnValue(USER_ID),
    };

    service = new PromotionLoyaltyPointsService(
      prisma as unknown as PrismaService,
      auditLogService as AuditLogService,
      requestContextService as RequestContextService,
    );
  });

  it('creates a loyalty scheme', async () => {
    prisma.loyaltyScheme.create.mockResolvedValueOnce(makeSchemeRecord());

    const input: SaveLoyaltySchemeDto = {
      ls_name: 'Summer Rewards',
      ls_type: 'REDEEM',
      ls_start_date: '2026-04-01',
      ls_end_date: '2026-04-30',
      ls_comp_id: COMPANY_ID,
      ls_created_by: USER_ID,
    };

    const result = await service.saveScheme(input);

    expect(prisma.loyaltyScheme.create).toHaveBeenCalledTimes(1);
    const createSchemeData = getFirstCreateCallData<Prisma.LoyaltySchemeUncheckedCreateInput>(
      prisma.loyaltyScheme.create,
    );
    expect(createSchemeData.lsName).toBe('Summer Rewards');
    expect(createSchemeData.lsCompId).toBe(COMPANY_ID);
    expect(result.ls_id).toBe(SCHEME_ID);
    expect(result.points).toEqual([]);
    expect(result.gifts).toEqual([]);
    expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
  });

  it('rejects duplicate scheme codes', async () => {
    prisma.loyaltyScheme.findFirst.mockResolvedValueOnce({ lsId: SCHEME_ID });

    const input: SaveLoyaltySchemeDto = {
      ls_code: 'LS001',
      ls_name: 'Summer Rewards',
      ls_type: 'REDEEM',
      ls_start_date: '2026-04-01',
      ls_end_date: '2026-04-30',
      ls_comp_id: COMPANY_ID,
    };

    await expect(service.saveScheme(input)).rejects.toBeInstanceOf(ConflictException);
  });

  it('returns a scheme with nested active points and gifts', async () => {
    prisma.loyaltyScheme.findFirst.mockResolvedValueOnce(
      makeSchemeWithChildren({}, { points: [makePointRecord()], gifts: [makeGiftRecord()] }),
    );

    const result = await service.getSchemeById(SCHEME_ID);

    expect(result.ls_id).toBe(SCHEME_ID);
    expect(result.points).toHaveLength(1);
    expect(result.gifts).toHaveLength(1);
    expect(result.points[0].lspt_points).toBe(10);
    expect(result.gifts[0].lsg_redeem_points).toBe(100);
  });

  it('soft deletes a scheme and cascades soft delete to points and gifts', async () => {
    prisma.loyaltyScheme.findFirst.mockResolvedValueOnce(
      makeSchemeWithChildren({}, { points: [makePointRecord()], gifts: [makeGiftRecord()] }),
    );
    prisma.loyaltyScheme.update.mockResolvedValueOnce(makeSchemeRecord({ lsIsDeleted: true }));
    prisma.loyaltySchemePoint.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.loyaltySchemeGift.updateMany.mockResolvedValueOnce({ count: 1 });
    prisma.loyaltySchemeParty.updateMany.mockResolvedValueOnce({ count: 0 });

    const result = await service.softDeleteScheme(SCHEME_ID, USER_ID);

    expect(result).toEqual({ ls_id: SCHEME_ID, deleted: true });
    expect(prisma.loyaltySchemePoint.updateMany).toHaveBeenCalledTimes(1);
    expect(prisma.loyaltySchemeGift.updateMany).toHaveBeenCalledTimes(1);
    expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
  });

  it('creates a loyalty point with auto-assigned sequence number', async () => {
    prisma.loyaltyScheme.findFirst.mockResolvedValueOnce({ lsId: SCHEME_ID, lsItemType: 'ALL' });
    prisma.loyaltySchemePoint.aggregate.mockResolvedValueOnce({ _max: { lsptSlno: 2 } });
    prisma.loyaltySchemePoint.findFirst.mockResolvedValueOnce(null);
    prisma.loyaltySchemePoint.create.mockResolvedValueOnce(
      makePointRecord({ lsptId: NEXT_POINT_ID, lsptSlno: 3 }),
    );

    const input: SaveLoyaltyPointDto = {
      lspt_ls_id: SCHEME_ID,
      lspt_each: 1,
      lspt_points: 10,
      lspt_created_by: USER_ID,
    };

    const result = await service.savePoint(input);

    expect(prisma.loyaltySchemePoint.create).toHaveBeenCalledTimes(1);
    const createPointData = getFirstCreateCallData<Prisma.LoyaltySchemePointUncheckedCreateInput>(
      prisma.loyaltySchemePoint.create,
    );
    expect(createPointData.lsptSlno).toBe(3);
    expect(createPointData.lsptFactor).toBe(10);
    expect(result.lspt_slno).toBe(3);
  });

  it('rejects child writes when the parent scheme is missing', async () => {
    prisma.loyaltyScheme.findFirst.mockResolvedValueOnce(null);

    const input: SaveLoyaltyPointDto = {
      lspt_ls_id: SCHEME_ID,
      lspt_each: 1,
      lspt_points: 10,
    };

    await expect(service.savePoint(input)).rejects.toBeInstanceOf(BadRequestException);
  });

  it('creates a loyalty gift with auto-assigned sequence number', async () => {
    prisma.loyaltyScheme.findFirst.mockResolvedValueOnce({ lsId: SCHEME_ID });
    prisma.itemMaster.findFirst.mockResolvedValueOnce({ itemId: NEXT_ITEM_ID });
    prisma.unit.findFirst.mockResolvedValueOnce({ unit_id: UNIT_ID });
    prisma.loyaltySchemeGift.aggregate.mockResolvedValueOnce({ _max: { lsgSlno: 2 } });
    prisma.loyaltySchemeGift.findFirst.mockResolvedValueOnce(null);
    prisma.loyaltySchemeGift.create.mockResolvedValueOnce(
      makeGiftRecord({ lsgId: NEXT_GIFT_ID, lsgSlno: 3, lsgItemId: NEXT_ITEM_ID }),
    );

    const input: SaveLoyaltyGiftDto = {
      lsg_ls_id: SCHEME_ID,
      lsg_item_id: NEXT_ITEM_ID,
      lsg_unit_id: UNIT_ID,
      lsg_item_qty: 1,
      lsg_redeem_points: 150,
      lsg_created_by: USER_ID,
    };

    const result = await service.saveGift(input);

    expect(prisma.loyaltySchemeGift.create).toHaveBeenCalledTimes(1);
    const createGiftData = getFirstCreateCallData<Prisma.LoyaltySchemeGiftUncheckedCreateInput>(
      prisma.loyaltySchemeGift.create,
    );
    expect(createGiftData.lsgSlno).toBe(3);
    expect(createGiftData.lsgItemId).toBe(NEXT_ITEM_ID);
    expect(result.lsg_slno).toBe(3);
  });

  it('throws not found when fetching a missing point', async () => {
    prisma.loyaltySchemePoint.findFirst.mockResolvedValueOnce(null);

    await expect(service.getPointById(POINT_ID)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('soft deletes a point row', async () => {
    prisma.loyaltySchemePoint.findFirst.mockResolvedValueOnce(makePointRecord());
    prisma.loyaltySchemePoint.update.mockResolvedValueOnce(
      makePointRecord({ lsptIsDeleted: true, lsptIsActive: false }),
    );

    const result = await service.softDeletePoint(POINT_ID, USER_ID);

    expect(result).toEqual({ lspt_id: POINT_ID, deleted: true });
    expect(prisma.loyaltySchemePoint.update).toHaveBeenCalledTimes(1);
    expect(auditLogService.logEntityChange).toHaveBeenCalledTimes(1);
  });
});
