import { VoucherNumberingMode } from '@prisma/client';
import {
  canHaveChildren,
  checkChildIdentity,
  checkNumbering,
  childTypeCode,
  kindOf,
  lockedFieldChanges,
  numberedByOf,
  printDocTypeOf,
  sameValue,
  sharedGstin,
  type BranchFact,
  type NumberingDraft,
  type NumberingFacts,
} from './voucher-types.rules';

/** Voucher Types plan §5 / §7.2 — the master's rules that need no database. */

const CO = 'c1';
const branch = (over: Partial<BranchFact> = {}): BranchFact => ({
  branchId: 'b-cbe',
  branchName: 'Coimbatore',
  companyId: CO,
  numberCode: 'CBE',
  gstin: '33AAPCA6346P1Z2',
  ...over,
});
const draft = (over: Partial<NumberingDraft> = {}): NumberingDraft => ({
  mode: VoucherNumberingMode.AUTO,
  prefix: 'ZT{BR}',
  suffix: null,
  width: 4,
  startNo: 1,
  ...over,
});
const facts = (over: Partial<NumberingFacts> = {}): NumberingFacts => ({
  vchrTypeId: null,
  accYear: '2026-2027',
  gstOutward: true,
  branches: [branch()],
  previewBranch: branch(),
  series: [{ vchrTypeId: 3, vchrTypeName: 'Sales Bill', prefix: 'bil', suffix: '' }],
  ...over,
});
const codes = (v: { errors: Array<{ code: string }> }) => v.errors.map((e) => e.code);

describe('kind, numberedBy, parents', () => {
  it('works Kind out from the columns (Q24)', () => {
    expect(kindOf({ vchrAffectsAccounts: false, vchrInRegister: false })).toBe('NUMBERING_ONLY');
    expect(kindOf({ vchrAffectsAccounts: true, vchrInRegister: true })).toBe('VOUCHER_REGISTER');
    expect(kindOf({ vchrAffectsAccounts: true, vchrInRegister: false })).toBe('DOCUMENT');
  });

  it('marks the Q26 rows as numbered by their screen; children always by the counter', () => {
    expect(numberedByOf({ vchrTypeCode: 'SRt', vchrParentId: null })).toBe('SCREEN');
    expect(numberedByOf({ vchrTypeCode: 'PUR', vchrParentId: null })).toBe('SCREEN');
    expect(numberedByOf({ vchrTypeCode: 'Bil', vchrParentId: null })).toBe('COUNTER');
    expect(numberedByOf({ vchrTypeCode: 'SRt', vchrParentId: 3 })).toBe('COUNTER');
  });

  it('lets only Sales Bill (a base) have children (Q1)', () => {
    expect(canHaveChildren({ vchrTypeCode: 'Bil', vchrParentId: null })).toBe(true);
    expect(canHaveChildren({ vchrTypeCode: 'SRt', vchrParentId: null })).toBe(false);
    expect(canHaveChildren({ vchrTypeCode: 'Bil-RT', vchrParentId: 3 })).toBe(false);
  });

  it('prints Sales Bill and its children with SALE_BILL designs; other types are not wired', () => {
    expect(printDocTypeOf({ vchrTypeCode: 'Bil' }, null)).toBe('SALE_BILL');
    expect(printDocTypeOf({ vchrTypeCode: 'Rct' }, null)).toBeNull();
    expect(printDocTypeOf({ vchrTypeCode: 'Rct' }, 'ACC_VOUCHER')).toBe('ACC_VOUCHER');
  });
});

describe('childTypeCode (decision 32)', () => {
  it('is base code - abbreviation', () => {
    expect(childTypeCode('Bil', 'RT', new Set(['Bil', 'SRt']))).toBe('Bil-RT');
  });

  it('adds -2, -3 when another company took it (any case)', () => {
    expect(childTypeCode('Bil', 'RT', new Set(['bil-rt']))).toBe('Bil-RT-2');
    expect(childTypeCode('Bil', 'RT', new Set(['Bil-RT', 'Bil-RT-2']))).toBe('Bil-RT-3');
  });

  it('stays within VarChar(20)', () => {
    const code = childTypeCode('ABCDEFGHIJKLMN', 'RETAIL', new Set(['ABCDEFGHIJKLMN-RETAI']));
    expect(code.length).toBeLessThanOrEqual(20);
    expect(code.endsWith('-2')).toBe(true);
  });
});

describe('checkNumbering (§7.2 item 4)', () => {
  it('passes a clean child and fills the preview strip (A11)', () => {
    const v = checkNumbering(draft(), facts());
    expect(v.errors).toEqual([]);
    expect(v.warnings).toEqual([]);
    expect(v.preview).toEqual({
      sample: 'ZTCBE0001',
      length: 9,
      branchCode: 'CBE',
      branchName: 'Coimbatore',
      accYear: '2026-2027',
      gstLimit: 16,
      clashWith: null,
    });
  });

  it.each([0, 10, 1.5])('refuses width %p (VT_WIDTH_INVALID)', (width) => {
    expect(codes(checkNumbering(draft({ width }), facts()))).toContain('VT_WIDTH_INVALID');
  });

  it.each([0, -5, 1_000_000_000])('refuses starting no %p (VT_START_NO_INVALID)', (startNo) => {
    expect(codes(checkNumbering(draft({ startNo }), facts()))).toContain('VT_START_NO_INVALID');
  });

  it('refuses an unknown token, naming it without braces', () => {
    const v = checkNumbering(draft({ prefix: 'ZT{BR}{QQ}' }), facts());
    expect(v.errors).toEqual([
      expect.objectContaining({
        code: 'SEQUENCE_FORMAT_TOKEN_UNKNOWN',
        field: 'vchrNoPrefix',
        params: { token: 'QQ' },
      }),
    ]);
    expect(v.preview.sample).toBeNull();
  });

  it('refuses {YY} with an accounting year not shaped NNNN-NNNN', () => {
    const v = checkNumbering(draft({ prefix: 'ZT{BR}{YY}' }), facts({ accYear: '2026-27' }));
    expect(v.errors).toEqual([
      expect.objectContaining({ code: 'SEQUENCE_FORMAT_TOKEN_UNKNOWN', params: { token: 'YY' } }),
    ]);
  });

  it('refuses a non-AUTO Method: GST types (Q18) and, today, every type (decision 42)', () => {
    const gst = checkNumbering(draft({ mode: VoucherNumberingMode.MANUAL }), facts());
    expect(gst.errors).toEqual([
      expect.objectContaining({ code: 'VT_METHOD_GST_AUTO_ONLY', field: 'vchrNumberingMode' }),
    ]);
    expect(gst.errors[0].rule).toBeUndefined();
    const other = checkNumbering(
      draft({ mode: VoucherNumberingMode.AUTO_MANUAL }),
      facts({ gstOutward: false }),
    );
    expect(other.errors).toEqual([
      expect.objectContaining({ code: 'VT_METHOD_GST_AUTO_ONLY', rule: 'NO_NUMBER_BOX' }),
    ]);
  });

  it('refuses a GST number over 16 at ANY branch (VT_NO_TOO_LONG with sample / len)', () => {
    // CBE: ZTCBE/26-27/0001 (16); COUNTER2: ZTCOUNTER2/26-27/0001 (21).
    const v = checkNumbering(
      draft({ prefix: 'ZT{BR}/{YY}/' }),
      facts({ branches: [branch(), branch({ branchId: 'b-c2', numberCode: 'COUNTER2' })] }),
    );
    expect(v.errors).toEqual([
      expect.objectContaining({
        code: 'VT_NO_TOO_LONG',
        params: { sample: 'ZTCOUNTER2/26-27/0001', len: '21' },
      }),
    ]);
    // The strip shows the branch asked for.
    expect(v.preview.sample).toBe('ZTCBE/26-27/0001');
  });

  it('refuses ZT/{FY}/ + 5 digits = 18 for a GST type', () => {
    const v = checkNumbering(
      draft({ prefix: 'ZT/{FY}/', width: 5 }),
      facts({ branches: [branch({ gstin: 'A' })] }),
    );
    expect(codes(v)).toEqual(['VT_NO_TOO_LONG']);
  });

  it('only warns (VT_NO_OVER_16) for a non-GST type, and refuses over 50 for any', () => {
    const warn = checkNumbering(
      draft({ prefix: 'JRL/{FY}/{BR}/', width: 5 }),
      facts({ gstOutward: false }),
    );
    expect(warn.errors).toEqual([]);
    expect(warn.warnings).toEqual([expect.objectContaining({ code: 'VT_NO_OVER_16' })]);
    const tooLong = checkNumbering(
      // 39 + 9 + 10 = 58.
      draft({ prefix: '{FY}/{FY}/{FY}/{FY}', suffix: '/{FY}', width: 9 }),
      facts({ gstOutward: false }),
    );
    expect(codes(tooLong)).toEqual(['SEQUENCE_REFNO_TOO_LONG']);
  });

  it('counts the starting number’s digits', () => {
    // 'ZTCBE' (5) + '123456789' (9) = 14.
    expect(checkNumbering(draft({ startNo: 123456789 }), facts()).preview.sample).toBe(
      'ZTCBE123456789',
    );
  });

  it('refuses a character other than letters, digits, / and - in a GST number (VT_NO_BAD_CHAR)', () => {
    expect(codes(checkNumbering(draft({ prefix: 'RT.{BR}' }), facts()))).toContain(
      'VT_NO_BAD_CHAR',
    );
    expect(codes(checkNumbering(draft({ prefix: 'RT_{BR}' }), facts()))).toContain(
      'VT_NO_BAD_CHAR',
    );
    expect(codes(checkNumbering(draft({ prefix: 'RT/{BR}-' }), facts()))).not.toContain(
      'VT_NO_BAD_CHAR',
    );
    expect(
      codes(checkNumbering(draft({ prefix: 'RT.' }), facts({ gstOutward: false }))),
    ).not.toContain('VT_NO_BAD_CHAR');
  });

  it('wants {BR} when two active branches share a GSTIN (Q13, VT_BR_REQUIRED)', () => {
    const shared = facts({
      branches: [branch(), branch({ branchId: 'b-c2', numberCode: 'COUNTER2' })],
    });
    expect(codes(checkNumbering(draft({ prefix: 'RT/{YY}/' }), shared))).toEqual([
      'VT_BR_REQUIRED',
    ]);
    expect(codes(checkNumbering(draft({ prefix: 'RT{BR}' }), shared))).toEqual([]);
    const own = facts({
      branches: [branch(), branch({ branchId: 'b-ho', gstin: '33ABNPL5414F1ZU' })],
    });
    expect(codes(checkNumbering(draft({ prefix: 'RT/{YY}/' }), own))).toEqual([]);
  });

  it('never asks for {BR} on a non-GST type', () => {
    const shared = facts({ gstOutward: false, branches: [branch(), branch({ branchId: 'b-c2' })] });
    expect(codes(checkNumbering(draft({ prefix: 'RT/' }), shared))).toEqual([]);
  });

  it('refuses a prefix + suffix another series prints (VT_PREFIX_TAKEN, any case), not its own', () => {
    const v = checkNumbering(draft({ prefix: 'BIL', suffix: null }), facts({ gstOutward: false }));
    expect(v.errors).toEqual([
      expect.objectContaining({
        code: 'VT_PREFIX_TAKEN',
        params: { other: 'Sales Bill', prefix: 'BIL' },
      }),
    ]);
    expect(v.preview.clashWith).toBe('Sales Bill');
    expect(
      codes(checkNumbering(draft({ prefix: 'bil' }), facts({ gstOutward: false, vchrTypeId: 3 }))),
    ).toEqual([]);
    expect(
      codes(checkNumbering(draft({ prefix: 'bil', suffix: '/R' }), facts({ gstOutward: false }))),
    ).toEqual([]);
  });

  it('skips branches with no code when the format prints {BR}', () => {
    const v = checkNumbering(
      draft({ prefix: 'ZT{BR}' }),
      facts({ branches: [branch(), branch({ branchId: 'b-x', numberCode: null, gstin: null })] }),
    );
    expect(v.errors).toEqual([]);
  });

  it('shows {BR} raw in the preview when the preview branch has no code', () => {
    const v = checkNumbering(draft(), facts({ previewBranch: branch({ numberCode: null }) }));
    expect(v.preview).toMatchObject({ sample: 'ZT{BR}0001', branchCode: null });
  });
});

describe('sharedGstin', () => {
  it('counts per company and ignores branches with no GSTIN', () => {
    expect(sharedGstin([branch(), branch({ companyId: 'c2' })])).toBeNull();
    expect(sharedGstin([branch({ gstin: null }), branch({ gstin: null })])).toBeNull();
    expect(sharedGstin([branch(), branch({ branchId: 'x', gstin: '33aapca6346p1z2' })])).toEqual({
      gstin: '33AAPCA6346P1Z2',
      count: 2,
    });
  });
});

describe('checkChildIdentity (§7.2 item 2)', () => {
  const others = [
    { vchrTypeId: 3, vchrTypeName: 'Sales Bill', vchrTypeShort: 'Bil' },
    { vchrTypeId: 70, vchrTypeName: 'Retail Sales', vchrTypeShort: 'RT' },
  ];

  it('passes a fresh name and abbreviation', () => {
    expect(checkChildIdentity({ name: 'Wholesale', abbr: 'WS' }, others, null)).toEqual([]);
  });

  it.each([
    [{ name: '  ', abbr: 'WS' }, 'VT_NAME_REQUIRED'],
    [{ name: 'sales bill', abbr: 'WS' }, 'VT_NAME_TAKEN'],
    [{ name: 'RETAIL SALES', abbr: 'WS' }, 'VT_NAME_TAKEN'],
    [{ name: 'Wholesale', abbr: '' }, 'VT_ABBR_REQUIRED'],
    [{ name: 'Wholesale', abbr: 'WHOLES1' }, 'VT_ABBR_INVALID'],
    [{ name: 'Wholesale', abbr: 'W-S' }, 'VT_ABBR_INVALID'],
    [{ name: 'Wholesale', abbr: 'rt' }, 'VT_ABBR_TAKEN'],
    [{ name: 'Wholesale', abbr: 'BIL' }, 'VT_ABBR_TAKEN'],
  ])('%p → %s', (d, code) => {
    expect(checkChildIdentity(d, others, null).map((e) => e.code)).toEqual([code]);
  });

  it('does not clash with itself on an edit', () => {
    expect(checkChildIdentity({ name: 'Retail Sales', abbr: 'RT' }, others, 70)).toEqual([]);
  });
});

describe('lockedFieldChanges (§7.2 item 3, Q26)', () => {
  const stored = {
    vchrTypeName: 'Sales Bill',
    vchrTypeShort: 'Bil',
    vchrParentId: null,
    vchrIsActive: true,
    vchrTallyVoucherTypeName: 'Sales',
    vchrNumberingMode: VoucherNumberingMode.AUTO,
    vchrNoPrefix: 'srt',
    vchrNoSuffix: '',
    vchrNoWidth: 5,
    vchrResetFreq: 'YEARLY' as const,
    vchrStartNo: 1,
  };

  it('names every sent field that differs, ignores what is left out or the same', () => {
    const out = lockedFieldChanges(
      stored,
      { vchrTypeName: 'Sales Invoice', vchrTypeShort: 'Bil', vchrIsActive: undefined },
      ['vchrTypeName', 'vchrTypeShort', 'vchrIsActive'],
      'is set by the app.',
    );
    expect(out).toEqual([
      expect.objectContaining({ code: 'VT_BASE_FIELD_LOCKED', field: 'vchrTypeName' }),
    ]);
  });

  it("reads '' and null alike (the DTO sends null for '')", () => {
    expect(sameValue(null, '')).toBe(true);
    expect(sameValue(' srt ', 'srt')).toBe(true);
    expect(sameValue('SRT', 'srt')).toBe(false);
    expect(lockedFieldChanges(stored, { vchrNoSuffix: null }, ['vchrNoSuffix'], 'x')).toEqual([]);
  });
});
