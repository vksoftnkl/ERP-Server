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

/** A child table mock: rows are created with an id and a creation stamp. */
const childTable = (idKey: string, createdOnKey: string) => ({
  findFirst: jest.fn().mockResolvedValue(null),
  findMany: jest.fn().mockResolvedValue([]),
  create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    [idKey]: `new-${idKey}`,
    [createdOnKey]: NOW,
    ...data,
  })),
  update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => ({
    [createdOnKey]: NOW,
    ...data,
  })),
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
      promotionSchemeBranch: childTable('prbId', 'prbCreatedOn'),
      promotionSchemeParty: childTable('prpId', 'prpCreatedOn'),
      promotionSchemeItem: childTable('priId', 'priCreatedOn'),
      promotionSchemeSlab: childTable('prsId', 'prsCreatedOn'),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new PromotionSchemeService(prisma as never, audit as never, context as never);
  });

  const newScheme = (extra: Partial<SavePromotionSchemeDto> = {}): SavePromotionSchemeDto =>
    ({
      prm_comp_id: COMPANY_ID,
      prm_code: ' SUMMER ',
      prm_name: 'Summer sale',
      prm_start_date: '2026-05-01',
      prm_end_date: '2026-05-31',
      ...extra,
    }) as SavePromotionSchemeDto;

  const createdData = () =>
    (prisma.promotionScheme.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.promotionScheme.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditActions = () =>
    audit.logEntityChange.mock.calls.map(
      ([entry]) => `${(entry as { action: string }).action}:${(entry as { tableName: string }).tableName}`,
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
          } as never),
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
          branches: [{ prb_branch_id: BRANCH_ID }, { prb_branch_id: OTHER_BRANCH_ID, prb_is_exclude: true }],
        } as never),
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
        newScheme({ parties: [{ prp_kind: 'area', prp_scope_id: AREA_ID }] } as never),
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
        service.saveScheme(
          newScheme({ parties: [{ prp_kind: 'STATE', prp_scope_id: AREA_ID }] } as never),
        ),
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
          } as never),
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

      await service.saveScheme(newScheme({ parties: [] } as never));

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
        service.saveScheme(
          newScheme({ slabs: [{ prs_benefit: 'DISC_AMT', prs_disc_amt: 10 }] } as never),
        ),
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
      await service.saveScheme(
        newScheme({ slabs: [{ prs_exceeds: 0, prs_disc_perc: 5 }] } as never),
      );

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
          } as never),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'prs_exceeds', code: PromotionSchemeErrorCode.DUPLICATE_ROW_SCOPE }],
        },
      });
    });
  });

  describe('update', () => {
    it('answers 404 for a scheme that is not live', async () => {
      const refusal = await refusalOf(
        service.saveScheme({ prm_id: PRM_ID, prm_name: 'X' } as SavePromotionSchemeDto),
      );

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
      } as SavePromotionSchemeDto);

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
        service.saveScheme({ prm_id: PRM_ID, prm_benefit: 'DISC_AMT' } as SavePromotionSchemeDto),
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
      } as unknown as SavePromotionSchemeDto);

      expect(updatedData()).toMatchObject({ prmBenefit: 'DISC_AMT' });
      expect(prisma.promotionSchemeSlab.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { prsId: 'slab-1' },
          data: expect.objectContaining({ prsIsDeleted: true }) as object,
        }),
      );
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
