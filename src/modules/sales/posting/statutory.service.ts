import { Injectable, Scope } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  AatoClass,
  CancelWindowKind,
  STATUTORY_CODES,
  StatutoryAppliesTo,
  StatutoryLimit,
} from './types/statutory.types';

/**
 * §3.6 — the law, per company, on a date.
 *
 * ── Why this is TypeScript and not a database function ──────────────────
 *
 * It is a read, so it is not dangerous the way a trigger is. But it is the ONE
 * piece of law the OFFLINE TILL must also apply, by itself, with no server in
 * reach: the cash limit under 269ST, the PAN / Form 60 threshold, the e-way
 * bill floor. The till has to answer those while disconnected, so the
 * resolution order has to exist in TypeScript no matter what — and a second
 * copy in plpgsql would be two implementations of one statute, drifting, with
 * the server silently overruling what the counter told the customer.
 *
 * ── The precedence IS the rule ──────────────────────────────────────────
 *
 * Keep the ORDER BY exactly as written:
 *   1  a company override beats the shipped pack
 *   2  a specific applies_to beats 'ALL'
 *   3  a turnover-class row beats an any-class row
 *   4  the latest window in force on that date
 *
 * ── No row means NOT APPLICABLE ─────────────────────────────────────────
 *
 * `limit()` returns null, and a guard must say so out loud rather than
 * defaulting to a number. A missing EWAY_VALUE_LIMIT does not mean zero.
 *
 * ── Cache per REQUEST, never per process ────────────────────────────────
 *
 * `stl_effective_from` means the answer changes with the DOCUMENT's date, not
 * with today's, and a company may edit its own override mid-session. The
 * service is REQUEST-scoped and the cache dies with the request.
 */
@Injectable({ scope: Scope.REQUEST })
export class StatutoryService {
  /** key: code|company|onDate|appliesTo|aatoClass */
  private readonly cache = new Map<string, StatutoryLimit | null>();

  constructor(private readonly prisma: PrismaService) {}

  /**
   * The single best row for this company, code and date, or null.
   *
   * `tx` is optional so a guard inside a post transaction reads the same
   * snapshot as the rows it is about to write.
   */
  async limit(
    companyId: string,
    code: string,
    onDate: string,
    appliesTo: StatutoryAppliesTo = 'ALL',
    aatoClass: AatoClass | null = null,
    tx?: Prisma.TransactionClient,
  ): Promise<StatutoryLimit | null> {
    const key = `${code}|${companyId}|${onDate}|${appliesTo}|${aatoClass ?? ''}`;
    if (this.cache.has(key)) {
      return this.cache.get(key) ?? null;
    }

    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<
      {
        stl_id: string;
        stl_code: string;
        stl_section: string | null;
        stl_label: string;
        stl_value_type: string;
        stl_value: Prisma.Decimal | null;
        stl_value_text: string | null;
        stl_enforce: string;
        stl_effective_from: Date;
        stl_effective_to: Date | null;
        stl_source_ref: string | null;
        is_company_override: boolean;
      }[]
    >`
      SELECT s.stl_id, s.stl_code, s.stl_section, s.stl_label, s.stl_value_type,
             s.stl_value, s.stl_value_text, s.stl_enforce,
             s.stl_effective_from, s.stl_effective_to, s.stl_source_ref,
             (s.stl_company_id IS NOT NULL) AS is_company_override
        FROM public.statutory_limits s
       WHERE s.stl_code = ${code}
         AND s.stl_is_deleted = false
         AND s.stl_is_active = true
         AND (s.stl_company_id IS NULL OR s.stl_company_id = ${companyId}::uuid)
         AND (s.stl_applies_to = 'ALL' OR s.stl_applies_to = ${appliesTo})
         AND (s.stl_aato_class IS NULL OR s.stl_aato_class = ${aatoClass})
         AND s.stl_effective_from <= ${onDate}::date
         AND (s.stl_effective_to IS NULL OR s.stl_effective_to >= ${onDate}::date)
       -- This precedence IS the rule. Do not reorder.
       ORDER BY (s.stl_company_id IS NOT NULL) DESC,
                (s.stl_applies_to <> 'ALL')    DESC,
                (s.stl_aato_class IS NOT NULL) DESC,
                s.stl_effective_from           DESC
       LIMIT 1`;

    const resolved = rows.length === 0 ? null : this.toLimit(rows[0]);
    this.cache.set(key, resolved);
    return resolved;
  }

  /** The company's turnover class, which several codes are keyed by. */
  async aatoClass(companyId: string, tx?: Prisma.TransactionClient): Promise<AatoClass | null> {
    const client = tx ?? this.prisma;
    const rows = await client.$queryRaw<{ comp_aato_class: string | null }[]>`
      SELECT comp_aato_class FROM public.companys WHERE comp_id = ${companyId}::uuid`;
    return (rows[0]?.comp_aato_class as AatoClass | undefined) ?? null;
  }

  // ── assert* helpers the guards call (§3.6) ─────────────────────────────
  //
  // Each RESOLVES and REPORTS. None of them throws: the guard layer decides
  // whether a WARN goes into ctx.warnings[] or becomes a refusal, because that
  // depends on dto.overrides[] and um_can_override, which are the guard's to
  // see — not this service's.

  /**
   * 269ST — cash received from one person in a day / per transaction / event.
   * `exceeded` is true when the cash tendered is AT OR ABOVE the limit: the
   * section bites at the limit, not above it.
   */
  async assertCashLimit(
    companyId: string,
    cashAmount: number,
    onDate: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ limit: StatutoryLimit | null; exceeded: boolean }> {
    const limit = await this.limit(
      companyId,
      STATUTORY_CODES.CASH_TXN_LIMIT_269ST,
      onDate,
      'ALL',
      null,
      tx,
    );
    if (!limit || limit.value === null) {
      return { limit, exceeded: false };
    }
    return { limit, exceeded: cashAmount >= limit.value };
  }

  /** Rule 114B — PAN (or Form 60) required on a cash sale above this. */
  async assertPanOrForm60(
    companyId: string,
    cashAmount: number,
    onDate: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ limit: StatutoryLimit | null; required: boolean }> {
    const limit = await this.limit(
      companyId,
      STATUTORY_CODES.PAN_REQUIRED_CASH_SALE,
      onDate,
      'ALL',
      null,
      tx,
    );
    if (!limit || limit.value === null) {
      return { limit, required: false };
    }
    return { limit, required: cashAmount > limit.value };
  }

  /**
   * Rule 138(1) — is an e-way bill required for this consignment?
   *
   * `appliesTo` carries the supply direction, and a STATE CODE outranks it:
   * Tamil Nadu's intra-state floor is 1,00,000 where the default is 50,000, and
   * the pack expresses that as a row with stl_applies_to = '33'. So the state
   * is tried first and the direction is the fallback.
   */
  async ewayApplicable(
    companyId: string,
    consignmentValue: number,
    onDate: string,
    opts: { interState: boolean; stateCode?: string | null },
    tx?: Prisma.TransactionClient,
  ): Promise<{ limit: StatutoryLimit | null; applicable: boolean }> {
    const direction: StatutoryAppliesTo = opts.interState ? 'INTER_STATE' : 'INTRA_STATE';

    // A state-specific row beats the direction default, but only for an
    // intra-state move — an inter-state consignment is the union's floor.
    let limit: StatutoryLimit | null = null;
    if (!opts.interState && opts.stateCode) {
      limit = await this.limit(
        companyId,
        STATUTORY_CODES.EWAY_VALUE_LIMIT,
        onDate,
        opts.stateCode,
        null,
        tx,
      );
    }
    if (!limit) {
      limit = await this.limit(
        companyId,
        STATUTORY_CODES.EWAY_VALUE_LIMIT,
        onDate,
        direction,
        null,
        tx,
      );
    }

    if (!limit || limit.value === null) {
      return { limit, applicable: false };
    }
    return { limit, applicable: consignmentValue > limit.value };
  }

  /**
   * Rule 48(4) — is e-invoicing mandatory for this company?
   *
   * Two things have to be true and they are different questions: the company
   * flag says whether it has been switched on, and the AATO threshold says
   * whether the law requires it. The caller gets both.
   */
  async einvoiceApplicable(
    companyId: string,
    onDate: string,
    opts: { aatoAmount: number | null; companyFlag: boolean },
    tx?: Prisma.TransactionClient,
  ): Promise<{ limit: StatutoryLimit | null; applicable: boolean; byLaw: boolean }> {
    const limit = await this.limit(
      companyId,
      STATUTORY_CODES.EINV_AATO_THRESHOLD,
      onDate,
      'ALL',
      null,
      tx,
    );
    const byLaw =
      !!limit && limit.value !== null && opts.aatoAmount !== null && opts.aatoAmount > limit.value;
    return { limit, applicable: opts.companyFlag || byLaw, byLaw };
  }

  /** Rule 46 — how many HSN digits this company must print, by turnover class. */
  async hsnDigits(
    companyId: string,
    onDate: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ limit: StatutoryLimit | null; digits: number | null }> {
    const aato = await this.aatoClass(companyId, tx);
    const limit = await this.limit(companyId, STATUTORY_CODES.HSN_DIGITS, onDate, 'ALL', aato, tx);
    // HSN_DIGITS is a TEXT row ('4' / '6'), because the figure is a digit
    // count printed on a document rather than an amount to compare.
    const digits = limit?.valueText ? Number.parseInt(limit.valueText, 10) : null;
    return { limit, digits: Number.isNaN(digits as number) ? null : digits };
  }

  /**
   * Is the IRN / e-way bill still inside its cancellation window?
   *
   * Two different statutes with the same shape, so the kind picks the code.
   * `generatedOn` is an instant, not a date: the window is in HOURS.
   */
  async withinCancelWindow(
    companyId: string,
    kind: CancelWindowKind,
    generatedOn: Date,
    onDate: string,
    now: Date = new Date(),
    tx?: Prisma.TransactionClient,
  ): Promise<{ limit: StatutoryLimit | null; within: boolean; hoursElapsed: number }> {
    const code =
      kind === 'IRN' ? STATUTORY_CODES.EINV_CANCEL_HOURS : STATUTORY_CODES.EWAY_CANCEL_HOURS;
    const limit = await this.limit(companyId, code, onDate, 'ALL', null, tx);
    const hoursElapsed = (now.getTime() - generatedOn.getTime()) / 3_600_000;
    if (!limit || limit.value === null) {
      // No row means the rule is NOT APPLICABLE — not "zero hours, refuse".
      return { limit, within: true, hoursElapsed };
    }
    return { limit, within: hoursElapsed <= limit.value, hoursElapsed };
  }

  /**
   * s.34(2) — a credit note for an FY must be declared by 30 November of the
   * next FY (or the annual return, if earlier).
   *
   * The pack stores this as TEXT 'MM-DD' rather than a day count, because the
   * deadline is a calendar date and not an interval.
   */
  async creditNoteCutoff(
    companyId: string,
    billDate: string,
    onDate: string,
    tx?: Prisma.TransactionClient,
  ): Promise<{ limit: StatutoryLimit | null; cutoff: string | null; passed: boolean }> {
    const limit = await this.limit(
      companyId,
      STATUTORY_CODES.CREDIT_NOTE_CUTOFF,
      onDate,
      'ALL',
      null,
      tx,
    );
    if (!limit?.valueText) {
      return { limit, cutoff: null, passed: false };
    }

    // The bill's FY runs April to March, so the cutoff falls in the year AFTER
    // the one the bill's April started.
    const bill = new Date(`${billDate}T00:00:00Z`);
    const fyStartYear =
      bill.getUTCMonth() + 1 >= 4 ? bill.getUTCFullYear() : bill.getUTCFullYear() - 1;
    const cutoff = `${fyStartYear + 1}-${limit.valueText}`;
    return { limit, cutoff, passed: onDate > cutoff };
  }

  private toLimit(row: {
    stl_id: string;
    stl_code: string;
    stl_section: string | null;
    stl_label: string;
    stl_value_type: string;
    stl_value: Prisma.Decimal | null;
    stl_value_text: string | null;
    stl_enforce: string;
    stl_effective_from: Date;
    stl_effective_to: Date | null;
    stl_source_ref: string | null;
    is_company_override: boolean;
  }): StatutoryLimit {
    return {
      id: row.stl_id,
      code: row.stl_code,
      section: row.stl_section,
      label: row.stl_label,
      valueType: row.stl_value_type as StatutoryLimit['valueType'],
      value: row.stl_value === null ? null : Number(row.stl_value),
      valueText: row.stl_value_text,
      enforce: row.stl_enforce as StatutoryLimit['enforce'],
      effectiveFrom: toDateString(row.stl_effective_from),
      effectiveTo: row.stl_effective_to === null ? null : toDateString(row.stl_effective_to),
      sourceRef: row.stl_source_ref,
      isCompanyOverride: row.is_company_override,
    };
  }
}

/** `date` columns come back as a Date at UTC midnight; print the calendar day. */
function toDateString(d: Date): string {
  return d.toISOString().slice(0, 10);
}
