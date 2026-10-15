import { HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { OutstandingExportDto } from '../../../../reports/party-outstanding/dto/party-outstanding-query.dto';
import {
  DEFAULT_BUCKETS,
  parseBuckets,
} from '../../../../reports/party-outstanding/party-outstanding.ageing';
import { PartyOutstandingService } from '../../../../reports/party-outstanding/party-outstanding.service';
import type {
  Bal,
  PartiesExportPayload,
  PartyFlag,
  PartyRow,
} from '../../../../reports/party-outstanding/types/party-outstanding.types';
import { formatNumber } from '../../engine/expression/transforms/format';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';

/**
 * Party-wise Outstanding (menu 279, purpose PARTY_OUTSTANDING) — the party list
 * as the screen's Party-wise tab shows it.
 *
 * The rows are the report's own `/export` (shape PARTIES), called in-process:
 * what is pending on D, its ageing, the chain rule, the counter tender and the
 * PDC rules live in PartyOutstandingService and nowhere else, so a stored query
 * here would be a second definition of "outstanding" waiting to disagree. The
 * service also keeps its own menu-279 check, so the print refuses whoever the
 * screen refuses.
 *
 * The filters arrive as the revision's prompts (ptv_params) and go through the
 * report's own DTO — the same validation the HTTP route applies. Company is the
 * render's (server-owned); docId names nothing and is ignored. Field names are
 * listed in docs/print-templates/party-outstanding-a5/README.md: a provider
 * dataset has no field list in the designer.
 */

/** Prompt name → export DTO key. Every prompt is optional except as_on and side. */
type Answers = Readonly<Record<string, unknown>>;

const MAX_BUCKET_SLOTS = 8; // six edges + "> last" + DUE_DATE's "Not due"

function text(answers: Answers, name: string): string | undefined {
  const value = answers[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function flag(answers: Answers, name: string): boolean | undefined {
  return typeof answers[name] === 'boolean' ? (answers[name] as boolean) : undefined;
}

function whole(answers: Answers, name: string): number | undefined {
  return typeof answers[name] === 'number' ? (answers[name] as number) : undefined;
}

function amount(value: string | null | undefined): number {
  const n = Number(value ?? 0);
  return Number.isFinite(n) ? n : 0;
}

function money(value: string | number): string {
  return formatNumber(value, '##,##,##0.00');
}

/** 'DR' / 'CR' / null (0.00) → 'Dr' / 'Cr' / ''. */
function sideText(bal: Bal): string {
  return bal.side === 'DR' ? 'Dr' : bal.side === 'CR' ? 'Cr' : '';
}

/** dd-MM-yyyy from an ISO date — the text form is the whole value, no zone involved. */
function dmy(iso: string | null | undefined): string {
  return iso ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : '';
}

/** The screen's chip words (view/cells.ts flagChip). */
function flagLabel(flagValue: PartyFlag, lastEdge: number | undefined): string {
  switch (flagValue) {
    case 'CHQ_BOUNCED':
      return 'CHQ BOUNCED';
    case 'OVER_180':
      return lastEdge === undefined ? 'OLDEST BUCKET' : `> ${lastEdge} DAYS`;
    case 'ADVANCE':
      return 'ADVANCE';
    case 'OVER_LIMIT':
      return 'OVER LIMIT';
    default:
      return String(flagValue);
  }
}

/** The service's refusal sentences, not just "Unprocessable Entity". */
function refusalText(error: unknown): string {
  if (error instanceof HttpException) {
    const body = error.getResponse() as
      | { message?: unknown; errors?: { message?: string }[] }
      | string;
    if (typeof body === 'object' && body !== null) {
      const nested =
        typeof body.message === 'object' && body.message !== null
          ? (body.message as { errors?: { message?: string }[] }).errors
          : undefined;
      const details = (body.errors ?? nested ?? []).map((e) => e.message).filter(Boolean);
      if (details.length > 0) return details.join(' ');
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class PartyOutstandingPrintSource {
  constructor(
    private readonly outstanding: PartyOutstandingService,
    private readonly prisma: PrismaService,
  ) {}

  /** The prompts as the report's export query, validated by the report's own DTO. */
  async query(request: ProviderRequest): Promise<OutstandingExportDto> {
    const a = request.params;
    const plain: Record<string, unknown> = {
      companyId: request.context.companyId,
      shape: 'PARTIES',
      asOn: text(a, 'as_on'),
      side: text(a, 'side')?.toUpperCase(),
      // Not `branch_id`: unanswered, that falls back to the session's branch,
      // and "all branches" would quietly print one.
      branchId: text(a, 'filter_branch_id'),
      groupId: text(a, 'group_id'),
      areaId: text(a, 'area_id'),
      salesmanId: text(a, 'salesman_id'),
      collectionDay: text(a, 'collection_day'),
      partyId: text(a, 'party_id'),
      ageBy: text(a, 'age_by')?.toUpperCase(),
      buckets: text(a, 'buckets'),
      onlyOverdue: flag(a, 'only_overdue'),
      includeOnAccount: flag(a, 'include_on_account'),
      deductPdc: flag(a, 'deduct_pdc'),
      hideZero: flag(a, 'hide_zero'),
      minDueDays: whole(a, 'min_due_days'),
      maxDueDays: whole(a, 'max_due_days'),
      sort: text(a, 'sort'),
      dir: text(a, 'dir')?.toLowerCase(),
    };
    for (const key of Object.keys(plain)) {
      if (plain[key] === undefined) delete plain[key];
    }
    const dto = plainToInstance(OutstandingExportDto, plain);
    const problems = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (problems.length > 0) {
      const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
      throw new Error(
        `The print's filters are not what Party-wise Outstanding takes: ${messages.join('; ')}`,
      );
    }
    return dto;
  }

  async parties(
    request: ProviderRequest,
  ): Promise<{ q: OutstandingExportDto; data: PartiesExportPayload }> {
    const q = await this.query(request);
    try {
      const data = (await this.outstanding.export(q)) as PartiesExportPayload;
      return { q, data };
    } catch (error) {
      throw new Error(refusalText(error));
    }
  }

  async printedBy(userId: string | null): Promise<string | null> {
    if (!userId || !/^[0-9a-f-]{36}$/i.test(userId)) return null;
    const [user] = await this.prisma.$queryRaw<{ name: string | null }[]>`
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${userId}::uuid`;
    return user?.name ?? null;
  }
}

@Injectable()
export class PartyOutstandingHeadProvider implements PrintDataProvider {
  readonly code = 'reports.party_outstanding.head';
  readonly label = 'Party-wise Outstanding — heading, totals and tiles';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: PartyOutstandingPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow> {
    const [{ q, data }, printedBy] = await Promise.all([
      this.source.parties(request),
      this.source.printedBy(request.context.userId),
    ]);
    const { totals, tiles } = data;
    const receivable = data.side === 'RECEIVABLE';
    const now = new Date(Date.now() + 330 * 60_000).toISOString();

    const head: PrintRow = {
      company_name: data.companyName,
      branch_name: data.branchName,
      branch_label: data.branchName ?? 'All branches',
      printed_as: data.printedAs,
      side: data.side,
      side_word: receivable ? 'Receivable' : 'Payable',
      title: receivable
        ? 'PARTY-WISE OUTSTANDING — RECEIVABLES'
        : 'PARTY-WISE OUTSTANDING — PAYABLES',
      as_on: data.asOn,
      as_on_text: dmy(data.asOn),
      acc_year: data.accYear,
      is_future: data.isFuture,
      age_by_text:
        (q.ageBy ?? 'BILL_DATE') === 'DUE_DATE' ? 'Aged by due date' : 'Aged by bill date',
      bucket_count: data.bucketLabels.length,
      parties: data.totalRows,
      bills: totals.bills,
      owed: amount(totals.owed),
      on_account: amount(totals.onAccount),
      net_amt: amount(totals.net.amount),
      net_side: sideText(totals.net),
      overdue: amount(totals.overdue),
      pdc_in_hand: amount(totals.pdcInHand),
      overdue_pct: tiles.overduePctOfOwed,
      above_days: tiles.aboveDays.days,
      above_amount: amount(tiles.aboveDays.amount),
      above_parties: tiles.aboveDays.parties,
      pdc_amount: amount(tiles.pdcInHand.amount),
      pdc_cheques: tiles.pdcInHand.cheques,
      deduct_pdc: q.deductPdc ?? false,
      due_next_days: tiles.dueNext.days,
      due_next_amount: amount(tiles.dueNext.amount),
      due_next_from_text: dmy(tiles.dueNext.from),
      due_next_to_text: dmy(tiles.dueNext.to),
      printed_at: `${dmy(now.slice(0, 10))} ${now.slice(11, 16)}`,
      printed_by: printedBy,
    };
    // The ageing totals as fixed slots: label_N / bucket_N for N < bucket_count.
    for (let i = 0; i < MAX_BUCKET_SLOTS; i += 1) {
      head[`label_${i}`] = data.bucketLabels[i] ?? '';
      head[`bucket_${i}`] = i < totals.buckets.length ? amount(totals.buckets[i]) : null;
    }
    return head;
  }
}

@Injectable()
export class PartyOutstandingPartiesProvider implements PrintDataProvider {
  readonly code = 'reports.party_outstanding.parties';
  readonly label = 'Party-wise Outstanding — one row per party';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: PartyOutstandingPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    const { q, data } = await this.source.parties(request);
    const edges = parseBuckets(q.buckets) ?? [...DEFAULT_BUCKETS];
    const lastEdge = edges[edges.length - 1];
    return data.rows
      .slice(0, request.rowLimit)
      .map((row, index) => toRow(row, index, data.bucketLabels, lastEdge));
  }
}

function toRow(
  row: PartyRow,
  index: number,
  labels: readonly string[],
  lastEdge: number | undefined,
): PrintRow {
  const flags = row.flags.map((f) => flagLabel(f, lastEdge)).join(' · ');
  const ageing = row.buckets
    .map((value, i) => (amount(value) !== 0 ? `${labels[i]} ${money(value)}` : null))
    .filter(Boolean)
    .join(' · ');
  const out: PrintRow = {
    sl_no: index + 1,
    party_id: row.partyId,
    name: row.name,
    area: row.area,
    phone: row.phone,
    credit_days: row.creditDays,
    credit_limit: row.creditLimit === null ? null : amount(row.creditLimit),
    bills: row.bills,
    owed: amount(row.owed),
    on_account: amount(row.onAccount),
    net_amt: amount(row.net.amount),
    net_side: sideText(row.net),
    overdue: amount(row.overdue),
    oldest_days: row.oldestDays,
    pdc_in_hand: amount(row.pdcInHand),
    flags_text: flags || null,
    ageing_text: ageing || null,
    // The line under the party: where, who, terms, flags, then the ageing.
    sub_text:
      [
        row.area,
        row.phone ? `Ph ${row.phone}` : null,
        row.creditDays ? `${row.creditDays} days credit` : null,
        flags || null,
        ageing ? `Ageing: ${ageing}` : null,
        amount(row.pdcInHand) !== 0 ? `PDC in hand ${money(row.pdcInHand)}` : null,
      ]
        .filter(Boolean)
        .join(' · ') || null,
  };
  for (let i = 0; i < MAX_BUCKET_SLOTS; i += 1) {
    out[`bucket_${i}`] = i < row.buckets.length ? amount(row.buckets[i]) : null;
  }
  return out;
}

/** For print-render.module.ts's explicit registry (the source is a helper, not a provider). */
export const PARTY_OUTSTANDING_PRINT_PROVIDERS = [
  PartyOutstandingHeadProvider,
  PartyOutstandingPartiesProvider,
] as const;
