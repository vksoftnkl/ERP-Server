import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PromotionSchemeErrorCode } from '../types/promotion-scheme-error-codes';
import {
  BranchRow,
  ItemRow,
  PartyRow,
  SchemeRow,
  SchemeWithChildren,
  SlabRow,
  handlePromotionWriteError,
  normalizeEnum,
  normalizeNullableString,
  parseDateOnly,
  parseTimeToUtcDate,
  requireInteger,
  requireNumber,
  requireString,
  requireUuid,
  resolveActor,
  resolveActorUuid,
  toBranchPayload,
  toIsoDate,
  toIsoTime,
  toItemPayload,
  toPartyPayload,
  toSchemePayload,
  toSchemeSummaryPayload,
  toSlabPayload,
} from './promotion-scheme.utils';

const UUID = '019c6f6c-be87-7a11-8905-36092c46e201';
const OTHER_UUID = '019c6f6c-be87-7a11-8905-36092c46e202';
const CREATED_ON = new Date('2026-10-01T04:30:00.000Z');
const dec = (value: string | number) => new Prisma.Decimal(value);

/** The status and body of the HttpException a call was refused with. */
function refusalOf(call: () => unknown): { status: number; body: unknown } {
  try {
    call();
  } catch (error) {
    if (error instanceof HttpException) {
      return { status: error.getStatus(), body: error.getResponse() };
    }
    throw error;
  }
  throw new Error('expected the call to be refused');
}

const fieldRefusal = (field: string, code: PromotionSchemeErrorCode) => ({
  status: 400,
  body: { message: 'Validation failed', errors: [{ field, code }] },
});

const knownError = (code: string, meta: Record<string, unknown> = {}) =>
  new Prisma.PrismaClientKnownRequestError('write failed', { code, clientVersion: 'test', meta });

describe('promotion-scheme.utils — format helpers', () => {
  it('cuts a Date to its UTC calendar day and a time to UTC HH:mm:ss', () => {
    expect(toIsoDate(new Date('2026-10-19T23:59:59.000Z'))).toBe('2026-10-19');
    expect(toIsoTime(new Date(Date.UTC(1970, 0, 1, 18, 0, 5)))).toBe('18:00:05');
    expect(toIsoTime(null)).toBeNull();
  });

  it('normalises nullable strings, actors and vocabulary values', () => {
    expect(normalizeNullableString('  x ')).toBe('x');
    expect(normalizeNullableString(' ')).toBeNull();
    expect(resolveActor(undefined, ' ', ' admin ')).toBe('admin');
    expect(resolveActor()).toBeNull();
    expect(resolveActorUuid('admin', UUID)).toBe(UUID);
    expect(resolveActorUuid('admin')).toBeNull();
    expect(normalizeEnum(' disc_perc ')).toBe('DISC_PERC');
    expect(normalizeEnum(undefined)).toBe('');
  });
});

describe('promotion-scheme.utils — validation primitives', () => {
  it('requireString and requireUuid refuse with their own codes', () => {
    expect(requireString(' SUMMER ', 'prm_code')).toBe('SUMMER');
    expect(refusalOf(() => requireString('', 'prm_code'))).toMatchObject(
      fieldRefusal('prm_code', PromotionSchemeErrorCode.FIELD_REQUIRED),
    );
    expect(requireUuid(UUID, 'prm_comp_id')).toBe(UUID);
    expect(refusalOf(() => requireUuid('abc', 'prm_comp_id'))).toMatchObject(
      fieldRefusal('prm_comp_id', PromotionSchemeErrorCode.INVALID_UUID),
    );
  });

  it('requireNumber and requireInteger guard the range and wholeness', () => {
    expect(requireNumber(0, 'prm_min_qty', 0)).toBe(0);
    expect(refusalOf(() => requireNumber(-0.01, 'prm_min_qty', 0))).toMatchObject(
      fieldRefusal('prm_min_qty', PromotionSchemeErrorCode.NUMBER_BELOW_MINIMUM),
    );
    expect(refusalOf(() => requireNumber(101, 'pri_disc_perc', 0, 100))).toMatchObject(
      fieldRefusal('pri_disc_perc', PromotionSchemeErrorCode.NUMBER_ABOVE_MAXIMUM),
    );
    expect(refusalOf(() => requireInteger(2.5, 'prb_slno', 1))).toMatchObject(
      fieldRefusal('prb_slno', PromotionSchemeErrorCode.NOT_WHOLE_NUMBER),
    );
  });

  it('parseDateOnly reads a UTC midnight and refuses what is not a date', () => {
    expect(parseDateOnly('2026-12-25', 'prm_start_date').toISOString()).toBe(
      '2026-12-25T00:00:00.000Z',
    );
    expect(refusalOf(() => parseDateOnly(undefined, 'prm_start_date'))).toMatchObject(
      fieldRefusal('prm_start_date', PromotionSchemeErrorCode.FIELD_REQUIRED),
    );
    expect(refusalOf(() => parseDateOnly('2026-00-10', 'prm_start_date'))).toMatchObject(
      fieldRefusal('prm_start_date', PromotionSchemeErrorCode.INVALID_DATE),
    );
  });

  it('parseTimeToUtcDate takes HH:mm[:ss] and refuses the rest', () => {
    expect(parseTimeToUtcDate('06:15', 'prm_valid_from_time').toISOString()).toBe(
      '1970-01-01T06:15:00.000Z',
    );
    expect(refusalOf(() => parseTimeToUtcDate('6:15 pm', 'prm_valid_from_time'))).toMatchObject(
      fieldRefusal('prm_valid_from_time', PromotionSchemeErrorCode.INVALID_TIME),
    );
  });
});

describe('promotion-scheme.utils — row mappers', () => {
  it('maps a branch row, preferring brCode over brShort', () => {
    const row = {
      prbId: 'b1',
      prbPrmId: UUID,
      prbSlno: 1,
      prbBranchId: OTHER_UUID,
      prbIsExclude: false,
      prbNotes: null,
      prbIsActive: true,
      prbIsDeleted: false,
      prbSyncDate: null,
      prbCreatedOn: CREATED_ON,
      prbCreatedBy: null,
      prbModifiedOn: null,
      prbModifiedBy: null,
      branch: { brName: 'Main', brCode: 'MB', brShort: 'MN' },
    } as unknown as BranchRow;

    expect(toBranchPayload(row)).toMatchObject({ prb_branch_code: 'MB' });
  });

  it.each([
    [{ customer: { cusName: 'Ravi', cusCode: 'C001' } }, 'Ravi', 'C001'],
    [{ customerGroup: { cgrName: 'Retail', cgrShort: 'RT' } }, 'Retail', 'RT'],
    [{ area: { armName: 'Anna Nagar', armShort: 'AN' } }, 'Anna Nagar', 'AN'],
    [{ city: { ctmName: 'Chennai', ctmShort: 'MAA' } }, 'Chennai', 'MAA'],
    [{}, null, null],
  ])('names a party row through the master that was joined (%o)', (lookup, name, code) => {
    const row = {
      prpId: 'p1',
      prpPrmId: UUID,
      prpSlno: 1,
      prpKind: 'AREA',
      prpScopeId: OTHER_UUID,
      prpIsExclude: false,
      prpMatchPriority: 3,
      prpNotes: null,
      prpIsActive: true,
      prpIsDeleted: false,
      prpSyncDate: null,
      prpCreatedOn: CREATED_ON,
      prpCreatedBy: null,
      prpModifiedOn: null,
      prpModifiedBy: null,
      ...lookup,
    } as unknown as PartyRow;

    expect(toPartyPayload(row)).toMatchObject({ prp_scope_name: name, prp_scope_code: code });
  });

  it('maps an item row, turning the rates into numbers', () => {
    const row = {
      priId: 'i1',
      priPrmId: UUID,
      priSlno: 1,
      priKind: 'ITEM_SECTION',
      priScopeId: OTHER_UUID,
      priUnitId: null,
      priIsExclude: false,
      priDiscPerc: dec('7.5'),
      priDiscQty: dec(0),
      priDiscAmt: dec(0),
      priMinQty: dec(2),
      priFactor: dec(1),
      priMaxBenefit: dec('250.25'),
      priMatchPriority: 1,
      priNotes: null,
      priIsActive: true,
      priIsDeleted: false,
      priSyncDate: null,
      priCreatedOn: CREATED_ON,
      priCreatedBy: null,
      priModifiedOn: null,
      priModifiedBy: null,
      itemSection: { secName: 'Dairy' },
    } as unknown as ItemRow;

    expect(toItemPayload(row)).toMatchObject({
      pri_scope_name: 'Dairy',
      pri_disc_perc: 7.5,
      pri_min_qty: 2,
      pri_max_benefit: 250.25,
    });
  });

  it('maps a slab row, keeping the open bound and an unset fixed price null', () => {
    const row = {
      prsId: 's1',
      prsPrmId: UUID,
      prsSlno: 1,
      prsBenefit: 'DISC_AMT',
      prsExceeds: dec(500),
      prsUpto: null,
      prsEach: dec(1),
      prsIsRepeat: false,
      prsMaxRepeats: 0,
      prsFreeItemId: null,
      prsFreeUnitId: null,
      prsFreeQty: dec(0),
      prsFreeStockCheck: true,
      prsDiscPerc: dec(0),
      prsDiscQty: dec(0),
      prsDiscAmt: dec(50),
      prsFixedPrice: null,
      prsMaxBenefitAmt: dec(0),
      prsNotes: null,
      prsIsActive: true,
      prsIsDeleted: false,
      prsSyncDate: null,
      prsCreatedOn: CREATED_ON,
      prsCreatedBy: null,
      prsModifiedOn: null,
      prsModifiedBy: null,
    } as unknown as SlabRow;

    expect(toSlabPayload(row)).toMatchObject({
      prs_exceeds: 500,
      prs_upto: null,
      prs_disc_amt: 50,
      prs_fixed_price: null,
    });
    expect(toSlabPayload({ ...row, prsFixedPrice: dec('99.9') } as SlabRow).prs_fixed_price).toBe(
      99.9,
    );
  });

  it('maps the scheme header and its four grids', () => {
    const scheme = {
      prmId: UUID,
      prmCompId: OTHER_UUID,
      prmBranchId: null,
      prmTenantId: null,
      prmCode: 'SUMMER',
      prmName: 'Summer sale',
      prmStatus: 'DRAFT',
      prmApplyOn: 'ITEM_QTY',
      prmBenefit: 'DISC_PERC',
      prmPriority: 2,
      prmStackMode: 'EXCLUSIVE',
      prmAutoApply: true,
      prmAllowWithManualDisc: false,
      prmCalcOnAmountType: 'NET_AMOUNT',
      prmIncludeTax: false,
      prmBillType: 'ALL',
      prmMinBillAmount: dec('0'),
      prmMinQty: dec('3'),
      prmBranchScope: 'ALL',
      prmCustScope: 'LIST',
      prmItemScope: 'LIST',
      prmPriceLevelId: null,
      prmMaxBenefitPerBill: dec('1000.5'),
      prmMaxUsesTotal: 0,
      prmMaxUsesPerCust: 1,
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
      prmCreatedOn: CREATED_ON,
      prmCreatedBy: 'admin',
      prmModifiedOn: null,
      prmModifiedBy: null,
      prmApprovedOn: null,
      prmApprovedBy: null,
      company: null,
      branch: { brName: 'Main' },
    } as unknown as SchemeRow;

    expect(toSchemeSummaryPayload(scheme)).toMatchObject({
      prm_comp_name: null,
      prm_branch_name: 'Main',
      prm_min_qty: 3,
      prm_max_benefit_per_bill: 1000.5,
      prm_start_date: '2026-05-01',
      prm_end_date: '2026-05-31',
      prm_valid_from_time: null,
      prm_approved_on: null,
    });
    expect(
      toSchemePayload({
        ...scheme,
        branches: [],
        parties: [],
        items: [],
        slabs: [],
      } as SchemeWithChildren),
    ).toMatchObject({ prm_code: 'SUMMER', branches: [], parties: [], items: [], slabs: [] });
  });
});

describe('promotion-scheme.utils — handlePromotionWriteError', () => {
  it('turns the exclusive-clash GiST exclusion (23P01) into a 409 on prm_priority', () => {
    const clash = new Error(
      'conflicting key value violates exclusion constraint "ex_prm_exclusive_clash" (23P01)',
    );

    expect(refusalOf(() => handlePromotionWriteError(clash))).toMatchObject({
      status: 409,
      body: {
        errors: [{ field: 'prm_priority', code: PromotionSchemeErrorCode.EXCLUSIVE_CLASH }],
      },
    });
  });

  it('answers a unique violation (P2002) with a 409', () => {
    expect(refusalOf(() => handlePromotionWriteError(knownError('P2002')))).toMatchObject({
      status: 409,
      body: { errors: [{ code: PromotionSchemeErrorCode.DUPLICATE_RECORD }] },
    });
  });

  it.each([
    ['fk_prm_company', 'prm_comp_id'],
    ['fk_prm_branch', 'prm_branch_id'],
    ['fk_prm_price_level', 'prm_price_level_id'],
    ['fk_prm_coupon_batch', 'prm_coupon_batch_id'],
    ['fk_prm_approved_by', 'prm_approved_by'],
    ['fk_prb_branch', 'prb_branch_id'],
    ['fk_prp_area', 'prp_scope_id'],
    ['fk_pri_unit', 'pri_unit_id'],
    ['fk_pri_item', 'pri_scope_id'],
    ['fk_prs_free_item', 'prs_free_item_id'],
    ['fk_prs_free_unit', 'prs_free_unit_id'],
    ['fk_prs_scheme_benefit', 'prs_benefit'],
    ['unknown_fk', 'request'],
  ])('files a foreign-key failure on %s under %s', (fieldName, field) => {
    expect(
      refusalOf(() => handlePromotionWriteError(knownError('P2003', { field_name: fieldName }))),
    ).toMatchObject({
      status: 400,
      body: { errors: [{ field, code: PromotionSchemeErrorCode.REFERENCE_NOT_FOUND }] },
    });
  });

  it('lets every other failure fall through to the caller', () => {
    expect(() => handlePromotionWriteError(knownError('P2025'))).not.toThrow();
    expect(() => handlePromotionWriteError(new Error('connection reset'))).not.toThrow();
    expect(() => handlePromotionWriteError(null)).not.toThrow();
  });
});
