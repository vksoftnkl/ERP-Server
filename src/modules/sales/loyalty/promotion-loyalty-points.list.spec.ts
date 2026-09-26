import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';

/**
 * GET /list has two filters nobody can turn off — is_deleted = false and
 * is_active = true, on the header AND on all five child grids. They are
 * invisible to the compiler and easy to lose in a refactor, so the query the
 * service hands Prisma is pinned here.
 */
const COMPANY = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const BRANCH = '01963d86-caf0-7b26-89f0-58ac380a2d60';

const buildService = (rows: unknown[] = []) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { loyaltyScheme: { findMany } };
  const service = new PromotionLoyaltyPointsService(
    prisma as never,
    { logEntityChange: jest.fn() } as never,
    { getUserId: () => null } as never,
  );
  return { service, findMany };
};

const schemeRow = () => ({
  lscId: 'scheme-1',
  lscCompId: COMPANY,
  lscBranchId: BRANCH,
  company: { compName: 'Sri Krishna Traders' },
  branch: { brName: 'Main Shop' },
  lscTenantId: null,
  lscCode: 'DIWALI25',
  lscName: 'Diwali 2025',
  lscType: 'BOTH',
  lscStatus: 'APPROVED',
  lscPriority: 1,
  lscAutoApply: true,
  lscApplyOn: 'BILL_AMOUNT',
  lscCalcOnAmountType: 'NET_AMOUNT',
  lscIncludeTax: false,
  lscBillType: 'ALL',
  lscMinBillAmount: 0,
  lscMaxEarnPoints: 0,
  lscEarnOnDiscounted: true,
  lscEarnOnCharges: false,
  lscEarnWithRedeem: false,
  lscRoundingMethod: 'FLOOR',
  lscPointsDecimals: 2,
  lscBranchScope: 'LIST',
  lscCustScope: 'ALL',
  lscItemScope: 'ALL',
  lscPriceLevelId: null,
  lscPoolMode: 'COMPANY',
  lscAllowCrossBranchRedeem: true,
  lscAllowPointRedeem: true,
  lscAllowGiftRedeem: true,
  lscRedeemTenderId: null,
  lscRedeemValuePerPoint: 0.25,
  lscMinRedeemPoints: 0,
  lscMaxRedeemPoints: 0,
  lscMaxRedeemPerc: 100,
  lscRedeemMinBillAmount: 0,
  lscRedeemMultiple: 0,
  lscExpiryBasis: 'EARN_DATE',
  lscPointsValidDays: 365,
  lscActivationDays: 7,
  lscReturnMode: 'REVERSE',
  lscStartDate: new Date('2025-10-01T00:00:00.000Z'),
  lscEndDate: new Date('2025-10-31T00:00:00.000Z'),
  lscValidFromTime: null,
  lscValidToTime: null,
  lscValidWeekdays: null,
  lscRemarks: null,
  lscIsActive: true,
  lscIsDeleted: false,
  lscSyncDate: null,
  lscCreatedOn: new Date('2025-09-01T00:00:00.000Z'),
  lscCreatedBy: null,
  lscModifiedOn: null,
  lscModifiedBy: null,
  lscApprovedOn: null,
  lscApprovedBy: null,
  branches: [
    {
      lsbId: 'branch-row-1',
      lsbLscId: 'scheme-1',
      lsbSlno: 1,
      lsbBranchId: BRANCH,
      branch: { brName: 'Main Shop', brCode: 'MAIN', brShort: 'MN' },
      lsbIsExclude: false,
      lsbNotes: null,
      lsbIsActive: true,
      lsbIsDeleted: false,
      lsbSyncDate: null,
      lsbCreatedOn: new Date('2025-09-01T00:00:00.000Z'),
      lsbCreatedBy: null,
      lsbModifiedOn: null,
      lsbModifiedBy: null,
    },
  ],
  parties: [],
  items: [],
  slabs: [
    {
      lssId: 'slab-row-1',
      lssLscId: 'scheme-1',
      lssSlno: 1,
      lssItemId: null,
      lssUnitId: null,
      item: null,
      unit: null,
      lssExceeds: 1000,
      lssUpto: null,
      lssEach: 100,
      lssPoints: 2,
      lssFactor: 1,
      lssMaxPoints: 0,
      lssNotes: null,
      lssIsActive: true,
      lssIsDeleted: false,
      lssSyncDate: null,
      lssCreatedOn: new Date('2025-09-01T00:00:00.000Z'),
      lssCreatedBy: null,
      lssModifiedOn: null,
      lssModifiedBy: null,
    },
  ],
  gifts: [],
});

describe('PromotionLoyaltyPointsService.listSchemes', () => {
  it('always filters out deleted and inactive schemes', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({ lsc_comp_id: COMPANY });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lscCompId: COMPANY, lscIsDeleted: false, lscIsActive: true },
      }),
    );
  });

  it('drops both narrowings from the where clause when neither is sent', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({ where: { lscIsDeleted: false, lscIsActive: true } }),
    );
  });

  it('narrows by branch alone when no company is sent', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({ lsc_branch_id: BRANCH });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { lscBranchId: BRANCH, lscIsDeleted: false, lscIsActive: true },
      }),
    );
  });

  it('joins the company and branch names onto the header', async () => {
    const { service, findMany } = buildService([schemeRow()]);

    const [scheme] = await service.listSchemes({ lsc_comp_id: COMPANY });

    const [[{ include }]] = findMany.mock.calls as Array<[{ include: Record<string, unknown> }]>;
    expect(include.company).toEqual({ select: { compName: true } });
    expect(include.branch).toEqual({ select: { brName: true } });

    expect(scheme.lsc_comp_name).toBe('Sri Krishna Traders');
    expect(scheme.lsc_branch_name).toBe('Main Shop');
  });

  it('leaves lsc_branch_name null on a company-wide scheme', async () => {
    const { service } = buildService([{ ...schemeRow(), lscBranchId: null, branch: null }]);

    const [scheme] = await service.listSchemes({ lsc_comp_id: COMPANY });

    expect(scheme.lsc_branch_name).toBeNull();
  });

  it('filters every child grid to live rows too', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({ lsc_comp_id: COMPANY });

    const [[{ include }]] = findMany.mock.calls as Array<
      [{ include: Record<string, { where: Record<string, boolean> }> }]
    >;

    expect(include.branches.where).toEqual({ lsbIsDeleted: false, lsbIsActive: true });
    expect(include.parties.where).toEqual({ lspIsDeleted: false, lspIsActive: true });
    expect(include.items.where).toEqual({ lsiIsDeleted: false, lsiIsActive: true });
    expect(include.slabs.where).toEqual({ lssIsDeleted: false, lssIsActive: true });
    expect(include.gifts.where).toEqual({ lsgIsDeleted: false, lsgIsActive: true });
  });

  it('answers with the whole graph — header plus the five grids', async () => {
    const { service } = buildService([schemeRow()]);

    const [scheme] = await service.listSchemes({ lsc_comp_id: COMPANY });

    expect(scheme.lsc_id).toBe('scheme-1');
    expect(scheme.lsc_code).toBe('DIWALI25');
    expect(scheme.lsc_start_date).toBe('2025-10-01');
    expect(scheme.lsc_activation_days).toBe(7);

    // The grids ride along, names resolved, exactly as /get returns them.
    expect(scheme.branches).toHaveLength(1);
    expect(scheme.branches[0].lsb_branch_name).toBe('Main Shop');
    expect(scheme.slabs).toHaveLength(1);
    expect(scheme.slabs[0].lss_exceeds).toBe(1000);
    expect(scheme.slabs[0].lss_item_id).toBeNull();
    expect(scheme.parties).toEqual([]);
    expect(scheme.items).toEqual([]);
    expect(scheme.gifts).toEqual([]);
  });
});
