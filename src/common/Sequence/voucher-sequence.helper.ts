import { throwBadRequest, throwNotFound, throwUnprocessable } from '../utils/module-shared.utils';
import { BRANCH_NUMBER_CODE_PATTERN, branchNumberCode } from './branch-number-code.helper';
import type { SequenceErrorDetail } from './types/sequence-api.types';
import { SequenceErrorCode } from './types/sequence-error-codes';
import {
  AccVoucherSeq,
  AccVoucherType,
  Prisma,
  VoucherNumberingMode,
  VoucherResetFreq,
} from '@prisma/client';
// Held for the life of the transaction so the find-or-create below cannot race a
// concurrent first allocation on the same scope (the unique constraint would
// otherwise turn a simultaneous first save into a 500).
const VOUCHER_SEQ_LOCK_NAMESPACE = 'accounts.acc_voucher_seq.allocate';
// Guards the company-wide voucher serial. avh_voucher_slno is unique per
// (company, acc_year) across EVERY voucher type (ux_avh_voucher_slno), so two
// concurrent posts of different document types would otherwise pick the same
// number and one of them would 500 on the unique index.
const VOUCHER_SLNO_LOCK_NAMESPACE = 'accounts.acc_voucher_header.voucher_slno';
const DEFAULT_DEVICE_CODE = 'MAIN';
// Period key used by voucher types that never reset their counter.
const NO_RESET_PERIOD_KEY = 'ALL';
// acc_voucher_seq.seq_last_refno / most document refno columns are VarChar(100).
const REFNO_MAX_LENGTH = 100;
// avh_voucher_refno / abl_voucher_refno are VarChar(50): a {FY} / {BR} format must
// build a number that fits them (branch serial plan §5.2).
const POSTED_REFNO_MAX_LENGTH = 50;
// The counter row's format snapshot columns: seq_voucher_prefix VarChar(60)
// (migration 20261104100000), seq_voucher_suffix VarChar(20).
export const SEQ_VOUCHER_PREFIX_MAX_LENGTH = 60;
export const SEQ_VOUCHER_SUFFIX_MAX_LENGTH = 20;
// The tokens a voucher-type prefix / suffix may hold (plan §5.2). Nothing else is
// expanded: an unknown `{…}` is refused, never printed raw.
const FORMAT_TOKEN = /\{([^{}]*)\}/g;
// Voucher Types plan §5.2 / §7.3 (2026-11-14): {YY} = the two-digit years of the
// accounting year ('2026-2027' → '26-27'), for numbers that must stay within the
// GST 16-character limit.
export const KNOWN_FORMAT_TOKENS = ['FY', 'YY', 'BR'] as const;
export type FormatToken = (typeof KNOWN_FORMAT_TOKENS)[number];
const ACC_YEAR_SHAPE = /^(\d{4})-(\d{4})$/;
/**
 * GST (CGST Rules r.46(b)): an outward invoice / note number has at most 16
 * characters. Checked at counter creation for every GST outward type (Voucher
 * Types plan decision 35) and at the type's save in the master.
 */
export const GST_DOC_NO_MAX_LENGTH = 16;
/** vchr_gst_side of a type (or a child's mirror) whose documents go on GSTR-1. */
export const GST_OUTWARD_SIDE = 'OUTPUT';
type VoucherTypeFormat = Pick<
  AccVoucherType,
  'vchrTypeId' | 'vchrNoPrefix' | 'vchrNoSuffix' | 'vchrNoWidth' | 'vchrResetFreq'
> &
  // Optional so a caller (or a test double) that predates the Voucher Types
  // master still reads: start 1, Method AUTO, no GST rule, a base type.
  Partial<
    Pick<AccVoucherType, 'vchrStartNo' | 'vchrNumberingMode' | 'vchrGstSide' | 'vchrParentId'>
  >;
export interface VoucherNumberScope {
  vchrTypeId: number;
  companyId: string;
  branchId: string;
  accYear: string;
  // The counter is kept per device/counter inside the scope; callers that do not
  // number per device leave this alone and share the default 'MAIN' counter.
  deviceCode?: string | null;
  // Drives the reset period key for DAILY / MONTHLY voucher types. Pass the date
  // the document is dated on, not the save time; defaults to now.
  documentDate?: Date | null;
  /**
   * Voucher Types plan §7.3 (Method, Q18): the number the user typed, for a type
   * numbered MANUAL (required) or AUTO_MANUAL (used when given). An AUTO type
   * ignores it and draws from the counter. No document sends one yet (decision
   * 42: no screen has a number box); duplicate checks of a typed number stay with
   * the document that gets the box.
   */
  typedRefno?: string | null;
}
export interface AllocatedVoucherNumber {
  // The consumed running number — acc_voucher_seq.seq_last_no after the increment.
  // 0 for a typed number (`typed: true`): the counter was not touched.
  lastNo: bigint;
  // voucherPrefix + zero-padded lastNo + voucherSuffix, also written back to
  // acc_voucher_seq.seq_last_refno. A typed number as typed (trimmed).
  refno: string;
  // The reset bucket the number was drawn from, resolved from the voucher type.
  periodKey: string;
  /** Present (true) only when the number is the typed one (MANUAL / AUTO_MANUAL). */
  typed?: true;
}
// The columns of a voucher type the allocator reads.
const VOUCHER_TYPE_FORMAT_SELECT = {
  vchrTypeId: true,
  vchrNoPrefix: true,
  vchrNoSuffix: true,
  vchrNoWidth: true,
  vchrResetFreq: true,
  vchrStartNo: true,
  vchrNumberingMode: true,
  vchrGstSide: true,
  vchrParentId: true,
} as const;
// The typed number to use, or null to draw from the counter (plan §7.3):
//   AUTO        → null (a typed number is ignored and not consumed);
//   MANUAL      → the typed number, required (422 SEQUENCE_NUMBER_REQUIRED);
//   AUTO_MANUAL → the typed number when given, else null.
function typedNumberFor(
  voucherType: VoucherTypeFormat,
  typedRefno: string | null | undefined,
): string | null {
  const mode = voucherType.vchrNumberingMode ?? VoucherNumberingMode.AUTO;
  if (mode === VoucherNumberingMode.AUTO) {
    return null;
  }
  const typed = typedRefno?.trim() || null;
  if (typed === null) {
    if (mode === VoucherNumberingMode.AUTO_MANUAL) {
      return null;
    }
    const message = `Voucher type ${voucherType.vchrTypeId} is numbered by hand; the document number is required.`;
    throwUnprocessable<SequenceErrorDetail>(message, [
      { field: 'typedRefno', code: SequenceErrorCode.NUMBER_REQUIRED, message },
    ]);
  }
  if (typed.length > POSTED_REFNO_MAX_LENGTH) {
    const message = `The typed number "${typed}" has ${typed.length} characters; a document number may have at most ${POSTED_REFNO_MAX_LENGTH}.`;
    throwBadRequest<SequenceErrorDetail>(message, [
      { field: 'typedRefno', code: SequenceErrorCode.REFNO_TOO_LONG, message },
    ]);
  }
  return typed;
}
// Consumes the next number for `scope` from accounts.acc_voucher_seq and returns
// it together with the printable reference number. The sequence row is created
// on first use, seeded from the voucher type's numbering format.
//
// Must be called with a transaction client: the advisory lock and the increment
// only stay consistent while the caller's transaction is open, so the document
// insert has to commit alongside the number it consumed.
export async function allocateVoucherNumber(
  tx: Prisma.TransactionClient,
  scope: VoucherNumberScope,
): Promise<AllocatedVoucherNumber> {
  const vchrTypeId = scope.vchrTypeId;
  if (!Number.isInteger(vchrTypeId) || vchrTypeId <= 0) {
    throwBadRequest<SequenceErrorDetail>('vchrTypeId must be a positive integer.', [
      {
        field: 'vchrTypeId',
        code: SequenceErrorCode.FIELD_NOT_INTEGER,
        message: 'vchrTypeId must be a positive integer.',
      },
    ]);
  }
  const companyId = requireText(scope.companyId, 'companyId');
  const branchId = requireText(scope.branchId, 'branchId');
  const accYear = requireText(scope.accYear, 'accYear');
  const deviceCode = scope.deviceCode?.trim() || DEFAULT_DEVICE_CODE;
  const voucherType = await tx.accVoucherType.findFirst({
    where: {
      vchrTypeId,
    },
    select: VOUCHER_TYPE_FORMAT_SELECT,
  });
  if (!voucherType) {
    throwNotFound<SequenceErrorDetail>(
      `Voucher type ${vchrTypeId} was not found.`,
      'vchrTypeId',
      `Voucher type ${vchrTypeId} was not found.`,
      SequenceErrorCode.VOUCHER_TYPE_NOT_FOUND,
    );
  }
  const periodKey = buildPeriodKey(voucherType.vchrResetFreq, accYear, scope.documentDate);
  // Method (Q18, plan §7.3). Read before any lock: a typed number never touches
  // the counter, so it takes neither the scope lock nor a counter row.
  const typed = typedNumberFor(voucherType, scope.typedRefno);
  if (typed !== null) {
    return { lastNo: BigInt(0), refno: typed, periodKey, typed: true };
  }
  const resolvedScope = {
    vchrTypeId,
    companyId,
    branchId,
    accYear,
    deviceCode,
    periodKey,
  };
  await acquireVoucherScopeLock(tx, resolvedScope);
  const sequence = await findOrCreateSequence(tx, resolvedScope, voucherType);
  // Relative increment rather than a read-then-write of a value we already read:
  // the row lock it takes keeps the counter correct even against the admin CRUD
  // path, which guards a different advisory lock.
  const consumed = await tx.accVoucherSeq.update({
    where: {
      id: sequence.id,
    },
    data: {
      lastNo: {
        increment: 1,
      },
    },
  });
  const refno = buildRefno(consumed);
  await tx.accVoucherSeq.update({
    where: {
      id: sequence.id,
    },
    data: {
      lastRefno: refno,
      modifiedOn: new Date(),
    },
  });
  return {
    lastNo: consumed.lastNo,
    refno,
    periodKey,
  };
}
/**
 * The number the next draw for `scope` would print, WITHOUT drawing it: no lock,
 * no counter row, no write. For pick lists (/bills/voucher-type-choices `nextRefno`).
 * `refno` is null (and `code` says why) when the type is numbered by hand or the
 * counter could not open (an unknown token, a branch with no code, a GST16 or
 * {BR} refusal) — the save would answer that refusal itself.
 */
export async function previewNextVoucherNumber(
  client: Prisma.TransactionClient,
  scope: VoucherNumberScope,
): Promise<{ refno: string | null; code: string | null }> {
  const voucherType = await client.accVoucherType.findFirst({
    where: { vchrTypeId: scope.vchrTypeId },
    select: VOUCHER_TYPE_FORMAT_SELECT,
  });
  if (!voucherType) {
    return { refno: null, code: SequenceErrorCode.VOUCHER_TYPE_NOT_FOUND };
  }
  if (
    (voucherType.vchrNumberingMode ?? VoucherNumberingMode.AUTO) === VoucherNumberingMode.MANUAL
  ) {
    return { refno: null, code: SequenceErrorCode.NUMBER_REQUIRED };
  }
  const periodKey = buildPeriodKey(voucherType.vchrResetFreq, scope.accYear, scope.documentDate);
  const existing = await client.accVoucherSeq.findFirst({
    where: {
      vchrTypeId: scope.vchrTypeId,
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      deviceCode: scope.deviceCode?.trim() || DEFAULT_DEVICE_CODE,
      periodKey,
    },
  });
  try {
    if (existing) {
      if (existing.isDeleted || !existing.isActive) {
        return { refno: null, code: SequenceErrorCode.INACTIVE };
      }
      return {
        refno: buildRefno({ ...existing, lastNo: existing.lastNo + BigInt(1) }),
        code: null,
      };
    }
    const format = await expandVoucherFormat(client, scope, {
      prefix: voucherType.vchrNoPrefix,
      suffix: voucherType.vchrNoSuffix,
      noWidth: voucherType.vchrNoWidth,
    });
    const startNo = voucherStartNo(voucherType);
    await assertCounterRules(client, scope, voucherType, format, startNo);
    return { refno: firstVoucherNumber(format, startNo), code: null };
  } catch (error: unknown) {
    const code = refusalCodeOf(error);
    if (code === null) {
      throw error;
    }
    return { refno: null, code };
  }
}
/** The first `errors[].code` of a house refusal, or null for anything else. */
function refusalCodeOf(error: unknown): string | null {
  const response =
    error && typeof (error as { getResponse?: unknown }).getResponse === 'function'
      ? (error as { getResponse: () => unknown }).getResponse()
      : null;
  const errors = (response as { errors?: Array<{ code?: unknown }> } | null)?.errors;
  const code = Array.isArray(errors) ? errors[0]?.code : undefined;
  return typeof code === 'string' ? code : null;
}
// Next company-wide voucher serial (acc_voucher_header.avh_voucher_slno) for the
// financial year. Taken under an advisory lock held for the rest of the
// transaction, mirroring allocateVoucherNumber's approach to acc_voucher_seq.
//
// Separate from allocateVoucherNumber because the two count different things:
// avh_voucher_no runs per voucher TYPE (and is the number printed on the
// document), while this one runs across every type in the company / year.
export async function allocateVoucherSlno(
  tx: Prisma.TransactionClient,
  companyId: string,
  accYear: string,
): Promise<bigint> {
  const lockKey = [companyId, accYear].join('|');
  await tx.$queryRaw`
    -- The lock sits in the select list: an unreferenced CTE is never run,
    -- so the old WITH advisory_lock AS (...) form took no lock at all.
    SELECT count(pg_advisory_xact_lock(
             hashtext(${VOUCHER_SLNO_LOCK_NAMESPACE}),
             hashtext(${lockKey})
           ))::int AS locked
  `;
  const rows = await tx.$queryRaw<Array<{ next_slno: bigint }>>`
    SELECT COALESCE(MAX(avh_voucher_slno), 0) + 1 AS next_slno
    FROM accounts.acc_voucher_header
    WHERE avh_company_id = ${companyId}::uuid
      AND avh_acc_year = ${accYear}
  `;
  return rows[0]?.next_slno ?? BigInt(1);
}
// prefix + zero-padded number + suffix. The company / branch codes on the row are
// a format snapshot only; the company and branch are already part of the scope
// the counter runs in, so repeating them in the printed number adds nothing.
export function buildRefno(sequence: AccVoucherSeq): string {
  const prefix = sequence.voucherPrefix?.trim() ?? '';
  const suffix = sequence.voucherSuffix?.trim() ?? '';
  const digits = sequence.lastNo.toString();
  // A counter that outgrows its configured width keeps counting rather than
  // truncating to a number that has already been issued.
  const width = Math.max(sequence.noWidth, digits.length);
  const refno = `${prefix}${digits.padStart(width, '0')}${suffix}`;
  if (refno.length > REFNO_MAX_LENGTH) {
    const message = `Generated reference number "${refno}" exceeds ${REFNO_MAX_LENGTH} characters. Shorten the prefix, suffix, or number width on voucher type ${sequence.vchrTypeId}.`;
    throwBadRequest<SequenceErrorDetail>(message, [
      { field: 'vchrTypeId', code: SequenceErrorCode.REFNO_TOO_LONG, message },
    ]);
  }
  return refno;
}
export interface VoucherFormat {
  prefix: string | null;
  suffix: string | null;
  noWidth: number;
}
export interface VoucherFormatScope {
  vchrTypeId: number;
  branchId: string;
  accYear: string;
}
// Branch serial plan §5.2 / §5.5 (approved 2026-11-04): the tokens a voucher
// type's prefix / suffix may hold, expanded only when a counter row is CREATED.
// The row's seq_voucher_prefix / _suffix is the year's frozen format snapshot;
// buildRefno just prints it.
//   {FY} = the accounting year as stored ('2026-2027').
//   {YY} = its two-digit years ('26-27'; Voucher Types plan §7.3). An accYear
//          not shaped NNNN-NNNN is refused as SEQUENCE_FORMAT_TOKEN_UNKNOWN
//          with params.token 'YY'.
//   {BR} = the branch's number code (branch-number-code.helper.ts), which must
//          match ^[A-Z0-9-]{1,10}$.
// A format with no '{' comes back as it is, without a query: every counter in
// use today keeps its exact behaviour. Refuses (nothing is written) an unknown
// token or stray brace, a branch with no usable code, and a format whose first
// number would be over 50 characters or whose expansion overflows its column.
export async function expandVoucherFormat(
  tx: Prisma.TransactionClient,
  scope: VoucherFormatScope,
  format: VoucherFormat,
): Promise<VoucherFormat> {
  if (!format.prefix?.includes('{') && !format.suffix?.includes('{')) {
    return format;
  }
  const tokens = [
    ...formatTokens(format.prefix, 'prefix', scope.vchrTypeId),
    ...formatTokens(format.suffix, 'suffix', scope.vchrTypeId),
  ];
  const values: Record<FormatToken, string> = {
    FY: scope.accYear,
    YY: tokens.includes('YY') ? requireShortAccYear(scope.accYear, scope.vchrTypeId) : '',
    BR: tokens.includes('BR') ? await requireBranchNumberCode(tx, scope.branchId) : '',
  };
  const expanded: VoucherFormat = {
    prefix: fillFormatTokens(format.prefix, values),
    suffix: fillFormatTokens(format.suffix, values),
    noWidth: format.noWidth,
  };
  assertFormatFits(expanded, scope.vchrTypeId);
  return expanded;
}
// The tokens `text` holds, refusing any it does not know — including a brace
// left over once every {…} is taken out ("PO{FY", "PO}{FY}").
function formatTokens(text: string | null, part: string, vchrTypeId: number): FormatToken[] {
  const { names, unknown } = scanFormatTokens(text);
  if (unknown !== undefined) {
    const message = `The number ${part} "${text}" of voucher type ${vchrTypeId} holds an unknown token "${unknown}". Only {FY}, {YY} and {BR} are expanded.`;
    throwUnprocessable<SequenceErrorDetail>(message, [
      {
        field: 'vchrTypeId',
        code: SequenceErrorCode.FORMAT_TOKEN_UNKNOWN,
        message,
        // No braces: the wording filler would read "{YY}" as a placeholder and drop it.
        params: { token: unknown.replace(/[{}]/g, ' ').trim() },
      },
    ]);
  }
  return names;
}
/**
 * The tokens a prefix / suffix holds, without throwing: `unknown` is the first
 * name that is not a known token, or the whole text when a stray brace is left
 * once every {…} is taken out ("PO{FY", "PO}{FY}"). Shared with the Voucher
 * Types master's live preview, which lists the refusal instead of throwing it.
 */
export function scanFormatTokens(text: string | null | undefined): {
  names: FormatToken[];
  unknown: string | undefined;
} {
  if (!text?.includes('{')) {
    return { names: [], unknown: undefined };
  }
  const names: string[] = [];
  const rest = text.replace(FORMAT_TOKEN, (_whole, name: string) => {
    names.push(name);
    return '';
  });
  const unknown =
    names.find((name) => !(KNOWN_FORMAT_TOKENS as readonly string[]).includes(name)) ??
    (/[{}]/.test(rest) ? text : undefined);
  return { names: names as FormatToken[], unknown };
}
/** '2026-2027' → '26-27'; null for an accYear not shaped NNNN-NNNN. */
export function shortAccYear(accYear: string): string | null {
  const m = ACC_YEAR_SHAPE.exec(accYear.trim());
  return m ? `${m[1].slice(2)}-${m[2].slice(2)}` : null;
}
function requireShortAccYear(accYear: string, vchrTypeId: number): string {
  const yy = shortAccYear(accYear);
  if (yy === null) {
    const message = `Voucher type ${vchrTypeId} prints {YY}, but the accounting year "${accYear}" is not shaped NNNN-NNNN.`;
    throwUnprocessable<SequenceErrorDetail>(message, [
      {
        field: 'vchrTypeId',
        code: SequenceErrorCode.FORMAT_TOKEN_UNKNOWN,
        message,
        params: { token: 'YY' },
      },
    ]);
  }
  return yy;
}
/**
 * Fills the known tokens of a prefix / suffix (pure: the caller supplies the
 * values). Text without '{' comes back as it is.
 */
export function fillVoucherFormatTokens(
  text: string | null,
  values: Record<FormatToken, string>,
): string | null {
  return fillFormatTokens(text, values);
}
async function requireBranchNumberCode(
  tx: Prisma.TransactionClient,
  branchId: string,
): Promise<string> {
  const code = await branchNumberCode(tx, branchId);
  if (!code) {
    const message = `Branch ${branchId} has neither a bill prefix nor a code to print in its document numbers.`;
    throwUnprocessable<SequenceErrorDetail>(message, [
      { field: 'branchId', code: SequenceErrorCode.BRANCH_CODE_MISSING, message },
    ]);
  }
  if (!BRANCH_NUMBER_CODE_PATTERN.test(code)) {
    const message = `Branch ${branchId} prints "${code}" in its document numbers; it may have only letters, digits and "-", up to 10.`;
    throwUnprocessable<SequenceErrorDetail>(message, [
      {
        field: 'branchId',
        code: SequenceErrorCode.BRANCH_CODE_INVALID,
        message,
        params: { branchCode: code },
      },
    ]);
  }
  return code;
}
function fillFormatTokens(text: string | null, values: Record<FormatToken, string>): string | null {
  if (!text?.includes('{')) {
    return text;
  }
  return text.replace(FORMAT_TOKEN, (_whole, name: FormatToken) => values[name]);
}
// The expanded snapshot must fit its columns, and the first number it builds
// (prefix + the counter at its width + suffix, as buildRefno prints it) must
// fit avh_voucher_refno / abl_voucher_refno.
function assertFormatFits(format: VoucherFormat, vchrTypeId: number): void {
  const prefix = format.prefix ?? '';
  const suffix = format.suffix ?? '';
  const first = `${prefix.trim()}${'1'.padStart(Math.max(format.noWidth, 1), '0')}${suffix.trim()}`;
  let message: string | null = null;
  if (prefix.length > SEQ_VOUCHER_PREFIX_MAX_LENGTH) {
    message = `The number prefix of voucher type ${vchrTypeId} expands to "${prefix}", over ${SEQ_VOUCHER_PREFIX_MAX_LENGTH} characters.`;
  } else if (suffix.length > SEQ_VOUCHER_SUFFIX_MAX_LENGTH) {
    message = `The number suffix of voucher type ${vchrTypeId} expands to "${suffix}", over ${SEQ_VOUCHER_SUFFIX_MAX_LENGTH} characters.`;
  } else if (first.length > POSTED_REFNO_MAX_LENGTH) {
    message = `Voucher type ${vchrTypeId} would number documents like "${first}" (${first.length} characters); a document number may have at most ${POSTED_REFNO_MAX_LENGTH}.`;
  }
  if (message) {
    throwBadRequest<SequenceErrorDetail>(message, [
      { field: 'vchrTypeId', code: SequenceErrorCode.REFNO_TOO_LONG, message },
    ]);
  }
}
async function findOrCreateSequence(
  tx: Prisma.TransactionClient,
  scope: Required<Pick<VoucherNumberScope, 'vchrTypeId' | 'companyId' | 'branchId' | 'accYear'>> & {
    deviceCode: string;
    periodKey: string;
  },
  voucherType: VoucherTypeFormat,
): Promise<AccVoucherSeq> {
  const existing = await tx.accVoucherSeq.findFirst({
    where: {
      vchrTypeId: scope.vchrTypeId,
      companyId: scope.companyId,
      branchId: scope.branchId,
      accYear: scope.accYear,
      deviceCode: scope.deviceCode,
      periodKey: scope.periodKey,
    },
  });
  if (existing) {
    // isActive / isDeleted are deliberate admin switches — quietly reviving the
    // row would undo them, so the save fails with something actionable instead.
    if (existing.isDeleted || !existing.isActive) {
      const message = `Voucher sequence ${existing.id} for voucher type ${scope.vchrTypeId} is inactive. Reactivate it before creating documents in ${scope.accYear}.`;
      throwBadRequest<SequenceErrorDetail>(message, [
        { field: 'vchrTypeId', code: SequenceErrorCode.INACTIVE, message },
      ]);
    }
    return existing;
  }
  const [company, branch] = await Promise.all([
    tx.company.findFirst({
      where: {
        compId: scope.companyId,
        compIsDeleted: false,
      },
      select: {
        compCode: true,
      },
    }),
    tx.branchMaster.findFirst({
      where: {
        brId: scope.branchId,
        brCompId: scope.companyId,
        brIsDeleted: false,
      },
      select: {
        brCode: true,
      },
    }),
  ]);
  if (!company) {
    const message = `No active company found with id ${scope.companyId}.`;
    throwBadRequest<SequenceErrorDetail>(message, [
      { field: 'companyId', code: SequenceErrorCode.COMPANY_NOT_FOUND, message },
    ]);
  }
  if (!branch) {
    const message = `No active branch found with id ${scope.branchId} for company ${scope.companyId}.`;
    throwBadRequest<SequenceErrorDetail>(message, [
      { field: 'branchId', code: SequenceErrorCode.BRANCH_NOT_FOUND, message },
    ]);
  }
  // {FY} / {YY} / {BR} are expanded here, once, as the year's counter opens — never per draw.
  const format = await expandVoucherFormat(tx, scope, {
    prefix: voucherType.vchrNoPrefix,
    suffix: voucherType.vchrNoSuffix,
    noWidth: voucherType.vchrNoWidth,
  });
  const startNo = voucherStartNo(voucherType);
  await assertCounterRules(tx, scope, voucherType, format, startNo);
  return tx.accVoucherSeq.create({
    data: {
      ...scope,
      // Plan §7.3: the type's starting number is the first number drawn.
      lastNo: BigInt(startNo - 1),
      // Format snapshot: editing the voucher type (or the branch's Bill Prefix)
      // later never rewrites numbers already issued from this row.
      voucherPrefix: format.prefix,
      voucherSuffix: format.suffix,
      noWidth: voucherType.vchrNoWidth,
      companyCode: company.compCode,
      branchCode: branch.brCode,
    },
  });
}
/** The type's starting number (>= 1; ck_vchr_start_no), 1 when not read. */
export function voucherStartNo(voucherType: Partial<Pick<AccVoucherType, 'vchrStartNo'>>): number {
  const n = voucherType.vchrStartNo;
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 ? n : 1;
}
/** prefix + the starting number at its width + suffix, as buildRefno prints it. */
export function firstVoucherNumber(format: VoucherFormat, startNo = 1): string {
  const digits = String(Math.max(1, startNo));
  const width = Math.max(format.noWidth, 1, digits.length);
  return `${(format.prefix ?? '').trim()}${digits.padStart(width, '0')}${(format.suffix ?? '').trim()}`;
}
/** True when the raw (unexpanded) prefix or suffix prints the branch code. */
export function formatHasBranchToken(prefix: string | null, suffix: string | null): boolean {
  return [prefix, suffix].some((t) => scanFormatTokens(t).names.includes('BR'));
}
/**
 * Voucher Types plan decisions 35 and 40, run as a counter row is CREATED:
 *  - a GST outward type (vchr_gst_side OUTPUT, a child's mirror too) whose
 *    first number at this branch and year is over 16 characters is refused
 *    (422 SEQUENCE_REFNO_TOO_LONG with rule GST16): the branch or year was
 *    added after the type was saved;
 *  - a CHILD GST outward type with no {BR} is refused (422 VT_BR_REQUIRED) at a
 *    branch whose GSTIN another active branch of the company shares: the two
 *    branches would print the same numbers. Base types get this check only at
 *    their save in the master (decision 40: Acme's type 3 'bil' would refuse
 *    the next type-3 counter today).
 * Counters that already exist are never re-checked.
 */
/**
 * What assertCounterRules reads of a counter's type: its GST side and parent, and
 * the RAW (unexpanded) prefix / suffix the counter prints, to see a {BR}. The
 * allocator passes the voucher type itself; /sequences/create passes the type's
 * side and parent with the prefix / suffix the administrator typed.
 */
export type CounterRuleSubject = Pick<AccVoucherType, 'vchrNoPrefix' | 'vchrNoSuffix'> &
  Partial<Pick<AccVoucherType, 'vchrGstSide' | 'vchrParentId'>>;
export async function assertCounterRules(
  tx: Prisma.TransactionClient,
  scope: { vchrTypeId: number; companyId: string; branchId: string; accYear: string },
  voucherType: CounterRuleSubject,
  format: VoucherFormat,
  startNo: number,
): Promise<void> {
  if (voucherType.vchrGstSide !== GST_OUTWARD_SIDE) {
    return;
  }
  const first = firstVoucherNumber(format, startNo);
  if (first.length > GST_DOC_NO_MAX_LENGTH) {
    const message = `Voucher type ${scope.vchrTypeId} would number GST documents at this branch like "${first}" (${first.length} characters); a GST invoice number may have at most ${GST_DOC_NO_MAX_LENGTH}.`;
    throwUnprocessable<SequenceErrorDetail>(message, [
      {
        field: 'vchrTypeId',
        code: SequenceErrorCode.REFNO_TOO_LONG,
        message,
        // Picks the wording variant rule=GST16 (fixed.error_message).
        rule: 'GST16',
        params: { sample: first, len: String(first.length) },
      },
    ]);
  }
  if (
    voucherType.vchrParentId == null ||
    formatHasBranchToken(voucherType.vchrNoPrefix, voucherType.vchrNoSuffix)
  ) {
    return;
  }
  const [row] = await tx.$queryRaw<{ sharing: number }[]>`
    WITH me AS (
      SELECT COALESCE(NULLIF(btrim(b.br_gstin_no), ''), NULLIF(btrim(c.comp_gstin_no), '')) AS gstin
        FROM public.branch_master b
        JOIN public.companys c ON c.comp_id = b.br_comp_id
       WHERE b.br_id = ${scope.branchId}::uuid)
    SELECT count(*)::int AS sharing
      FROM public.branch_master b
      JOIN public.companys c ON c.comp_id = b.br_comp_id
      JOIN me ON me.gstin IS NOT NULL
     WHERE b.br_comp_id = ${scope.companyId}::uuid
       AND b.br_is_deleted = false
       AND b.br_is_active = true
       AND COALESCE(NULLIF(btrim(b.br_gstin_no), ''), NULLIF(btrim(c.comp_gstin_no), '')) = me.gstin`;
  if ((row?.sharing ?? 0) >= 2) {
    const message = `Voucher type ${scope.vchrTypeId} has no {BR} in its number, and ${row.sharing} active branches of this company share this branch's GSTIN: their numbers would repeat.`;
    throwUnprocessable<SequenceErrorDetail>(message, [
      { field: 'vchrTypeId', code: SequenceErrorCode.BR_REQUIRED, message },
    ]);
  }
}
// The bucket the counter resets in: 'ALL' when it never resets, the accounting
// year when it resets yearly, otherwise the document's month or day.
function buildPeriodKey(
  resetFreq: VoucherResetFreq,
  accYear: string,
  documentDate: Date | null | undefined,
): string {
  const reference =
    documentDate && !Number.isNaN(documentDate.getTime()) ? documentDate : new Date();
  const year = String(reference.getUTCFullYear());
  const month = String(reference.getUTCMonth() + 1).padStart(2, '0');
  const day = String(reference.getUTCDate()).padStart(2, '0');
  switch (resetFreq) {
    case VoucherResetFreq.NEVER:
      return NO_RESET_PERIOD_KEY;
    case VoucherResetFreq.DAILY:
      return `${year}-${month}-${day}`;
    case VoucherResetFreq.MONTHLY:
      return `${year}-${month}`;
    case VoucherResetFreq.YEARLY:
    default:
      return accYear;
  }
}
/**
 * The counter scope's advisory lock, held for the rest of the transaction. The
 * allocator's find-or-create and /sequences/create both take it, so the two can
 * never open the same scope at once.
 */
export async function acquireVoucherScopeLock(
  tx: Prisma.TransactionClient,
  scope: {
    vchrTypeId: number;
    companyId: string;
    branchId: string;
    accYear: string;
    deviceCode: string;
    periodKey: string;
  },
): Promise<void> {
  const lockKey = [
    scope.vchrTypeId,
    scope.companyId,
    scope.branchId,
    scope.accYear,
    scope.deviceCode,
    scope.periodKey,
  ].join('|');
  await tx.$queryRaw<Array<{ locked: number }>>`
    -- The lock sits in the select list: an unreferenced CTE is never run,
    -- so the old WITH advisory_lock AS (...) form took no lock at all.
    SELECT count(pg_advisory_xact_lock(
             hashtext(${VOUCHER_SEQ_LOCK_NAMESPACE}),
             hashtext(${lockKey})
           ))::int AS locked
  `;
}
function requireText(value: string | null | undefined, fieldName: string): string {
  const trimmed = value?.trim();
  if (!trimmed) {
    throwBadRequest<SequenceErrorDetail>(`${fieldName} is required.`, [
      {
        field: fieldName,
        code: SequenceErrorCode.FIELD_EMPTY,
        message: `${fieldName} is required.`,
      },
    ]);
  }
  return trimmed;
}
