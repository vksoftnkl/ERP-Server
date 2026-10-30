import { Prisma } from '@prisma/client';
import {
  SettlementLineKind,
  SettlementMatchRule,
  SettlementMatchStatus,
} from './types/tender-settlement-enum';

/** A statement line still waiting for a tender row (UNMATCHED, or a SUGGESTED one re-judged). */
export interface MatchLine {
  aslId: string;
  kind: SettlementLineKind;
  tenderId: string | null;
  refNo: string | null;
  authCode: string | null;
  cardLast4: string | null;
  gross: Prisma.Decimal;
  txnOn: Date | null;
}

/** A tender row that could be the line's (the service reads them; this only judges). */
export interface MatchCandidate {
  tdId: string;
  tdAccYear: string;
  tenderId: string;
  drCr: 'DR' | 'CR';
  /** NA | PENDING | PARTIAL | SETTLED | FAILED */
  settleStatus: string;
  refNo: string | null;
  authCode: string | null;
  cardLast4: string | null;
  /** td_total_amt — what the tender took, surcharge included. */
  amount: Prisma.Decimal;
  /** YYYY-MM-DD */
  docDate: string;
  createdOn: Date;
}

export interface MatchVerdict {
  aslId: string;
  status:
    | SettlementMatchStatus.MATCHED
    | SettlementMatchStatus.SUGGESTED
    | SettlementMatchStatus.UNMATCHED;
  rule: SettlementMatchRule | null;
  tdId: string | null;
  tdAccYear: string | null;
  /** gross − the row's amount (signed). */
  diff: Prisma.Decimal;
}

const DAY_MS = 86_400_000;

/**
 * §5.4 — the first rule that hits wins, per line:
 *
 *   REF          the RRN / UTR equals the row's td_ref_no, amount within
 *                `tolerance`                                     → MATCHED
 *   AUTH         card: approval code and last 4 equal, amount equal, the
 *                transaction within a day of the row's date      → MATCHED
 *   AMOUNT_TIME  same tender, same amount, within `windowMinutes` of the
 *                row's creation, EXACTLY ONE candidate on each side → SUGGESTED
 *   none                                                         → UNMATCHED
 *
 * Which rows a kind may take: a SALE a money-in row still waiting
 * (PENDING / PARTIAL); a REFUND a money-out row waiting; a CHARGEBACK a
 * money-in row the provider already paid (SETTLED / PARTIAL). A row is used by
 * one line of a kind; `taken` carries rows other lines already hold.
 * Deterministic: lines in the order given, ties to the smaller difference,
 * then the earlier row.
 */
export function matchLines(
  lines: readonly MatchLine[],
  candidates: readonly MatchCandidate[],
  options: {
    tolerance: Prisma.Decimal;
    windowMinutes: number;
    /** `${kind}|${tdId}` already held by a line outside this run. */
    taken?: ReadonlySet<string>;
  },
): MatchVerdict[] {
  const used = new Set<string>(options.taken ?? []);
  const verdicts = new Map<string, MatchVerdict>();
  const eligible = (line: MatchLine, c: MatchCandidate): boolean =>
    c.tenderId === line.tenderId && !used.has(`${line.kind}|${c.tdId}`) && kindTakes(line.kind, c);
  const take = (
    line: MatchLine,
    c: MatchCandidate,
    rule: SettlementMatchRule,
    status: MatchVerdict['status'],
  ) => {
    used.add(`${line.kind}|${c.tdId}`);
    verdicts.set(line.aslId, {
      aslId: line.aslId,
      status,
      rule,
      tdId: c.tdId,
      tdAccYear: c.tdAccYear,
      diff: line.gross.minus(c.amount),
    });
  };
  const customerLines = lines.filter((l) => isCustomerKind(l.kind) && l.tenderId);

  // REF
  for (const line of customerLines) {
    if (!line.refNo) continue;
    const ref = line.refNo.trim().toUpperCase();
    const hits = candidates
      .filter((c) => eligible(line, c) && c.refNo?.trim().toUpperCase() === ref)
      .filter((c) => line.gross.minus(c.amount).abs().lessThanOrEqualTo(options.tolerance));
    const best = closest(line, hits);
    if (best) take(line, best, SettlementMatchRule.REF, SettlementMatchStatus.MATCHED);
  }

  // AUTH (card)
  for (const line of customerLines) {
    if (verdicts.has(line.aslId) || !line.authCode || !line.cardLast4) continue;
    const auth = line.authCode.trim().toUpperCase();
    const hits = candidates.filter(
      (c) =>
        eligible(line, c) &&
        c.authCode?.trim().toUpperCase() === auth &&
        c.cardLast4 === line.cardLast4 &&
        c.amount.equals(line.gross) &&
        (line.txnOn === null || withinDays(line.txnOn, c.docDate, 1)),
    );
    const best = closest(line, hits);
    if (best) take(line, best, SettlementMatchRule.AUTH, SettlementMatchStatus.MATCHED);
  }

  // AMOUNT_TIME — exactly one on each side
  const open = customerLines.filter((l) => !verdicts.has(l.aslId) && l.txnOn);
  const windowMs = Math.max(0, options.windowMinutes) * 60_000;
  const options1 = new Map<string, MatchCandidate[]>();
  for (const line of open) {
    options1.set(
      line.aslId,
      candidates.filter(
        (c) =>
          eligible(line, c) &&
          c.amount.equals(line.gross) &&
          Math.abs(c.createdOn.getTime() - line.txnOn!.getTime()) <= windowMs,
      ),
    );
  }
  const claims = new Map<string, number>();
  for (const list of options1.values()) {
    for (const c of list) claims.set(c.tdId, (claims.get(c.tdId) ?? 0) + 1);
  }
  for (const line of open) {
    const list = options1.get(line.aslId) ?? [];
    if (list.length === 1 && claims.get(list[0].tdId) === 1 && eligible(line, list[0])) {
      take(line, list[0], SettlementMatchRule.AMOUNT_TIME, SettlementMatchStatus.SUGGESTED);
    }
  }

  return lines.map(
    (line) =>
      verdicts.get(line.aslId) ?? {
        aslId: line.aslId,
        status: SettlementMatchStatus.UNMATCHED,
        rule: null,
        tdId: null,
        tdAccYear: null,
        diff: new Prisma.Decimal(0),
      },
  );
}

/** SALE, REFUND and CHARGEBACK have a customer (and so a tender row) behind them. */
export function isCustomerKind(kind: SettlementLineKind): boolean {
  return (
    kind === SettlementLineKind.SALE ||
    kind === SettlementLineKind.REFUND ||
    kind === SettlementLineKind.CHARGEBACK
  );
}

/** Which tender rows a line of this kind may settle. */
export function kindTakes(
  kind: SettlementLineKind,
  c: Pick<MatchCandidate, 'drCr' | 'settleStatus'>,
): boolean {
  switch (kind) {
    case SettlementLineKind.SALE:
      return c.drCr === 'DR' && (c.settleStatus === 'PENDING' || c.settleStatus === 'PARTIAL');
    case SettlementLineKind.REFUND:
      return c.drCr === 'CR' && (c.settleStatus === 'PENDING' || c.settleStatus === 'PARTIAL');
    case SettlementLineKind.CHARGEBACK:
      return c.drCr === 'DR' && (c.settleStatus === 'SETTLED' || c.settleStatus === 'PARTIAL');
    default:
      return false;
  }
}

function closest(line: MatchLine, hits: MatchCandidate[]): MatchCandidate | null {
  if (hits.length === 0) return null;
  return [...hits].sort((a, b) => {
    const da = line.gross.minus(a.amount).abs();
    const db = line.gross.minus(b.amount).abs();
    const byDiff = da.comparedTo(db);
    return byDiff !== 0 ? byDiff : a.createdOn.getTime() - b.createdOn.getTime();
  })[0];
}

function withinDays(on: Date, docDate: string, days: number): boolean {
  const doc = Date.parse(`${docDate}T00:00:00+05:30`);
  return on.getTime() >= doc - days * DAY_MS && on.getTime() < doc + (days + 1) * DAY_MS;
}
