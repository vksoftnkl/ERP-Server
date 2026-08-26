import { PromotionSchemeService } from './promotion-scheme.service';

/**
 * GET /list has two filters nobody can turn off — is_deleted = false and
 * is_active = true, on the header AND on all four child grids. They are
 * invisible to the compiler and easy to lose in a refactor, so the query the
 * service hands Prisma is pinned here.
 */
const COMPANY = '01963d86-caf0-7b26-89f0-58ac380a2d5e';
const BRANCH = '01963d86-caf0-7b26-89f0-58ac380a2d60';

const buildService = (rows: unknown[] = []) => {
  const findMany = jest.fn().mockResolvedValue(rows);
  const prisma = { promotionScheme: { findMany } };
  const service = new PromotionSchemeService(
    prisma as never,
    { logEntityChange: jest.fn() } as never,
    { getUserId: () => null } as never,
  );
  return { service, findMany };
};

const schemeRow = () => ({
  prmId: 'scheme-1',
  prmCompId: COMPANY,
  prmBranchId: BRANCH,
  company: { compName: 'Sri Krishna Traders' },
  branch: { brName: 'Main Shop' },
  prmTenantId: null,
  prmCode: 'DIWALI25',
  prmName: 'Diwali 2025',
  prmStatus: 'APPROVED',
  prmApplyOn: 'ITEM_QTY',
  prmBenefit: 'DISC_PERC',
  prmPriority: 1,
  prmStackMode: 'EXCLUSIVE',
  prmAutoApply: true,
  prmAllowWithManualDisc: false,
  prmCalcOnAmountType: 'NET_AMOUNT',
  prmIncludeTax: false,
  prmBillType: 'ALL',
  prmMinBillAmount: 0,
  prmMinQty: 0,
  prmBranchScope: 'LIST',
  prmCustScope: 'ALL',
  prmItemScope: 'ALL',
  prmPriceLevelId: null,
  prmMaxBenefitPerBill: 0,
  prmMaxUsesTotal: 0,
  prmMaxUsesPerCust: 0,
  prmBudgetAmount: 0,
  prmCouponBatchId: null,
  prmStartDate: new Date('2025-10-01T00:00:00.000Z'),
  prmEndDate: new Date('2025-10-31T00:00:00.000Z'),
  prmValidFromTime: null,
  prmValidToTime: null,
  prmValidWeekdays: null,
  prmRemarks: null,
  prmIsActive: true,
  prmIsDeleted: false,
  prmSyncDate: null,
  prmCreatedOn: new Date('2025-09-01T00:00:00.000Z'),
  prmCreatedBy: null,
  prmModifiedOn: null,
  prmModifiedBy: null,
  prmApprovedOn: null,
  prmApprovedBy: null,
  branches: [
    {
      prbId: 'branch-row-1',
      prbPrmId: 'scheme-1',
      prbSlno: 1,
      prbBranchId: BRANCH,
      branch: { brName: 'Main Shop', brCode: 'MAIN', brShort: 'MN' },
      prbIsExclude: false,
      prbNotes: null,
      prbIsActive: true,
      prbIsDeleted: false,
      prbSyncDate: null,
      prbCreatedOn: new Date('2025-09-01T00:00:00.000Z'),
      prbCreatedBy: null,
      prbModifiedOn: null,
      prbModifiedBy: null,
    },
  ],
  parties: [],
  items: [],
  slabs: [
    {
      prsId: 'slab-row-1',
      prsPrmId: 'scheme-1',
      prsSlno: 1,
      prsBenefit: 'DISC_PERC',
      prsExceeds: 1000,
      prsUpto: null,
      prsEach: 0,
      prsIsRepeat: false,
      prsMaxRepeats: 0,
      prsFreeItemId: null,
      prsFreeUnitId: null,
      freeItem: null,
      freeUnit: null,
      prsFreeQty: 0,
      prsFreeStockCheck: false,
      prsDiscPerc: 5,
      prsDiscQty: 0,
      prsDiscAmt: 0,
      prsFixedPrice: null,
      prsMaxBenefitAmt: 0,
      prsNotes: null,
      prsIsActive: true,
      prsIsDeleted: false,
      prsSyncDate: null,
      prsCreatedOn: new Date('2025-09-01T00:00:00.000Z'),
      prsCreatedBy: null,
      prsModifiedOn: null,
      prsModifiedBy: null,
    },
  ],
});

describe('PromotionSchemeService.listSchemes', () => {
  it('always filters out deleted and inactive schemes', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({ prm_comp_id: COMPANY });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prmCompId: COMPANY, prmIsDeleted: false, prmIsActive: true },
      }),
    );
  });

  it('drops both narrowings from the where clause when neither is sent', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({});

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prmIsDeleted: false, prmIsActive: true },
      }),
    );
  });

  it('narrows by branch alone when no company is sent', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({ prm_branch_id: BRANCH });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { prmBranchId: BRANCH, prmIsDeleted: false, prmIsActive: true },
      }),
    );
  });

  it('adds the branch to the where clause only when one is sent', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({ prm_comp_id: COMPANY, prm_branch_id: BRANCH });

    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          prmCompId: COMPANY,
          prmBranchId: BRANCH,
          prmIsDeleted: false,
          prmIsActive: true,
        },
      }),
    );
  });

  it('joins the company and branch names onto the header', async () => {
    const { service, findMany } = buildService([schemeRow()]);

    const [scheme] = await service.listSchemes({ prm_comp_id: COMPANY });

    const [[{ include }]] = findMany.mock.calls as Array<[{ include: Record<string, unknown> }]>;
    expect(include.company).toEqual({ select: { compName: true } });
    expect(include.branch).toEqual({ select: { brName: true } });

    expect(scheme.prm_comp_name).toBe('Sri Krishna Traders');
    expect(scheme.prm_branch_name).toBe('Main Shop');
  });

  it('leaves prm_branch_name null on a company-wide scheme', async () => {
    const { service } = buildService([{ ...schemeRow(), prmBranchId: null, branch: null }]);

    const [scheme] = await service.listSchemes({ prm_comp_id: COMPANY });

    expect(scheme.prm_comp_name).toBe('Sri Krishna Traders');
    expect(scheme.prm_branch_name).toBeNull();
  });

  it('filters every child grid to live rows too', async () => {
    const { service, findMany } = buildService();

    await service.listSchemes({ prm_comp_id: COMPANY });

    const [[{ include }]] = findMany.mock.calls as Array<
      [{ include: Record<string, { where: Record<string, boolean> }> }]
    >;

    expect(include.branches.where).toEqual({ prbIsDeleted: false, prbIsActive: true });
    expect(include.parties.where).toEqual({ prpIsDeleted: false, prpIsActive: true });
    expect(include.items.where).toEqual({ priIsDeleted: false, priIsActive: true });
    expect(include.slabs.where).toEqual({ prsIsDeleted: false, prsIsActive: true });
  });

  it('answers with the whole graph — header plus the four grids', async () => {
    const { service } = buildService([schemeRow()]);

    const [scheme] = await service.listSchemes({ prm_comp_id: COMPANY });

    expect(scheme.prm_id).toBe('scheme-1');
    expect(scheme.prm_code).toBe('DIWALI25');
    expect(scheme.prm_start_date).toBe('2025-10-01');

    // The grids ride along, names resolved, exactly as /get returns them.
    expect(scheme.branches).toHaveLength(1);
    expect(scheme.branches[0].prb_branch_name).toBe('Main Shop');
    expect(scheme.slabs).toHaveLength(1);
    expect(scheme.slabs[0].prs_exceeds).toBe(1000);
    expect(scheme.parties).toEqual([]);
    expect(scheme.items).toEqual([]);
  });
});
