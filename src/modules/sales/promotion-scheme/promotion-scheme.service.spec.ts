import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_AUDIT_ACTOR } from 'src/common/utils/module-service.utils';
import { SavePromotionSchemeDto } from './dto/save-promotion-scheme.dto';
import { PromotionSchemeService } from './promotion-scheme.service';
import { PromotionSchemeErrorCode } from './types/promotion-scheme-error-codes';

const PRM_ID = '019c6f6c-be87-7a11-8905-36092c46e401';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e402';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e403';
const OTHER_BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e404';
const AREA_ID = '019c6f6c-be87-7a11-8905-36092c46e405';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e406';
const APPROVER_ID = '019c6f6c-be87-7a11-8905-36092c46e407';
const PARTY_ROW_ID = '019c6f6c-be87-7a11-8905-36092c46e408';
const ITEM_ROW_ID = '019c6f6c-be87-7a11-8905-36092c46e409';
const BRAND_ID = '019c6f6c-be87-7a11-8905-36092c46e40a';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46e40b';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46e40c';
const BRANCH_ROW_ID = '019c6f6c-be87-7a11-8905-36092c46e40d';
const OTHER_COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e40e';
const NOW = new Date('2026-10-19T04:30:00.000Z');
const dec = (value: number) => new Prisma.Decimal(value);

/** The status and body of the HttpException a call was refused with. */
async function refusalOf(promise: Promise<unknown>): Promise<{ status: number; body: unknown }> {
  const error = await promise.then(
    () => {
      throw new Error('expected the call to be refused');
    },
    (caught: unknown) => caught,
  );
  if (!(error instanceof HttpException)) throw error;
  return { status: error.getStatus(), body: error.getResponse() };
}

const schemeRow = (overrides: Record<string, unknown> = {}) => ({
  prmId: PRM_ID,
  prmCompId: COMPANY_ID,
  prmBranchId: null,
  prmTenantId: null,
  prmCode: 'SUMMER',
  prmName: 'Summer sale',
  prmStatus: 'DRAFT',
  prmApplyOn: 'ITEM_QTY',
  prmBenefit: 'DISC_PERC',
  prmPriority: 1,
  prmStackMode: 'EXCLUSIVE',
  prmAutoApply: true,
  prmAllowWithManualDisc: false,
  prmCalcOnAmountType: 'NET_AMOUNT',
  prmIncludeTax: false,
  prmBillType: 'ALL',
  prmMinBillAmount: dec(0),
  prmMinQty: dec(0),
  prmBranchScope: 'ALL',
  prmCustScope: 'ALL',
  prmItemScope: 'ALL',
  prmPriceLevelId: null,
  prmMaxBenefitPerBill: dec(0),
  prmMaxUsesTotal: 0,
  prmMaxUsesPerCust: 0,
  prmBudgetAmount: dec(0),
  prmCouponBatchId: null,
  prmStartDate: new Date('2026-05-01T00:00:00.000Z'),
  prmEndDate: new Date('2026-05-31T00:00:00.000Z'),
  prmValidFromTime: null,
  prmValidToTime: null,
  prmValidWeekdays: null,
  prmRemarks: null,
  prmIsActive: true,
  prmIsDeleted: false,
  prmSyncDate: null,
  prmCreatedOn: NOW,
  prmCreatedBy: 'admin',
  prmModifiedOn: null,
  prmModifiedBy: null,
  prmApprovedOn: null,
  prmApprovedBy: null,
  ...overrides,
});

const withChildren = (row: object, children: Record<string, unknown[]> = {}) => ({
  ...row,
  branches: [],
  parties: [],
  items: [],
  slabs: [],
  ...children,
});

const slabRow = (overrides: Record<string, unknown> = {}) => ({
  prsId: 'slab-1',
  prsPrmId: PRM_ID,
  prsSlno: 1,
  prsBenefit: 'DISC_PERC',
  prsExceeds: dec(0),
  prsUpto: null,
  prsEach: dec(1),
  prsIsRepeat: false,
  prsMaxRepeats: 0,
  prsFreeItemId: null,
  prsFreeUnitId: null,
  prsFreeQty: dec(0),
  prsFreeStockCheck: true,
  prsDiscPerc: dec(5),
  prsDiscQty: dec(0),
  prsDiscAmt: dec(0),
  prsFixedPrice: null,
  prsMaxBenefitAmt: dec(0),
  prsNotes: null,
  prsIsActive: true,
  prsIsDeleted: false,
  prsSyncDate: null,
  prsCreatedOn: NOW,
  prsCreatedBy: null,
  prsModifiedOn: null,
  prsModifiedBy: null,
  ...overrides,
});

const partyRow = (overrides: Record<string, unknown> = {}) => ({
  prpId: PARTY_ROW_ID,
  prpPrmId: PRM_ID,
  prpSlno: 1,
  prpKind: 'CUSTOMER',
  prpScopeId: AREA_ID,
  prpIsExclude: false,
  prpMatchPriority: 4,
  prpNotes: null,
  prpIsActive: true,
  prpIsDeleted: false,
  prpSyncDate: null,
  prpCreatedOn: NOW,
  prpCreatedBy: null,
  prpModifiedOn: null,
  prpModifiedBy: null,
  ...overrides,
});

const branchRow = (overrides: Record<string, unknown> = {}) => ({
  prbId: 'branch-row-1',
  prbPrmId: PRM_ID,
  prbSlno: 1,
  prbBranchId: BRANCH_ID,
  prbIsExclude: false,
  prbNotes: null,
  prbIsActive: true,
  prbIsDeleted: false,
  prbSyncDate: null,
  prbCreatedOn: NOW,
  prbCreatedBy: null,
  prbModifiedOn: null,
  prbModifiedBy: null,
  ...overrides,
});

const itemRow = (overrides: Record<string, unknown> = {}) => ({
  priId: ITEM_ROW_ID,
  priPrmId: PRM_ID,
  priSlno: 1,
  priKind: 'ITEM_BRAND',
  priScopeId: BRAND_ID,
  priItemId: null,
  priGroupId: null,
  priCategoryId: null,
  priBrandId: BRAND_ID,
  priSectionId: null,
  priUnitId: null,
  priIsExclude: false,
  priDiscPerc: dec(5),
  priDiscQty: dec(0),
  priDiscAmt: dec(0),
  priMinQty: dec(0),
  priFactor: dec(1),
  priMaxBenefit: dec(0),
  priMatchPriority: 3,
  priNotes: null,
  priIsActive: true,
  priIsDeleted: false,
  priSyncDate: null,
  priCreatedOn: NOW,
  priCreatedBy: null,
  priModifiedOn: null,
  priModifiedBy: null,
  ...overrides,
});

/**
 * A child table mock. A write answers with the whole row the table would hold
 * afterwards — the stored defaults overlaid with what was written — since the
 * service maps that row straight into its audit entry.
 */
const childTable = (idKey: string, rowOf: (overrides: Record<string, unknown>) => object) => ({
  findFirst: jest.fn().mockResolvedValue(null),
  findMany: jest.fn().mockResolvedValue([]),
  create: jest.fn(async ({ data }: { data: Record<string, unknown> }) =>
    rowOf({ [idKey]: `new-${idKey}`, ...data }),
  ),
  update: jest.fn(
    async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) =>
      rowOf({ ...where, ...data }),
  ),
  updateMany: jest.fn().mockResolvedValue({ count: 0 }),
});

describe('PromotionSchemeService — save, read and delete', () => {
  let stored: ReturnType<typeof withChildren> | null;
  let codeClash: { prmId: string } | null;
  let prisma: {
    promotionScheme: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    promotionSchemeBranch: ReturnType<typeof childTable>;
    promotionSchemeParty: ReturnType<typeof childTable>;
    promotionSchemeItem: ReturnType<typeof childTable>;
    promotionSchemeSlab: ReturnType<typeof childTable>;
    $transaction: jest.Mock;
  };
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: PromotionSchemeService;

  beforeEach(() => {
    stored = null;
    codeClash = null;
    prisma = {
      promotionScheme: {
        // The code probe selects; the graph read includes.
        findFirst: jest.fn(async (args: { select?: object }) => (args.select ? codeClash : stored)),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = schemeRow(data);
          stored = withChildren(row);
          return row;
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = schemeRow({ ...stored, ...data });
          stored = withChildren(row, {
            branches: stored?.branches ?? [],
            parties: stored?.parties ?? [],
            items: stored?.items ?? [],
            slabs: stored?.slabs ?? [],
          });
          return row;
        }),
      },
      promotionSchemeBranch: childTable('prbId', branchRow),
      promotionSchemeParty: childTable('prpId', partyRow),
      promotionSchemeItem: childTable('priId', itemRow),
      promotionSchemeSlab: childTable('prsId', slabRow),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new PromotionSchemeService(prisma as never, audit as never, context as never);
  });

  const newScheme = (extra: Partial<SavePromotionSchemeDto> = {}): SavePromotionSchemeDto => ({
    prm_comp_id: COMPANY_ID,
    prm_code: ' SUMMER ',
    prm_name: 'Summer sale',
    prm_start_date: '2026-05-01',
    prm_end_date: '2026-05-31',
    ...extra,
  });

  const createdData = () =>
    (prisma.promotionScheme.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.promotionScheme.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditActions = () =>
    audit.logEntityChange.mock.calls.map(
      ([entry]) =>
        `${(entry as { action: string }).action}:${(entry as { tableName: string }).tableName}`,
    );

  describe('create', () => {
    it('writes the required header fields, stamps the user and audits the insert', async () => {
      const payload = await service.saveScheme(newScheme());

      expect(createdData()).toEqual({
        prmCompId: COMPANY_ID,
        prmCode: 'SUMMER',
        prmName: 'Summer sale',
        prmStartDate: new Date('2026-05-01T00:00:00.000Z'),
        prmEndDate: new Date('2026-05-31T00:00:00.000Z'),
        prmCreatedBy: USER_ID,
      });
      expect(payload).toMatchObject({
        prm_id: PRM_ID,
        prm_code: 'SUMMER',
        prm_start_date: '2026-05-01',
        branches: [],
        slabs: [],
      });
      expect(auditActions()).toEqual(['insert:promotion scheme']);
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, screenName: 'Promotion Scheme' }),
        prisma,
      );
    });

    it('stamps the default actor when there is no user and no creator', async () => {
      context.getUserId.mockReturnValue(null);

      await service.saveScheme(newScheme());

      expect(createdData().prmCreatedBy).toBe(DEFAULT_AUDIT_ACTOR);
    });

    it('refuses a company id that is not a uuid before reading anything', async () => {
      const refusal = await refusalOf(service.saveScheme(newScheme({ prm_comp_id: 'acme' })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'prm_comp_id', code: PromotionSchemeErrorCode.INVALID_UUID }] },
      });
      expect(prisma.promotionScheme.findFirst).not.toHaveBeenCalled();
    });

    it('reports every broken header rule at once', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            prm_end_date: '2026-04-30',
            prm_benefit: 'FIXED_PRICE',
            prm_apply_on: 'BILL_AMOUNT',
          }),
        ),
      );

      expect(refusal.status).toBe(400);
      const codes = (refusal.body as { errors: Array<{ code: string }> }).errors.map(
        (error) => error.code,
      );
      expect(codes).toEqual(
        expect.arrayContaining([
          PromotionSchemeErrorCode.END_BEFORE_START,
          PromotionSchemeErrorCode.FIXED_PRICE_NEEDS_ITEM_TRIGGER,
        ]),
      );
      expect(prisma.promotionScheme.create).not.toHaveBeenCalled();
    });

    it('upper-cases the vocabulary and the weekdays, and parses the time window', async () => {
      await service.saveScheme(
        newScheme({
          prm_benefit: 'disc_amt',
          prm_stack_mode: 'stackable',
          prm_valid_weekdays: ' sat,sun ',
          prm_valid_from_time: '18:00',
          prm_valid_to_time: '21:30:00',
        }),
      );

      expect(createdData()).toMatchObject({
        prmBenefit: 'DISC_AMT',
        prmStackMode: 'STACKABLE',
        prmValidWeekdays: 'SAT,SUN',
        prmValidFromTime: new Date('1970-01-01T18:00:00.000Z'),
        prmValidToTime: new Date('1970-01-01T21:30:00.000Z'),
      });
    });

    it('drops an approver that is not a user id, so an APPROVED scheme is refused', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ prm_status: 'APPROVED', prm_approved_by: 'manager' })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: PromotionSchemeErrorCode.APPROVER_REQUIRED }] },
      });
    });

    it('accepts an APPROVED scheme that names its approver by id', async () => {
      await service.saveScheme(
        newScheme({
          prm_status: 'APPROVED',
          prm_approved_by: APPROVER_ID,
          prm_approved_on: '2026-10-19T10:00:00+05:30',
        }),
      );

      expect(createdData()).toMatchObject({
        prmStatus: 'APPROVED',
        prmApprovedBy: APPROVER_ID,
        prmApprovedOn: new Date('2026-10-19T04:30:00.000Z'),
      });
    });

    it('refuses an approval instant that is not a datetime', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ prm_approved_on: 'yesterday' })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'prm_approved_on', code: PromotionSchemeErrorCode.INVALID_DATETIME }],
        },
      });
    });

    it('refuses a code another live scheme of the company already uses', async () => {
      codeClash = { prmId: 'other' };

      const refusal = await refusalOf(service.saveScheme(newScheme()));

      expect(prisma.promotionScheme.findFirst).toHaveBeenCalledWith({
        where: {
          prmCompId: COMPANY_ID,
          prmIsDeleted: false,
          prmCode: { equals: 'SUMMER', mode: 'insensitive' },
        },
        select: { prmId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'prm_code', code: PromotionSchemeErrorCode.CODE_EXISTS }] },
      });
      expect(prisma.promotionScheme.create).not.toHaveBeenCalled();
    });

    it('answers the exclusive-clash exclusion constraint with a 409', async () => {
      prisma.promotionScheme.create.mockRejectedValue(
        new Error('violates exclusion constraint "ex_prm_exclusive_clash" 23P01'),
      );

      const refusal = await refusalOf(service.saveScheme(newScheme()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: PromotionSchemeErrorCode.EXCLUSIVE_CLASH }] },
      });
    });

    it('rethrows a failure it cannot name', async () => {
      const failure = new Error('connection reset');
      prisma.promotionScheme.create.mockRejectedValue(failure);

      await expect(service.saveScheme(newScheme())).rejects.toBe(failure);
    });
  });

  describe('the grids saved with the header', () => {
    it('leaves every grid alone when the body carries none', async () => {
      await service.saveScheme(newScheme());

      expect(prisma.promotionSchemeBranch.findMany).not.toHaveBeenCalled();
      expect(prisma.promotionSchemeParty.findMany).not.toHaveBeenCalled();
      expect(prisma.promotionSchemeItem.findMany).not.toHaveBeenCalled();
      expect(prisma.promotionSchemeSlab.findMany).not.toHaveBeenCalled();
    });

    it('refuses two rows of one grid that name the same branch', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            branches: [{ prb_branch_id: BRANCH_ID }, { prb_branch_id: BRANCH_ID }],
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'prb_branch_id',
              message: 'Rows 1 and 2 target the same scope',
              code: PromotionSchemeErrorCode.DUPLICATE_ROW_SCOPE,
            },
          ],
        },
      });
      expect(prisma.promotionSchemeBranch.create).not.toHaveBeenCalled();
    });

    it('creates branch rows numbered by position when no slno is sent', async () => {
      await service.saveScheme(
        newScheme({
          branches: [
            { prb_branch_id: BRANCH_ID },
            { prb_branch_id: OTHER_BRANCH_ID, prb_is_exclude: true },
          ],
        }),
      );

      const slnos = prisma.promotionSchemeBranch.create.mock.calls.map(
        ([args]) => (args as { data: { prbSlno: number; prbIsExclude: boolean } }).data,
      );
      expect(slnos).toEqual([
        expect.objectContaining({ prbSlno: 1, prbBranchId: BRANCH_ID, prbIsExclude: false }),
        expect.objectContaining({ prbSlno: 2, prbBranchId: OTHER_BRANCH_ID, prbIsExclude: true }),
      ]);
      expect(auditActions()).toEqual([
        'insert:promotion scheme',
        'insert:promotion scheme branch',
        'insert:promotion scheme branch',
      ]);
    });

    it('seeds a party row match priority from its kind', async () => {
      await service.saveScheme(
        newScheme({ parties: [{ prp_kind: 'area', prp_scope_id: AREA_ID }] }),
      );

      expect(prisma.promotionSchemeParty.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prpKind: 'AREA',
            prpScopeId: AREA_ID,
            prpMatchPriority: 3,
            prpSlno: 1,
          }) as object,
        }),
      );
    });

    it('refuses a party kind outside the vocabulary', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ parties: [{ prp_kind: 'STATE', prp_scope_id: AREA_ID }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            expect.objectContaining({
              field: 'prp_kind',
              code: PromotionSchemeErrorCode.VALUE_NOT_ALLOWED,
            }),
          ],
        },
      });
    });

    it('refuses a row id that is not on this scheme', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            parties: [{ prp_id: PARTY_ROW_ID, prp_kind: 'CUSTOMER', prp_scope_id: AREA_ID }],
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [{ field: 'prp_id', code: PromotionSchemeErrorCode.SCHEME_ROW_NOT_FOUND }],
        },
      });
      expect(prisma.promotionSchemeParty.findFirst).toHaveBeenCalledWith({
        where: { prpId: PARTY_ROW_ID, prpPrmId: PRM_ID, prpIsDeleted: false },
      });
    });

    it('soft deletes the rows a posted grid no longer carries', async () => {
      const stale = partyRow();
      prisma.promotionSchemeParty.findMany.mockResolvedValue([stale]);

      await service.saveScheme(newScheme({ parties: [] }));

      expect(prisma.promotionSchemeParty.findMany).toHaveBeenCalledWith({
        where: { prpPrmId: PRM_ID, prpIsDeleted: false, prpId: { notIn: [] } },
      });
      expect(prisma.promotionSchemeParty.update).toHaveBeenCalledWith({
        where: { prpId: PARTY_ROW_ID },
        data: {
          prpIsDeleted: true,
          prpIsActive: false,
          prpModifiedOn: expect.any(Date) as Date,
          prpModifiedBy: USER_ID,
        },
      });
      expect(auditActions()).toContain('cancel:promotion scheme party');
    });

    it("refuses a slab whose benefit is not the scheme's", async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ slabs: [{ prs_benefit: 'DISC_AMT', prs_disc_amt: 10 }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'prs_benefit', code: PromotionSchemeErrorCode.SLAB_BENEFIT_MISMATCH }],
        },
      });
      expect(prisma.promotionSchemeSlab.create).not.toHaveBeenCalled();
    });

    it("creates a slab under the scheme's benefit when the row names none", async () => {
      await service.saveScheme(newScheme({ slabs: [{ prs_exceeds: 0, prs_disc_perc: 5 }] }));

      expect(prisma.promotionSchemeSlab.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            prsBenefit: 'DISC_PERC',
            prsExceeds: 0,
            prsDiscPerc: 5,
            prsEach: 1,
            prsFreeStockCheck: true,
          }) as object,
        }),
      );
    });

    it('refuses two slab bands starting at the same threshold', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            slabs: [
              { prs_exceeds: 100, prs_disc_perc: 5 },
              { prs_exceeds: 100, prs_disc_perc: 7 },
            ],
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'prs_exceeds', code: PromotionSchemeErrorCode.DUPLICATE_ROW_SCOPE }],
        },
      });
    });

    it('lets two bands share a threshold when they give different free items', async () => {
      await service.saveScheme(
        newScheme({
          prm_benefit: 'FREE_ITEM',
          slabs: [
            {
              prs_exceeds: 100,
              prs_free_item_id: ITEM_ID,
              prs_free_unit_id: UNIT_ID,
              prs_free_qty: 1,
            },
            {
              prs_exceeds: 100,
              prs_free_item_id: BRAND_ID,
              prs_free_unit_id: UNIT_ID,
              prs_free_qty: 1,
            },
          ],
        }),
      );

      expect(prisma.promotionSchemeSlab.create).toHaveBeenCalledTimes(2);
    });

    it('reports every broken band rule of one slab at once', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            slabs: [{ prs_exceeds: 500, prs_upto: 100, prs_each: 0, prs_disc_perc: 0 }],
          }),
        ),
      );

      expect(refusal.status).toBe(400);
      expect((refusal.body as { errors: Array<{ field: string; code: string }> }).errors).toEqual(
        expect.arrayContaining([
          expect.objectContaining({
            field: 'prs_upto',
            code: PromotionSchemeErrorCode.SLAB_BAND_INVALID,
          }),
          expect.objectContaining({
            field: 'prs_each',
            code: PromotionSchemeErrorCode.NOT_ABOVE_ZERO,
          }),
          expect.objectContaining({
            field: 'prs_disc_perc',
            code: PromotionSchemeErrorCode.SLAB_BENEFIT_VALUE_MISSING,
          }),
        ]),
      );
      expect(prisma.promotionSchemeSlab.create).not.toHaveBeenCalled();
    });

    it('refuses a free item sent without the unit it is issued in', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            prm_benefit: 'FREE_ITEM',
            slabs: [{ prs_exceeds: 0, prs_free_item_id: ITEM_ID, prs_free_qty: 1 }],
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'prs_free_unit_id', code: PromotionSchemeErrorCode.SLAB_FREE_UNIT_PAIR },
          ],
        },
      });
    });

    it('refuses a branch row whose serial number is not a whole number', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ branches: [{ prb_branch_id: BRANCH_ID, prb_slno: 1.5 }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'prb_slno', code: PromotionSchemeErrorCode.NOT_WHOLE_NUMBER }] },
      });
    });

    it('refuses a new branch row that names no branch', async () => {
      const refusal = await refusalOf(service.saveScheme(newScheme({ branches: [{}] })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'prb_branch_id', code: PromotionSchemeErrorCode.INVALID_UUID }] },
      });
    });
  });

  describe('the item grid', () => {
    it('creates a brand row with its priority seeded from the kind and no unit', async () => {
      await service.saveScheme(
        newScheme({
          items: [{ pri_kind: 'item_brand', pri_scope_id: BRAND_ID, pri_disc_perc: 10 }],
        }),
      );

      expect(prisma.promotionSchemeItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            priPrmId: PRM_ID,
            priSlno: 1,
            priKind: 'ITEM_BRAND',
            priScopeId: BRAND_ID,
            priUnitId: null,
            priDiscPerc: 10,
            priDiscQty: 0,
            priDiscAmt: 0,
            priFactor: 1,
            priMatchPriority: 3,
            priIsExclude: false,
          }) as object,
        }),
      );
      expect(auditActions()).toEqual(['insert:promotion scheme', 'insert:promotion scheme item']);
    });

    it('wants a unit on an ITEM row and refuses one on every other kind', async () => {
      const missing = await refusalOf(
        service.saveScheme(newScheme({ items: [{ pri_kind: 'ITEM', pri_scope_id: ITEM_ID }] })),
      );
      expect(missing).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'pri_unit_id', code: PromotionSchemeErrorCode.ITEM_UNIT_REQUIRED }],
        },
      });

      const stray = await refusalOf(
        service.saveScheme(
          newScheme({
            items: [{ pri_kind: 'ITEM_BRAND', pri_scope_id: BRAND_ID, pri_unit_id: UNIT_ID }],
          }),
        ),
      );
      expect(stray).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'pri_unit_id', code: PromotionSchemeErrorCode.ITEM_UNIT_NOT_ALLOWED }],
        },
      });
      expect(prisma.promotionSchemeItem.create).not.toHaveBeenCalled();
    });

    it('refuses an exclude row that still gives something', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            items: [
              {
                pri_kind: 'ITEM_BRAND',
                pri_scope_id: BRAND_ID,
                pri_is_exclude: true,
                pri_disc_amt: 5,
              },
            ],
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'pri_is_exclude', code: PromotionSchemeErrorCode.EXCLUDE_ROW_GIVES }],
        },
      });
    });

    it('refuses two item rows on the same kind and scope, whatever their case', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            items: [
              { pri_kind: 'item_brand', pri_scope_id: BRAND_ID },
              { pri_kind: 'ITEM_BRAND', pri_scope_id: BRAND_ID },
            ],
          }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'pri_scope_id', code: PromotionSchemeErrorCode.DUPLICATE_ROW_SCOPE }],
        },
      });
    });

    it('judges an edited item row on its stored rates merged with the new one', async () => {
      prisma.promotionSchemeItem.findFirst.mockResolvedValue(itemRow());

      const refusal = await refusalOf(
        service.saveScheme(newScheme({ items: [{ pri_id: ITEM_ROW_ID, pri_disc_amt: 10 }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'pri_disc_perc', code: PromotionSchemeErrorCode.ITEM_MORE_THAN_ONE_RATE },
          ],
        },
      });
      expect(prisma.promotionSchemeItem.update).not.toHaveBeenCalled();
    });

    it('writes only the fields an edited item row carries', async () => {
      prisma.promotionSchemeItem.findFirst.mockResolvedValue(itemRow());

      await service.saveScheme(newScheme({ items: [{ pri_id: ITEM_ROW_ID, pri_disc_perc: 7.5 }] }));

      expect(prisma.promotionSchemeItem.findFirst).toHaveBeenCalledWith({
        where: { priId: ITEM_ROW_ID, priPrmId: PRM_ID, priIsDeleted: false },
      });
      const { data } = prisma.promotionSchemeItem.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        priModifiedOn: expect.any(Date) as Date,
        priModifiedBy: USER_ID,
        priDiscPerc: 7.5,
      });
      expect(auditActions()).toContain('update:promotion scheme item');
    });
  });

  describe('editing rows already on the scheme', () => {
    it('updates a branch row in place, writing only what it carries', async () => {
      prisma.promotionSchemeBranch.findFirst.mockResolvedValue(branchRow({ prbId: BRANCH_ROW_ID }));

      await service.saveScheme(
        newScheme({ branches: [{ prb_id: BRANCH_ROW_ID, prb_is_exclude: true }] }),
      );

      expect(prisma.promotionSchemeBranch.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { prbId: BRANCH_ROW_ID },
          data: {
            prbModifiedOn: expect.any(Date) as Date,
            prbModifiedBy: USER_ID,
            prbIsExclude: true,
          },
        }),
      );
      expect(prisma.promotionSchemeBranch.create).not.toHaveBeenCalled();
      // The kept row is not soft deleted afterwards.
      expect(prisma.promotionSchemeBranch.findMany).toHaveBeenCalledWith({
        where: { prbPrmId: PRM_ID, prbIsDeleted: false, prbId: { notIn: [BRANCH_ROW_ID] } },
      });
    });

    it('answers 404 for a branch row id that is not on this scheme', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({ branches: [{ prb_id: BRANCH_ROW_ID, prb_branch_id: BRANCH_ID }] }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [{ field: 'prb_id', code: PromotionSchemeErrorCode.SCHEME_ROW_NOT_FOUND }],
        },
      });
    });

    it('keeps a party row kind and priority from the stored row when the edit omits them', async () => {
      prisma.promotionSchemeParty.findFirst.mockResolvedValue(
        partyRow({ prpKind: 'AREA', prpMatchPriority: 3 }),
      );

      await service.saveScheme(
        newScheme({ parties: [{ prp_id: PARTY_ROW_ID, prp_is_exclude: true }] }),
      );

      const { data } = prisma.promotionSchemeParty.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        prpModifiedOn: expect.any(Date) as Date,
        prpModifiedBy: USER_ID,
        prpIsExclude: true,
      });
    });

    it('refuses an edited party row whose priority leaves the 0..9 range', async () => {
      prisma.promotionSchemeParty.findFirst.mockResolvedValue(partyRow());

      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({ parties: [{ prp_id: PARTY_ROW_ID, prp_match_priority: 12 }] }),
        ),
      );

      expect(refusal.status).toBe(400);
      expect(refusal.body).toMatchObject({
        errors: [expect.objectContaining({ field: 'prp_match_priority' })],
      });
      expect(prisma.promotionSchemeParty.update).not.toHaveBeenCalled();
    });

    it('judges an edited band on the stored threshold it did not resend', async () => {
      prisma.promotionSchemeSlab.findFirst.mockResolvedValue(slabRow({ prsExceeds: dec(500) }));

      const refusal = await refusalOf(
        service.saveScheme(newScheme({ slabs: [{ prs_id: 'slab-1', prs_upto: 100 }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'prs_upto', code: PromotionSchemeErrorCode.SLAB_BAND_INVALID }] },
      });
    });

    it('writes only the fields an edited band carries', async () => {
      prisma.promotionSchemeSlab.findFirst.mockResolvedValue(slabRow());

      await service.saveScheme(
        newScheme({ slabs: [{ prs_id: 'slab-1', prs_disc_perc: 8, prs_upto: 999 }] }),
      );

      const { where, data } = prisma.promotionSchemeSlab.update.mock.calls[0][0];
      expect(where).toEqual({ prsId: 'slab-1' });
      expect(data).toEqual({
        prsModifiedOn: expect.any(Date) as Date,
        prsModifiedBy: USER_ID,
        prsUpto: 999,
        prsDiscPerc: 8,
      });
      expect(auditActions()).toContain('update:promotion scheme slab');
    });

    it('answers 404 for a band id that is not on this scheme', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ slabs: [{ prs_id: 'gone', prs_disc_perc: 5 }] })),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [{ field: 'prs_id', code: PromotionSchemeErrorCode.SCHEME_ROW_NOT_FOUND }],
        },
      });
    });

    it('stamps the soft delete of a dropped row with the scheme modifier', async () => {
      stored = withChildren(schemeRow());
      prisma.promotionSchemeBranch.findMany.mockResolvedValue([branchRow()]);

      await service.saveScheme({
        prm_id: PRM_ID,
        prm_modified_by: 'editor',
        branches: [],
      });

      expect(prisma.promotionSchemeBranch.update).toHaveBeenCalledWith({
        where: { prbId: 'branch-row-1' },
        data: expect.objectContaining({ prbIsDeleted: true, prbModifiedBy: 'editor' }) as object,
      });
    });
  });

  describe('write failures', () => {
    it('names the master a foreign key could not find', async () => {
      prisma.promotionSchemeBranch.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'test',
          meta: { field_name: 'fk_prb_branch' },
        }),
      );

      const refusal = await refusalOf(
        service.saveScheme(newScheme({ branches: [{ prb_branch_id: BRANCH_ID }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'prb_branch_id', code: PromotionSchemeErrorCode.REFERENCE_NOT_FOUND }],
        },
      });
    });

    it('answers a unique violation with a 409', async () => {
      prisma.promotionScheme.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('dup', { code: 'P2002', clientVersion: 'test' }),
      );

      const refusal = await refusalOf(service.saveScheme(newScheme()));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ code: PromotionSchemeErrorCode.DUPLICATE_RECORD }] },
      });
    });

    it('maps a failure inside an update the same way', async () => {
      stored = withChildren(schemeRow());
      prisma.promotionScheme.update.mockRejectedValue(
        new Error('violates exclusion constraint "ex_prm_exclusive_clash" 23P01'),
      );

      const refusal = await refusalOf(service.saveScheme({ prm_id: PRM_ID, prm_priority: 2 }));

      expect(refusal).toMatchObject({
        status: 409,
        body: {
          errors: [{ field: 'prm_priority', code: PromotionSchemeErrorCode.EXCLUSIVE_CLASH }],
        },
      });
    });
  });

  describe('update', () => {
    it('answers 404 for a scheme that is not live', async () => {
      const refusal = await refusalOf(service.saveScheme({ prm_id: PRM_ID, prm_name: 'X' }));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'prm_id', code: PromotionSchemeErrorCode.SCHEME_NOT_FOUND }] },
      });
      expect(prisma.promotionScheme.update).not.toHaveBeenCalled();
    });

    it('writes only the fields sent, checks the code against other schemes, and audits', async () => {
      stored = withChildren(schemeRow());

      const payload = await service.saveScheme({
        prm_id: PRM_ID,
        prm_name: 'Summer sale 2',
        prm_modified_by: 'editor',
      });

      expect(updatedData()).toEqual({
        prmModifiedOn: expect.any(Date) as Date,
        prmModifiedBy: 'editor',
        prmName: 'Summer sale 2',
      });
      expect(prisma.promotionScheme.findFirst).toHaveBeenCalledWith({
        where: {
          prmCompId: COMPANY_ID,
          prmIsDeleted: false,
          prmCode: { equals: 'SUMMER', mode: 'insensitive' },
          prmId: { not: PRM_ID },
        },
        select: { prmId: true },
      });
      expect(payload.prm_name).toBe('Summer sale 2');
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          pk: PRM_ID,
          originalRecord: expect.objectContaining({ prm_name: 'Summer sale' }) as object,
          modifiedRecord: expect.objectContaining({ prm_name: 'Summer sale 2' }) as object,
        }),
        prisma,
      );
    });

    it('refuses to change the benefit under existing bands unless they are resent', async () => {
      stored = withChildren(schemeRow(), { slabs: [slabRow()] });

      const refusal = await refusalOf(
        service.saveScheme({ prm_id: PRM_ID, prm_benefit: 'DISC_AMT' }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'prm_benefit', code: PromotionSchemeErrorCode.BENEFIT_CHANGE_WITH_SLABS },
          ],
        },
      });
      expect(prisma.promotionScheme.update).not.toHaveBeenCalled();
    });

    it('lets the benefit change when the same call rewrites the bands', async () => {
      stored = withChildren(schemeRow(), { slabs: [slabRow()] });
      prisma.promotionSchemeSlab.findMany.mockResolvedValue([slabRow()]);

      await service.saveScheme({
        prm_id: PRM_ID,
        prm_benefit: 'DISC_AMT',
        slabs: [],
      });

      expect(updatedData()).toMatchObject({ prmBenefit: 'DISC_AMT' });
      expect(prisma.promotionSchemeSlab.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { prsId: 'slab-1' },
          data: expect.objectContaining({ prsIsDeleted: true }) as object,
        }),
      );
    });

    it('refuses a renamed code another scheme of the company already uses', async () => {
      stored = withChildren(schemeRow());
      codeClash = { prmId: 'other' };

      const refusal = await refusalOf(service.saveScheme({ prm_id: PRM_ID, prm_code: 'winter' }));

      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'prm_code', code: PromotionSchemeErrorCode.CODE_EXISTS }] },
      });
      expect(prisma.promotionScheme.update).not.toHaveBeenCalled();
    });

    it('probes the code against the company the scheme is moving to', async () => {
      stored = withChildren(schemeRow());

      await service.saveScheme({
        prm_id: PRM_ID,
        prm_comp_id: OTHER_COMPANY_ID,
      });

      expect(prisma.promotionScheme.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ prmCompId: OTHER_COMPANY_ID }) as object,
          select: { prmId: true },
        }),
      );
    });

    it('refuses a scheme id that is not a uuid before opening a transaction', async () => {
      const refusal = await refusalOf(service.saveScheme({ prm_id: 'scheme-1' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'prm_id', code: PromotionSchemeErrorCode.INVALID_UUID }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('judges the header rules on the stored row overlaid with the edit', async () => {
      stored = withChildren(schemeRow());

      const refusal = await refusalOf(
        service.saveScheme({
          prm_id: PRM_ID,
          prm_end_date: '2026-04-01',
        }),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: PromotionSchemeErrorCode.END_BEFORE_START }] },
      });
    });
  });

  describe('getSchemeById', () => {
    it('answers 404 for a scheme that is not live', async () => {
      const refusal = await refusalOf(service.getSchemeById(PRM_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              field: 'prm_id',
              message: `prm_id ${PRM_ID} was not found`,
              code: PromotionSchemeErrorCode.SCHEME_NOT_FOUND,
            },
          ],
        },
      });
    });

    it('returns the whole scheme graph', async () => {
      stored = withChildren(schemeRow(), { slabs: [slabRow()] });

      await expect(service.getSchemeById(PRM_ID)).resolves.toMatchObject({
        prm_id: PRM_ID,
        slabs: [{ prs_id: 'slab-1', prs_disc_perc: 5 }],
      });
    });
  });

  describe('softDeleteScheme', () => {
    it('answers 404 for a scheme that is not live', async () => {
      const refusal = await refusalOf(service.softDeleteScheme(PRM_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.promotionScheme.update).not.toHaveBeenCalled();
    });

    it('takes the header and all four grids down together, under one actor and instant', async () => {
      stored = withChildren(schemeRow());

      await expect(service.softDeleteScheme(PRM_ID, 'hq-user')).resolves.toEqual({
        deleted: true,
        prm_id: PRM_ID,
      });

      const header = (
        prisma.promotionScheme.update.mock.calls[0][0] as {
          data: { prmModifiedOn: Date; prmModifiedBy: string };
        }
      ).data;
      expect(header).toMatchObject({
        prmIsDeleted: true,
        prmIsActive: false,
        prmModifiedBy: 'hq-user',
      });
      for (const [table, prefix, fk] of [
        [prisma.promotionSchemeBranch, 'prb', 'prbPrmId'],
        [prisma.promotionSchemeParty, 'prp', 'prpPrmId'],
        [prisma.promotionSchemeItem, 'pri', 'priPrmId'],
        [prisma.promotionSchemeSlab, 'prs', 'prsPrmId'],
      ] as const) {
        expect(table.updateMany).toHaveBeenCalledWith({
          where: { [fk]: PRM_ID, [`${prefix}IsDeleted`]: false },
          data: {
            [`${prefix}IsDeleted`]: true,
            [`${prefix}IsActive`]: false,
            [`${prefix}ModifiedOn`]: header.prmModifiedOn,
            [`${prefix}ModifiedBy`]: 'hq-user',
          },
        });
      }
      expect(auditActions()).toEqual(['cancel:promotion scheme']);
    });
  });
});
