import {
  EffectiveGiftRow,
  EffectiveItemRow,
  EffectivePartyRow,
  EffectiveScheme,
  EffectiveSlabRow,
  collectGiftInvariantErrors,
  collectItemInvariantErrors,
  collectPartyInvariantErrors,
  collectSchemeInvariantErrors,
  collectSlabInvariantErrors,
} from './loyalty-scheme-invariants';

/**
 * These functions mirror the CHECK constraints the loyalty tables actually
 * carry. The point of the mirror is that the API answers 400 with a FIELD
 * before Postgres answers 23514 with a constraint name, so each test here pins
 * the field name, not merely that something was rejected.
 */

const scheme = (overrides: Partial<EffectiveScheme> = {}): EffectiveScheme => ({
  lscCode: 'DIWALI25',
  lscType: 'BOTH',
  lscStatus: 'DRAFT',
  lscApplyOn: 'BILL_AMOUNT',
  lscCalcOnAmountType: 'NET_AMOUNT',
  lscBillType: 'ALL',
  lscRoundingMethod: 'FLOOR',
  lscBranchScope: 'ALL',
  lscCustScope: 'ALL',
  lscItemScope: 'ALL',
  lscPoolMode: 'COMPANY',
  lscReturnMode: 'REVERSE',
  lscExpiryBasis: 'NONE',
  lscPriority: 1,
  lscPointsDecimals: 2,
  lscActivationDays: 0,
  lscPointsValidDays: 0,
  lscMinBillAmount: 0,
  lscMaxEarnPoints: 0,
  lscAllowPointRedeem: false,
  lscRedeemValuePerPoint: 0,
  lscMinRedeemPoints: 0,
  lscMaxRedeemPoints: 0,
  lscMaxRedeemPerc: 100,
  lscRedeemMinBillAmount: 0,
  lscRedeemMultiple: 0,
  lscStartDate: new Date('2025-10-01T00:00:00.000Z'),
  lscEndDate: new Date('2025-10-31T00:00:00.000Z'),
  lscValidFromTime: null,
  lscValidToTime: null,
  lscValidWeekdays: null,
  lscApprovedBy: null,
  ...overrides,
});

const fields = (errors: Array<{ field: string }>) => errors.map((error) => error.field);

describe('loyalty scheme header invariants', () => {
  it('accepts a plain valid header', () => {
    expect(collectSchemeInvariantErrors(scheme())).toEqual([]);
  });

  it('ck_lsc_code_shape — rejects a code with a space in it', () => {
    expect(fields(collectSchemeInvariantErrors(scheme({ lscCode: 'DIWALI 25' })))).toContain(
      'lsc_code',
    );
  });

  it('ck_lsc_type — rejects a type outside the vocabulary', () => {
    expect(fields(collectSchemeInvariantErrors(scheme({ lscType: 'POINTS' })))).toContain(
      'lsc_type',
    );
  });

  it('ck_lsc_expiry_days — an EARN_DATE basis needs a positive window', () => {
    const errors = collectSchemeInvariantErrors(
      scheme({ lscExpiryBasis: 'EARN_DATE', lscPointsValidDays: 0 }),
    );
    expect(fields(errors)).toContain('lsc_points_valid_days');
  });

  it('ck_lsc_expiry_days — a NONE basis is happy with zero days', () => {
    expect(
      collectSchemeInvariantErrors(scheme({ lscExpiryBasis: 'NONE', lscPointsValidDays: 0 })),
    ).toEqual([]);
  });

  it('ck_lsc_redeem_rate — a redeeming scheme must price a point', () => {
    const errors = collectSchemeInvariantErrors(
      scheme({ lscAllowPointRedeem: true, lscRedeemValuePerPoint: 0 }),
    );
    expect(fields(errors)).toContain('lsc_redeem_value_per_point');
  });

  it('ck_lsc_redeem_rate — passes once a rate is set', () => {
    expect(
      collectSchemeInvariantErrors(
        scheme({ lscAllowPointRedeem: true, lscRedeemValuePerPoint: 0.25 }),
      ),
    ).toEqual([]);
  });

  it('ck_lsc_dates — rejects an end before the start', () => {
    const errors = collectSchemeInvariantErrors(
      scheme({ lscEndDate: new Date('2025-09-01T00:00:00.000Z') }),
    );
    expect(fields(errors)).toContain('lsc_end_date');
  });

  it('ck_lsc_time_pair — rejects one end of the window without the other', () => {
    const errors = collectSchemeInvariantErrors(
      scheme({ lscValidFromTime: new Date(Date.UTC(1970, 0, 1, 22, 22)) }),
    );
    expect(fields(errors)).toContain('lsc_valid_to_time');
  });

  // 22:22 to 04:44 spans midnight, which is a real late-night promotion and
  // must NOT be rejected. There is deliberately no ordering rule on the pair.
  it('ck_lsc_time_pair — accepts a window that crosses midnight', () => {
    expect(
      collectSchemeInvariantErrors(
        scheme({
          lscValidFromTime: new Date(Date.UTC(1970, 0, 1, 22, 22)),
          lscValidToTime: new Date(Date.UTC(1970, 0, 1, 4, 44)),
        }),
      ),
    ).toEqual([]);
  });

  it('ck_lsc_weekdays — rejects a day name that is not three letters', () => {
    const errors = collectSchemeInvariantErrors(scheme({ lscValidWeekdays: 'MONDAY,TUE' }));
    expect(fields(errors)).toContain('lsc_valid_weekdays');
  });

  it('ck_lsc_weekdays — accepts a comma-separated list', () => {
    expect(collectSchemeInvariantErrors(scheme({ lscValidWeekdays: 'SAT,SUN' }))).toEqual([]);
  });

  it('ck_lsc_approved — an APPROVED scheme needs an approver', () => {
    const errors = collectSchemeInvariantErrors(scheme({ lscStatus: 'APPROVED' }));
    expect(fields(errors)).toContain('lsc_approved_by');
  });

  it('ck_lsc_activation — rejects an activation window over a year', () => {
    expect(fields(collectSchemeInvariantErrors(scheme({ lscActivationDays: 400 })))).toContain(
      'lsc_activation_days',
    );
  });

  it('ck_lsc_redeem_limits — rejects a redeem percentage over 100', () => {
    expect(fields(collectSchemeInvariantErrors(scheme({ lscMaxRedeemPerc: 120 })))).toContain(
      'lsc_max_redeem_perc',
    );
  });

  // Collected, not short-circuited: one bad payload reports everything at once.
  it('reports every problem in one pass', () => {
    const errors = collectSchemeInvariantErrors(
      scheme({ lscCode: 'BAD CODE', lscType: 'NOPE', lscPriority: 99 }),
    );
    expect(fields(errors)).toEqual(
      expect.arrayContaining(['lsc_code', 'lsc_type', 'lsc_priority']),
    );
  });
});

describe('loyalty scheme party invariants', () => {
  const party = (overrides: Partial<EffectivePartyRow> = {}): EffectivePartyRow => ({
    lspSlno: 1,
    lspKind: 'CUSTOMER',
    lspMatchPriority: 2,
    ...overrides,
  });

  it('accepts the two kinds loyalty has', () => {
    expect(collectPartyInvariantErrors(party())).toEqual([]);
    expect(collectPartyInvariantErrors(party({ lspKind: 'CUSTOMER_GROUP' }))).toEqual([]);
  });

  // AREA and CITY are promotion's, not loyalty's: a wallet follows the person.
  it('ck_lsp_kind — rejects AREA, which loyalty deliberately does not offer', () => {
    expect(fields(collectPartyInvariantErrors(party({ lspKind: 'AREA' })))).toContain('lsp_kind');
  });

  it('ck_lsp_slno — rejects a zero serial number', () => {
    expect(fields(collectPartyInvariantErrors(party({ lspSlno: 0 })))).toContain('lsp_slno');
  });
});

describe('loyalty scheme item invariants', () => {
  const item = (overrides: Partial<EffectiveItemRow> = {}): EffectiveItemRow => ({
    lsiSlno: 1,
    lsiKind: 'ITEM_BRAND',
    lsiIsExclude: false,
    lsiFactor: 1,
    lsiPoints: 0,
    lsiMaxPoints: 0,
    lsiMatchPriority: 3,
    ...overrides,
  });

  it('accepts an in-scope row with no rate on it', () => {
    expect(collectItemInvariantErrors(item())).toEqual([]);
  });

  it('accepts a double-points row', () => {
    expect(collectItemInvariantErrors(item({ lsiFactor: 2 }))).toEqual([]);
  });

  it('ck_lsi_kind — rejects a kind outside the five', () => {
    expect(fields(collectItemInvariantErrors(item({ lsiKind: 'ITEM_TYPE' })))).toContain(
      'lsi_kind',
    );
  });

  it('ck_lsi_exclude — an exclude row may not also carry a rate', () => {
    const errors = collectItemInvariantErrors(item({ lsiIsExclude: true, lsiFactor: 2 }));
    expect(fields(errors)).toContain('lsi_is_exclude');
  });

  it('ck_lsi_exclude — a bare exclude row is fine', () => {
    expect(collectItemInvariantErrors(item({ lsiIsExclude: true }))).toEqual([]);
  });

  it('ck_lsi_values — a factor of 0 would silently zero the line', () => {
    expect(fields(collectItemInvariantErrors(item({ lsiFactor: 0 })))).toContain('lsi_factor');
  });
});

describe('loyalty scheme slab invariants', () => {
  const slab = (overrides: Partial<EffectiveSlabRow> = {}): EffectiveSlabRow => ({
    lssSlno: 1,
    lssExceeds: 1000,
    lssUpto: 4999,
    lssEach: 100,
    lssPoints: 2,
    lssFactor: 1,
    lssMaxPoints: 0,
    ...overrides,
  });

  it('accepts a normal band', () => {
    expect(collectSlabInvariantErrors(slab())).toEqual([]);
  });

  it('accepts an open-ended top band', () => {
    expect(collectSlabInvariantErrors(slab({ lssUpto: null }))).toEqual([]);
  });

  it('ck_lss_band — rejects a ceiling below the floor', () => {
    expect(fields(collectSlabInvariantErrors(slab({ lssUpto: 500 })))).toContain('lss_upto');
  });

  it('ck_lss_values — rejects a zero granularity, which would divide by zero', () => {
    expect(fields(collectSlabInvariantErrors(slab({ lssEach: 0 })))).toContain('lss_each');
  });
});

describe('loyalty scheme gift invariants', () => {
  const gift = (overrides: Partial<EffectiveGiftRow> = {}): EffectiveGiftRow => ({
    lsgSlno: 1,
    lsgItemQty: 1,
    lsgRedeemPoints: 500,
    lsgMaxQtyPerBill: 0,
    lsgValidFrom: null,
    lsgValidUpto: null,
    ...overrides,
  });

  it('accepts a catalogue row with no validity window', () => {
    expect(collectGiftInvariantErrors(gift())).toEqual([]);
  });

  it('ck_lsg_qty — a gift that hands over nothing is not a gift', () => {
    expect(fields(collectGiftInvariantErrors(gift({ lsgItemQty: 0 })))).toContain('lsg_item_qty');
  });

  it('ck_lsg_validity — rejects an end before the start', () => {
    const errors = collectGiftInvariantErrors(
      gift({
        lsgValidFrom: new Date('2025-10-31T00:00:00.000Z'),
        lsgValidUpto: new Date('2025-10-01T00:00:00.000Z'),
      }),
    );
    expect(fields(errors)).toContain('lsg_valid_upto');
  });

  it('ck_lsg_validity — an open-ended window is fine', () => {
    expect(
      collectGiftInvariantErrors(gift({ lsgValidFrom: new Date('2025-10-01T00:00:00.000Z') })),
    ).toEqual([]);
  });
});
