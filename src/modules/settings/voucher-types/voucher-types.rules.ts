import { AccVoucherType, VoucherNumberingMode } from '@prisma/client';
import {
  GST_DOC_NO_MAX_LENGTH,
  GST_OUTWARD_SIDE,
  KNOWN_FORMAT_TOKENS,
  SEQ_VOUCHER_PREFIX_MAX_LENGTH,
  SEQ_VOUCHER_SUFFIX_MAX_LENGTH,
  compactAccYear,
  fillVoucherFormatTokens,
  firstVoucherNumber,
  formatHasBranchToken,
  formatHasDeviceToken,
  scanFormatTokens,
  shortAccYear,
} from 'src/common/Sequence/voucher-sequence.helper';
import { SequenceErrorCode } from 'src/common/Sequence/types/sequence-error-codes';
import { VoucherTypeErrorCode, VoucherTypeWarningCode } from './types/voucher-types-error-codes';

/**
 * The Voucher Types master's rules that need no database (plan
 * Shared/Prathap/accounts/plan-voucher-types-2026-11-14.md §5 / §7.2). The service
 * gathers the facts (rows, branches, series) and these decide.
 */

export const VOUCHER_TYPES_MENU_ID = 303;
export const VOUCHER_TYPES_AUDIT_SCREEN_NAME = 'Voucher Types';
export const VOUCHER_TYPES_TABLE_NAME = 'accounts.acc_voucher_types';

/** Q1: only Sales Bill may have children now. The parent column is generic. */
export const PARENT_TYPE_CODES: readonly string[] = ['Bil'];
/** The base the Sales Bill numbers and posts under; its children are the bill's choices. */
export const SALES_BILL_TYPE_CODE = 'Bil';

/**
 * Q26 / §5.2: the rows whose SCREEN builds the number (sale return per device,
 * purchase documents, stock vouchers): Numbering is view-only there. The
 * branch-serial build moves a code from here to "counter" as it converts it.
 */
export const SCREEN_NUMBERED_CODES: readonly string[] = [
  'SRt',
  'GRN',
  'PUR',
  'PRN',
  'SHR',
  'PO',
  'SV-ADJ',
  'SV-ISS',
  'SV-DMG',
  'SV-EXP',
  'SV-TRF',
  'SV-TRI',
];

/**
 * Decision 42 (user, 2026-11-14): the master offers Manual / Auto+Manual only for
 * a type whose screen can take a typed number. None can today, so every type is
 * Automatic only. The allocator already honours the Method (§7.3) for later.
 */
export const ALLOWED_METHODS: readonly VoucherNumberingMode[] = [VoucherNumberingMode.AUTO];

export const ABBR_PATTERN = /^[A-Za-z0-9]{1,6}$/;
/** A GST invoice / note number: letters, digits, '/' and '-' only. */
const GST_DOC_NO_CHARS = /^[A-Za-z0-9/-]*$/;
export const WIDTH_MIN = 1;
export const WIDTH_MAX = 9;
export const START_NO_MAX = 999_999_999;
/** avh_voucher_refno / abl_voucher_refno are VarChar(50). */
const POSTED_REFNO_MAX_LENGTH = 50;

/**
 * Decision 31: a child carries a server-written mirror of its base's accounting
 * columns (NOT NULL, and readers join avh_voucher_type_id straight to the row).
 * Never editable; `inherited` on /get shows the base's values.
 */
export const MIRROR_FIELDS = [
  'vchrCategory',
  'vchrNature',
  'vchrAffectsAccounts',
  'vchrAffectsInventory',
  'vchrIsCashVoucher',
  'vchrIsBankVoucher',
  'vchrPartyMode',
  'vchrPartySide',
  'vchrBillwiseMode',
  'vchrRaiseBillType',
  'vchrDrGroups',
  'vchrCrGroups',
  'vchrGstRegister',
  'vchrGstSide',
  'vchrTdsMode',
  'vchrMenuId',
  'vchrInRegister',
  'vchrInstruments',
  'vchrTallyExportEnabled',
  'vchrTallyBaseVoucherType',
  // Challan plan decision 32: a child of a GST document type is one too.
  'vchrGstDocNo',
] as const satisfies ReadonlyArray<keyof AccVoucherType>;
export type MirrorField = (typeof MIRROR_FIELDS)[number];

export type VoucherKind = 'DOCUMENT' | 'VOUCHER_REGISTER' | 'NUMBERING_ONLY';
export type NumberedBy = 'COUNTER' | 'SCREEN';

/** Q24: worked out from the columns, never stored. */
export function kindOf(
  t: Pick<AccVoucherType, 'vchrAffectsAccounts' | 'vchrInRegister'>,
): VoucherKind {
  if (!t.vchrAffectsAccounts) {
    return 'NUMBERING_ONLY';
  }
  return t.vchrInRegister ? 'VOUCHER_REGISTER' : 'DOCUMENT';
}

/** A child always draws from a counter; a base by the Q26 list. */
export function numberedByOf(t: Pick<AccVoucherType, 'vchrTypeCode' | 'vchrParentId'>): NumberedBy {
  return t.vchrParentId == null && SCREEN_NUMBERED_CODES.includes(t.vchrTypeCode)
    ? 'SCREEN'
    : 'COUNTER';
}

export function isBaseType(t: Pick<AccVoucherType, 'vchrParentId'>): boolean {
  return t.vchrParentId == null;
}

export function canHaveChildren(t: Pick<AccVoucherType, 'vchrParentId' | 'vchrTypeCode'>): boolean {
  return t.vchrParentId == null && PARENT_TYPE_CODES.includes(t.vchrTypeCode);
}

/** §5.2: a type (or a child's mirror) whose documents go on GSTR-1. */
export function isGstOutward(t: Pick<AccVoucherType, 'vchrGstSide'>): boolean {
  return t.vchrGstSide === GST_OUTWARD_SIDE;
}

/**
 * Challan plan decision 32: a type whose number is a GST document number
 * (acc_voucher_types.vchr_gst_doc_no: the challan 19 and the challan return 20,
 * and a child's mirror) — at most 16 characters, A–Z a–z 0–9 - / only.
 */
export function isGstDocNo(t: Partial<Pick<AccVoucherType, 'vchrGstDocNo'>>): boolean {
  return t.vchrGstDocNo === true;
}

/** VT_NO_TOO_LONG's wording variant for a vchr_gst_doc_no type that is not outward (rule=GST_DOC_NO). */
export const VT_NO_TOO_LONG_DOC_RULE = 'GST_DOC_NO';

/** Every known token, braced, to strip from a prefix / suffix before the charset check. */
const KNOWN_TOKEN_TEXT = new RegExp(`\\{(${KNOWN_FORMAT_TOKENS.join('|')})\\}`, 'g');
/** The known tokens as the refusal message lists them. */
const KNOWN_TOKEN_LIST = KNOWN_FORMAT_TOKENS.map((t) => `{${t}}`).join(', ');

/**
 * The print design kind (print_purpose.ppo_doc_type) a type's designs are of: the
 * base's own design's kind when it names one, else SALE_BILL for Sales Bill (its
 * default design is SALE_INVOICE). Null for a type whose print design is not wired
 * (only the Sales Bill reads vchr_print_purpose_id today, VT-34).
 */
export function printDocTypeOf(
  base: Pick<AccVoucherType, 'vchrTypeCode'>,
  basePurposeDocType: string | null,
): string | null {
  if (basePurposeDocType) {
    return basePurposeDocType;
  }
  return base.vchrTypeCode === SALES_BILL_TYPE_CODE ? 'SALE_BILL' : null;
}

/** Decision 32: base code + '-' + abbreviation; '-2', '-3' … when taken. VarChar(20). */
export function childTypeCode(baseCode: string, abbr: string, taken: ReadonlySet<string>): string {
  const stem = `${baseCode}-${abbr}`.slice(0, 20);
  const lowerTaken = new Set([...taken].map((c) => c.toLowerCase()));
  if (!lowerTaken.has(stem.toLowerCase())) {
    return stem;
  }
  for (let n = 2; n < 1000; n += 1) {
    const tail = `-${n}`;
    const candidate = `${stem.slice(0, 20 - tail.length)}${tail}`;
    if (!lowerTaken.has(candidate.toLowerCase())) {
      return candidate;
    }
  }
  throw new Error(`No free voucher type code for ${stem}`);
}

// ── issues ────────────────────────────────────────────────────────────────

export interface VtIssue {
  field: string;
  code: string;
  message: string;
  /** Fills the `{name}` placeholders of the wording row (notes 120). */
  params?: Record<string, string>;
  /** Picks a wording variant `rule=<value>`. */
  rule?: string;
}

export function issue(
  code: string,
  field: string,
  message: string,
  extra: Pick<VtIssue, 'params' | 'rule'> = {},
): VtIssue {
  return { field, code, message, ...extra };
}

// ── numbering (§7.2 item 4) ─────────────────────────────────────────────────

export interface NumberingDraft {
  mode: VoucherNumberingMode;
  prefix: string | null;
  suffix: string | null;
  width: number;
  startNo: number;
}

export interface BranchFact {
  branchId: string;
  branchName: string;
  companyId: string;
  /** branch-number-code.helper: the Bill Prefix, else the code, upper-cased; null when both are blank. */
  numberCode: string | null;
  /** COALESCE(NULLIF(br_gstin_no,''), comp_gstin_no); null when neither. */
  gstin: string | null;
}

export interface SeriesFact {
  vchrTypeId: number;
  vchrTypeName: string;
  prefix: string | null;
  suffix: string | null;
}

export interface NumberingFacts {
  /** The type being saved; null for a new one. */
  vchrTypeId: number | null;
  accYear: string;
  gstOutward: boolean;
  /**
   * Challan plan decision 32: the type (or its base) is a vchr_gst_doc_no type, held
   * to 16 characters and the GST charset like an outward one. Left out = false.
   */
  gstDocNo?: boolean;
  /**
   * The longest live device code that can number for the company (a base: any
   * company's), what {DV} is judged and previewed with. Null / left out = no
   * live device: a {DV} format is then not length-checked here (its counter is).
   */
  deviceCode?: string | null;
  /** The active branches the type numbers at: the company's for a child, every company's for a base. */
  branches: readonly BranchFact[];
  /** The branch the preview strip shows (A11). */
  previewBranch: BranchFact | null;
  /** The other counter-numbered series the company can use (§7.2: bases + its own children). */
  series: readonly SeriesFact[];
}

export interface NumberingPreview {
  sample: string | null;
  length: number | null;
  branchCode: string | null;
  /** The preview branch's name, for the strip caption (added 11-15 round 2). */
  branchName: string | null;
  accYear: string;
  gstLimit: number | null;
  clashWith: string | null;
  /**
   * The device code the sample prints for {DV}: the company's longest live one
   * (null when none). Sent for every type, so a screen can preview a {DV} typed
   * into a type that had none (added 11-16, challan plan §5.1).
   */
  deviceCode: string | null;
}

export interface NumberingVerdict {
  errors: VtIssue[];
  warnings: VtIssue[];
  preview: NumberingPreview;
}

const seriesKey = (prefix: string | null, suffix: string | null): string =>
  `${(prefix ?? '').trim().toUpperCase()}|${(suffix ?? '').trim().toUpperCase()}`;

/**
 * Every numbering refusal and warning of a draft, and the preview strip. The
 * caller drops the refusals when an edit leaves the numbering as stored (a format
 * change applies from the next counter, Q14; C7 "fires when the numbering is next
 * edited").
 */
export function checkNumbering(d: NumberingDraft, f: NumberingFacts): NumberingVerdict {
  const errors: VtIssue[] = [];
  const warnings: VtIssue[] = [];
  const widthOk = Number.isInteger(d.width) && d.width >= WIDTH_MIN && d.width <= WIDTH_MAX;
  const startOk = Number.isInteger(d.startNo) && d.startNo >= 1 && d.startNo <= START_NO_MAX;
  if (!widthOk) {
    errors.push(
      issue(
        VoucherTypeErrorCode.WIDTH_INVALID,
        'vchrNoWidth',
        `The width ${d.width} is not 1 to ${WIDTH_MAX}.`,
      ),
    );
  }
  if (!startOk) {
    errors.push(
      issue(
        VoucherTypeErrorCode.START_NO_INVALID,
        'vchrStartNo',
        `The starting number ${d.startNo} is not 1 to ${START_NO_MAX}.`,
      ),
    );
  }
  let tokensOk = true;
  const parts: Array<[string, string | null]> = [
    ['vchrNoPrefix', d.prefix],
    ['vchrNoSuffix', d.suffix],
  ];
  const names = new Set<string>();
  for (const [field, text] of parts) {
    const scan = scanFormatTokens(text);
    scan.names.forEach((n) => names.add(n));
    if (scan.unknown !== undefined) {
      tokensOk = false;
      errors.push(
        issue(
          SequenceErrorCode.FORMAT_TOKEN_UNKNOWN,
          field,
          `"${text}" holds an unknown code "${scan.unknown}". Only ${KNOWN_TOKEN_LIST} are known.`,
          // No braces: the wording filler would read "{QQ}" as a placeholder and drop it.
          { params: { token: scan.unknown.replace(/[{}]/g, ' ').trim() } },
        ),
      );
    }
  }
  const yy = shortAccYear(f.accYear);
  const fyc = compactAccYear(f.accYear);
  for (const [token, value] of [
    ['YY', yy],
    ['FYC', fyc],
  ] as const) {
    if (tokensOk && names.has(token) && value === null) {
      tokensOk = false;
      errors.push(
        issue(
          SequenceErrorCode.FORMAT_TOKEN_UNKNOWN,
          'vchrNoPrefix',
          `{${token}} needs an accounting year shaped NNNN-NNNN, not "${f.accYear}".`,
          { params: { token } },
        ),
      );
    }
  }
  // GST16 and the charset: outward types (Voucher Types §5.2) and GST document
  // types (challan plan decision 32). VT_BR_REQUIRED stays outward-only.
  const gstLimited = f.gstOutward || f.gstDocNo === true;
  const deviceCode = f.deviceCode?.trim() || null;
  if (d.mode !== VoucherNumberingMode.AUTO) {
    errors.push(
      issue(
        VoucherTypeErrorCode.METHOD_GST_AUTO_ONLY,
        'vchrNumberingMode',
        f.gstOutward
          ? 'A GST invoice or note must be numbered automatically.'
          : `Method ${d.mode} needs a number box on the document's screen; none has one yet (Automatic only).`,
        f.gstOutward ? {} : { rule: 'NO_NUMBER_BOX' },
      ),
    );
  }

  const usesBr = formatHasBranchToken(d.prefix, d.suffix);
  const usesDv = formatHasDeviceToken(d.prefix, d.suffix);
  const sampleAt = (
    branchCode: string | null,
  ): { prefix: string; suffix: string; first: string } | null => {
    if (!tokensOk) {
      return null;
    }
    const values = {
      FY: f.accYear,
      YY: yy ?? '',
      FYC: fyc ?? '',
      BR: branchCode ?? '{BR}',
      DV: deviceCode ?? '{DV}',
    };
    const prefix = fillVoucherFormatTokens(d.prefix, values) ?? '';
    const suffix = fillVoucherFormatTokens(d.suffix, values) ?? '';
    const first = firstVoucherNumber(
      { prefix, suffix, noWidth: widthOk ? d.width : 1 },
      startOk ? d.startNo : 1,
    );
    return { prefix, suffix, first };
  };

  // The longest first number over the branches the type numbers at. A {BR}
  // format is judged per branch (a branch with no code is refused at its
  // counter with SEQUENCE_BRANCH_CODE_MISSING, not here); any other has one shape.
  // A {DV} format is judged with the longest live device code; with no live
  // device it is not judged here (each device's counter is, as it opens).
  const codes =
    usesDv && deviceCode === null
      ? []
      : usesBr
        ? [...new Set(f.branches.map((b) => b.numberCode).filter((c): c is string => !!c))]
        : [null];
  const samples = codes
    .map((c) => sampleAt(c))
    .filter((s): s is NonNullable<typeof s> => s !== null);
  const longest = samples.reduce<(typeof samples)[number] | null>(
    (a, s) => (a === null || s.first.length > a.first.length ? s : a),
    null,
  );
  if (longest) {
    if (
      longest.prefix.length > SEQ_VOUCHER_PREFIX_MAX_LENGTH ||
      longest.suffix.length > SEQ_VOUCHER_SUFFIX_MAX_LENGTH ||
      longest.first.length > POSTED_REFNO_MAX_LENGTH
    ) {
      errors.push(
        issue(
          SequenceErrorCode.REFNO_TOO_LONG,
          'vchrNoPrefix',
          `Documents would be numbered like "${longest.first}" (${longest.first.length} characters); a document number may have at most ${POSTED_REFNO_MAX_LENGTH}.`,
        ),
      );
    } else if (longest.first.length > GST_DOC_NO_MAX_LENGTH) {
      const params = { sample: longest.first, len: String(longest.first.length) };
      if (gstLimited) {
        // A GST document type that is not an invoice (the challan, its return)
        // takes the challan-worded variant rule=GST_DOC_NO (user 11-16).
        const docNo = f.gstDocNo === true && !f.gstOutward;
        errors.push(
          issue(
            VoucherTypeErrorCode.NO_TOO_LONG,
            'vchrNoPrefix',
            `${longest.first} has ${longest.first.length} characters; a GST ${docNo ? 'document' : 'invoice'} number may have ${GST_DOC_NO_MAX_LENGTH} at most.`,
            docNo ? { params, rule: VT_NO_TOO_LONG_DOC_RULE } : { params },
          ),
        );
      } else {
        warnings.push(
          issue(
            VoucherTypeWarningCode.NO_OVER_16,
            'vchrNoPrefix',
            `${longest.first} has ${longest.first.length} characters: fine for this type, not for a GST invoice.`,
            { params },
          ),
        );
      }
    }
  }
  if (gstLimited) {
    const bare = [d.prefix, d.suffix].map((t) => (t ?? '').replace(KNOWN_TOKEN_TEXT, '')).join('');
    // An unknown token is already refused above; its braces are not "characters".
    if (tokensOk && !GST_DOC_NO_CHARS.test(bare)) {
      errors.push(
        issue(
          VoucherTypeErrorCode.NO_BAD_CHAR,
          'vchrNoPrefix',
          'A GST invoice number may have only letters, digits, / and -.',
        ),
      );
    }
  }
  if (f.gstOutward) {
    if (!usesBr) {
      const shared = sharedGstin(f.branches);
      if (shared) {
        errors.push(
          issue(
            VoucherTypeErrorCode.BR_REQUIRED,
            'vchrNoPrefix',
            `${shared.count} active branches share GSTIN ${shared.gstin}; each needs its own numbers: put {BR} in the prefix.`,
            { params: { gstin: shared.gstin, branches: String(shared.count) } },
          ),
        );
      }
    }
  }
  const key = seriesKey(d.prefix, d.suffix);
  const clash = f.series.find(
    (s) => s.vchrTypeId !== f.vchrTypeId && seriesKey(s.prefix, s.suffix) === key,
  );
  if (clash) {
    const printed = [d.prefix, d.suffix].filter((t) => !!t?.trim()).join(' … ');
    errors.push(
      issue(
        VoucherTypeErrorCode.PREFIX_TAKEN,
        'vchrNoPrefix',
        `${clash.vchrTypeName} already prints "${printed}" in this company.`,
        { params: { other: clash.vchrTypeName, prefix: printed } },
      ),
    );
  }

  const shown = sampleAt(usesBr ? (f.previewBranch?.numberCode ?? null) : null);
  return {
    errors,
    warnings,
    preview: {
      sample: shown?.first ?? null,
      length: shown?.first.length ?? null,
      branchCode: f.previewBranch?.numberCode ?? null,
      branchName: f.previewBranch?.branchName ?? null,
      accYear: f.accYear,
      gstLimit: gstLimited ? GST_DOC_NO_MAX_LENGTH : null,
      clashWith: clash?.vchrTypeName ?? null,
      deviceCode,
    },
  };
}

/** The first GSTIN two or more of the branches share (per company), or null. */
export function sharedGstin(
  branches: readonly BranchFact[],
): { gstin: string; count: number } | null {
  const counts = new Map<string, number>();
  for (const b of branches) {
    if (!b.gstin) {
      continue;
    }
    const k = `${b.companyId}|${b.gstin.toUpperCase()}`;
    counts.set(k, (counts.get(k) ?? 0) + 1);
  }
  for (const [k, count] of counts) {
    if (count >= 2) {
      return { gstin: k.split('|')[1], count };
    }
  }
  return null;
}

// ── identity of a child (§7.2 item 2) ──────────────────────────────────────

export interface NamedRow {
  vchrTypeId: number;
  vchrTypeName: string;
  vchrTypeShort: string | null;
}

/**
 * Name and abbreviation of a child: required, the abbreviation 1–6 letters or
 * digits, both unique (any case) among the other rows the company sees — its own
 * children and the bases.
 */
export function checkChildIdentity(
  draft: { name: string; abbr: string },
  others: readonly NamedRow[],
  selfId: number | null,
): VtIssue[] {
  const errors: VtIssue[] = [];
  const name = draft.name.trim();
  const abbr = draft.abbr.trim();
  const rest = others.filter((o) => o.vchrTypeId !== selfId);
  if (!name) {
    errors.push(
      issue(VoucherTypeErrorCode.NAME_REQUIRED, 'vchrTypeName', 'A voucher type needs a name.'),
    );
  } else {
    const clash = rest.find((o) => o.vchrTypeName.trim().toLowerCase() === name.toLowerCase());
    if (clash) {
      errors.push(
        issue(
          VoucherTypeErrorCode.NAME_TAKEN,
          'vchrTypeName',
          `Voucher type ${clash.vchrTypeId} is already named "${clash.vchrTypeName}".`,
          { params: { name: clash.vchrTypeName } },
        ),
      );
    }
  }
  if (!abbr) {
    errors.push(
      issue(
        VoucherTypeErrorCode.ABBR_REQUIRED,
        'vchrTypeShort',
        'A child type needs an abbreviation.',
      ),
    );
  } else if (!ABBR_PATTERN.test(abbr)) {
    errors.push(
      issue(
        VoucherTypeErrorCode.ABBR_INVALID,
        'vchrTypeShort',
        `"${abbr}" is not 1 to 6 letters or digits.`,
      ),
    );
  } else {
    const clash = rest.find(
      (o) => (o.vchrTypeShort ?? '').trim().toUpperCase() === abbr.toUpperCase(),
    );
    if (clash) {
      errors.push(
        issue(
          VoucherTypeErrorCode.ABBR_TAKEN,
          'vchrTypeShort',
          `${clash.vchrTypeName} already uses the abbreviation ${clash.vchrTypeShort}.`,
          { params: { other: clash.vchrTypeName } },
        ),
      );
    }
  }
  return errors;
}

// ── a base row (§7.2 item 3) and a screen-numbered row (Q26) ────────────────

/** The fields a base type keeps as the app set them (Q17; Active per OP-2). */
export const BASE_LOCKED_FIELDS = [
  'vchrTypeName',
  'vchrTypeShort',
  'vchrParentId',
  'vchrIsActive',
  'vchrTallyVoucherTypeName',
] as const satisfies ReadonlyArray<keyof AccVoucherType>;

/** The numbering a "numbered by its screen" row keeps (B2). */
export const NUMBERING_FIELDS = [
  'vchrNumberingMode',
  'vchrNoPrefix',
  'vchrNoSuffix',
  'vchrNoWidth',
  'vchrResetFreq',
  'vchrStartNo',
] as const satisfies ReadonlyArray<keyof AccVoucherType>;

/** Equal as stored: strings trimmed, and '' is null (the DTO turns '' into null; some rows hold ''). */
export const sameValue = (a: unknown, b: unknown): boolean => {
  const norm = (v: unknown) => (typeof v === 'string' ? v.trim() || null : (v ?? null));
  return norm(a) === norm(b);
};

/** One VT_BASE_FIELD_LOCKED per field the draft sends with a value other than the stored one. */
export function lockedFieldChanges(
  stored: Pick<
    AccVoucherType,
    (typeof BASE_LOCKED_FIELDS)[number] | (typeof NUMBERING_FIELDS)[number]
  >,
  draft: Partial<
    Record<(typeof BASE_LOCKED_FIELDS)[number] | (typeof NUMBERING_FIELDS)[number], unknown>
  >,
  fields: ReadonlyArray<(typeof BASE_LOCKED_FIELDS)[number] | (typeof NUMBERING_FIELDS)[number]>,
  why: string,
): VtIssue[] {
  return fields
    .filter((k) => draft[k] !== undefined && !sameValue(draft[k], stored[k]))
    .map((k) => issue(VoucherTypeErrorCode.BASE_FIELD_LOCKED, k, `${k} ${why}`));
}

// ── delivery mode (delivery tracking plan §8.4 item 11, Q3) ──────────────────

/** acc_voucher_types.vchr_delivery_mode (ck_vchr_delivery_mode): NULL or one of these. */
export const VT_DELIVERY_MODES = ['INSTANT', 'PICKUP', 'DISPATCH'] as const;
export type VtDeliveryMode = (typeof VT_DELIVERY_MODES)[number];

/** The mode a Sales Bill type falls back to when neither it nor its base names one. */
export const VT_DEFAULT_DELIVERY_MODE: VtDeliveryMode = 'INSTANT';

/**
 * Only Sales Bill and its children carry a delivery mode (Q3): the base row
 * itself (code Bil) or a row whose base is it.
 */
export function hasDeliveryMode(
  row: Pick<AccVoucherType, 'vchrTypeCode' | 'vchrParentId'> | null,
  base: Pick<AccVoucherType, 'vchrTypeCode'> | null,
): boolean {
  if (!row) {
    return false;
  }
  if (row.vchrParentId == null) {
    return row.vchrTypeCode === SALES_BILL_TYPE_CODE;
  }
  return base?.vchrTypeCode === SALES_BILL_TYPE_CODE;
}

/**
 * What a bill of the type defaults to (child → base → INSTANT); null for a type
 * that has no delivery mode.
 */
export function effectiveDeliveryMode(
  own: string | null | undefined,
  baseMode: string | null | undefined,
  applies: boolean,
): VtDeliveryMode | null {
  if (!applies) {
    return null;
  }
  const pick = (own ?? '').trim() || (baseMode ?? '').trim();
  return (VT_DELIVERY_MODES as readonly string[]).includes(pick)
    ? (pick as VtDeliveryMode)
    : VT_DEFAULT_DELIVERY_MODE;
}

/**
 * The save rules of the delivery mode (plan §8.4 item 11):
 *
 *  - VT_DELIVERY_MODE_NOT_ALLOWED: a type that is not Sales Bill nor one of its
 *    children is sent a mode;
 *  - VT_DELIVERY_MODE_REQUIRED: a Sales Bill type (the base or a child) is sent
 *    null / '' — the mode cannot be cleared once the screen sends the key.
 *
 * A key left out keeps the stored value. A child that has never been saved with
 * a mode keeps NULL, which means "the base's" (plan §7.5 item 2), so an edit
 * from a screen that does not send the key yet is not refused.
 *
 * `sent` is the DTO value: undefined = left out, null = cleared.
 */
export function checkDeliveryMode(
  sent: string | null | undefined,
  resolved: string | null,
  ctx: { applies: boolean; isBase?: boolean },
): VtIssue[] {
  if (!ctx.applies) {
    return sent !== undefined && sent !== null
      ? [
          issue(
            VoucherTypeErrorCode.DELIVERY_MODE_NOT_ALLOWED,
            'vchrDeliveryMode',
            'Only Sales Bill types have a delivery mode.',
          ),
        ]
      : [];
  }
  void resolved;
  if (sent === null) {
    return [
      issue(
        VoucherTypeErrorCode.DELIVERY_MODE_REQUIRED,
        'vchrDeliveryMode',
        'A Sales Bill type needs a delivery mode: Instant, Pickup or Dispatch.',
      ),
    ];
  }
  return [];
}
