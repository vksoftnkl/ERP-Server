import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { DEFAULT_AUDIT_ACTOR } from 'src/common/utils/module-service.utils';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import { PromotionLoyaltyPointsService } from './promotion-loyalty-points.service';
import { LoyaltyErrorCode } from './types/loyalty-error-codes';

/**
 * POST /create (create and update, header plus the five grids), GET /get and
 * DELETE /delete. /list and /eligibility have their own specs.
 */
const LSC_ID = '019c6f6c-be87-7a11-8905-36092c46e801';
const COMPANY_ID = '019c6f6c-be87-7a11-8905-36092c46e802';
const BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e803';
const OTHER_BRANCH_ID = '019c6f6c-be87-7a11-8905-36092c46e804';
const USER_ID = '019c6f6c-be87-7a11-8905-36092c46e805';
const APPROVER_ID = '019c6f6c-be87-7a11-8905-36092c46e806';
const CUSTOMER_ID = '019c6f6c-be87-7a11-8905-36092c46e807';
const GROUP_ID = '019c6f6c-be87-7a11-8905-36092c46e808';
const ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46e809';
const OTHER_ITEM_ID = '019c6f6c-be87-7a11-8905-36092c46e80a';
const UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46e80b';
const OTHER_UNIT_ID = '019c6f6c-be87-7a11-8905-36092c46e80c';
const BRAND_ID = '019c6f6c-be87-7a11-8905-36092c46e80d';
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

const codesOf = (refusal: { body: unknown }): string[] =>
  (refusal.body as { errors: Array<{ code: string }> }).errors.map((error) => error.code);

const schemeRow = (overrides: Record<string, unknown> = {}) => ({
  lscId: LSC_ID,
  lscCompId: COMPANY_ID,
  lscBranchId: null,
  lscTenantId: null,
  lscCode: 'GOLD',
  lscName: 'Gold card',
  lscType: 'BOTH',
  lscStatus: 'DRAFT',
  lscPriority: 1,
  lscAutoApply: true,
  lscApplyOn: 'BILL_AMOUNT',
  lscCalcOnAmountType: 'NET_AMOUNT',
  lscIncludeTax: false,
  lscBillType: 'ALL',
  lscMinBillAmount: dec(0),
  lscMaxEarnPoints: dec(0),
  lscEarnOnDiscounted: true,
  lscEarnOnCharges: false,
  lscEarnWithRedeem: false,
  lscRoundingMethod: 'FLOOR',
  lscPointsDecimals: 2,
  lscBranchScope: 'ALL',
  lscCustScope: 'ALL',
  lscItemScope: 'ALL',
  lscPriceLevelId: null,
  lscPoolMode: 'COMPANY',
  lscAllowCrossBranchRedeem: true,
  lscAllowPointRedeem: false,
  lscAllowGiftRedeem: false,
  lscRedeemTenderId: null,
  lscRedeemValuePerPoint: dec(0),
  lscMinRedeemPoints: dec(0),
  lscMaxRedeemPoints: dec(0),
  lscMaxRedeemPerc: dec(100),
  lscRedeemMinBillAmount: dec(0),
  lscRedeemMultiple: dec(0),
  lscExpiryBasis: 'EARN_DATE',
  lscPointsValidDays: 365,
  lscActivationDays: 0,
  lscReturnMode: 'REVERSE',
  lscStartDate: new Date('2026-04-01T00:00:00.000Z'),
  lscEndDate: new Date('2027-03-31T00:00:00.000Z'),
  lscValidFromTime: null,
  lscValidToTime: null,
  lscValidWeekdays: null,
  lscRemarks: null,
  lscIsActive: true,
  lscIsDeleted: false,
  lscSyncDate: null,
  lscCreatedOn: NOW,
  lscCreatedBy: 'admin',
  lscModifiedOn: null,
  lscModifiedBy: null,
  lscApprovedOn: null,
  lscApprovedBy: null,
  ...overrides,
});

const withChildren = (row: object, children: Record<string, unknown[]> = {}) => ({
  ...row,
  branches: [],
  parties: [],
  items: [],
  slabs: [],
  gifts: [],
  ...children,
});

const branchRow = (overrides: Record<string, unknown> = {}) => ({
  lsbId: 'branch-row-1',
  lsbLscId: LSC_ID,
  lsbSlno: 1,
  lsbBranchId: BRANCH_ID,
  lsbIsExclude: false,
  lsbNotes: null,
  lsbIsActive: true,
  lsbIsDeleted: false,
  lsbSyncDate: null,
  lsbCreatedOn: NOW,
  lsbCreatedBy: null,
  lsbModifiedOn: null,
  lsbModifiedBy: null,
  ...overrides,
});

const partyRow = (overrides: Record<string, unknown> = {}) => ({
  lspId: 'party-row-1',
  lspLscId: LSC_ID,
  lspSlno: 1,
  lspKind: 'CUSTOMER',
  lspScopeId: CUSTOMER_ID,
  lspCustId: CUSTOMER_ID,
  lspCustGroupId: null,
  lspIsExclude: false,
  lspMatchPriority: 2,
  lspNotes: null,
  lspIsActive: true,
  lspIsDeleted: false,
  lspSyncDate: null,
  lspCreatedOn: NOW,
  lspCreatedBy: null,
  lspModifiedOn: null,
  lspModifiedBy: null,
  ...overrides,
});

const itemRow = (overrides: Record<string, unknown> = {}) => ({
  lsiId: 'item-row-1',
  lsiLscId: LSC_ID,
  lsiSlno: 1,
  lsiKind: 'ITEM_BRAND',
  lsiScopeId: BRAND_ID,
  lsiItemId: null,
  lsiGroupId: null,
  lsiCategoryId: null,
  lsiBrandId: BRAND_ID,
  lsiSectionId: null,
  lsiIsExclude: false,
  lsiFactor: dec(2),
  lsiPoints: dec(0),
  lsiMaxPoints: dec(0),
  lsiMatchPriority: 3,
  lsiNotes: null,
  lsiIsActive: true,
  lsiIsDeleted: false,
  lsiSyncDate: null,
  lsiCreatedOn: NOW,
  lsiCreatedBy: null,
  lsiModifiedOn: null,
  lsiModifiedBy: null,
  ...overrides,
});

const slabRow = (overrides: Record<string, unknown> = {}) => ({
  lssId: 'slab-row-1',
  lssLscId: LSC_ID,
  lssSlno: 1,
  lssItemId: null,
  lssUnitId: null,
  lssExceeds: dec(1000),
  lssUpto: null,
  lssEach: dec(100),
  lssPoints: dec(2),
  lssFactor: dec(1),
  lssMaxPoints: dec(0),
  lssNotes: null,
  lssIsActive: true,
  lssIsDeleted: false,
  lssSyncDate: null,
  lssCreatedOn: NOW,
  lssCreatedBy: null,
  lssModifiedOn: null,
  lssModifiedBy: null,
  ...overrides,
});

const giftRow = (overrides: Record<string, unknown> = {}) => ({
  lsgId: 'gift-row-1',
  lsgLscId: LSC_ID,
  lsgSlno: 1,
  lsgItemId: ITEM_ID,
  lsgUnitId: UNIT_ID,
  lsgItemQty: dec(1),
  lsgRedeemPoints: dec(500),
  lsgRepeat: false,
  lsgMaxQtyPerBill: dec(0),
  lsgStockCheck: true,
  lsgValidFrom: new Date('2026-04-01T00:00:00.000Z'),
  lsgValidUpto: new Date('2026-12-31T00:00:00.000Z'),
  lsgNotes: null,
  lsgIsActive: true,
  lsgIsDeleted: false,
  lsgSyncDate: null,
  lsgCreatedOn: NOW,
  lsgCreatedBy: null,
  lsgModifiedOn: null,
  lsgModifiedBy: null,
  ...overrides,
});

/** A child table whose writes answer with the whole row the table would hold. */
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

type Probe = { where: Record<string, unknown>; select?: Record<string, boolean> };

describe('PromotionLoyaltyPointsService — save, read and delete', () => {
  let stored: ReturnType<typeof withChildren> | null;
  let codeClash: { lscId: string } | null;
  let primaryClash: { lscId: string; lscCode: string } | null;
  let prisma: {
    loyaltyScheme: { findFirst: jest.Mock; create: jest.Mock; update: jest.Mock };
    loyaltySchemeBranch: ReturnType<typeof childTable>;
    loyaltySchemeParty: ReturnType<typeof childTable>;
    loyaltySchemeItem: ReturnType<typeof childTable>;
    loyaltySchemeSlab: ReturnType<typeof childTable>;
    loyaltySchemeGift: ReturnType<typeof childTable>;
    $transaction: jest.Mock;
  };
  let audit: { logEntityChange: jest.Mock };
  let context: { getUserId: jest.Mock };
  let service: PromotionLoyaltyPointsService;

  beforeEach(() => {
    stored = null;
    codeClash = null;
    primaryClash = null;
    prisma = {
      loyaltyScheme: {
        // Three readers: the code probe and the primary probe select, the graph
        // read includes.
        findFirst: jest.fn(async ({ select }: Probe) => {
          if (select?.lscCode) return primaryClash;
          if (select) return codeClash;
          return stored;
        }),
        create: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = schemeRow(data);
          stored = withChildren(row);
          return row;
        }),
        update: jest.fn(async ({ data }: { data: Record<string, unknown> }) => {
          const row = schemeRow({ ...stored, ...data });
          stored = { ...withChildren(row), ...pickChildren(stored) };
          return row;
        }),
      },
      loyaltySchemeBranch: childTable('lsbId', branchRow),
      loyaltySchemeParty: childTable('lspId', partyRow),
      loyaltySchemeItem: childTable('lsiId', itemRow),
      loyaltySchemeSlab: childTable('lssId', slabRow),
      loyaltySchemeGift: childTable('lsgId', giftRow),
      $transaction: jest.fn(async (callback: (tx: unknown) => unknown) => callback(prisma)),
    };
    audit = { logEntityChange: jest.fn().mockResolvedValue(undefined) };
    context = { getUserId: jest.fn().mockReturnValue(USER_ID) };
    service = new PromotionLoyaltyPointsService(prisma as never, audit as never, context as never);
  });

  const pickChildren = (graph: ReturnType<typeof withChildren> | null) => ({
    branches: graph?.branches ?? [],
    parties: graph?.parties ?? [],
    items: graph?.items ?? [],
    slabs: graph?.slabs ?? [],
    gifts: graph?.gifts ?? [],
  });

  const newScheme = (extra: Record<string, unknown> = {}): SaveLoyaltySchemeDto => ({
    lsc_comp_id: COMPANY_ID,
    lsc_code: ' GOLD ',
    lsc_name: 'Gold card',
    lsc_start_date: '2026-04-01',
    lsc_end_date: '2027-03-31',
    lsc_points_valid_days: 365,
    ...extra,
  });
  const edit = (extra: Record<string, unknown> = {}) =>
    ({ lsc_id: LSC_ID, ...extra }) as unknown as SaveLoyaltySchemeDto;

  const createdData = () =>
    (prisma.loyaltyScheme.create.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const updatedData = () =>
    (prisma.loyaltyScheme.update.mock.calls[0][0] as { data: Record<string, unknown> }).data;
  const auditActions = () =>
    audit.logEntityChange.mock.calls.map(
      ([entry]) =>
        `${(entry as { action: string }).action}:${(entry as { tableName: string }).tableName}`,
    );
  const probes = () =>
    prisma.loyaltyScheme.findFirst.mock.calls
      .map(([args]) => args as Probe)
      .filter((args) => args.select);

  describe('create', () => {
    it('writes the required header fields, stamps the user and audits the insert', async () => {
      const payload = await service.saveScheme(newScheme());

      expect(createdData()).toEqual({
        lscCompId: COMPANY_ID,
        lscCode: 'GOLD',
        lscName: 'Gold card',
        lscStartDate: new Date('2026-04-01T00:00:00.000Z'),
        lscEndDate: new Date('2027-03-31T00:00:00.000Z'),
        lscPointsValidDays: 365,
        lscCreatedBy: USER_ID,
      });
      expect(payload).toMatchObject({
        lsc_id: LSC_ID,
        lsc_code: 'GOLD',
        lsc_start_date: '2026-04-01',
        gifts: [],
      });
      expect(auditActions()).toEqual(['insert:loyalty scheme']);
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({ userId: USER_ID, screenName: 'Promotion Loyalty Points' }),
        prisma,
      );
    });

    it('stamps the creator named in the body, else the default actor with nobody logged in', async () => {
      await service.saveScheme(newScheme({ lsc_created_by: ' hq-admin ' }));
      expect(createdData().lscCreatedBy).toBe('hq-admin');

      prisma.loyaltyScheme.create.mockClear();
      context.getUserId.mockReturnValue(null);
      await service.saveScheme(newScheme());
      expect(createdData().lscCreatedBy).toBe(DEFAULT_AUDIT_ACTOR);
    });

    it('refuses a company id that is not a uuid before reading anything', async () => {
      const refusal = await refusalOf(service.saveScheme(newScheme({ lsc_comp_id: 'acme' })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsc_comp_id', code: LoyaltyErrorCode.INVALID_UUID }] },
      });
      expect(prisma.loyaltyScheme.findFirst).not.toHaveBeenCalled();
    });

    it('refuses an earn-date expiry with no validity window', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ lsc_points_valid_days: undefined })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'lsc_points_valid_days', code: LoyaltyErrorCode.EXPIRY_DAYS_REQUIRED }],
        },
      });
      expect(prisma.loyaltyScheme.create).not.toHaveBeenCalled();
    });

    it('lets a scheme whose points never expire leave the window at 0', async () => {
      await service.saveScheme(
        newScheme({ lsc_points_valid_days: undefined, lsc_expiry_basis: 'none' }),
      );

      expect(createdData()).toMatchObject({ lscExpiryBasis: 'NONE' });
    });

    it('reports every broken header rule at once', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            lsc_code: 'GOLD CARD',
            lsc_end_date: '2026-03-01',
            lsc_priority: 12,
            lsc_valid_from_time: '09:00',
          }),
        ),
      );

      expect(refusal.status).toBe(400);
      expect(codesOf(refusal)).toEqual(
        expect.arrayContaining([
          LoyaltyErrorCode.CODE_SHAPE,
          LoyaltyErrorCode.END_BEFORE_START,
          LoyaltyErrorCode.OUT_OF_RANGE,
          LoyaltyErrorCode.TIME_PAIR_INCOMPLETE,
        ]),
      );
    });

    it('upper-cases the vocabulary and the weekdays, and parses the time window', async () => {
      await service.saveScheme(
        newScheme({
          lsc_type: 'earn',
          lsc_rounding_method: 'ceil',
          lsc_valid_weekdays: ' mon,fri ',
          lsc_valid_from_time: '22:00',
          lsc_valid_to_time: '04:30:15',
        }),
      );

      expect(createdData()).toMatchObject({
        lscType: 'EARN',
        lscRoundingMethod: 'CEIL',
        lscValidWeekdays: 'MON,FRI',
        lscValidFromTime: new Date('1970-01-01T22:00:00.000Z'),
        lscValidToTime: new Date('1970-01-01T04:30:15.000Z'),
      });
    });

    it('refuses a time that is not HH:mm', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ lsc_valid_from_time: '9 am', lsc_valid_to_time: '18:00' })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsc_valid_from_time', code: LoyaltyErrorCode.INVALID_TIME }] },
      });
    });

    it('wants a point value once point redemption is switched on', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ lsc_allow_point_redeem: true })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [
            { field: 'lsc_redeem_value_per_point', code: LoyaltyErrorCode.REDEEM_RATE_REQUIRED },
          ],
        },
      });
    });

    it('drops an approver that is not a user id, so an APPROVED scheme is refused', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ lsc_status: 'APPROVED', lsc_approved_by: 'manager' })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: {
          errors: [{ field: 'lsc_approved_by', code: LoyaltyErrorCode.SCHEME_APPROVER_REQUIRED }],
        },
      });
    });

    it('refuses an approval instant that is not a datetime, and clears a blank one', async () => {
      const refusal = await refusalOf(service.saveScheme(newScheme({ lsc_approved_on: 'soon' })));
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsc_approved_on', code: LoyaltyErrorCode.INVALID_DATETIME }] },
      });

      await service.saveScheme(newScheme({ lsc_approved_on: '  ' }));
      expect(createdData().lscApprovedOn).toBeNull();
    });

    it('refuses a code another live scheme of the company already uses', async () => {
      codeClash = { lscId: 'other' };

      const refusal = await refusalOf(service.saveScheme(newScheme()));

      expect(probes()[0]).toEqual({
        where: {
          lscCompId: COMPANY_ID,
          lscIsDeleted: false,
          lscCode: { equals: 'GOLD', mode: 'insensitive' },
        },
        select: { lscId: true },
      });
      expect(refusal).toMatchObject({
        status: 409,
        body: { errors: [{ field: 'lsc_code', code: LoyaltyErrorCode.SCHEME_CODE_EXISTS }] },
      });
      expect(prisma.loyaltyScheme.create).not.toHaveBeenCalled();
    });

    describe('the one approved primary per company, branch and type', () => {
      const approvedPrimary = (extra: Record<string, unknown> = {}) =>
        newScheme({
          lsc_status: 'APPROVED',
          lsc_approved_by: APPROVER_ID,
          lsc_branch_id: BRANCH_ID,
          lsc_type: 'EARN',
          ...extra,
        });

      it('probes ux_lsc_primary on exactly the key it is built from', async () => {
        await service.saveScheme(approvedPrimary());

        expect(probes()[1]).toEqual({
          where: {
            lscCompId: COMPANY_ID,
            lscBranchId: BRANCH_ID,
            lscType: 'EARN',
            lscPriority: 1,
            lscStatus: 'APPROVED',
            lscIsActive: true,
            lscIsDeleted: false,
          },
          select: { lscId: true, lscCode: true },
        });
      });

      it('refuses a second approved priority-1 scheme', async () => {
        primaryClash = { lscId: 'other', lscCode: 'SILVER' };

        const refusal = await refusalOf(service.saveScheme(approvedPrimary()));

        expect(refusal).toMatchObject({
          status: 409,
          body: {
            errors: [{ field: 'lsc_priority', code: LoyaltyErrorCode.PRIMARY_SCHEME_EXISTS }],
          },
        });
        expect(
          (refusal.body as { errors: Array<{ message: string }> }).errors[0].message,
        ).toContain('SILVER');
        expect(prisma.loyaltyScheme.create).not.toHaveBeenCalled();
      });

      it.each([
        ['a lower priority', { lsc_priority: 2 }],
        ['a draft', { lsc_status: 'DRAFT', lsc_approved_by: undefined }],
        ['an inactive scheme', { lsc_is_active: false }],
      ])('does not probe for %s', async (_label, extra) => {
        primaryClash = { lscId: 'other', lscCode: 'SILVER' };

        await service.saveScheme(approvedPrimary(extra));

        expect(probes()).toHaveLength(1);
        expect(prisma.loyaltyScheme.create).toHaveBeenCalled();
      });
    });

    it('names the master a foreign key could not find', async () => {
      prisma.loyaltyScheme.create.mockRejectedValue(
        new Prisma.PrismaClientKnownRequestError('fk', {
          code: 'P2003',
          clientVersion: 'test',
          meta: { field_name: 'fk_lsc_company' },
        }),
      );

      const refusal = await refusalOf(service.saveScheme(newScheme()));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsc_comp_id', code: LoyaltyErrorCode.REFERENCE_NOT_FOUND }] },
      });
    });

    it('rethrows a failure it cannot name', async () => {
      const failure = new Error('connection reset');
      prisma.loyaltyScheme.create.mockRejectedValue(failure);

      await expect(service.saveScheme(newScheme())).rejects.toBe(failure);
    });
  });

  describe('update', () => {
    it('answers 404 for a scheme that is not live', async () => {
      const refusal = await refusalOf(service.saveScheme(edit({ lsc_name: 'X' })));

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'lsc_id', code: LoyaltyErrorCode.SCHEME_NOT_FOUND }] },
      });
      expect(prisma.loyaltyScheme.update).not.toHaveBeenCalled();
    });

    it('refuses a scheme id that is not a uuid before opening a transaction', async () => {
      const refusal = await refusalOf(service.saveScheme({ lsc_id: 'gold' }));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsc_id', code: LoyaltyErrorCode.INVALID_UUID }] },
      });
      expect(prisma.$transaction).not.toHaveBeenCalled();
    });

    it('writes only the fields sent, probes the code against other schemes, and audits', async () => {
      stored = withChildren(schemeRow());

      const payload = await service.saveScheme(
        edit({ lsc_name: 'Gold card 2', lsc_modified_by: 'editor' }),
      );

      expect(updatedData()).toEqual({
        lscModifiedOn: expect.any(Date) as Date,
        lscModifiedBy: 'editor',
        lscName: 'Gold card 2',
      });
      expect(probes()[0].where).toEqual({
        lscCompId: COMPANY_ID,
        lscIsDeleted: false,
        lscCode: { equals: 'GOLD', mode: 'insensitive' },
        lscId: { not: LSC_ID },
      });
      expect(payload.lsc_name).toBe('Gold card 2');
      expect(audit.logEntityChange).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'update',
          pk: LSC_ID,
          originalRecord: expect.objectContaining({ lsc_name: 'Gold card' }) as object,
          modifiedRecord: expect.objectContaining({ lsc_name: 'Gold card 2' }) as object,
        }),
        prisma,
      );
    });

    it('judges the header rules on the stored row overlaid with the edit', async () => {
      stored = withChildren(schemeRow());

      const refusal = await refusalOf(service.saveScheme(edit({ lsc_points_valid_days: 0 })));

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ code: LoyaltyErrorCode.EXPIRY_DAYS_REQUIRED }] },
      });
      expect(prisma.loyaltyScheme.update).not.toHaveBeenCalled();
    });

    it('probes the primary on the stored company and branch, leaving itself out', async () => {
      stored = withChildren(
        schemeRow({ lscBranchId: BRANCH_ID, lscType: 'EARN', lscApprovedBy: APPROVER_ID }),
      );
      primaryClash = { lscId: 'other', lscCode: 'SILVER' };

      const refusal = await refusalOf(service.saveScheme(edit({ lsc_status: 'APPROVED' })));

      expect(probes()[1].where).toEqual({
        lscCompId: COMPANY_ID,
        lscBranchId: BRANCH_ID,
        lscType: 'EARN',
        lscPriority: 1,
        lscStatus: 'APPROVED',
        lscIsActive: true,
        lscIsDeleted: false,
        lscId: { not: LSC_ID },
      });
      expect(refusal.status).toBe(409);
    });

    it('lets an approved primary be deactivated without probing for a clash', async () => {
      stored = withChildren(schemeRow({ lscStatus: 'APPROVED', lscApprovedBy: APPROVER_ID }));
      primaryClash = { lscId: 'other', lscCode: 'SILVER' };

      await service.saveScheme(edit({ lsc_is_active: false }));

      expect(probes()).toHaveLength(1);
      expect(updatedData()).toMatchObject({ lscIsActive: false });
    });
  });

  describe('the grids saved with the header', () => {
    it('leaves every grid alone when the body carries none', async () => {
      await service.saveScheme(newScheme());

      for (const table of [
        prisma.loyaltySchemeBranch,
        prisma.loyaltySchemeParty,
        prisma.loyaltySchemeItem,
        prisma.loyaltySchemeSlab,
        prisma.loyaltySchemeGift,
      ]) {
        expect(table.findMany).not.toHaveBeenCalled();
      }
    });

    it('creates branch rows numbered by position, header audited first', async () => {
      await service.saveScheme(
        newScheme({
          branches: [
            { lsb_branch_id: BRANCH_ID },
            { lsb_branch_id: OTHER_BRANCH_ID, lsb_is_exclude: true },
          ],
        }),
      );

      expect(prisma.loyaltySchemeBranch.create.mock.calls.map(([args]) => args.data)).toEqual([
        expect.objectContaining({ lsbSlno: 1, lsbBranchId: BRANCH_ID, lsbIsExclude: false }),
        expect.objectContaining({ lsbSlno: 2, lsbBranchId: OTHER_BRANCH_ID, lsbIsExclude: true }),
      ]);
      expect(auditActions()).toEqual([
        'insert:loyalty scheme',
        'insert:loyalty scheme branch',
        'insert:loyalty scheme branch',
      ]);
    });

    it('refuses two rows naming the same branch, and a serial below 1', async () => {
      const twice = await refusalOf(
        service.saveScheme(
          newScheme({ branches: [{ lsb_branch_id: BRANCH_ID }, { lsb_branch_id: BRANCH_ID }] }),
        ),
      );
      expect(twice).toMatchObject({
        status: 400,
        body: {
          errors: [
            {
              field: 'lsb_branch_id',
              message: 'Rows 1 and 2 target the same scope',
              code: LoyaltyErrorCode.DUPLICATE_ROW_SCOPE,
            },
          ],
        },
      });

      const zero = await refusalOf(
        service.saveScheme(newScheme({ branches: [{ lsb_branch_id: BRANCH_ID, lsb_slno: 0 }] })),
      );
      expect(zero).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsb_slno', code: LoyaltyErrorCode.NUMBER_BELOW_MINIMUM }] },
      });
      expect(prisma.loyaltySchemeBranch.create).not.toHaveBeenCalled();
    });

    it('seeds a party priority from its kind: a named customer outranks a group', async () => {
      await service.saveScheme(
        newScheme({
          parties: [
            { lsp_kind: 'customer', lsp_scope_id: CUSTOMER_ID },
            { lsp_kind: 'CUSTOMER_GROUP', lsp_scope_id: GROUP_ID, lsp_is_exclude: true },
          ],
        }),
      );

      expect(prisma.loyaltySchemeParty.create.mock.calls.map(([args]) => args.data)).toEqual([
        expect.objectContaining({ lspKind: 'CUSTOMER', lspMatchPriority: 2, lspSlno: 1 }),
        expect.objectContaining({
          lspKind: 'CUSTOMER_GROUP',
          lspMatchPriority: 1,
          lspIsExclude: true,
          lspSlno: 2,
        }),
      ]);
    });

    it('refuses a party kind a wallet cannot follow', async () => {
      const refusal = await refusalOf(
        service.saveScheme(newScheme({ parties: [{ lsp_kind: 'AREA', lsp_scope_id: GROUP_ID }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsp_kind', code: LoyaltyErrorCode.VALUE_NOT_ALLOWED }] },
      });
    });

    it('answers 404 for a party row id that is not on this scheme', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({ parties: [{ lsp_id: 'party-row-1', lsp_kind: 'CUSTOMER' }] }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 404,
        body: { errors: [{ field: 'lsp_id', code: LoyaltyErrorCode.SCHEME_ROW_NOT_FOUND }] },
      });
      expect(prisma.loyaltySchemeParty.findFirst).toHaveBeenCalledWith({
        where: { lspId: 'party-row-1', lspLscId: LSC_ID, lspIsDeleted: false },
      });
    });

    it('updates a kept party row with only what it carries', async () => {
      prisma.loyaltySchemeParty.findFirst.mockResolvedValue(partyRow());

      await service.saveScheme(
        newScheme({ parties: [{ lsp_id: 'party-row-1', lsp_notes: '  VIP  ' }] }),
      );

      const { data } = prisma.loyaltySchemeParty.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        lspModifiedOn: expect.any(Date) as Date,
        lspModifiedBy: USER_ID,
        lspNotes: 'VIP',
      });
    });

    it('creates an item row with the factor defaulting to 1', async () => {
      await service.saveScheme(
        newScheme({ items: [{ lsi_kind: 'ITEM_BRAND', lsi_scope_id: BRAND_ID, lsi_points: 5 }] }),
      );

      expect(prisma.loyaltySchemeItem.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lsiKind: 'ITEM_BRAND',
            lsiScopeId: BRAND_ID,
            lsiFactor: 1,
            lsiPoints: 5,
            lsiMaxPoints: 0,
            lsiMatchPriority: 3,
            lsiIsExclude: false,
          }) as object,
        }),
      );
    });

    it('refuses an exclude item row that still earns, judged on the stored factor', async () => {
      prisma.loyaltySchemeItem.findFirst.mockResolvedValue(itemRow());

      const refusal = await refusalOf(
        service.saveScheme(newScheme({ items: [{ lsi_id: 'item-row-1', lsi_is_exclude: true }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsi_is_exclude', code: LoyaltyErrorCode.EXCLUDE_ROW_EARNS }] },
      });
      expect(prisma.loyaltySchemeItem.update).not.toHaveBeenCalled();
    });

    it('refuses a factor of zero on an item row', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({ items: [{ lsi_kind: 'ITEM', lsi_scope_id: ITEM_ID, lsi_factor: 0 }] }),
        ),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsi_factor', code: LoyaltyErrorCode.NOT_ABOVE_ZERO }] },
      });
    });

    it('lets two bands share a threshold only when they name different items', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({ slabs: [{ lss_exceeds: 1000 }, { lss_exceeds: 1000, lss_points: 3 }] }),
        ),
      );
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lss_exceeds', code: LoyaltyErrorCode.DUPLICATE_ROW_SCOPE }] },
      });

      await service.saveScheme(
        newScheme({
          slabs: [
            { lss_exceeds: 1000, lss_item_id: ITEM_ID, lss_unit_id: UNIT_ID },
            { lss_exceeds: 1000, lss_item_id: OTHER_ITEM_ID, lss_unit_id: UNIT_ID },
          ],
        }),
      );
      expect(prisma.loyaltySchemeSlab.create).toHaveBeenCalledTimes(2);
    });

    it('creates a whole-bill band with an open top and the documented defaults', async () => {
      await service.saveScheme(newScheme({ slabs: [{ lss_exceeds: 500, lss_points: 1 }] }));

      expect(prisma.loyaltySchemeSlab.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lssItemId: null,
            lssUnitId: null,
            lssExceeds: 500,
            lssUpto: null,
            lssEach: 1,
            lssPoints: 1,
            lssFactor: 1,
            lssMaxPoints: 0,
          }) as object,
        }),
      );
    });

    it('judges an edited band on the stored threshold it did not resend', async () => {
      prisma.loyaltySchemeSlab.findFirst.mockResolvedValue(slabRow());

      const refusal = await refusalOf(
        service.saveScheme(newScheme({ slabs: [{ lss_id: 'slab-row-1', lss_upto: 900 }] })),
      );

      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lss_upto', code: LoyaltyErrorCode.SLAB_BAND_INVALID }] },
      });
    });

    it('writes only the fields an edited band carries', async () => {
      prisma.loyaltySchemeSlab.findFirst.mockResolvedValue(slabRow());

      await service.saveScheme(
        newScheme({ slabs: [{ lss_id: 'slab-row-1', lss_upto: 5000, lss_points: 3 }] }),
      );

      const { where, data } = prisma.loyaltySchemeSlab.update.mock.calls[0][0];
      expect(where).toEqual({ lssId: 'slab-row-1' });
      expect(data).toEqual({
        lssModifiedOn: expect.any(Date) as Date,
        lssModifiedBy: USER_ID,
        lssUpto: 5000,
        lssPoints: 3,
      });
    });

    it('creates a gift with its validity window as calendar days', async () => {
      await service.saveScheme(
        newScheme({
          gifts: [
            {
              lsg_item_id: ITEM_ID,
              lsg_unit_id: UNIT_ID,
              lsg_redeem_points: 500,
              lsg_valid_from: '2026-04-01',
              lsg_valid_upto: '2026-12-31T18:00:00+05:30',
            },
          ],
        }),
      );

      expect(prisma.loyaltySchemeGift.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            lsgSlno: 1,
            lsgItemId: ITEM_ID,
            lsgUnitId: UNIT_ID,
            lsgItemQty: 1,
            lsgRedeemPoints: 500,
            lsgRepeat: false,
            lsgStockCheck: true,
            lsgValidFrom: new Date('2026-04-01T00:00:00.000Z'),
            lsgValidUpto: new Date('2026-12-31T00:00:00.000Z'),
          }) as object,
        }),
      );
    });

    it('refuses a gift that names no item, and one whose window ends before it starts', async () => {
      const noItem = await refusalOf(
        service.saveScheme(newScheme({ gifts: [{ lsg_unit_id: UNIT_ID, lsg_redeem_points: 1 }] })),
      );
      expect(noItem).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsg_item_id', code: LoyaltyErrorCode.INVALID_UUID }] },
      });

      const backwards = await refusalOf(
        service.saveScheme(
          newScheme({
            gifts: [
              {
                lsg_item_id: ITEM_ID,
                lsg_unit_id: UNIT_ID,
                lsg_valid_from: '2026-12-01',
                lsg_valid_upto: '2026-11-01',
              },
            ],
          }),
        ),
      );
      expect(backwards).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsg_valid_upto', code: LoyaltyErrorCode.END_BEFORE_START }] },
      });
      expect(prisma.loyaltySchemeGift.create).not.toHaveBeenCalled();
    });

    it('refuses the same gift item and unit twice, but not the item in another unit', async () => {
      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({
            gifts: [
              { lsg_item_id: ITEM_ID, lsg_unit_id: UNIT_ID },
              { lsg_item_id: ITEM_ID, lsg_unit_id: UNIT_ID },
            ],
          }),
        ),
      );
      expect(refusal).toMatchObject({
        status: 400,
        body: { errors: [{ field: 'lsg_item_id', code: LoyaltyErrorCode.DUPLICATE_ROW_SCOPE }] },
      });

      await service.saveScheme(
        newScheme({
          gifts: [
            { lsg_item_id: ITEM_ID, lsg_unit_id: UNIT_ID },
            { lsg_item_id: ITEM_ID, lsg_unit_id: OTHER_UNIT_ID },
          ],
        }),
      );
      expect(prisma.loyaltySchemeGift.create).toHaveBeenCalledTimes(2);
    });

    it('judges an edited gift on its stored window and writes only what it carries', async () => {
      prisma.loyaltySchemeGift.findFirst.mockResolvedValue(giftRow());

      const refusal = await refusalOf(
        service.saveScheme(
          newScheme({ gifts: [{ lsg_id: 'gift-row-1', lsg_valid_upto: '2026-01-01' }] }),
        ),
      );
      expect(refusal.body).toMatchObject({
        errors: [{ field: 'lsg_valid_upto', code: LoyaltyErrorCode.END_BEFORE_START }],
      });

      await service.saveScheme(
        newScheme({ gifts: [{ lsg_id: 'gift-row-1', lsg_redeem_points: 750 }] }),
      );
      const { data } = prisma.loyaltySchemeGift.update.mock.calls[0][0] as {
        data: Record<string, unknown>;
      };
      expect(data).toEqual({
        lsgModifiedOn: expect.any(Date) as Date,
        lsgModifiedBy: USER_ID,
        lsgRedeemPoints: 750,
      });
      expect(auditActions()).toContain('update:loyalty scheme gift');
    });

    it('soft deletes every row a posted grid no longer carries, under the modifier', async () => {
      stored = withChildren(schemeRow());
      prisma.loyaltySchemeGift.findMany.mockResolvedValue([giftRow()]);
      prisma.loyaltySchemeSlab.findMany.mockResolvedValue([slabRow()]);

      await service.saveScheme(edit({ lsc_modified_by: 'editor', gifts: [], slabs: [] }));

      expect(prisma.loyaltySchemeGift.findMany).toHaveBeenCalledWith({
        where: { lsgLscId: LSC_ID, lsgIsDeleted: false, lsgId: { notIn: [] } },
      });
      expect(prisma.loyaltySchemeGift.update).toHaveBeenCalledWith({
        where: { lsgId: 'gift-row-1' },
        data: {
          lsgIsDeleted: true,
          lsgIsActive: false,
          lsgModifiedOn: expect.any(Date) as Date,
          lsgModifiedBy: 'editor',
        },
      });
      expect(prisma.loyaltySchemeSlab.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { lssId: 'slab-row-1' } }),
      );
      expect(auditActions()).toEqual(
        expect.arrayContaining(['cancel:loyalty scheme slab', 'cancel:loyalty scheme gift']),
      );
    });
  });

  describe('getSchemeById', () => {
    it('answers 404 for a scheme that is not live', async () => {
      const refusal = await refusalOf(service.getSchemeById(LSC_ID));

      expect(refusal).toMatchObject({
        status: 404,
        body: {
          errors: [
            {
              field: 'lsc_id',
              message: `lsc_id ${LSC_ID} was not found`,
              code: LoyaltyErrorCode.SCHEME_NOT_FOUND,
            },
          ],
        },
      });
    });

    it('returns the whole graph, deactivated rows included for the grid to show', async () => {
      stored = withChildren(schemeRow(), {
        gifts: [giftRow({ lsgIsActive: false })],
        slabs: [slabRow()],
      });

      await expect(service.getSchemeById(LSC_ID)).resolves.toMatchObject({
        lsc_id: LSC_ID,
        slabs: [{ lss_id: 'slab-row-1', lss_exceeds: 1000 }],
        gifts: [{ lsg_id: 'gift-row-1', lsg_is_active: false, lsg_valid_upto: '2026-12-31' }],
      });
      const include = (
        prisma.loyaltyScheme.findFirst.mock.calls[0][0] as {
          include: { gifts: { where: Record<string, unknown> } };
        }
      ).include;
      expect(include.gifts.where).toEqual({ lsgIsDeleted: false });
    });
  });

  describe('softDeleteScheme', () => {
    it('answers 404 for a scheme that is not live', async () => {
      const refusal = await refusalOf(service.softDeleteScheme(LSC_ID));

      expect(refusal.status).toBe(404);
      expect(prisma.loyaltyScheme.update).not.toHaveBeenCalled();
    });

    it('takes the header and all five grids down together, under one actor and instant', async () => {
      stored = withChildren(schemeRow());

      await expect(service.softDeleteScheme(LSC_ID)).resolves.toEqual({
        deleted: true,
        lsc_id: LSC_ID,
      });

      const header = updatedData() as { lscModifiedOn: Date; lscModifiedBy: string };
      expect(header).toMatchObject({
        lscIsDeleted: true,
        lscIsActive: false,
        lscModifiedBy: USER_ID,
      });
      for (const [table, prefix] of [
        [prisma.loyaltySchemeBranch, 'lsb'],
        [prisma.loyaltySchemeParty, 'lsp'],
        [prisma.loyaltySchemeItem, 'lsi'],
        [prisma.loyaltySchemeSlab, 'lss'],
        [prisma.loyaltySchemeGift, 'lsg'],
      ] as const) {
        expect(table.updateMany).toHaveBeenCalledWith({
          where: { [`${prefix}LscId`]: LSC_ID, [`${prefix}IsDeleted`]: false },
          data: {
            [`${prefix}IsDeleted`]: true,
            [`${prefix}IsActive`]: false,
            [`${prefix}ModifiedOn`]: header.lscModifiedOn,
            [`${prefix}ModifiedBy`]: USER_ID,
          },
        });
      }
      expect(auditActions()).toEqual(['cancel:loyalty scheme']);
    });

    it('stamps the actor the caller names over the request user', async () => {
      stored = withChildren(schemeRow());

      await service.softDeleteScheme(LSC_ID, 'hq-user');

      expect(updatedData()).toMatchObject({ lscModifiedBy: 'hq-user' });
    });
  });
});
