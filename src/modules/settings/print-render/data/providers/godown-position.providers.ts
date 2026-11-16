import { HttpException, Injectable } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { PrismaService } from '../../../../../database/prisma/prisma.service';
import { GodownPositionQueryDto } from '../../../../stocks/reports/godown-position/dto/godown-position-query.dto';
import { GodownPositionService } from '../../../../stocks/reports/godown-position/godown-position.service';
import type {
  PositionExportPayload,
  PositionRow,
  PositionTiles,
} from '../../../../stocks/reports/godown-position/types/godown-position.types';
import { PrintDataProvider, PrintRow, ProviderRequest } from '../print-data-provider.types';
import { countText, decOf, dmyText, istText, numOf, qtyText, RenderMemo, UUID } from './print-text.utils';

/**
 * Godown Stock Position (menu 306) prints — delivery tracking P5 (plan §10):
 *
 *   GODOWN_POSITION  A4 landscape: the 306 grid and its tiles.
 *   COUNT_SHEET      A4: item, godown, Physical and an empty Counted column (F7).
 *
 * Both read the report's own run (GodownPositionService.printData: VIEW + PRINT
 * on 306, then the /export body), so the paper has the screen's numbers. docId
 * is the company (as the Stock Summary print); the prompts are the screen's
 * scope: branch_id (blank = the render's), godown_id, group_id, brand_id, qty_in,
 * bucket, only_to_give, hide_zero, find — through the report's own DTO, the
 * validation the HTTP route applies. Quantities come as numbers AND `*_text`
 * without trailing zeros; times are IST 12-hour.
 */

type Answers = Readonly<Record<string, unknown>>;

function text(a: Answers, name: string): string | undefined {
  const v = a[name];
  if (typeof v === 'number') return String(v);
  return typeof v === 'string' && v.trim() ? v.trim() : undefined;
}

function flag(a: Answers, name: string): boolean | undefined {
  const v = a[name];
  if (typeof v === 'boolean') return v;
  if (typeof v === 'string' && /^(true|false)$/i.test(v.trim())) return v.trim().toLowerCase() === 'true';
  return undefined;
}

/** The service's refusal sentences, not just "Unprocessable Entity". */
function refusalText(error: unknown): string {
  if (error instanceof HttpException) {
    const body = error.getResponse() as { errors?: { message?: string }[] } | string;
    if (typeof body === 'object' && body !== null) {
      const details = (body.errors ?? []).map((e) => e.message).filter(Boolean);
      if (details.length > 0) return details.join(' ');
    }
    return error.message;
  }
  return error instanceof Error ? error.message : String(error);
}

const BUCKET_TEXT: Record<string, string> = {
  SALEABLE: 'Saleable',
  DAMAGED: 'Damaged',
  QUARANTINE: 'Quarantine',
  EXPIRED: 'Expired',
  SAMPLE: 'Sample',
  ALL: 'All buckets',
};

const kgPart = (kg: string) => (decOf(kg).isZero() ? '' : ` · ${qtyText(kg)} kg`);

/** The MASTER row (both designs). Exported for the spec. */
export function positionHeadRow(data: PositionExportPayload, printedBy: string | null, at: Date): PrintRow {
  const h = data.head;
  const t: PositionTiles = data.tiles;
  const printedAt = istText(at);
  return {
    company_name: h.companyName,
    branch_name: h.branchName,
    godown_text: h.godownName ?? 'All godowns',
    printed_as: data.printedAs,
    as_of_text: `as of ${h.asOf}`,
    qty_in_text: h.qtyIn === 'BASE' ? 'Qty in the base unit' : 'Qty in the selling unit',
    bucket_text: BUCKET_TEXT[h.bucket] ?? h.bucket,
    rows_count: data.totalRows,
    rows_text: countText(data.totalRows, 'row'),
    physical_text: `${qtyText(t.physical.pkgs)} pkgs${kgPart(t.physical.kg)}`,
    bnd_text:
      `${qtyText(t.billedNotDelivered.pkgs)} pkgs${kgPart(t.billedNotDelivered.kg)}` +
      ` · ${countText(t.billedNotDelivered.bills, 'bill')}`,
    owned_text: `${qtyText(t.owned.pkgs)} pkgs${kgPart(t.owned.kg)}`,
    reserved_text: `${qtyText(t.reserved.pkgs)} pkgs · ${countText(t.reserved.items, 'item')}`,
    challan_text: `${qtyText(t.challanOut.pkgs)} pkgs · ${countText(t.challanOut.challans, 'challan')}`,
    short_text:
      t.short.items > 0
        ? `${countText(t.short.items, 'item')} short` +
          (t.short.first ? ` (first: ${t.short.first.itemName} @ ${t.short.first.godownName ?? ''})` : '')
        : 'None short',
    short_items: t.short.items,
    physical_kg_text: qtyText(data.totals.physicalKg),
    bnd_kg_text: qtyText(data.totals.bndKg),
    owned_kg_text: qtyText(data.totals.ownedKg),
    reserved_kg_text: qtyText(data.totals.reservedKg),
    free_kg_text: qtyText(data.totals.freeKg),
    challan_kg_text: qtyText(data.totals.challanKg),
    tie_text: data.totals.tie
      ? 'Physical = Owned + Billed not delivered on every row'
      : 'Some rows do not tie (shown in red): check the delivery events',
    tie: data.totals.tie,
    printed_at: printedAt,
    printed_by: printedBy ?? '',
    printed_line: [`Printed ${printedAt}`, printedBy].filter(Boolean).join(' · '),
  };
}

const blankZero = (v: string) => (decOf(v).isZero() ? '' : qtyText(v));

/** One DETAIL row, as the 306 grid shows it. Exported for the spec. */
export function positionPrintRow(r: PositionRow, index: number): PrintRow {
  const short = decOf(r.short);
  const over = decOf(r.overGiven);
  return {
    sl_no: index + 1,
    item_code: r.itemCode ?? '',
    item_name: r.itemName,
    godown_name: r.godownName ?? '',
    unit_name: r.unitName,
    physical: numOf(r.physical),
    physical_text: qtyText(r.physical),
    bnd: numOf(r.billedNotDelivered),
    bnd_text: blankZero(r.billedNotDelivered),
    owned: numOf(r.owned),
    owned_text: qtyText(r.owned),
    reserved_text: blankZero(r.reserved),
    free_text: qtyText(r.freeToSell),
    challan_text: blankZero(r.challanOut),
    physical_kg_text: blankZero(r.physicalKg),
    short_text: short.isZero() ? '' : `SHORT ${qtyText(short)}`,
    over_text: over.isZero() ? '' : `over-given ${qtyText(over)}`,
    flags_text: [short.isZero() ? null : `SHORT ${qtyText(short)}`, over.isZero() ? null : `over-given ${qtyText(over)}`, r.tie ? null : 'does not tie']
      .filter(Boolean)
      .join(' · '),
    is_short: !short.isZero(),
    is_red: !short.isZero() || !over.isZero() || !r.tie,
    tie: r.tie,
    last_given_text: r.lastGiven ? `${r.lastGiven.refno ?? 'go-live'} · ${dmyText(r.lastGiven.date)}` : '',
    count_note: decOf(r.billedNotDelivered).isZero()
      ? ''
      : `incl. ${qtyText(r.billedNotDelivered)} billed, not yet given`,
  };
}

@Injectable()
export class GodownPositionPrintSource {
  private readonly runs = new RenderMemo<PositionExportPayload>();

  constructor(
    private readonly position: GodownPositionService,
    private readonly prisma: PrismaService,
  ) {}

  /** The prompts as the report's Show query, validated by the report's own DTO. */
  async query(request: ProviderRequest): Promise<GodownPositionQueryDto> {
    const a = request.params;
    const plain: Record<string, unknown> = {
      companyId: request.context.companyId,
      branchId: text(a, 'branch_id') ?? request.context.branchId ?? undefined,
      godownId: text(a, 'godown_id'),
      groupId: text(a, 'group_id'),
      brandId: text(a, 'brand_id'),
      qtyIn: text(a, 'qty_in')?.toUpperCase(),
      bucket: text(a, 'bucket')?.toUpperCase(),
      onlyToGive: flag(a, 'only_to_give'),
      hideZero: flag(a, 'hide_zero'),
      find: text(a, 'find'),
    };
    for (const key of Object.keys(plain)) {
      if (plain[key] === undefined) delete plain[key];
    }
    const dto = plainToInstance(GodownPositionQueryDto, plain);
    const problems = await validate(dto, { whitelist: true, forbidNonWhitelisted: true });
    if (problems.length > 0) {
      const messages = problems.flatMap((p) => Object.values(p.constraints ?? {}));
      throw new Error(
        `The print's filters are not what the Godown Stock Position takes: ${messages.join('; ')}`,
      );
    }
    return dto;
  }

  async data(request: ProviderRequest): Promise<PositionExportPayload> {
    const q = await this.query(request);
    const key = JSON.stringify([q, request.context.userId]);
    return this.runs.get(key, async () => {
      try {
        return await this.position.printData(q, request.context.userId);
      } catch (error) {
        throw new Error(refusalText(error));
      }
    });
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
export class GodownPositionHeadProvider implements PrintDataProvider {
  readonly code = 'reports.godown_position.head';
  readonly label = 'Godown Stock Position — heading, tiles, kg totals and tie';
  readonly cardinality = 'one' as const;
  constructor(private readonly source: GodownPositionPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow> {
    const [data, printedBy] = await Promise.all([
      this.source.data(request),
      this.source.printedBy(request.context.userId),
    ]);
    return positionHeadRow(data, printedBy, new Date());
  }
}

@Injectable()
export class GodownPositionRowsProvider implements PrintDataProvider {
  readonly code = 'reports.godown_position.rows';
  readonly label = 'Godown Stock Position — one row per item × godown, as the grid (also the count sheet)';
  readonly cardinality = 'many' as const;
  constructor(private readonly source: GodownPositionPrintSource) {}

  async resolve(request: ProviderRequest): Promise<PrintRow[]> {
    const data = await this.source.data(request);
    return data.rows.slice(0, request.rowLimit).map((row, i) => positionPrintRow(row, i));
  }
}

/** For print-render.module.ts's explicit registry. */
export const GODOWN_POSITION_PRINT_PROVIDERS = [
  GodownPositionHeadProvider,
  GodownPositionRowsProvider,
] as const;
