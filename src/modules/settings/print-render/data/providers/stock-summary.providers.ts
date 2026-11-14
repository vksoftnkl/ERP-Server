import { HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import {
  StockSummaryQueryDto,
  StockSummaryViewDto,
} from '../../../../stocks/reports/stock-summary/dto/stock-summary-query.dto';
import { StockSummaryService } from '../../../../stocks/reports/stock-summary/stock-summary.service';
import { chipsText } from '../../../../stocks/reports/stock-summary/stock-summary.rules';
import type {
  ExportPayload,
  SummaryRow,
  SummaryTotals,
} from '../../../../stocks/reports/stock-summary/types/stock-summary.types';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';

/**
 * Stock Summary (menu 302, purpose STOCK_SUMMARY) — the Item-wise tab on A4
 * landscape (plan §7). The other tabs export to CSV.
 *
 * The rows are the report's own run: with `run_id` (the Show on screen, alive
 * and the printing user's) they are read with no SQL — no second computation
 * (the Item Ledger's backlog #6); without it the service builds ONE run from
 * the scope prompts and the head and rows datasets of the render share it.
 * VIEW and PRINT on 302 are checked either way (403 STOCK_SUMMARY_RIGHT_PRINT).
 *
 * Prompts (ptv_params): run_id (optional), branch_id (blank = the session's),
 * from_date, to_date (required without run_id), godown_id, group_id,
 * brand_id, bucket, value_at, qty_in, no_sale_days, hide_zero, only_negative,
 * show, find, sort, dir, group_by + group_key (the Group summary drill; read
 * with run_id alone too) — through the report's own Show DTO, the validation the
 * HTTP route applies. Company: docId when it is a uuid (the screen's Company
 * dropdown, Q2), else the render's. Field names are listed in
 * src/modules/stocks/reports/stock-summary/README.md ("Printing").
 */

type Answers = Readonly<Record<string, unknown>>;

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function text(answers: Answers, name: string): string | undefined {
  const value = answers[name];
  if (typeof value === 'number') return String(value);
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function flag(answers: Answers, name: string): boolean | undefined {
  return typeof answers[name] === 'boolean' ? answers[name] : undefined;
}

function int(answers: Answers, name: string): number | undefined {
  const v = answers[name];
  if (typeof v === 'number' && Number.isInteger(v)) return v;
  if (typeof v === 'string' && /^\d+$/.test(v.trim())) return Number(v.trim());
  return undefined;
}

/**
 * The view prompts: sort, dir, hide_zero, only_negative, show, find, and the
 * Group summary drill group_by + group_key (a group / brand / section /
 * category id, or NONE for "(No …)") — the same keys /rows takes.
 */
function viewPrompts(a: Answers): Record<string, unknown> {
  return {
    hideZero: flag(a, 'hide_zero'),
    onlyNegative: flag(a, 'only_negative'),
    show: text(a, 'show')?.toUpperCase(),
    find: text(a, 'find'),
    sort: text(a, 'sort'),
    dir: text(a, 'dir')?.toLowerCase(),
    groupBy: text(a, 'group_by')?.toUpperCase(),
    groupKey: text(a, 'group_key'),
  };
}

/** The engine formats numbers; a provider hands them over as numbers (null stays null). */
function num(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** dd/MM/yyyy from an ISO date. */
function dmy(iso: string | null | undefined): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
}

/** dd/MM/yyyy hh:mm AM from an IST instant text (`…T19:42:10+05:30`). */
function istText(instant: string | null | undefined): string {
  if (!instant) return '';
  const hh = Number(instant.slice(11, 13));
  const h12 = hh % 12 === 0 ? 12 : hh % 12;
  return `${dmy(instant.slice(0, 10))} ${String(h12).padStart(2, '0')}:${instant.slice(14, 16)} ${hh < 12 ? 'AM' : 'PM'}`;
}

/** The service's refusal sentences, not just "Unprocessable Entity". */
function refusalText(error: unknown): string {
  if (error instanceof HttpException) {
    const body = error.getResponse() as
      | { message?: unknown; errors?: { message?: string }[] }
      | string;
    if (typeof body === 'object' && body !== null) {
      const details = (body.errors ?? []).map((e) => e.message).filter(Boolean);
      if (details.length > 0) return details.join(' ');
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

@Injectable()
export class StockSummaryPrintSource {
  constructor(
    private readonly summary: StockSummaryService,
    private readonly prisma: PrismaService,
  ) {}

  /** The prompts as the report's Show query, validated by the report's own DTO; null with no dates. */
  async query(request: ProviderRequest): Promise<StockSummaryQueryDto | null> {
    const a = request.params;
    const docCompany =
      request.context.docId && UUID.test(request.context.docId) ? request.context.docId : null;
    const plain: Record<string, unknown> = {
      companyId: docCompany ?? request.context.companyId,
      branchId: text(a, 'branch_id') ?? request.context.branchId ?? undefined,
      from: text(a, 'from_date'),
      to: text(a, 'to_date'),
      godownId: text(a, 'godown_id'),
      groupId: text(a, 'group_id'),
      brandId: text(a, 'brand_id'),
      bucket: text(a, 'bucket')?.toUpperCase(),
      valueAt: text(a, 'value_at')?.toUpperCase(),
      qtyIn: text(a, 'qty_in')?.toUpperCase(),
      noSaleDays: int(a, 'no_sale_days'),
      hideZero: flag(a, 'hide_zero'),
      onlyNegative: flag(a, 'only_negative'),
      show: text(a, 'show')?.toUpperCase(),
      ...viewPrompts(a),
    };
    for (const key of Object.keys(plain)) {
      if (plain[key] === undefined) delete plain[key];
    }
    if (plain.from === undefined && plain.to === undefined && text(a, 'run_id')) return null;
    const dto = plainToInstance(StockSummaryQueryDto, plain);
    const problems = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (problems.length > 0) {
      const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
      throw new Error(
        `The print's filters are not what the Stock Summary takes: ${messages.join('; ')}`,
      );
    }
    return dto;
  }

  /** The view prompts alone (sort, filters, the group drill), validated by the report's view DTO. */
  async view(request: ProviderRequest): Promise<StockSummaryViewDto> {
    const plain: Record<string, unknown> = viewPrompts(request.params);
    for (const key of Object.keys(plain)) {
      if (plain[key] === undefined) delete plain[key];
    }
    const dto = plainToInstance(StockSummaryViewDto, plain);
    const problems = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (problems.length > 0) {
      const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
      throw new Error(
        `The print's filters are not what the Stock Summary takes: ${messages.join('; ')}`,
      );
    }
    return dto;
  }

  async data(request: ProviderRequest): Promise<ExportPayload> {
    const runId = text(request.params, 'run_id') ?? null;
    if (runId && !UUID.test(runId))
      throw new Error('The print’s run_id is not a run of the Stock Summary.');
    const query = await this.query(request);
    const view = await this.view(request);
    try {
      return await this.summary.printData({ runId: runId?.toLowerCase() ?? null, query, view });
    } catch (error) {
      throw new Error(refusalText(error));
    }
  }

  async printedBy(userId: string | null): Promise<string | null> {
    if (!userId || !UUID.test(userId)) return null;
    const [user] = await this.prisma.$queryRaw<{ name: string | null }[]>`
      SELECT COALESCE(NULLIF(btrim(usr_display_name), ''), usr_login_name) AS name
        FROM public.user_master WHERE usr_id = ${userId}::uuid`;
    return user?.name ?? null;
  }
}

@Injectable()
export class StockSummaryHeadProvider implements PrintDataProvider {
  readonly code = 'reports.stock_summary.head';
  readonly label = 'Stock Summary — heading, totals, transit and tie';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: StockSummaryPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow> {
    const [data, printedBy] = await Promise.all([
      this.source.data(request),
      this.source.printedBy(request.context.userId),
    ]);
    return summaryHeadRow(data, printedBy, new Date());
  }
}

@Injectable()
export class StockSummaryRowsProvider implements PrintDataProvider {
  readonly code = 'reports.stock_summary.rows';
  readonly label = 'Stock Summary — one row per item, as the Item-wise grid';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: StockSummaryPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    const data = await this.source.data(request);
    return (data.rows as SummaryRow[])
      .slice(0, request.rowLimit)
      .map((row, i) => summaryPrintRow(row, i, data.head.todayOnly));
  }
}

/** The MASTER row. Exported for the spec. */
export function summaryHeadRow(data: ExportPayload, printedBy: string | null, at: Date): PrintRow {
  const h = data.head;
  const totals = data.totals as SummaryTotals;
  const t = data.transitOut;
  const tie = data.tie;
  const now = new Date(at.getTime() + 330 * 60_000).toISOString();
  return {
    title: 'STOCK SUMMARY',
    company_name: h.companyName,
    branch_name: h.branchName,
    printed_as: data.printedAs,
    period_text: `${dmy(h.from)} to ${dmy(h.to)}`,
    as_of_text: `as of ${istText(h.asOf)}`,
    bucket: h.bucket,
    value_at_text: h.valueAt === 'WITH_TAX' ? 'Cost with tax' : 'Cost without tax',
    qty_in_text: h.qtyIn === 'DEFAULT' ? 'Qty in default unit' : 'Qty in base unit',
    items_text:
      totals.rowsShown === totals.rows
        ? `${totals.rows} items`
        : `${totals.rowsShown} of ${totals.rows} items`,
    closing_value: num(totals.closingValue),
    opening_value: num(totals.openingValue),
    inward_value: num(totals.inwardValue),
    outward_value: num(totals.outwardValue),
    cost_adj: num(totals.costAdj),
    transit_out_text:
      t && t.transfers > 0
        ? `Sent from this branch, not received yet: ${t.items} item(s) on ${t.transfers} transfer(s), value ${t.value}`
        : '',
    tie_text: !tie?.checked
      ? 'Tie: only when To is today'
      : tie.differ === 0
        ? `= Stock now ✓ ${tie.equal} of ${tie.items} items`
        : `≠ Stock now on ${tie.differ} item(s)`,
    printed_at: istText(`${now.slice(0, 19)}+05:30`),
    printed_by: printedBy,
  };
}

/** One DETAIL row, as the Item-wise grid shows it. Exported for the spec. */
export function summaryPrintRow(row: SummaryRow, index: number, todayOnly: boolean): PrintRow {
  return {
    sl_no: index + 1,
    code: row.code,
    name: row.name,
    group: row.groupName,
    unit: row.unit.name,
    opening: num(row.opening),
    inward: num(row.inward),
    outward: num(row.outward),
    closing: num(row.closing),
    // today_only: the template prints "—" in the three today-only columns when false.
    today_only: todayOnly,
    reserved: todayOnly ? num(row.reserved) : null,
    available: todayOnly ? num(row.available) : null,
    in_transit: todayOnly ? num(row.inTransit) : null,
    rate: num(row.rate),
    value: num(row.value),
    last_sale: dmy(row.lastSale),
    chips_text: chipsText(row.chips),
    negative: row.chips.some((c) => c.kind === 'NEGATIVE'),
  };
}

/** For print-render.module.ts's explicit registry (the source is a helper, not a provider). */
export const STOCK_SUMMARY_PRINT_PROVIDERS = [
  StockSummaryHeadProvider,
  StockSummaryRowsProvider,
] as const;
