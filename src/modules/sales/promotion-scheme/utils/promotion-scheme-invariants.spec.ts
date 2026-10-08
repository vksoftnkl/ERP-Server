import {
  EffectiveItemRow,
  EffectivePartyRow,
  EffectiveScheme,
  EffectiveSlabRow,
  ITEM_INVARIANTS,
  PARTY_INVARIANTS,
  SCHEME_INVARIANTS,
  SLAB_INVARIANTS,
  collectItemInvariantErrors,
  collectPartyInvariantErrors,
  collectSchemeInvariantErrors,
  collectSlabInvariantErrors,
} from './promotion-scheme-invariants';

/** A header that satisfies every constraint; each test breaks exactly one thing. */
const valid: EffectiveScheme = {
  prmCode: 'DIWALI25',
  prmStatus: 'DRAFT',
  prmApplyOn: 'ITEM_QTY',
  prmBenefit: 'DISC_PERC',
  prmStackMode: 'EXCLUSIVE',
  prmCalcOnAmountType: 'NET_AMOUNT',
  prmBillType: 'ALL',
  prmBranchScope: 'ALL',
  prmCustScope: 'ALL',
  prmItemScope: 'ALL',
  prmPriority: 1,
  prmMinBillAmount: 0,
  prmMinQty: 0,
  prmMaxBenefitPerBill: 0,
  prmMaxUsesTotal: 0,
  prmMaxUsesPerCust: 0,
  prmBudgetAmount: 0,
  prmStartDate: new Date('2025-10-01'),
  prmEndDate: new Date('2025-10-31'),
  prmValidFromTime: null,
  prmValidToTime: null,
  prmValidWeekdays: null,
  prmApprovedBy: null,
};

const fields = (scheme: Partial<EffectiveScheme>): string[] =>
  collectSchemeInvariantErrors({ ...valid, ...scheme }).map((e) => e.field);

describe('promotion scheme invariants', () => {
  it('carries one function per CHECK constraint in the DDL', () => {
    expect([...SCHEME_INVARIANTS.keys()]).toEqual([
      'ck_prm_code_shape',
      'ck_prm_status',
      'ck_prm_apply_on',
      'ck_prm_benefit',
      'ck_prm_stack_mode',
      'ck_prm_calc_on',
      'ck_prm_bill_type',
      'ck_prm_branch_scope',
      'ck_prm_cust_scope',
      'ck_prm_item_scope',
      'ck_prm_fixed_price_scope',
      'ck_prm_dates',
      'ck_prm_time_pair',
      'ck_prm_weekdays',
      'ck_prm_priority',
      'ck_prm_thresholds',
      'ck_prm_caps',
      'ck_prm_approved',
    ]);
  });

  it('passes a valid header', () => {
    expect(collectSchemeInvariantErrors(valid)).toEqual([]);
  });

  describe.each([
    ['ck_prm_code_shape', { prmCode: 'DIWALI 25!' }, 'prm_code'],
    ['ck_prm_status', { prmStatus: 'LIVE' }, 'prm_status'],
    ['ck_prm_apply_on', { prmApplyOn: 'LINE' }, 'prm_apply_on'],
    ['ck_prm_benefit', { prmBenefit: 'CASHBACK' }, 'prm_benefit'],
    ['ck_prm_stack_mode', { prmStackMode: 'MERGE' }, 'prm_stack_mode'],
    ['ck_prm_calc_on', { prmCalcOnAmountType: 'MRP' }, 'prm_calc_on_amount_type'],
    ['ck_prm_bill_type', { prmBillType: 'UPI' }, 'prm_bill_type'],
    ['ck_prm_branch_scope', { prmBranchScope: 'SOME' }, 'prm_branch_scope'],
    ['ck_prm_cust_scope', { prmCustScope: 'SOME' }, 'prm_cust_scope'],
    ['ck_prm_item_scope', { prmItemScope: 'SOME' }, 'prm_item_scope'],
    ['ck_prm_dates', { prmEndDate: new Date('2025-09-30') }, 'prm_end_date'],
    ['ck_prm_weekdays', { prmValidWeekdays: 'MONDAY' }, 'prm_valid_weekdays'],
    ['ck_prm_priority', { prmPriority: 0 }, 'prm_priority'],
    ['ck_prm_thresholds', { prmMinQty: -1 }, 'prm_min_qty'],
    ['ck_prm_caps', { prmBudgetAmount: -1 }, 'prm_budget_amount'],
    ['ck_prm_approved', { prmStatus: 'APPROVED' }, 'prm_approved_by'],
  ])('%s', (_name, broken, field) => {
    it(`reports ${field}`, () => {
      expect(fields(broken as Partial<EffectiveScheme>)).toContain(field);
    });
  });

  it('ck_prm_fixed_price_scope rejects a FIXED_PRICE benefit on a bill-level trigger', () => {
    expect(fields({ prmBenefit: 'FIXED_PRICE', prmApplyOn: 'BILL_AMOUNT' })).toContain(
      'prm_apply_on',
    );
    expect(fields({ prmBenefit: 'FIXED_PRICE', prmApplyOn: 'ITEM_QTY' })).toEqual([]);
  });

  it('ck_prm_time_pair wants both bounds or neither, and allows a window across midnight', () => {
    expect(fields({ prmValidFromTime: new Date() })).toContain('prm_valid_to_time');
    // 22:00 -> 04:00 is a late-night offer, not a typo.
    expect(
      fields({
        prmValidFromTime: new Date('1970-01-01T22:00:00Z'),
        prmValidToTime: new Date('1970-01-01T04:00:00Z'),
      }),
    ).toEqual([]);
  });

  it('reports every problem at once rather than stopping at the first', () => {
    expect(
      fields({
        prmCode: 'bad code!',
        prmStatus: 'LIVE',
        prmPriority: 99,
        prmMinQty: -5,
        prmBudgetAmount: -5,
      }),
    ).toEqual(['prm_code', 'prm_status', 'prm_priority', 'prm_min_qty', 'prm_budget_amount']);
  });
});

describe('promotion scheme party invariants', () => {
  const valid: EffectivePartyRow = {
    prpSlno: 1,
    prpKind: 'CUSTOMER_GROUP',
    prpMatchPriority: 1,
  };
  const fields = (row: Partial<EffectivePartyRow>): string[] =>
    collectPartyInvariantErrors({ ...valid, ...row }).map((e) => e.field);

  it('carries one function per CHECK constraint on the party table', () => {
    expect([...PARTY_INVARIANTS.keys()]).toEqual([
      'ck_prp_kind',
      'ck_prp_slno',
      'ck_prp_match_priority',
    ]);
  });

  it('passes a valid row', () => {
    expect(collectPartyInvariantErrors(valid)).toEqual([]);
  });

  it.each(['CUSTOMER', 'CUSTOMER_GROUP', 'AREA', 'CITY'])('accepts prp_kind %s', (kind) => {
    expect(fields({ prpKind: kind })).toEqual([]);
  });

  it('ck_prp_kind rejects anything outside the four', () => {
    expect(fields({ prpKind: 'STATE' })).toContain('prp_kind');
  });

  it('ck_prp_slno wants a whole number above zero', () => {
    expect(fields({ prpSlno: 0 })).toContain('prp_slno');
    expect(fields({ prpSlno: -1 })).toContain('prp_slno');
    expect(fields({ prpSlno: 1.5 })).toContain('prp_slno');
  });

  it('ck_prp_match_priority spans 0 to 9 inclusive', () => {
    expect(fields({ prpMatchPriority: 0 })).toEqual([]);
    expect(fields({ prpMatchPriority: 9 })).toEqual([]);
    expect(fields({ prpMatchPriority: 10 })).toContain('prp_match_priority');
    expect(fields({ prpMatchPriority: -1 })).toContain('prp_match_priority');
  });

  it('reports every problem on the row at once', () => {
    expect(fields({ prpKind: 'STATE', prpSlno: 0, prpMatchPriority: 42 })).toEqual([
      'prp_kind',
      'prp_slno',
      'prp_match_priority',
    ]);
  });
});

describe('promotion scheme item invariants', () => {
  const valid: EffectiveItemRow = {
    priSlno: 1,
    priKind: 'ITEM_BRAND',
    priUnitId: null,
    priIsExclude: false,
    priDiscPerc: 0,
    priDiscQty: 0,
    priDiscAmt: 0,
    priMinQty: 0,
    priFactor: 1,
    priMaxBenefit: 0,
    priMatchPriority: 3,
  };
  const fields = (row: Partial<EffectiveItemRow>): string[] =>
    collectItemInvariantErrors({ ...valid, ...row }).map((e) => e.field);

  it('carries one function per CHECK constraint on the item table', () => {
    expect([...ITEM_INVARIANTS.keys()]).toEqual([
      'ck_pri_kind',
      'ck_pri_unit',
      'ck_pri_one_rate',
      'ck_pri_exclude',
      'ck_pri_values',
      'ck_pri_slno',
      'ck_pri_match_priority',
    ]);
  });

  it('passes a valid row', () => {
    expect(collectItemInvariantErrors(valid)).toEqual([]);
  });

  it('ck_pri_kind rejects anything outside the five', () => {
    expect(fields({ priKind: 'ITEM_COLOUR' })).toContain('pri_kind');
  });

  // The biconditional, both ways round.
  it('ck_pri_unit requires a unit on ITEM and forbids it everywhere else', () => {
    expect(fields({ priKind: 'ITEM', priUnitId: null })).toContain('pri_unit_id');
    expect(fields({ priKind: 'ITEM', priUnitId: 'unit-1', priMatchPriority: 4 })).toEqual([]);
    expect(fields({ priKind: 'ITEM_BRAND', priUnitId: 'unit-1' })).toContain('pri_unit_id');
  });

  it('ck_pri_one_rate allows one rate but not two', () => {
    expect(fields({ priDiscPerc: 10 })).toEqual([]);
    expect(fields({ priDiscPerc: 10, priDiscAmt: 5 })).toContain('pri_disc_perc');
  });

  it('ck_pri_exclude forbids a rate or a factor on an exclusion', () => {
    expect(fields({ priIsExclude: true })).toEqual([]);
    expect(fields({ priIsExclude: true, priDiscPerc: 10 })).toContain('pri_is_exclude');
    expect(fields({ priIsExclude: true, priFactor: 2 })).toContain('pri_is_exclude');
  });

  it('ck_pri_values bounds every numeric column', () => {
    expect(fields({ priDiscPerc: 101 })).toContain('pri_disc_perc');
    expect(fields({ priDiscQty: -1 })).toContain('pri_disc_qty');
    expect(fields({ priDiscAmt: -1 })).toContain('pri_disc_amt');
    expect(fields({ priMinQty: -1 })).toContain('pri_min_qty');
    expect(fields({ priFactor: 0 })).toContain('pri_factor');
    expect(fields({ priMaxBenefit: -1 })).toContain('pri_max_benefit');
  });

  it('ck_pri_slno and ck_pri_match_priority bound the grid columns', () => {
    expect(fields({ priSlno: 0 })).toContain('pri_slno');
    expect(fields({ priMatchPriority: 10 })).toContain('pri_match_priority');
    expect(fields({ priMatchPriority: 0 })).toEqual([]);
  });
});

describe('promotion scheme slab invariants', () => {
  const discPerc: EffectiveSlabRow = {
    prsSlno: 1,
    prsBenefit: 'DISC_PERC',
    prsExceeds: 1000,
    prsUpto: 4999,
    prsEach: 1,
    prsIsRepeat: false,
    prsMaxRepeats: 0,
    prsFreeItemId: null,
    prsFreeUnitId: null,
    prsFreeQty: 0,
    prsDiscPerc: 5,
    prsDiscQty: 0,
    prsDiscAmt: 0,
    prsFixedPrice: null,
    prsMaxBenefitAmt: 0,
  };
  const fields = (row: Partial<EffectiveSlabRow>): string[] =>
    collectSlabInvariantErrors({ ...discPerc, ...row }).map((e) => e.field);

  it('carries one function per CHECK constraint on the slab table', () => {
    expect([...SLAB_INVARIANTS.keys()]).toEqual([
      'ck_prs_band',
      'ck_prs_each',
      'ck_prs_amounts',
      'ck_prs_free_unit_pair',
      'ck_prs_benefit_columns',
      'ck_prs_slno',
    ]);
  });

  it('passes a valid DISC_PERC band', () => {
    expect(collectSlabInvariantErrors(discPerc)).toEqual([]);
  });

  it('ck_prs_band wants an open or ascending range', () => {
    expect(fields({ prsUpto: null })).toEqual([]);
    expect(fields({ prsUpto: 1000 })).toContain('prs_upto');
    expect(fields({ prsExceeds: -1 })).toContain('prs_exceeds');
  });

  it('ck_prs_each ties max_repeats to is_repeat', () => {
    expect(fields({ prsEach: 0 })).toContain('prs_each');
    expect(fields({ prsMaxRepeats: 3 })).toContain('prs_max_repeats');
    expect(fields({ prsIsRepeat: true, prsMaxRepeats: 3 })).toEqual([]);
  });

  it('ck_prs_free_unit_pair wants both halves of a free item or neither', () => {
    expect(fields({ prsFreeItemId: 'item-1' })).toContain('prs_free_unit_id');
    expect(fields({ prsFreeUnitId: 'unit-1' })).toContain('prs_free_unit_id');
  });

  describe('ck_prs_benefit_columns', () => {
    it('FREE_ITEM needs an item, a unit and a quantity, and nothing else', () => {
      expect(
        collectSlabInvariantErrors({
          ...discPerc,
          prsBenefit: 'FREE_ITEM',
          prsDiscPerc: 0,
          prsFreeItemId: 'item-1',
          prsFreeUnitId: 'unit-1',
          prsFreeQty: 1,
        }),
      ).toEqual([]);
      expect(fields({ prsBenefit: 'FREE_ITEM', prsDiscPerc: 0 })).toContain('prs_free_item_id');
    });

    it('DISC_PERC needs a percentage and nothing else', () => {
      expect(fields({ prsDiscPerc: 0 })).toContain('prs_disc_perc');
      expect(fields({ prsDiscAmt: 5 })).toContain('prs_benefit');
    });

    // The SQL writes this as `(prs_disc_amt > 0) <> (prs_disc_qty > 0)` — XOR,
    // so neither and both are equally wrong.
    it('DISC_AMT needs exactly one of flat or per-unit', () => {
      expect(
        collectSlabInvariantErrors({
          ...discPerc,
          prsBenefit: 'DISC_AMT',
          prsDiscPerc: 0,
          prsDiscAmt: 25,
        }),
      ).toEqual([]);
      expect(fields({ prsBenefit: 'DISC_AMT', prsDiscPerc: 0 })).toContain('prs_disc_amt');
      expect(
        fields({ prsBenefit: 'DISC_AMT', prsDiscPerc: 0, prsDiscAmt: 25, prsDiscQty: 2 }),
      ).toContain('prs_disc_amt');
    });

    it('FIXED_PRICE needs a price and nothing else', () => {
      expect(
        collectSlabInvariantErrors({
          ...discPerc,
          prsBenefit: 'FIXED_PRICE',
          prsDiscPerc: 0,
          prsFixedPrice: 99,
        }),
      ).toEqual([]);
      expect(fields({ prsBenefit: 'FIXED_PRICE', prsDiscPerc: 0 })).toContain('prs_fixed_price');
    });

    // The DDL's ELSE false.
    it('an unknown benefit fails outright', () => {
      expect(fields({ prsBenefit: 'CASHBACK' })).toContain('prs_benefit');
    });
  });

  it('ck_prs_slno bounds the grid column', () => {
    expect(fields({ prsSlno: 0 })).toContain('prs_slno');
  });
});
