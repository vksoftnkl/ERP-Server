import { NotFoundException } from '@nestjs/common';
import {
  buildAccountsErrorResponse,
  throwAccountsBadRequest,
  throwAccountsConflict,
  throwAccountsForbidden,
  throwUnprocessable,
  type AccountsErrorDetail,
} from 'src/common/utils/module-service.utils';

/**
 * The Voucher Register's error codes (voucher_register.md §6) and the one
 * throw site per HTTP status, on the sales module's model: the message is for
 * the operator, `code` is what the Qt client switches on, so every string
 * below is an API contract.
 *
 *   400  malformed          — the request did not parse or names a bad key
 *   403  a right is missing — `user_menus` on the voucher TYPE's menu
 *   404  not found          — the voucher, the type, the party
 *   409  state              — POSTED where DRAFT was needed, a spent bill
 *   422  a rule refused it  — ALL of them in one body on /validate and /post
 */
export const VCH = {
  RIGHT_VIEW: 'VCH_RIGHT_VIEW',
  RIGHT_CREATE: 'VCH_RIGHT_CREATE',
  RIGHT_EDIT: 'VCH_RIGHT_EDIT',
  RIGHT_DELETE: 'VCH_RIGHT_DELETE',
  RIGHT_POST: 'VCH_RIGHT_POST',
  RIGHT_CANCEL: 'VCH_RIGHT_CANCEL',
  RIGHT_OVERRIDE: 'VCH_RIGHT_OVERRIDE',

  UNBALANCED: 'VCH_UNBALANCED',
  NO_LINES: 'VCH_NO_LINES',
  LINE_AMOUNT: 'VCH_LINE_AMOUNT',
  LEDGER_SIDE: 'VCH_LEDGER_SIDE',
  LEDGER_INACTIVE: 'VCH_LEDGER_INACTIVE',
  LEDGER_NOT_FOUND: 'VCH_LEDGER_NOT_FOUND',
  INSTRUMENT_LEDGER: 'VCH_INSTRUMENT_LEDGER',
  PARTY_MODE: 'VCH_PARTY_MODE',
  PARTY_NOT_FOUND: 'VCH_PARTY_NOT_FOUND',
  BILLWISE_SHORT: 'VCH_BILLWISE_SHORT',
  BILL_OVERSPENT: 'VCH_BILL_OVERSPENT',
  BILL_NOT_FOUND: 'VCH_BILL_NOT_FOUND',
  BILL_WRONG_PARTY: 'VCH_BILL_WRONG_PARTY',
  BILL_WRONG_SIDE: 'VCH_BILL_WRONG_SIDE',
  ALLOCATION_LINE: 'VCH_ALLOCATION_LINE',
  PERIOD_LOCKED: 'VCH_PERIOD_LOCKED',
  YEAR_CLOSED: 'VCH_YEAR_CLOSED',
  DATE_OUTSIDE_YEAR: 'VCH_DATE_OUTSIDE_YEAR',
  TYPE_NOT_REGISTER: 'VCH_TYPE_NOT_REGISTER',
  TYPE_INVENTORY: 'VCH_TYPE_INVENTORY',
  GST_RATE_MISSING: 'VCH_GST_RATE_MISSING',
  GST_LEDGER_UNMAPPED: 'VCH_GST_LEDGER_UNMAPPED',
  GST_LEDGER_TYPED: 'VCH_GST_LEDGER_TYPED',
  GST_NOT_ALLOWED: 'VCH_GST_NOT_ALLOWED',
  TDS_UNMAPPED: 'VCH_TDS_UNMAPPED',
  TDS_RATE_MISSING: 'VCH_TDS_RATE_MISSING',
  TDS_BELOW_THRESHOLD: 'VCH_TDS_BELOW_THRESHOLD',
  TDS_DEPOSITED: 'VCH_TDS_DEPOSITED',
  IRN_LIVE: 'VCH_IRN_LIVE',
  ALLOCATED_ELSEWHERE: 'VCH_ALLOCATED_ELSEWHERE',
  NOT_DRAFT: 'VCH_NOT_DRAFT',
  NOT_POSTED: 'VCH_NOT_POSTED',
  POSTED: 'VCH_POSTED',
  CANCELLED: 'VCH_CANCELLED',
  NOT_FOUND: 'VCH_NOT_FOUND',
  BACKDATED: 'VCH_BACKDATED',
  DUP_DOC_REFNO: 'VCH_DUP_DOC_REFNO',
  DOC_REFNO_REQUIRED: 'VCH_DOC_REFNO_REQUIRED',
  INVALID: 'VCH_INVALID',
} as const;

export type VoucherErrorCode = (typeof VCH)[keyof typeof VCH];

/** The house `{field, message}` widened with the code the screen switches on. */
export interface VoucherErrorDetail extends AccountsErrorDetail {
  /** A VoucherErrorCode, or a code another guard (the books check) raised. */
  code: string;
  /** The typed line the refusal is about (its `rowNo`), when it is about one. */
  line?: number;
}

export interface VoucherRefusal {
  code: string;
  message: string;
  field?: string;
  line?: number;
}

/** INFO is shown and never blocks; WARN may be overridden; REFUSE never may. */
export interface VoucherWarning extends VoucherRefusal {
  level: 'INFO' | 'WARN';
  overridable: boolean;
}

/**
 * What one derivation collects: every refusal and warning together, so the
 * operator fixes five problems in one visit rather than five.
 *
 * `dryRun` is `/validate`: nothing throws, an overridable WARN stays a WARN.
 * On `/post` a WARN passes only when the request asked to override it AND the
 * user holds `um_can_override` on the type's menu; otherwise it is a refusal.
 */
export interface VoucherGuardContext {
  dryRun: boolean;
  overrides: readonly string[];
  canOverride: boolean;
  refusals: VoucherRefusal[];
  warnings: VoucherWarning[];
}

export function newGuardContext(opts: {
  dryRun: boolean;
  overrides?: readonly string[] | null;
  canOverride: boolean;
}): VoucherGuardContext {
  return {
    dryRun: opts.dryRun,
    overrides: opts.overrides ?? [],
    canOverride: opts.canOverride,
    refusals: [],
    warnings: [],
  };
}

/** Record a refusal. Never throws by itself: the caller decides when to raise them. */
export function refuse(
  ctx: VoucherGuardContext,
  code: string,
  message: string,
  opts: { field?: string; line?: number } = {},
): void {
  ctx.refusals.push({ code, message, field: opts.field, line: opts.line });
}

/** Raise a WARN: overridden → INFO; on a dry run → WARN; else → a refusal. */
export function warn(
  ctx: VoucherGuardContext,
  code: string,
  message: string,
  opts: { field?: string; line?: number; overridable?: boolean } = {},
): void {
  const overridable = opts.overridable ?? true;
  const accepted = overridable && ctx.overrides.includes(code) && ctx.canOverride;
  ctx.warnings.push({
    code,
    level: accepted ? 'INFO' : 'WARN',
    message,
    field: opts.field,
    line: opts.line,
    overridable,
  });
  if (accepted || (overridable && ctx.dryRun)) {
    return;
  }
  refuse(ctx, code, message, opts);
}

/** 422 carrying every refusal collected, not just the first. */
export function throwRefusals(message: string, refusals: readonly VoucherRefusal[]): never {
  throwUnprocessable<VoucherErrorDetail>(
    message,
    refusals.map((r) => ({
      field: r.field ?? 'document',
      message: r.message,
      code: r.code,
      ...(r.line === undefined ? {} : { line: r.line }),
    })),
  );
}

/** 422 — one rule refused it. */
export function throwRefused(message: string, code: string, field = 'document'): never {
  throwUnprocessable<VoucherErrorDetail>(message, [{ field, message, code }]);
}

/** 403 — a `user_menus` flag on the type's menu is false. */
export function throwRight(message: string, code: string, field = 'userId'): never {
  throwAccountsForbidden<VoucherErrorDetail>(message, [{ field, message, code }]);
}

/** 409 — the row exists and the request is well formed; its STATE refuses. */
export function throwState(message: string, code: string, field = 'voucherId'): never {
  throwAccountsConflict<VoucherErrorDetail>(message, [{ field, message, code }]);
}

/** 404 — and a voucher scoped to another company is a 404, never a 403. */
export function throwMissing(message: string, code: string, field = 'voucherId'): never {
  throw new NotFoundException(
    buildAccountsErrorResponse<VoucherErrorDetail>(message, [{ field, message, code }]),
  );
}

/** 400 — the request itself is wrong. */
export function throwInvalid(message: string, code: string, field = 'document'): never {
  throwAccountsBadRequest<VoucherErrorDetail>(message, [{ field, message, code }]);
}
