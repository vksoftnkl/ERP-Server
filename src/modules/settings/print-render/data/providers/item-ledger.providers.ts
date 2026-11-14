import { HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { ItemLedgerExportDto } from '../../../../stocks/reports/item-ledger/dto/item-ledger-query.dto';
import { ItemLedgerService } from '../../../../stocks/reports/item-ledger/item-ledger.service';
import type {
  ExportPayload,
  LedgerRow,
} from '../../../../stocks/reports/item-ledger/types/item-ledger.types';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';

/**
 * Item Ledger (menu 301, purpose ITEM_LEDGER) — the Vouchers tab on A4.
 *
 * The rows are the report's own `/export`, called in-process: the opening,
 * the posting order, the reversal pairs, the internal moves and the party
 * labels live in ItemLedgerService and nowhere else, so a stored query here
 * would be a second definition of the ledger waiting to disagree. The service
 * keeps its own menu-301 check, so the print refuses whoever the screen
 * refuses.
 *
 * The filters arrive as the revision's prompts (ptv_params): item_id,
 * from_date, to_date (required), branch_id (unanswered = the session's
 * branch), godown_id, bucket, lot_id, types (comma list), unit_id, value_at,
 * show_reversed, order — and go through the report's own export DTO, the same
 * validation the HTTP route applies. Company is the render's (server-owned);
 * docId names nothing and is ignored. Field names are listed in
 * src/modules/stocks/reports/item-ledger/README.md ("Printing").
 */

type Answers = Readonly<Record<string, unknown>>;

function text(answers: Answers, name: string): string | undefined {
  const value = answers[name];
  return typeof value === 'string' && value.trim() ? value.trim() : undefined;
}

function flag(answers: Answers, name: string): boolean | undefined {
  return typeof answers[name] === 'boolean' ? answers[name] : undefined;
}

/** The engine formats numbers; a provider hands them over as numbers (null stays null). */
function num(value: string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

/** dd/MM/yyyy from an ISO date — the text form is the whole value, no zone involved. */
function dmy(iso: string | null | undefined): string {
  return iso ? `${iso.slice(8, 10)}/${iso.slice(5, 7)}/${iso.slice(0, 4)}` : '';
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
export class ItemLedgerPrintSource {
  constructor(
    private readonly ledger: ItemLedgerService,
    private readonly prisma: PrismaService,
  ) {}

  /** The prompts as the report's export query, validated by the report's own DTO. */
  async query(request: ProviderRequest): Promise<ItemLedgerExportDto> {
    const a = request.params;
    const plain: Record<string, unknown> = {
      companyId: request.context.companyId,
      branchId: text(a, 'branch_id') ?? request.context.branchId ?? undefined,
      itemId: text(a, 'item_id'),
      from: text(a, 'from_date'),
      to: text(a, 'to_date'),
      godownId: text(a, 'godown_id'),
      bucket: text(a, 'bucket')?.toUpperCase(),
      lotId: text(a, 'lot_id'),
      types: text(a, 'types'),
      unitId: text(a, 'unit_id'),
      valueAt: text(a, 'value_at')?.toUpperCase(),
      showReversed: flag(a, 'show_reversed'),
      order: text(a, 'order')?.toLowerCase(),
    };
    for (const key of Object.keys(plain)) {
      if (plain[key] === undefined) delete plain[key];
    }
    const dto = plainToInstance(ItemLedgerExportDto, plain);
    const problems = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (problems.length > 0) {
      const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
      throw new Error(
        `The print's filters are not what the Item Ledger takes: ${messages.join('; ')}`,
      );
    }
    return dto;
  }

  async rows(request: ProviderRequest): Promise<ExportPayload> {
    const q = await this.query(request);
    try {
      return await this.ledger.export(q);
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
export class ItemLedgerHeadProvider implements PrintDataProvider {
  readonly code = 'reports.item_ledger.head';
  readonly label = 'Item Ledger — heading, opening, totals and closing';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: ItemLedgerPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow> {
    const [data, printedBy] = await Promise.all([
      this.source.rows(request),
      this.source.printedBy(request.context.userId),
    ]);
    return headRow(data, printedBy, new Date());
  }
}

@Injectable()
export class ItemLedgerRowsProvider implements PrintDataProvider {
  readonly code = 'reports.item_ledger.rows';
  readonly label = 'Item Ledger — one row per voucher line group, posting order';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: ItemLedgerPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    const data = await this.source.rows(request);
    return data.rows.slice(0, request.rowLimit).map((row, i) => ledgerPrintRow(row, i));
  }
}

/** The MASTER row. Exported for the spec. */
export function headRow(data: ExportPayload, printedBy: string | null, at: Date): PrintRow {
  const h = data.head;
  const now = new Date(at.getTime() + 330 * 60_000).toISOString();
  const hh = Number(now.slice(11, 13));
  const time = `${String(hh % 12 === 0 ? 12 : hh % 12).padStart(2, '0')}:${now.slice(14, 16)} ${hh < 12 ? 'AM' : 'PM'}`;
  return {
    title: 'ITEM LEDGER',
    company_name: h.companyName,
    branch_name: h.branchName,
    item_code: h.itemCode,
    item_name: h.itemName,
    item_label: [h.itemCode, h.itemName].filter(Boolean).join(' · '),
    printed_as: data.printedAs,
    from_date: h.from,
    to_date: h.to,
    from_text: dmy(h.from),
    to_text: dmy(h.to),
    period_text: `${dmy(h.from)} to ${dmy(h.to)}`,
    godown_name: h.godownName ?? 'All godowns',
    bucket: h.bucket,
    batch_no: h.batchNo,
    unit_name: h.unit.name,
    value_at_text: h.valueAt === 'WITH_TAX' ? 'Cost with tax' : 'Cost without tax',
    opening_text: `Opening balance · closing of ${dmy(data.opening.closingOf)}`,
    opening_qty: num(data.opening.qty),
    opening_value: num(data.opening.value),
    opening_rate: num(data.opening.rate),
    opening_lots: data.opening.lots,
    received_qty: num(data.totals.receivedQty),
    issued_qty: num(data.totals.issuedQty),
    value_in: num(data.totals.valueIn),
    value_out: num(data.totals.valueOut),
    rows: data.totals.rows,
    rows_shown: data.totals.rowsShown,
    docs: data.totals.docs,
    reversed_pairs: data.totals.reversedPairs,
    rows_note:
      data.totals.rowsShown === data.totals.rows
        ? `${data.totals.rows} rows`
        : `${data.totals.rowsShown} of ${data.totals.rows} rows (filtered)`,
    closing_text: `Closing · ${dmy(data.closing.date)}`,
    closing_qty: num(data.closing.qty),
    closing_value: num(data.closing.value),
    closing_rate: num(data.closing.rate),
    // P2-IL: the ledger rows' own sum, and the engine's revaluing of it.
    closing_ledger_value: num(data.closing.ledgerValue),
    cost_adj: num(data.closing.costAdj),
    printed_at: `${dmy(now.slice(0, 10))} ${time}`,
    printed_by: printedBy,
  };
}

/** One DETAIL row, as the screen's grid shows it. Exported for the spec. */
export function ledgerPrintRow(row: LedgerRow, index: number): PrintRow {
  const internal = row.kind === 'INTERNAL';
  const chip = row.state === 'LIVE' ? '' : row.state === 'REVERSAL' ? 'REVERSAL' : row.state;
  const party = [row.party?.label, row.detail].filter((v) => v && v.trim()).join(' · ');
  return {
    sl_no: index + 1,
    seq: row.seq,
    date_text: dmy(row.date),
    time: row.time,
    type_label: row.typeLabel,
    state: row.state,
    state_chip: chip,
    greyed: row.state !== 'LIVE',
    doc_no: row.docNo,
    party_detail: party || null,
    godown:
      internal && row.toGodownName
        ? `${row.godownName ?? ''} → ${row.toGodownName}`
        : row.godownName,
    batch_no: row.batchNo,
    received_qty: num(row.receivedQty),
    issued_qty: num(row.issuedQty),
    moved_text: internal && row.movedQty !== null ? `${row.movedQty} ↔ internal` : null,
    balance_qty: num(row.balanceQty),
    cost_rate: num(row.costRate),
    cost_value: num(row.costValue),
    doc_rate: num(row.docRate),
    user: row.user,
  };
}

/** For print-render.module.ts's explicit registry (the source is a helper, not a provider). */
export const ITEM_LEDGER_PRINT_PROVIDERS = [
  ItemLedgerHeadProvider,
  ItemLedgerRowsProvider,
] as const;
