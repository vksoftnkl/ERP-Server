import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../../../database/prisma/prisma.service';
import { RequestContextService } from '../../../../common/request-context/request-context.service';
import {
  assertMenuRight,
  RIGHT_COLUMN,
  type MenuRight,
  type MenuRights,
} from '../../../../common/posting/rights';
import {
  throwForbidden,
  throwUnprocessable,
} from '../../../../common/utils/module-shared.utils';
import type {
  GodownPositionBehindDto,
  GodownPositionExportDto,
  GodownPositionQueryDto,
} from './dto/godown-position-query.dto';
import {
  behindBillsSql,
  behindChallansSql,
  byLotSql,
  itemFactsSql,
  positionSql,
  type BehindBillDbRow,
  type BehindChallanDbRow,
  type ByLotDbRow,
  type ItemFactDbRow,
  type PositionDbRow,
  type PositionSqlScope,
} from './godown-position.sql';
import {
  behindBillRows,
  behindChallanRows,
  buildRows,
  byLotOf,
  dec,
  filterRows,
  printedAsOf,
  qtyIn,
  sortRows,
  tilesOf,
  totalsOf,
  unitOf,
} from './godown-position.rules';
import {
  GODOWN_POSITION_CODE_PREFIX,
  GODOWN_POSITION_ERROR,
  GODOWN_POSITION_MENU_ID,
  type BehindPayload,
  type PositionBucket,
  type PositionExportPayload,
  type PositionHead,
  type PositionPayload,
  type PositionQtyIn,
  type PositionRights,
} from './types/godown-position.types';

/**
 * Godown Stock Position (menu 306, delivery tracking plan §8.3): per item ×
 * godown, Physical = Owned + Billed not delivered, today only. Read-only.
 *
 * Every route checks VIEW on 306 first (403 GODOWN_POSITION_RIGHT_VIEW;
 * /export also EXPORT), then refuses — in this order — a branch not of the
 * company, a godown not of the branch (422 GODOWN_POSITION_GODOWN_NOT_IN_BRANCH),
 * a missing group / brand and (on /behind) item. Every read of one answer runs
 * in ONE read-only REPEATABLE READ transaction with custom plans and JIT off
 * (one moment's numbers; a generic plan of the optional scopes is seconds).
 * No HTTP cache: the answer depends on the caller's rights and on now.
 */
const TX_OPTIONS = {
  isolationLevel: Prisma.TransactionIsolationLevel.RepeatableRead,
  maxWait: 10_000,
  timeout: 60_000,
} as const;

type Db = Prisma.TransactionClient;

interface LookupRow {
  br_comp_id: string | null;
  br_name: string | null;
  br_is_deleted: boolean | null;
  comp_name: string | null;
  gdl_branch_id: string | null;
  gdl_name: string | null;
  gdl_is_deleted: boolean | null;
  itg_id: string | null;
  itg_name: string | null;
  itg_is_deleted: boolean | null;
  brand_id: string | null;
  brand_name: string | null;
  brand_is_deleted: boolean | null;
  item_id: string | null;
  item_company_id: string | null;
  item_is_deleted: boolean | null;
}

interface Moment {
  today: string;
  /** IST, 12-hour. */
  asOf: string;
}

@Injectable()
export class GodownPositionService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  /** GET /stock/reports/godown-position — Show. */
  async show(q: GodownPositionQueryDto): Promise<PositionPayload> {
    const rights = await this.assertRight('view', 'open the Godown Stock Position');
    const built = await this.build(q);
    return {
      head: built.head,
      tiles: tilesOf(built.rows),
      rows: built.rows.map((r) => r.wire),
      totals: totalsOf(built.rows),
      rights: rightsOf(rights),
    };
  }

  /** GET /stock/reports/godown-position/export — every row of a Show, for Excel / print. */
  async export(q: GodownPositionExportDto): Promise<PositionExportPayload> {
    const rights = await this.assertRight('view', 'open the Godown Stock Position');
    this.assertAlso(rights, 'export', 'export the Godown Stock Position');
    return this.exportPayload(q);
  }

  /**
   * Print (delivery tracking P5: purposes GODOWN_POSITION and COUNT_SHEET).
   * VIEW and PRINT on 306 for the user the RENDER names (403
   * GODOWN_POSITION_RIGHT_VIEW / _PRINT) — a print provider runs without the
   * request context — then the run /export answers.
   */
  async printData(q: GodownPositionQueryDto, userId: string | null): Promise<PositionExportPayload> {
    const rights = await assertMenuRight(this.prisma, {
      userId,
      menuId: GODOWN_POSITION_MENU_ID,
      right: 'view',
      codePrefix: GODOWN_POSITION_CODE_PREFIX,
      action: 'open the Godown Stock Position',
    });
    this.assertAlso(rights, 'print', 'print the Godown Stock Position');
    return this.exportPayload(q);
  }

  /** Show's run with printedAs and totalRows (the Excel / print body). */
  private async exportPayload(q: GodownPositionQueryDto): Promise<PositionExportPayload> {
    const built = await this.build(q);
    return {
      head: built.head,
      printedAs: printedAsOf({
        branchName: built.head.branchName,
        godownName: built.head.godownName,
        groupName: built.head.groupName,
        brandName: built.head.brandName,
        asOf: built.head.asOf,
        qtyIn: built.head.qtyIn,
        bucket: built.head.bucket,
        onlyToGive: built.head.onlyToGive,
        hideZero: built.head.hideZero,
        find: built.head.find,
      }),
      tiles: tilesOf(built.rows),
      rows: built.rows.map((r) => r.wire),
      totals: totalsOf(built.rows),
      totalRows: built.rows.length,
    };
  }

  /** GET /stock/reports/godown-position/behind — the bills / challans behind one figure, + by lot. */
  async behind(q: GodownPositionBehindDto): Promise<BehindPayload> {
    await this.assertRight('view', 'open the Godown Stock Position');
    const mode: PositionQtyIn = q.qtyIn ?? 'SELLING';
    const bucket: PositionBucket = q.bucket ?? 'SALEABLE';
    return this.snapshot(async (db) => {
      const row = await this.lookup(db, { ...q, groupId: undefined, brandId: undefined }, q.itemId);
      const s = this.scopeOf(q.companyId, q.branchId, q.godownId, bucket, null, null);
      const [fact] = await db.$queryRaw<ItemFactDbRow[]>(itemFactsSql([q.itemId]));
      const unit = unitOf(fact, mode);
      const lots = byLotOf(await db.$queryRaw<ByLotDbRow[]>(byLotSql(s, q.itemId)), unit.factor);
      let total = dec(0);
      let rows: BehindPayload['rows'];
      if (q.kind === 'BND') {
        const bills = await db.$queryRaw<BehindBillDbRow[]>(behindBillsSql(s, q.itemId));
        for (const b of bills) total = total.plus(dec(b.pending_base));
        rows = behindBillRows(bills, unit.factor);
      } else {
        const dcs = await db.$queryRaw<BehindChallanDbRow[]>(behindChallansSql(s, q.itemId));
        for (const d of dcs) total = total.plus(dec(d.open_base));
        rows = behindChallanRows(dcs, unit.factor);
      }
      return {
        kind: q.kind,
        itemId: q.itemId,
        itemName: fact?.item_name ?? '',
        godownId: q.godownId,
        godownName: row.gdl_name,
        unitName: unit.name,
        unitFactor: unit.factor.toFixed(6),
        rows,
        total: qtyIn(total, unit.factor),
        byLot: lots.byLot,
        sum: lots.sum,
      };
    });
  }

  // ── the run ─────────────────────────────────────────────────────────────

  private async build(q: GodownPositionQueryDto): Promise<{
    head: PositionHead;
    rows: ReturnType<typeof sortRows>;
  }> {
    const mode: PositionQtyIn = q.qtyIn ?? 'SELLING';
    const bucket: PositionBucket = q.bucket ?? 'SALEABLE';
    const hideZero = q.hideZero ?? true;
    const onlyToGive = q.onlyToGive ?? false;
    const find = (q.find ?? '').trim();
    return this.snapshot(async (db) => {
      const row = await this.lookup(db, q);
      const m = await this.moment(db);
      const s = this.scopeOf(
        q.companyId,
        q.branchId,
        q.godownId ?? null,
        bucket,
        q.groupId ?? null,
        q.brandId ?? null,
      );
      const dbRows = await db.$queryRaw<PositionDbRow[]>(positionSql(s));
      const items = [...new Set(dbRows.map((r) => r.item_id))];
      const facts = items.length ? await db.$queryRaw<ItemFactDbRow[]>(itemFactsSql(items)) : [];
      const godownRows = await db.$queryRaw<
        { gdl_id: string; gdl_name: string; gdl_sort: number | null }[]
      >`
        SELECT gdl_id, gdl_name, gdl_sort FROM inventory.godown_locations
         WHERE gdl_branch_id = ${q.branchId}::uuid
            OR gdl_id = ANY(${[...new Set(dbRows.map((r) => r.godown_id))]}::uuid[])`;
      const godowns = new Map(
        godownRows.map((g) => [
          g.gdl_id,
          { name: g.gdl_name, sort: g.gdl_sort === null ? Number.MAX_SAFE_INTEGER : Number(g.gdl_sort) },
        ]),
      );
      const rows = sortRows(
        filterRows(buildRows({ rows: dbRows, facts, godowns, qtyIn: mode }), {
          hideZero,
          onlyToGive,
          find,
        }),
      );
      const head: PositionHead = {
        companyId: q.companyId,
        companyName: row.comp_name,
        branchId: q.branchId,
        branchName: row.br_name,
        godownId: q.godownId ?? null,
        godownName: q.godownId ? row.gdl_name : null,
        groupId: q.groupId ?? null,
        groupName: q.groupId ? row.itg_name : null,
        brandId: q.brandId ?? null,
        brandName: q.brandId ? row.brand_name : null,
        asOf: m.asOf,
        today: m.today,
        qtyIn: mode,
        bucket,
        onlyToGive,
        hideZero,
        find,
      };
      return { head, rows };
    });
  }

  private scopeOf(
    companyId: string,
    branchId: string,
    godownId: string | null,
    bucket: PositionBucket,
    groupId: string | null,
    brandId: string | null,
  ): PositionSqlScope {
    return {
      companyId,
      branchId,
      godownId,
      bucket: bucket === 'ALL' ? null : bucket,
      groupId,
      brandId,
    };
  }

  // ── guards, snapshot, lookups ───────────────────────────────────────────

  /** 403 GODOWN_POSITION_RIGHT_<RIGHT> unless the caller holds it on menu 306. */
  private assertRight(right: MenuRight, action: string): Promise<MenuRights> {
    return assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: GODOWN_POSITION_MENU_ID,
      right,
      codePrefix: GODOWN_POSITION_CODE_PREFIX,
      action,
    });
  }

  /** A second right on the rights VIEW already loaded — same refusal shape. */
  private assertAlso(rights: MenuRights, right: MenuRight, action: string): void {
    if (rights[right]) return;
    const message =
      `This user may not ${action} (menu ${GODOWN_POSITION_MENU_ID}: ` +
      `${RIGHT_COLUMN[right]} is not granted)`;
    throwForbidden(message, [
      { field: 'userId', message, code: `${GODOWN_POSITION_CODE_PREFIX}_RIGHT_${right.toUpperCase()}` },
    ]);
  }

  private snapshot<T>(work: (db: Db) => Promise<T>): Promise<T> {
    return this.prisma.$transaction(async (tx) => {
      await tx.$executeRaw`SET TRANSACTION READ ONLY`;
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      await tx.$executeRaw`SET LOCAL jit = off`;
      return work(tx);
    }, TX_OPTIONS);
  }

  private async moment(db: Db): Promise<Moment> {
    const [row] = await db.$queryRaw<{ d: string; at: string }[]>`
      SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d,
             to_char(now() AT TIME ZONE 'Asia/Kolkata', 'DD/MM/YYYY HH12:MI AM') AS at`;
    return { today: row.d, asOf: row.at };
  }

  /** One round trip for the ids the query names, then the refusals in order. */
  private async lookup(
    db: Db,
    q: { companyId: string; branchId: string; godownId?: string; groupId?: string; brandId?: string },
    itemId: string | null = null,
  ): Promise<LookupRow> {
    const [row] = await db.$queryRaw<LookupRow[]>`
      SELECT b.br_comp_id, b.br_name, b.br_is_deleted, c.comp_name,
             g.gdl_branch_id, g.gdl_name, g.gdl_is_deleted,
             gr.itg_id, gr.itg_name, gr.itg_is_deleted,
             bd.brand_id, bd.brand_name, bd.brand_is_deleted,
             i.item_id, i.item_company_id, i.item_is_deleted
        FROM (SELECT 1) x
        LEFT JOIN public.branch_master b ON b.br_id = ${q.branchId}::uuid
        LEFT JOIN public.companys c ON c.comp_id = ${q.companyId}::uuid
        LEFT JOIN inventory.godown_locations g ON g.gdl_id = ${q.godownId ?? null}::uuid
        LEFT JOIN inventory.item_group_master gr ON gr.itg_id = ${q.groupId ?? null}::uuid
        LEFT JOIN inventory.item_brand_master bd ON bd.brand_id = ${q.brandId ?? null}::uuid
        LEFT JOIN inventory.item_master i ON i.item_id = ${itemId}::uuid`;
    if (!row.br_comp_id || row.br_comp_id !== q.companyId || row.br_is_deleted === true) {
      refuse(
        GODOWN_POSITION_ERROR.BRANCH_NOT_IN_COMPANY,
        'branchId',
        'That branch is not part of this company.',
      );
    }
    if (q.godownId && (row.gdl_branch_id !== q.branchId || row.gdl_is_deleted === true)) {
      refuse(
        GODOWN_POSITION_ERROR.GODOWN_NOT_IN_BRANCH,
        'godownId',
        `Godown ${row.gdl_name ?? q.godownId} is not a godown of ${row.br_name ?? 'this branch'}.`,
        { godown: row.gdl_name ?? 'That godown', branch: row.br_name ?? 'this branch' },
      );
    }
    if (q.groupId && (!row.itg_id || row.itg_is_deleted === true)) {
      refuse(GODOWN_POSITION_ERROR.GROUP_NOT_FOUND, 'groupId', 'That item group is not there now.');
    }
    if (q.brandId && (!row.brand_id || row.brand_is_deleted === true)) {
      refuse(GODOWN_POSITION_ERROR.BRAND_NOT_FOUND, 'brandId', 'That brand is not there now.');
    }
    // Not compared with the company: a row of this report is any holding the
    // branch's stock_balance has, and test data holds other companies' items
    // there (the Stock Summary flags them OTHER_COMPANY rather than hiding them).
    if (itemId && (!row.item_id || row.item_is_deleted === true)) {
      refuse(GODOWN_POSITION_ERROR.ITEM_NOT_FOUND, 'itemId', 'This item is not there now.');
    }
    return row;
  }
}

function refuse(
  code: string,
  field: string,
  message: string,
  params?: Record<string, string>,
): never {
  throwUnprocessable('Godown Stock Position request refused', [
    { field, message, code, ...(params ? { params } : {}) },
  ]);
}

function rightsOf(rights: MenuRights): PositionRights {
  return { view: rights.view, print: rights.print, export: rights.export };
}
