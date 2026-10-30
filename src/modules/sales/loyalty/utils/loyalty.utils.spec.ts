import { HttpException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { LoyaltyErrorCode } from '../types/loyalty-error-codes';
import {
  BranchRow,
  GiftRow,
  ItemRow,
  PartyRow,
  SchemeRow,
  SchemeWithChildren,
  SlabRow,
  handleLoyaltyWriteError,
  normalizeEnum,
  normalizeNullableString,
  parseDateOnly,
  parseNullableDateOnly,
  parseTimeToUtcDate,
  requireInteger,
  requireNumber,
  requireString,
  requireUuid,
  resolveActor,
  resolveActorUuid,
  toBranchPayload,
  toGiftPayload,
  toIsoDate,
  toIsoTime,
  toItemPayload,
  toNullableIsoDate,
  toPartyPayload,
  toSchemePayload,
  toSchemeSummaryPayload,
  toSlabPayload,
} from './loyalty.utils';

const UUID = '019c6f6c-be87-7a11-8905-36092c46e101';
const OTHER_UUID = '019c6f6c-be87-7a11-8905-36092c46e102';
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

const fieldRefusal = (field: string, code: LoyaltyErrorCode) => ({
  status: 400,
  body: { message: 'Validation failed', errors: [{ field, code }] },
});

const knownError = (code: string, meta: Record<string, unknown> = {}) =>
  new Prisma.PrismaClientKnownRequestError('write failed', { code, clientVersion: 'test', meta });

describe('loyalty.utils — format helpers', () => {
  it('cuts a Date to its UTC calendar day', () => {
    expect(toIsoDate(new Date('2026-10-19T23:59:59.000Z'))).toBe('2026-10-19');
    expect(toNullableIsoDate(null)).toBeNull();
    expect(toNullableIsoDate(new Date('2026-01-02T00:00:00.000Z'))).toBe('2026-01-02');
  });

  it('renders a time column as zero-padded UTC HH:mm:ss', () => {
    expect(toIsoTime(new Date(Date.UTC(1970, 0, 1, 7, 5, 9)))).toBe('07:05:09');
    expect(toIsoTime(null)).toBeNull();
  });

  it('trims a nullable string and turns a blank one into null', () => {
    expect(normalizeNullableString('  note ')).toBe('note');
    expect(normalizeNullableString('   ')).toBeNull();
    expect(normalizeNullableString(undefined)).toBeNull();
    expect(normalizeNullableString(null)).toBeNull();
  });

  it('takes the first non-blank actor, trimmed', () => {
    expect(resolveActor(undefined, '  ', ' admin ', 'later')).toBe('admin');
    expect(resolveActor(null, '')).toBeNull();
  });

  it('takes the first candidate that is a uuid, skipping login names', () => {
    expect(resolveActorUuid('admin', null, UUID, OTHER_UUID)).toBe(UUID);
    expect(resolveActorUuid('admin', 'not-a-uuid')).toBeNull();
  });

  it('upper-cases and trims a vocabulary value without judging it', () => {
    expect(normalizeEnum(' earn ')).toBe('EARN');
    expect(normalizeEnum('NOT_A_TYPE')).toBe('NOT_A_TYPE');
    expect(normalizeEnum(undefined)).toBe('');
    expect(normalizeEnum(null)).toBe('');
  });
});

describe('loyalty.utils — validation primitives', () => {
  it('requireString trims, and refuses a missing or blank value', () => {
    expect(requireString('  Gold  ', 'lsc_name')).toBe('Gold');
    expect(refusalOf(() => requireString('  ', 'lsc_name'))).toMatchObject(
      fieldRefusal('lsc_name', LoyaltyErrorCode.FIELD_REQUIRED),
    );
    expect(refusalOf(() => requireString(undefined, 'lsc_name'))).toMatchObject(
      fieldRefusal('lsc_name', LoyaltyErrorCode.FIELD_REQUIRED),
    );
  });

  it('requireUuid accepts a v7 uuid and refuses anything else', () => {
    expect(requireUuid(UUID, 'lsc_comp_id')).toBe(UUID);
    expect(refusalOf(() => requireUuid('company-1', 'lsc_comp_id'))).toMatchObject(
      fieldRefusal('lsc_comp_id', LoyaltyErrorCode.INVALID_UUID),
    );
    expect(refusalOf(() => requireUuid(null, 'lsc_comp_id'))).toMatchObject(
      fieldRefusal('lsc_comp_id', LoyaltyErrorCode.INVALID_UUID),
    );
  });

  it('requireNumber enforces the floor and, when given, the ceiling', () => {
    expect(requireNumber(5, 'lsc_priority', 1, 9)).toBe(5);
    expect(requireNumber(1, 'lsc_priority', 1, 9)).toBe(1);
    expect(refusalOf(() => requireNumber(0, 'lsc_priority', 1, 9))).toMatchObject(
      fieldRefusal('lsc_priority', LoyaltyErrorCode.NUMBER_BELOW_MINIMUM),
    );
    expect(refusalOf(() => requireNumber(10, 'lsc_priority', 1, 9))).toMatchObject(
      fieldRefusal('lsc_priority', LoyaltyErrorCode.NUMBER_ABOVE_MAXIMUM),
    );
  });

  it.each([Number.NaN, Number.POSITIVE_INFINITY, undefined, null])(
    'requireNumber refuses %p as below the minimum',
    (value) => {
      expect(refusalOf(() => requireNumber(value, 'lss_points', 0))).toMatchObject(
        fieldRefusal('lss_points', LoyaltyErrorCode.NUMBER_BELOW_MINIMUM),
      );
    },
  );

  it('requireInteger refuses a fraction before it checks the range', () => {
    expect(requireInteger(3, 'lsb_slno', 1)).toBe(3);
    expect(refusalOf(() => requireInteger(1.5, 'lsb_slno', 1))).toMatchObject(
      fieldRefusal('lsb_slno', LoyaltyErrorCode.NOT_WHOLE_NUMBER),
    );
    expect(refusalOf(() => requireInteger(0, 'lsb_slno', 1))).toMatchObject(
      fieldRefusal('lsb_slno', LoyaltyErrorCode.NUMBER_BELOW_MINIMUM),
    );
  });

  it('parseDateOnly reads the first ten characters as a UTC midnight', () => {
    expect(parseDateOnly('2026-10-19', 'lsc_start_date').toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    );
    expect(parseDateOnly(' 2026-10-19T18:30:00+05:30 ', 'lsc_start_date').toISOString()).toBe(
      '2026-10-19T00:00:00.000Z',
    );
  });

  it('parseDateOnly refuses a missing value and one that is not a date', () => {
    expect(refusalOf(() => parseDateOnly('  ', 'lsc_end_date'))).toMatchObject(
      fieldRefusal('lsc_end_date', LoyaltyErrorCode.FIELD_REQUIRED),
    );
    expect(refusalOf(() => parseDateOnly('2026-13-01', 'lsc_end_date'))).toMatchObject(
      fieldRefusal('lsc_end_date', LoyaltyErrorCode.INVALID_DATE),
    );
    expect(refusalOf(() => parseDateOnly('19/10/2026', 'lsc_end_date'))).toMatchObject(
      fieldRefusal('lsc_end_date', LoyaltyErrorCode.INVALID_DATE),
    );
  });

  it('parseNullableDateOnly answers null for a blank value and parses the rest', () => {
    expect(parseNullableDateOnly('', 'lsg_valid_from')).toBeNull();
    expect(parseNullableDateOnly(null, 'lsg_valid_from')).toBeNull();
    expect(parseNullableDateOnly('2026-11-01', 'lsg_valid_from')?.toISOString()).toBe(
      '2026-11-01T00:00:00.000Z',
    );
  });

  it('parseTimeToUtcDate takes HH:mm and HH:mm:ss on the epoch day', () => {
    expect(parseTimeToUtcDate('09:30', 'lsc_valid_from_time').toISOString()).toBe(
      '1970-01-01T09:30:00.000Z',
    );
    expect(parseTimeToUtcDate(' 23:59:58 ', 'lsc_valid_to_time').toISOString()).toBe(
      '1970-01-01T23:59:58.000Z',
    );
  });

  it.each(['24:00', '9:30', '12:60', '12:30:60', 'noon'])(
    'parseTimeToUtcDate refuses %p',
    (value) => {
      expect(refusalOf(() => parseTimeToUtcDate(value, 'lsc_valid_from_time'))).toMatchObject(
        fieldRefusal('lsc_valid_from_time', LoyaltyErrorCode.INVALID_TIME),
      );
    },
  );
});

describe('loyalty.utils — row mappers', () => {
  const audit = {
    CreatedOn: CREATED_ON,
    CreatedBy: 'admin',
    ModifiedOn: null,
    ModifiedBy: null,
    SyncDate: null,
  };

  it('maps a branch row, preferring brCode and falling back to brShort', () => {
    const row = {
      lsbId: 'b1',
      lsbLscId: UUID,
      lsbSlno: 1,
      lsbBranchId: OTHER_UUID,
      lsbIsExclude: false,
      lsbNotes: null,
      lsbIsActive: true,
      lsbIsDeleted: false,
      lsbSyncDate: null,
      lsbCreatedOn: audit.CreatedOn,
      lsbCreatedBy: audit.CreatedBy,
      lsbModifiedOn: new Date('2026-10-02T00:00:00.000Z'),
      lsbModifiedBy: 'editor',
      branch: { brName: 'Main', brCode: null, brShort: 'MN' },
    } as unknown as BranchRow;

    expect(toBranchPayload(row)).toMatchObject({
      lsb_branch_name: 'Main',
      lsb_branch_code: 'MN',
      lsb_created_on: CREATED_ON.toISOString(),
      lsb_modified_on: '2026-10-02T00:00:00.000Z',
      lsb_sync_date: null,
    });
    expect(toBranchPayload({ ...row, branch: undefined } as BranchRow)).toMatchObject({
      lsb_branch_name: null,
      lsb_branch_code: null,
    });
  });

  it('maps a party row through whichever master was joined', () => {
    const base = {
      lspId: 'p1',
      lspLscId: UUID,
      lspSlno: 1,
      lspKind: 'CUSTOMER_GROUP',
      lspScopeId: OTHER_UUID,
      lspCustId: null,
      lspCustGroupId: OTHER_UUID,
      lspIsExclude: true,
      lspMatchPriority: 1,
      lspNotes: null,
      lspIsActive: true,
      lspIsDeleted: false,
      lspSyncDate: null,
      lspCreatedOn: CREATED_ON,
      lspCreatedBy: null,
      lspModifiedOn: null,
      lspModifiedBy: null,
    };

    expect(
      toPartyPayload({
        ...base,
        customer: null,
        customerGroup: { cgrName: 'Wholesale', cgrShort: 'WS' },
      } as unknown as PartyRow),
    ).toMatchObject({
      lsp_scope_name: 'Wholesale',
      lsp_scope_code: 'WS',
      lsp_is_exclude: true,
      lsp_modified_on: null,
    });
    expect(
      toPartyPayload({
        ...base,
        customer: { cusName: 'Ravi', cusCode: 'C001' },
      } as unknown as PartyRow),
    ).toMatchObject({ lsp_scope_name: 'Ravi', lsp_scope_code: 'C001' });
  });

  it('maps an item row, turning the decimals into numbers', () => {
    const row = {
      lsiId: 'i1',
      lsiLscId: UUID,
      lsiSlno: 2,
      lsiKind: 'ITEM_BRAND',
      lsiScopeId: OTHER_UUID,
      lsiItemId: null,
      lsiGroupId: null,
      lsiCategoryId: null,
      lsiBrandId: OTHER_UUID,
      lsiSectionId: null,
      lsiIsExclude: false,
      lsiFactor: dec('1.5'),
      lsiPoints: dec('2.25'),
      lsiMaxPoints: dec(0),
      lsiMatchPriority: 3,
      lsiNotes: null,
      lsiIsActive: true,
      lsiIsDeleted: false,
      lsiSyncDate: null,
      lsiCreatedOn: CREATED_ON,
      lsiCreatedBy: null,
      lsiModifiedOn: null,
      lsiModifiedBy: null,
      itemBrand: { brand_name: 'Acme' },
    } as unknown as ItemRow;

    expect(toItemPayload(row)).toMatchObject({
      lsi_scope_name: 'Acme',
      lsi_factor: 1.5,
      lsi_points: 2.25,
      lsi_max_points: 0,
    });
  });

  it('maps a slab row, keeping an open upper bound null', () => {
    const row = {
      lssId: 's1',
      lssLscId: UUID,
      lssSlno: 1,
      lssItemId: null,
      lssUnitId: null,
      lssExceeds: dec(1000),
      lssUpto: null,
      lssEach: dec(100),
      lssPoints: dec(1),
      lssFactor: dec(1),
      lssMaxPoints: dec(50),
      lssNotes: null,
      lssIsActive: true,
      lssIsDeleted: false,
      lssSyncDate: null,
      lssCreatedOn: CREATED_ON,
      lssCreatedBy: null,
      lssModifiedOn: null,
      lssModifiedBy: null,
      unit: { unit: { unit_name: 'PCS' } },
    } as unknown as SlabRow;

    expect(toSlabPayload(row)).toMatchObject({
      lss_exceeds: 1000,
      lss_upto: null,
      lss_each: 100,
      lss_max_points: 50,
      lss_item_name: null,
      lss_unit_name: 'PCS',
    });
    expect(toSlabPayload({ ...row, lssUpto: dec('4999.99') } as SlabRow).lss_upto).toBe(4999.99);
  });

  it('maps a gift row with its validity window as calendar days', () => {
    const row = {
      lsgId: 'g1',
      lsgLscId: UUID,
      lsgSlno: 1,
      lsgItemId: OTHER_UUID,
      lsgUnitId: OTHER_UUID,
      lsgItemQty: dec(1),
      lsgRedeemPoints: dec(500),
      lsgRepeat: true,
      lsgMaxQtyPerBill: dec(2),
      lsgStockCheck: true,
      lsgValidFrom: new Date('2026-11-01T00:00:00.000Z'),
      lsgValidUpto: null,
      lsgNotes: null,
      lsgIsActive: true,
      lsgIsDeleted: false,
      lsgSyncDate: null,
      lsgCreatedOn: CREATED_ON,
      lsgCreatedBy: null,
      lsgModifiedOn: null,
      lsgModifiedBy: null,
      item: { itemNameEn: 'Tote bag' },
      unit: null,
    } as unknown as GiftRow;

    expect(toGiftPayload(row)).toMatchObject({
      lsg_item_name: 'Tote bag',
      lsg_unit_name: null,
      lsg_redeem_points: 500,
      lsg_max_qty_per_bill: 2,
      lsg_valid_from: '2026-11-01',
      lsg_valid_upto: null,
    });
  });

  const schemeRow = {
    lscId: UUID,
    lscCompId: OTHER_UUID,
    lscBranchId: null,
    lscTenantId: null,
    lscCode: 'GOLD',
    lscName: 'Gold card',
    lscType: 'BOTH',
    lscStatus: 'APPROVED',
    lscPriority: 1,
    lscAutoApply: true,
    lscApplyOn: 'BILL_AMOUNT',
    lscCalcOnAmountType: 'NET_AMOUNT',
    lscIncludeTax: false,
    lscBillType: 'ALL',
    lscMinBillAmount: dec('100.50'),
    lscMaxEarnPoints: dec(0),
    lscEarnOnDiscounted: true,
    lscEarnOnCharges: false,
    lscEarnWithRedeem: true,
    lscRoundingMethod: 'FLOOR',
    lscPointsDecimals: 2,
    lscBranchScope: 'ALL',
    lscCustScope: 'ALL',
    lscItemScope: 'ALL',
    lscPriceLevelId: null,
    lscPoolMode: 'COMPANY',
    lscAllowCrossBranchRedeem: true,
    lscAllowPointRedeem: true,
    lscAllowGiftRedeem: false,
    lscRedeemTenderId: null,
    lscRedeemValuePerPoint: dec('0.25'),
    lscMinRedeemPoints: dec(100),
    lscMaxRedeemPoints: dec(0),
    lscMaxRedeemPerc: dec(100),
    lscRedeemMinBillAmount: dec(0),
    lscRedeemMultiple: dec(10),
    lscExpiryBasis: 'EARN_DATE',
    lscPointsValidDays: 365,
    lscActivationDays: 0,
    lscReturnMode: 'REVERSE',
    lscStartDate: new Date('2026-04-01T00:00:00.000Z'),
    lscEndDate: new Date('2027-03-31T00:00:00.000Z'),
    lscValidFromTime: new Date(Date.UTC(1970, 0, 1, 9, 0, 0)),
    lscValidToTime: null,
    lscValidWeekdays: 'MON,TUE',
    lscRemarks: null,
    lscIsActive: true,
    lscIsDeleted: false,
    lscSyncDate: null,
    lscCreatedOn: CREATED_ON,
    lscCreatedBy: 'admin',
    lscModifiedOn: null,
    lscModifiedBy: null,
    lscApprovedOn: new Date('2026-10-02T10:00:00.000Z'),
    lscApprovedBy: UUID,
    company: { compName: 'Zeta Traders' },
    branch: null,
  } as unknown as SchemeRow;

  it('maps the scheme header: money as numbers, dates as days, times as HH:mm:ss', () => {
    expect(toSchemeSummaryPayload(schemeRow)).toMatchObject({
      lsc_comp_name: 'Zeta Traders',
      lsc_branch_name: null,
      lsc_min_bill_amount: 100.5,
      lsc_redeem_value_per_point: 0.25,
      lsc_redeem_multiple: 10,
      lsc_start_date: '2026-04-01',
      lsc_end_date: '2027-03-31',
      lsc_valid_from_time: '09:00:00',
      lsc_valid_to_time: null,
      lsc_approved_on: '2026-10-02T10:00:00.000Z',
      lsc_modified_on: null,
    });
  });

  it('maps the whole scheme with its five grids', () => {
    const payload = toSchemePayload({
      ...schemeRow,
      branches: [],
      parties: [],
      items: [],
      slabs: [],
      gifts: [],
    } as SchemeWithChildren);

    expect(payload).toMatchObject({
      lsc_code: 'GOLD',
      branches: [],
      parties: [],
      items: [],
      slabs: [],
      gifts: [],
    });
  });
});

describe('loyalty.utils — handleLoyaltyWriteError', () => {
  it('lets anything that is not a known Prisma error fall through', () => {
    expect(() => handleLoyaltyWriteError(new Error('connection reset'))).not.toThrow();
    expect(() => handleLoyaltyWriteError('boom')).not.toThrow();
  });

  it('answers a unique violation (P2002) with a 409', () => {
    expect(refusalOf(() => handleLoyaltyWriteError(knownError('P2002')))).toMatchObject({
      status: 409,
      body: { errors: [{ field: 'request', code: LoyaltyErrorCode.DUPLICATE_RECORD }] },
    });
  });

  it.each([
    ['fk_lsc_company', 'lsc_comp_id'],
    ['fk_lsc_branch', 'lsc_branch_id'],
    ['fk_lsc_price_level', 'lsc_price_level_id'],
    ['fk_lsc_redeem_tender', 'lsc_redeem_tender_id'],
    ['fk_lsc_approved_by', 'lsc_approved_by'],
    ['fk_lsb_branch', 'lsb_branch_id'],
    ['fk_lsp_customer', 'lsp_scope_id'],
    ['fk_lsi_item', 'lsi_scope_id'],
    ['fk_lss_item', 'lss_item_id'],
    ['fk_lss_unit', 'lss_unit_id'],
    ['fk_lsg_item', 'lsg_item_id'],
    ['fk_lsg_unit', 'lsg_unit_id'],
    ['something_else', 'request'],
  ])('files a foreign-key failure on %s under %s', (fieldName, field) => {
    expect(
      refusalOf(() => handleLoyaltyWriteError(knownError('P2003', { field_name: fieldName }))),
    ).toMatchObject({
      status: 400,
      body: { errors: [{ field, code: LoyaltyErrorCode.REFERENCE_NOT_FOUND }] },
    });
  });

  it('reads the foreign key from meta.target when field_name is absent', () => {
    expect(
      refusalOf(() => handleLoyaltyWriteError(knownError('P2003', { target: 'FK_LSB_BRANCH' }))),
    ).toMatchObject({ body: { errors: [{ field: 'lsb_branch_id' }] } });
  });

  it('names a loyalty CHECK constraint the invariants layer missed', () => {
    expect(
      refusalOf(() =>
        handleLoyaltyWriteError(knownError('P2010', { constraint: 'ck_lsc_dates' })),
      ),
    ).toMatchObject({
      status: 400,
      body: {
        errors: [
          {
            code: LoyaltyErrorCode.CHECK_REJECTED,
            message: 'Database constraint ck_lsc_dates rejected this row',
          },
        ],
      },
    });
  });

  it('leaves a constraint outside the loyalty tables alone', () => {
    expect(() =>
      handleLoyaltyWriteError(knownError('P2010', { constraint: 'ck_sb_status' })),
    ).not.toThrow();
  });
});
