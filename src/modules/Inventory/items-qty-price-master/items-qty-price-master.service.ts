import { assertDeleteState } from '../utils/master-tree.helper';
import { HttpException, Injectable } from '@nestjs/common';
import { ItemQtyPrice, Prisma } from '@prisma/client';
import {
  ConfiguredGridListResult,
  ConfiguredGridSqlService,
} from 'src/common/configured-grid-sql/configured-grid-sql.service';
import { GetItemQtyPriceQueryDto } from './dto/get-item-qty-price-query.dto';
import { SaveItemQtyPriceDto } from './dto/save-item-qty-price.dto';
import {
  ItemQtyPriceDeleteResult,
  ItemQtyPriceErrorDetail,
  ItemQtyPriceListItem,
  ItemQtyPriceListMeta,
  ItemQtyPricePayload,
} from './types/item-qty-price-api.types';
import { ItemQtyPriceErrorCode } from './types/item-qty-price-error-codes';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import {
  DEFAULT_ACTOR,
  hasOwnProperty,
  isForeignKeyConstraintError,
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryConflict,
  throwInventoryForbidden,
  throwInventoryNotFound,
  throwOnUniqueConstraintError,
  throwUnprocessable,
  toNullableNumber,
  toNumber,
} from 'src/common/utils/module-service.utils';
import {
  NO_RIGHTS,
  assertMenuRight,
  loadRights,
  type MenuRight,
  type MenuRights,
} from '../../../common/posting/rights';
import { isHqUserType } from '../../stocks/selling-price-bulk/types/selling-price-bulk.types';
import { isSellingSlabLevel } from './qty-slab.rules';
import {
  resolvePagination,
  runConfiguredGridQuery,
  runInventoryListQuery,
} from 'src/common/utils/module-list.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PriceMasterWriter } from '../item-price-log/price-master-writer.service';
import { PRICE_ORIGIN } from '../item-price-log/types/price-change-log.types';

/** Qty-wise Prices — the menu whose user_menus flags gate every slab route (§4.3). */
export const QTY_PRICE_MENU_ID = 244;
/** assertMenuRight's code family: ITEM_QTY_PRICE_RIGHT_VIEW / _CREATE / _EDIT / _DELETE. */
export const QTY_PRICE_RIGHT_PREFIX = 'ITEM_QTY_PRICE';

/** ItemsQtyPriceMasterService.save's options (save-with-rates passes them; /create none). */
export interface SlabSaveOptions {
  /** File each row's refusal under `<fieldPrefix><index>.<field>` (C-e, 'slabs.'). */
  fieldPrefix?: string;
}

/** A slab named by id, as the rights / level / HQ checks read it. */
export interface StoredSlabScope {
  iqpId: string;
  itemId: string;
  branchId: string | null;
  priceLevel: number | null;
  isDeleted: boolean;
}

const ITEM_QTY_PRICE_TABLE_NAME = 'item qty price';
const ITEM_QTY_PRICE_AUDIT_SCREEN_NAME = 'Item Qty Price Master';

// Joins that resolve the foreign-key ids to their display names for the GET
// responses. iqp_item_unit_id holds an iuc_id, so the unit name is reached
// through item_unit_conversion -> unit.
const ITEM_QTY_PRICE_INCLUDE = {
  item: { select: { itemNameEn: true } },
  itemUnitConversion: { select: { unit: { select: { unit_name: true } } } },
  company: { select: { compName: true } },
  branch: { select: { brName: true } },
  priceLevel: { select: { iplName: true } },
  party: { select: { cusName: true } },
} satisfies Prisma.ItemQtyPriceInclude;

// toPayload also runs on plain rows (create/update/delete audit trail) where the
// joins above are absent, so every relation is optional here.
type ItemQtyPriceWithNames = ItemQtyPrice & {
  item?: { itemNameEn: string } | null;
  itemUnitConversion?: { unit: { unit_name: string } | null } | null;
  company?: { compName: string } | null;
  branch?: { brName: string } | null;
  priceLevel?: { iplName: string } | null;
  party?: { cusName: string | null } | null;
};

@Injectable()
export class ItemsQtyPriceMasterService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly configuredGridSqlService: ConfiguredGridSqlService,
    private readonly requestContextService: RequestContextService,
    /** Notes 144 — the one writer of the slab table; it logs every change it makes. */
    private readonly priceWriter: PriceMasterWriter,
  ) {}

  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
    tx?: Prisma.TransactionClient,
    opts?: SlabSaveOptions,
  ): Promise<ItemQtyPricePayload>;
  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto[],
    tx?: Prisma.TransactionClient,
    opts?: SlabSaveOptions,
  ): Promise<ItemQtyPricePayload[]>;
  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto | SaveItemQtyPriceDto[],
    tx?: Prisma.TransactionClient,
    opts?: SlabSaveOptions,
  ): Promise<ItemQtyPricePayload | ItemQtyPricePayload[]>;
  /**
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own.
   * @param opts `fieldPrefix` (save-with-rates: 'slabs.') — every refusal of a
   * row is filed under `<prefix><index>.<field>`; absent, the fields are as
   * /create has always answered them.
   */
  async save(
    saveItemQtyPriceDto: SaveItemQtyPriceDto | SaveItemQtyPriceDto[],
    tx?: Prisma.TransactionClient,
    opts?: SlabSaveOptions,
  ): Promise<ItemQtyPricePayload | ItemQtyPricePayload[]> {
    const saveItems = Array.isArray(saveItemQtyPriceDto)
      ? saveItemQtyPriceDto
      : [saveItemQtyPriceDto];
    const prefix = opts?.fieldPrefix;
    const saveAll = async (client: Prisma.TransactionClient) => {
      const savedItems: ItemQtyPricePayload[] = [];
      for (const [index, saveItem] of saveItems.entries()) {
        try {
          savedItems.push(await this.saveItemQtyPrice(client, saveItem));
        } catch (error: unknown) {
          throw prefix === undefined ? error : this.atRow(error, `${prefix}${index}.`);
        }
      }
      // After the whole batch, so a ladder re-cut in one save (1–10 → 1–5 and
      // 10–20 → 5–20) is judged on where it ends, not on the order sent.
      try {
        await this.assertNoOverlaps(
          client,
          savedItems.map((saved) => saved.iqp_id),
          Array.isArray(saveItemQtyPriceDto) ? 'indexed' : 'single',
          'iqp_from_qty',
        );
      } catch (error: unknown) {
        // Already `<index>.iqp_from_qty` (indexed): only the prefix goes on.
        throw prefix === undefined ? error : this.atRow(error, prefix, true);
      }
      return savedItems;
    };
    try {
      const results = tx ? await saveAll(tx) : await this.prisma.$transaction(saveAll);
      return Array.isArray(saveItemQtyPriceDto) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  /**
   * One row's refusal, filed under `at` (review fix C-e): a database error is
   * worded first (handleWriteError — DUPLICATE / REFERENCE_NOT_FOUND), then
   * every error's field gets `at` in front — `iqp_to_qty` → `slabs.2.iqp_to_qty`.
   * `indexed`: the field already starts with its index (`2.iqp_from_qty`), and
   * `at` is the prefix alone. The exception itself (class, status) is kept.
   */
  private atRow(error: unknown, at: string, indexed = false): unknown {
    let refusal = error;
    if (!(refusal instanceof HttpException)) {
      try {
        this.handleWriteError(refusal);
      } catch (worded: unknown) {
        refusal = worded;
      }
    }
    if (!(refusal instanceof HttpException)) {
      return refusal;
    }
    const body = refusal.getResponse();
    if (typeof body === 'object' && body !== null && Array.isArray((body as { errors?: unknown }).errors)) {
      const coded = body as { errors: Array<{ field?: unknown }> };
      coded.errors = coded.errors.map((detail) => {
        const field = typeof detail.field === 'string' && detail.field ? detail.field : 'request';
        return { ...detail, field: indexed && !/^\d+\./.test(field) ? field : `${at}${field}` };
      });
    }
    return refusal;
  }

  async list(
    queryDto: GetItemQtyPriceQueryDto,
  ): Promise<ConfiguredGridListResult<ItemQtyPriceListItem, ItemQtyPriceListMeta>> {
    const { page, limit, skip } = resolvePagination(queryDto);
    const where: Prisma.ItemQtyPriceWhereInput = {
      iqpIsDeleted: false,
      ...(queryDto.iqp_item_id !== undefined && { iqpItemId: queryDto.iqp_item_id }),
      ...(queryDto.iqp_item_unit_id !== undefined && { iqpItemUnitId: queryDto.iqp_item_unit_id }),
      ...(queryDto.iqp_company_id !== undefined && { iqpCompanyId: queryDto.iqp_company_id }),
      ...(queryDto.iqp_branch_id !== undefined && { iqpBranchId: queryDto.iqp_branch_id }),
      ...(queryDto.iqp_party_id !== undefined && { iqpPartyId: queryDto.iqp_party_id }),
      ...(queryDto.iqp_price_level !== undefined && { iqpPriceLevel: queryDto.iqp_price_level }),
      ...(queryDto.iqp_is_active !== undefined && { iqpIsActive: queryDto.iqp_is_active }),
    };
    return runInventoryListQuery<ItemQtyPriceWithNames, ItemQtyPriceListItem>(
      { page, limit },
      {
        configuredGridFn: () =>
          runConfiguredGridQuery<ItemQtyPriceListItem>(this.configuredGridSqlService, {
            tableName: ITEM_QTY_PRICE_TABLE_NAME,
            alias: 'item_qty_price_grid',
            search: queryDto.search,
            page,
            limit,
            skip,
          }),
        countFn: () => this.prisma.itemQtyPrice.count({ where }),
        findManyFn: () =>
          this.prisma.itemQtyPrice.findMany({
            where,
            include: ITEM_QTY_PRICE_INCLUDE,
            // Group a slab ladder by item + unit, then order low → high by lower
            // bound; iqp_id keeps ties stable.
            orderBy: [
              { iqpItemId: 'asc' },
              { iqpItemUnitId: 'asc' },
              { iqpFromQty: 'asc' },
              { iqpId: 'asc' },
            ],
            skip,
            take: limit,
          }),
        toItemFn: (record) => this.toPayload(record),
      },
    );
  }

  async getById(iqpId: string): Promise<ItemQtyPricePayload> {
    const record = await this.prisma.itemQtyPrice.findFirst({
      where: { iqpId, iqpIsDeleted: false },
      include: ITEM_QTY_PRICE_INCLUDE,
    });
    if (!record) {
      this.throwNotFound(iqpId);
    }
    return this.toPayload(record);
  }

  /**
   * DELETE deletes — it is no longer a toggle (notes 70 C1): a slab that is
   * already deleted is a 409, and restore() (POST /item-qty-prices/restore)
   * brings one back. A batch is all-or-nothing, like the save.
   */
  /**
   * @param tx When supplied, the batch runs inside the caller's transaction
   * instead of opening its own (Qty-wise Prices' save-with-rates: the deletes,
   * the card and the slabs commit or roll back together).
   */
  async softDelete(iqpId: string, tx?: Prisma.TransactionClient): Promise<ItemQtyPriceDeleteResult>;
  async softDelete(
    iqpId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult[]>;
  async softDelete(
    iqpId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]>;
  async softDelete(
    iqpId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]> {
    return this.setDeleted(iqpId, true, tx);
  }
  /**
   * Restore deleted slabs. 409 when one is not deleted, or when a live slab now
   * holds the same key (uq_iqp_slab). `tx` as softDelete.
   */
  async restore(iqpId: string, tx?: Prisma.TransactionClient): Promise<ItemQtyPriceDeleteResult>;
  async restore(
    iqpId: string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult[]>;
  async restore(
    iqpId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]>;
  async restore(
    iqpId: string | string[],
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]> {
    return this.setDeleted(iqpId, false, tx);
  }

  private async setDeleted(
    iqpId: string | string[],
    wantDeleted: boolean,
    tx?: Prisma.TransactionClient,
  ): Promise<ItemQtyPriceDeleteResult | ItemQtyPriceDeleteResult[]> {
    const ids = Array.isArray(iqpId) ? iqpId : [iqpId];
    const applyAll = async (client: Prisma.TransactionClient) => {
      const results: ItemQtyPriceDeleteResult[] = [];
      for (const id of ids) {
        results.push(await this.setDeletedItemQtyPrice(client, id, wantDeleted));
      }
      if (!wantDeleted) {
        await this.assertNoOverlaps(
          client,
          ids,
          Array.isArray(iqpId) ? 'indexed' : 'single',
          'iqp_id',
        );
      }
      return results;
    };
    try {
      const results = tx ? await applyAll(tx) : await this.prisma.$transaction(applyAll);
      return Array.isArray(iqpId) ? results : results[0];
    } catch (error: unknown) {
      this.handleWriteError(error);
      throw error;
    }
  }

  // ── menu 244 rights and the slab rules shared with save-with-rates ────────
  // Plan 2026-11-05 §4.3 / §4.6 item 5 (A-13, A-14): until then the routes
  // checked only the login token.

  /** 403 `ITEM_QTY_PRICE_RIGHT_<RIGHT>` unless the caller holds `right` on menu 244. */
  async assertRight(right: MenuRight, action: string): Promise<MenuRights> {
    return assertMenuRight(this.prisma, {
      userId: this.requestContextService.getUserId(),
      menuId: QTY_PRICE_MENU_ID,
      right,
      codePrefix: QTY_PRICE_RIGHT_PREFIX,
      action,
    });
  }

  /** POST /create — CREATE for a row without iqp_id, EDIT for a row with one. */
  async assertSaveRights(rows: readonly Pick<SaveItemQtyPriceDto, 'iqp_id'>[]): Promise<void> {
    if (rows.some((row) => !row.iqp_id)) {
      await this.assertRight('create', 'add qty-wise prices');
    }
    if (rows.some((row) => row.iqp_id)) {
      await this.assertRight('edit', 'change qty-wise prices');
    }
  }

  /**
   * POST /create, rights FIRST (plan §4.3; review 2026-11-06): the same
   * verdict as assertSaveRights, read off the RAW body before it is validated,
   * so a caller without the right is told 403, not 400. A row names an iqp_id
   * when the key holds anything but undefined / null / ''. A body that is not
   * a non-empty array names no row: CREATE or EDIT will do (the shape check
   * answers next), neither is 403 ITEM_QTY_PRICE_RIGHT_CREATE. A caller who
   * holds the rights gets exactly the answer it got before.
   */
  async assertSaveRightsOfBody(body: unknown): Promise<void> {
    const rows = Array.isArray(body) ? (body as unknown[]) : [];
    if (rows.length) {
      const named = (row: unknown) => {
        const id =
          typeof row === 'object' && row !== null ? (row as { iqp_id?: unknown }).iqp_id : undefined;
        return id !== undefined && id !== null && id !== '';
      };
      return this.assertSaveRights(
        rows.map((row) => ({ iqp_id: named(row) ? 'named' : undefined })),
      );
    }
    const userId = this.requestContextService.getUserId();
    const rights = userId ? await loadRights(this.prisma, userId, QTY_PRICE_MENU_ID) : NO_RIGHTS;
    if (!rights.create && !rights.edit) {
      await this.assertRight('create', 'add qty-wise prices');
    }
  }

  /**
   * D16 (review fix C-d) — a user type that is not head office creates,
   * changes, deletes and restores only slabs of its OWN branch: the branch the
   * session logged in at (the access token's branch_id — the registered
   * device's branch — through the request context; never a body field). A
   * session with no such branch (no registered device: a web login, an
   * unregistered counter) owns none.
   */
  private ownBranchId(): string | null {
    return this.requestContextService.getBranchId()?.toLowerCase() ?? null;
  }

  private throwOtherBranch(fields: readonly string[], own: string | null): never {
    const message = own
      ? 'A slab for another branch can only be changed by head office. Pick your own branch for the slab.'
      : 'This login is not at a branch counter, so only head office can change qty-wise prices.';
    throwInventoryForbidden<ItemQtyPriceErrorDetail>('A slab of another branch needs head office', [
      ...fields.map((field) => ({ field, code: ItemQtyPriceErrorCode.OTHER_BRANCH, message })),
    ]);
  }

  /**
   * C-d on a save: a new slab's branch, and a changed slab's stored branch
   * AND its branch after the save (sent, else stored), must be the session's
   * own. A branch blank after the save is assertChainSlabsAllowed's
   * (CHAIN_HQ_ONLY, run first); an id that names no slab is the writer's 404.
   * 403 `ITEM_QTY_PRICE_OTHER_BRANCH`, field `<prefix><index>.iqp_branch_id`.
   */
  async assertOwnBranchSlabs(
    client: Pick<Prisma.TransactionClient, 'itemQtyPrice'>,
    rows: readonly Pick<SaveItemQtyPriceDto, 'iqp_id' | 'iqp_branch_id'>[],
    fieldPrefix = '',
    stored?: ReadonlyMap<string, StoredSlabScope>,
  ): Promise<void> {
    if (!rows.length || isHqUserType(this.requestContextService.getUserType())) {
      return;
    }
    const known =
      stored ??
      (await this.readStoredSlabs(
        client,
        rows.filter((row) => row.iqp_id).map((row) => row.iqp_id!),
      ));
    const own = this.ownBranchId();
    const owned = (branchId: string | null) => own !== null && branchId?.toLowerCase() === own;
    const wrong = rows
      .map((row, index) => {
        const before = row.iqp_id ? known.get(row.iqp_id.toLowerCase()) : undefined;
        const after =
          row.iqp_branch_id !== undefined ? row.iqp_branch_id : (before?.branchId ?? null);
        return {
          index,
          ok: (!before || owned(before.branchId)) && (after === null || owned(after)),
        };
      })
      .filter(({ ok }) => !ok);
    if (wrong.length) {
      this.throwOtherBranch(
        wrong.map(({ index }) => `${fieldPrefix}${index}.iqp_branch_id`),
        own,
      );
    }
  }

  /**
   * C-d on a delete / restore: each named slab's stored branch must be the
   * session's own (a branch-blank slab is head office's). An id that names no
   * slab is skipped — the writer answers its 404. `fieldOf(index)` names the
   * request path. 403 `ITEM_QTY_PRICE_OTHER_BRANCH`.
   */
  async assertOwnBranchSlabIds(
    client: Pick<Prisma.TransactionClient, 'itemQtyPrice'>,
    ids: readonly string[],
    fieldOf: (index: number) => string,
    stored?: ReadonlyMap<string, StoredSlabScope>,
  ): Promise<void> {
    if (!ids.length || isHqUserType(this.requestContextService.getUserType())) {
      return;
    }
    const known = stored ?? (await this.readStoredSlabs(client, ids));
    const own = this.ownBranchId();
    const wrong = ids
      .map((id, index) => ({ index, slab: known.get(id.toLowerCase()) }))
      .filter(({ slab }) => slab && (own === null || slab.branchId?.toLowerCase() !== own));
    if (wrong.length) {
      this.throwOtherBranch(
        wrong.map(({ index }) => fieldOf(index)),
        own,
      );
    }
  }

  /** POST /create's C-d check: rows indexed as the batch (`<index>.iqp_branch_id`). */
  async assertOwnBranchSlabsOf(
    rows: readonly Pick<SaveItemQtyPriceDto, 'iqp_id' | 'iqp_branch_id'>[],
  ): Promise<void> {
    return this.assertOwnBranchSlabs(this.prisma, rows);
  }

  /** DELETE /delete and POST /restore's C-d check: `iqp_id`, or `<index>.iqp_id` for a batch. */
  async assertOwnBranchSlabIdsOf(ids: string | readonly string[]): Promise<void> {
    const list = typeof ids === 'string' ? [ids] : ids;
    return this.assertOwnBranchSlabIds(this.prisma, list, (index) =>
      typeof ids === 'string' ? 'iqp_id' : `${index}.iqp_id`,
    );
  }

  /** The stored scope of slabs named by id, any state (for the checks below and save-with-rates'). */
  async readStoredSlabs(
    client: Pick<Prisma.TransactionClient, 'itemQtyPrice'>,
    ids: readonly string[],
  ): Promise<Map<string, StoredSlabScope>> {
    const unique = [...new Set(ids.filter(Boolean))];
    if (!unique.length) {
      return new Map();
    }
    const rows = await client.itemQtyPrice.findMany({
      where: { iqpId: { in: unique } },
      select: {
        iqpId: true,
        iqpItemId: true,
        iqpBranchId: true,
        iqpPriceLevel: true,
        iqpIsDeleted: true,
      },
    });
    // Keyed by the lower-case id: a uuid the client sent in capitals is the same row.
    return new Map(
      rows.map((row) => [
        row.iqpId.toLowerCase(),
        {
          iqpId: row.iqpId,
          itemId: row.iqpItemId,
          branchId: row.iqpBranchId,
          priceLevel: row.iqpPriceLevel,
          isDeleted: row.iqpIsDeleted,
        },
      ]),
    );
  }

  /**
   * C6 / Q12 — a slab's price level, as it will stand after the save (sent,
   * else the stored one on an update), must be blank (all levels) or an ACTIVE
   * level 1–4 of the Price Level master (`fixed.price_levels`, what the screens
   * read). 422 `ITEM_QTY_PRICE_LEVEL_NOT_SELLING`, field `<prefix><index>.iqp_price_level`.
   */
  async assertSellingLevels(
    client: Pick<Prisma.TransactionClient, '$queryRaw' | 'itemQtyPrice'>,
    rows: readonly Pick<SaveItemQtyPriceDto, 'iqp_id' | 'iqp_price_level'>[],
    fieldPrefix = '',
    stored?: ReadonlyMap<string, StoredSlabScope>,
  ): Promise<void> {
    if (!rows.length) {
      return;
    }
    const known =
      stored ??
      (await this.readStoredSlabs(
        client,
        rows
          .filter((row) => row.iqp_id && row.iqp_price_level === undefined)
          .map((row) => row.iqp_id!),
      ));
    const active = await this.activeSellingLevels(client);
    const wrong = rows
      .map((row, index) => ({
        index,
        level:
          row.iqp_price_level !== undefined
            ? row.iqp_price_level
            : row.iqp_id
              ? (known.get(row.iqp_id.toLowerCase())?.priceLevel ?? null)
              : null,
      }))
      .filter(({ level }) => !isSellingSlabLevel(level, active));
    if (!wrong.length) {
      return;
    }
    throwUnprocessable<ItemQtyPriceErrorDetail>('A slab names a price level that is not for sale', [
      ...wrong.map(({ index, level }) => ({
        field: `${fieldPrefix}${index}.iqp_price_level`,
        code: ItemQtyPriceErrorCode.LEVEL_NOT_SELLING,
        message:
          `Price level ${level} is not an active selling level. Pick an active level 1–4 ` +
          `(${active.length ? active.join(', ') : 'none is active'}), or leave it blank for all levels.`,
      })),
    ]);
  }

  /**
   * Q9 (D16) — a slab for ALL branches (branch blank after the save: sent, else
   * stored) may only be saved by a head-office user type (`isHqUserType`, menu
   * 30's list): two branches working offline could otherwise both save the
   * same slab and break `uq_iqp_slab` at sync. 403 `ITEM_QTY_PRICE_CHAIN_HQ_ONLY`.
   */
  async assertChainSlabsAllowed(
    client: Pick<Prisma.TransactionClient, 'itemQtyPrice'>,
    rows: readonly Pick<SaveItemQtyPriceDto, 'iqp_id' | 'iqp_branch_id'>[],
    fieldPrefix = '',
    stored?: ReadonlyMap<string, StoredSlabScope>,
  ): Promise<void> {
    if (!rows.length || isHqUserType(this.requestContextService.getUserType())) {
      return;
    }
    const known =
      stored ??
      (await this.readStoredSlabs(
        client,
        rows
          .filter((row) => row.iqp_id && row.iqp_branch_id === undefined)
          .map((row) => row.iqp_id!),
      ));
    const chain = rows
      .map((row, index) => ({
        index,
        branchId:
          row.iqp_branch_id !== undefined
            ? row.iqp_branch_id
            : row.iqp_id
              ? (known.get(row.iqp_id.toLowerCase())?.branchId ?? null)
              : null,
      }))
      .filter(({ branchId }) => branchId === null);
    if (!chain.length) {
      return;
    }
    throwInventoryForbidden<ItemQtyPriceErrorDetail>('A slab for all branches needs head office', [
      ...chain.map(({ index }) => ({
        field: `${fieldPrefix}${index}.iqp_branch_id`,
        code: ItemQtyPriceErrorCode.CHAIN_HQ_ONLY,
        message:
          'A slab for all branches can only be saved by head office. Pick this branch for the slab.',
      })),
    ]);
  }

  /** POST /create's C6 check: rows indexed as the batch (`<index>.iqp_price_level`). */
  async assertSellingLevelsOf(
    rows: readonly Pick<SaveItemQtyPriceDto, 'iqp_id' | 'iqp_price_level'>[],
  ): Promise<void> {
    return this.assertSellingLevels(this.prisma, rows);
  }

  /** POST /create's Q9 check: rows indexed as the batch (`<index>.iqp_branch_id`). */
  async assertChainSlabsAllowedOf(
    rows: readonly Pick<SaveItemQtyPriceDto, 'iqp_id' | 'iqp_branch_id'>[],
  ): Promise<void> {
    return this.assertChainSlabsAllowed(this.prisma, rows);
  }

  /** Price levels 1–4 that are active on the Price Level master (fixed.price_levels). */
  async activeSellingLevels(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
  ): Promise<number[]> {
    const rows = await client.$queryRaw<Array<{ id: number }>>`
      SELECT price_lvl_id::int AS id
        FROM fixed.price_levels
       WHERE price_lvl_id BETWEEN 1 AND 4
         AND price_lvl_is_active IS TRUE
         AND "price_lvl_isDeleted" IS NOT TRUE
       ORDER BY 1`;
    return rows.map((row) => Number(row.id));
  }

  /**
   * Every live slab of one item, all scopes, in the /get payload shape (names
   * resolved), unit → lower bound → id. Qty-wise Prices' get-with-rates.
   */
  async listForItem(
    itemId: string,
    client: Pick<Prisma.TransactionClient, 'itemQtyPrice'> = this.prisma,
  ): Promise<ItemQtyPricePayload[]> {
    const rows = await client.itemQtyPrice.findMany({
      where: { iqpItemId: itemId, iqpIsDeleted: false },
      include: ITEM_QTY_PRICE_INCLUDE,
      orderBy: [{ iqpItemUnitId: 'asc' }, { iqpFromQty: 'asc' }, { iqpId: 'asc' }],
    });
    return rows.map((row) => this.toPayload(row));
  }

  private async saveItemQtyPrice(
    tx: Prisma.TransactionClient,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): Promise<ItemQtyPricePayload> {
    if (saveItemQtyPriceDto.iqp_id) {
      return this.updateItemQtyPrice(tx, saveItemQtyPriceDto);
    }
    return this.createItemQtyPrice(tx, saveItemQtyPriceDto);
  }

  private async setDeletedItemQtyPrice(
    tx: Prisma.TransactionClient,
    iqpId: string,
    wantDeleted: boolean,
  ): Promise<ItemQtyPriceDeleteResult> {
    // Found regardless of its deleted state: restore needs the deleted row.
    const existing = await tx.itemQtyPrice.findFirst({
      where: { iqpId },
      include: ITEM_QTY_PRICE_INCLUDE,
    });
    if (!existing) {
      this.throwNotFound(iqpId);
    }

    assertDeleteState(existing.iqpIsDeleted, wantDeleted, {
      label: 'qty price slab',
      idField: 'iqp_id',
      restoreRoute: '/item-qty-prices/restore',
      alreadyDeletedCode: ItemQtyPriceErrorCode.ALREADY_DELETED,
      notDeletedCode: ItemQtyPriceErrorCode.NOT_DELETED,
    });
    const wasDeleted = existing.iqpIsDeleted;
    const nextDeleted = wantDeleted;
    const modifiedOn = new Date();
    const modifiedBy = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    // Guarded update: only flips if state hasn't changed since the read.
    const moved = await this.priceWriter.setQtyPriceDeleted(
      tx,
      PRICE_ORIGIN.QTY_PRICE,
      iqpId,
      wasDeleted,
      { iqpIsDeleted: nextDeleted, iqpModifiedOn: modifiedOn, iqpModifiedBy: modifiedBy },
    );
    if (moved === 0) {
      this.throwNotFound(iqpId);
    }

    const originalRecord = this.toPayload(existing);
    const modifiedRecord = this.toPayload({
      ...existing,
      iqpIsDeleted: nextDeleted,
      iqpModifiedOn: modifiedOn,
      iqpModifiedBy: modifiedBy,
    });
    await this.auditLogService.logEntityChange(
      {
        action: nextDeleted ? 'cancel' : 'update',
        tableName: ITEM_QTY_PRICE_TABLE_NAME,
        screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iqpId,
        displayName: this.buildDisplayName(existing),
        originalRecord,
        modifiedRecord,
        userId: modifiedBy,
        notes: nextDeleted ? 'Item qty price soft deleted' : 'Item qty price restored',
      },
      tx,
    );

    return { iqp_id: iqpId, deleted: nextDeleted };
  }

  private async createItemQtyPrice(
    tx: Prisma.TransactionClient,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): Promise<ItemQtyPricePayload> {
    const effectiveFrom = this.parseRequiredDate(
      saveItemQtyPriceDto.iqp_effective_from,
      'iqp_effective_from',
    );
    const effectiveTo =
      this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null;
    this.validateDateRange(effectiveFrom, effectiveTo);
    this.validateQtyRange(
      saveItemQtyPriceDto.iqp_from_qty ?? 0,
      saveItemQtyPriceDto.iqp_to_qty ?? null,
    );
    this.validatePriceValue(saveItemQtyPriceDto, null);
    await this.assertUnitOfItem(
      tx,
      saveItemQtyPriceDto.iqp_item_id,
      saveItemQtyPriceDto.iqp_item_unit_id,
    );

    const now = new Date();
    const createdBy = resolveActor(
      saveItemQtyPriceDto.iqp_created_by,
      this.requestContextService.getUserId(),
    );
    const data: Prisma.ItemQtyPriceUncheckedCreateInput = {
      iqpItemId: saveItemQtyPriceDto.iqp_item_id,
      iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
      iqpEffectiveFrom: effectiveFrom,
      iqpCreatedOn: now,
      iqpCreatedBy: createdBy,
    };
    this.applyOptionalFields(data, saveItemQtyPriceDto);
    const created = await this.priceWriter.createQtyPrice(
      tx,
      PRICE_ORIGIN.QTY_PRICE,
      data,
      ITEM_QTY_PRICE_INCLUDE,
    );
    const payload = this.toPayload(created);
    await this.auditLogService.logEntityChange(
      {
        action: 'New',
        tableName: ITEM_QTY_PRICE_TABLE_NAME,
        screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: payload.iqp_id,
        displayName: this.buildDisplayName(created),
        originalRecord: null,
        modifiedRecord: payload,
        userId: createdBy,
        notes: 'Item qty price created',
      },
      tx,
    );
    return payload;
  }
  private async updateItemQtyPrice(
    tx: Prisma.TransactionClient,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): Promise<ItemQtyPricePayload> {
    const iqpId = saveItemQtyPriceDto.iqp_id!;
    const existing = await tx.itemQtyPrice.findFirst({
      where: { iqpId, iqpIsDeleted: false },
      include: ITEM_QTY_PRICE_INCLUDE,
    });
    if (!existing) {
      this.throwNotFound(iqpId);
    }
    const nextEffectiveFrom = this.parseRequiredDate(
      saveItemQtyPriceDto.iqp_effective_from,
      'iqp_effective_from',
    );
    // `!== undefined`, not hasOwnProperty: every declared DTO field is an own
    // property (ES2022 class fields), so an omitted bound was validated as 0 /
    // open while the stored one was kept. An explicit null still clears.
    const nextEffectiveTo =
      saveItemQtyPriceDto.iqp_effective_to !== undefined
        ? (this.parseOptionalDate(saveItemQtyPriceDto.iqp_effective_to, 'iqp_effective_to') ?? null)
        : existing.iqpEffectiveTo;
    this.validateDateRange(nextEffectiveFrom, nextEffectiveTo);
    const nextFromQty =
      saveItemQtyPriceDto.iqp_from_qty !== undefined
        ? saveItemQtyPriceDto.iqp_from_qty
        : toNumber(existing.iqpFromQty);
    const nextToQty =
      saveItemQtyPriceDto.iqp_to_qty !== undefined
        ? saveItemQtyPriceDto.iqp_to_qty
        : toNullableNumber(existing.iqpToQty);
    this.validateQtyRange(nextFromQty, nextToQty);
    this.validatePriceValue(saveItemQtyPriceDto, existing);
    await this.assertUnitOfItem(
      tx,
      saveItemQtyPriceDto.iqp_item_id,
      saveItemQtyPriceDto.iqp_item_unit_id,
    );
    const data: Prisma.ItemQtyPriceUncheckedUpdateInput = {
      iqpItemId: saveItemQtyPriceDto.iqp_item_id,
      iqpItemUnitId: saveItemQtyPriceDto.iqp_item_unit_id,
      iqpEffectiveFrom: nextEffectiveFrom,
      iqpModifiedOn: new Date(),
      iqpModifiedBy: resolveActor(
        saveItemQtyPriceDto.iqp_modified_by,
        this.requestContextService.getUserId(),
      ),
    };
    this.applyOptionalFields(data, saveItemQtyPriceDto);
    const updated = await this.priceWriter.updateQtyPrice(
      tx,
      PRICE_ORIGIN.QTY_PRICE,
      iqpId,
      data,
      ITEM_QTY_PRICE_INCLUDE,
    );
    const payload = this.toPayload(updated);
    await this.auditLogService.logEntityChange(
      {
        action: 'update',
        tableName: ITEM_QTY_PRICE_TABLE_NAME,
        screenName: ITEM_QTY_PRICE_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: iqpId,
        displayName: this.buildDisplayName(updated),
        originalRecord: this.toPayload(existing),
        modifiedRecord: payload,
        userId: payload.iqp_modified_by ?? this.requestContextService.getUserId() ?? DEFAULT_ACTOR,
        notes: 'Item qty price updated',
      },
      tx,
    );
    return payload;
  }
  private applyOptionalFields(
    data: Prisma.ItemQtyPriceUncheckedCreateInput | Prisma.ItemQtyPriceUncheckedUpdateInput,
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
  ): void {
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_company_id'))
      data.iqpCompanyId = saveItemQtyPriceDto.iqp_company_id;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_branch_id'))
      data.iqpBranchId = saveItemQtyPriceDto.iqp_branch_id;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_party_id'))
      data.iqpPartyId = saveItemQtyPriceDto.iqp_party_id;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_price_level'))
      data.iqpPriceLevel = saveItemQtyPriceDto.iqp_price_level;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_from_qty'))
      data.iqpFromQty = saveItemQtyPriceDto.iqp_from_qty;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_to_qty'))
      data.iqpToQty = saveItemQtyPriceDto.iqp_to_qty;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_price_mode'))
      data.iqpPriceMode = saveItemQtyPriceDto.iqp_price_mode;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_disc_pct'))
      data.iqpDiscPct = saveItemQtyPriceDto.iqp_disc_pct;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_flat_off'))
      data.iqpFlatOff = saveItemQtyPriceDto.iqp_flat_off;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_price'))
      data.iqpPrice = saveItemQtyPriceDto.iqp_price;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_is_tax_incl'))
      data.iqpIsTaxIncl = saveItemQtyPriceDto.iqp_is_tax_incl;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_effective_to'))
      data.iqpEffectiveTo = this.parseOptionalDate(
        saveItemQtyPriceDto.iqp_effective_to,
        'iqp_effective_to',
      );
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_is_active'))
      data.iqpIsActive = saveItemQtyPriceDto.iqp_is_active;
    if (hasOwnProperty(saveItemQtyPriceDto, 'iqp_sync_date'))
      data.iqpSyncDate = this.parseOptionalDate(saveItemQtyPriceDto.iqp_sync_date, 'iqp_sync_date');
  }
  /**
   * Notes 139 A4 — a slab must state the figure its mode prices by: a fixed
   * price with no price, or a % mode with no %, was saved and meant nothing.
   * On an update an omitted figure is the stored one.
   */
  private validatePriceValue(
    saveItemQtyPriceDto: SaveItemQtyPriceDto,
    existing: ItemQtyPrice | null,
  ): void {
    const mode = saveItemQtyPriceDto.iqp_price_mode ?? existing?.iqpPriceMode ?? 'P';
    const [field, sent, stored] =
      mode === 'F'
        ? (['iqp_price', saveItemQtyPriceDto.iqp_price, existing?.iqpPrice] as const)
        : mode === 'R'
          ? (['iqp_flat_off', saveItemQtyPriceDto.iqp_flat_off, existing?.iqpFlatOff] as const)
          : (['iqp_disc_pct', saveItemQtyPriceDto.iqp_disc_pct, existing?.iqpDiscPct] as const);
    const value = sent !== undefined ? sent : toNullableNumber(stored ?? null);
    if (value === null || value === undefined) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field,
          code: ItemQtyPriceErrorCode.VALUE_REQUIRED,
          message: `Price mode ${mode} needs ${field}.`,
        },
      ]);
    }
  }
  /**
   * Notes 139 A4 — fk_iqp_item_unit only proves the unit row exists; the slab
   * must name a live unit row OF its own item, or it prices item A in a unit of
   * item B.
   */
  private async assertUnitOfItem(
    tx: Prisma.TransactionClient,
    itemId: string,
    itemUnitId: string,
  ): Promise<void> {
    const unit = await tx.itemUnitConversion.findFirst({
      where: { iucId: itemUnitId, iucItemId: itemId, iucIsDeleted: false },
      select: { iucId: true },
    });
    if (!unit) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: 'iqp_item_unit_id',
          code: ItemQtyPriceErrorCode.UNIT_NOT_OF_ITEM,
          message: `${itemUnitId} is not a live unit of item ${itemId}.`,
        },
      ]);
    }
  }
  /**
   * Notes 139 A4 — two live slabs of one item, unit and scope (company, branch,
   * party, price level; NULL = all, compared as a value) may not share a qty
   * on a shared date: [from, to) against [from, to), effective dates inclusive,
   * a NULL upper bound open. uq_iqp_slab only refuses an exact duplicate.
   * Overlapping a deleted slab is fine; overlapping an inactive one is not, so
   * switching it back on cannot create the clash.
   */
  private async assertNoOverlaps(
    tx: Prisma.TransactionClient,
    iqpIds: readonly string[],
    shape: 'indexed' | 'single',
    column: 'iqp_from_qty' | 'iqp_id',
  ): Promise<void> {
    if (!iqpIds.length) {
      return;
    }
    // One lock per item, taken in item order: two saves of one item's ladder
    // would otherwise each pass before the other commits.
    await tx.$queryRaw<Array<{ locked: number }>>`
      SELECT count(pg_advisory_xact_lock(hashtext('inventory.item_qty_price'), hashtext(k)))::int AS locked
        FROM (SELECT DISTINCT iqp_item_id::text AS k
                FROM inventory.item_qty_price
               WHERE iqp_id = ANY(${iqpIds}::uuid[])
               ORDER BY 1) AS items
    `;
    const [clash] = await tx.$queryRaw<
      Array<{
        iqp_id: string;
        other_id: string;
        other_from: string;
        other_to: string | null;
        other_effective_from: string;
        other_effective_to: string | null;
      }>
    >`
      SELECT r.iqp_id::text,
             o.iqp_id::text                AS other_id,
             o.iqp_from_qty::text          AS other_from,
             o.iqp_to_qty::text            AS other_to,
             o.iqp_effective_from::text    AS other_effective_from,
             o.iqp_effective_to::text      AS other_effective_to
        FROM inventory.item_qty_price r
        JOIN inventory.item_qty_price o
          ON o.iqp_id <> r.iqp_id
         AND o.iqp_is_deleted = false
         AND o.iqp_item_id = r.iqp_item_id
         AND o.iqp_item_unit_id = r.iqp_item_unit_id
         AND o.iqp_company_id IS NOT DISTINCT FROM r.iqp_company_id
         AND o.iqp_branch_id IS NOT DISTINCT FROM r.iqp_branch_id
         AND o.iqp_party_id IS NOT DISTINCT FROM r.iqp_party_id
         AND o.iqp_price_level IS NOT DISTINCT FROM r.iqp_price_level
         AND o.iqp_from_qty < COALESCE(r.iqp_to_qty, 'Infinity'::numeric)
         AND r.iqp_from_qty < COALESCE(o.iqp_to_qty, 'Infinity'::numeric)
         AND o.iqp_effective_from <= COALESCE(r.iqp_effective_to, 'infinity'::date)
         AND r.iqp_effective_from <= COALESCE(o.iqp_effective_to, 'infinity'::date)
       WHERE r.iqp_id = ANY(${iqpIds}::uuid[])
         AND r.iqp_is_deleted = false
       ORDER BY array_position(${iqpIds}::uuid[], r.iqp_id), o.iqp_from_qty, o.iqp_id
       LIMIT 1
    `;
    if (!clash) {
      return;
    }
    const index = iqpIds.indexOf(clash.iqp_id);
    const range = `${clash.other_from}–${clash.other_to ?? 'above'}`;
    const dates = `${clash.other_effective_from} to ${clash.other_effective_to ?? 'open'}`;
    throwInventoryConflict<ItemQtyPriceErrorDetail>('Qty price slabs overlap', [
      {
        field: shape === 'indexed' ? `${index}.${column}` : column,
        code: ItemQtyPriceErrorCode.OVERLAP,
        message:
          `The qty range overlaps slab ${clash.other_id} (${range}, ${dates}) for the same ` +
          'item, unit and scope. Close one range where the other starts, or end one date first.',
      },
    ]);
  }
  private validateDateRange(effectiveFrom: Date, effectiveTo: Date | null): void {
    if (!effectiveTo) {
      return;
    }
    if (effectiveFrom.getTime() > effectiveTo.getTime()) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: 'iqp_effective_to',
          code: ItemQtyPriceErrorCode.DATE_RANGE_INVALID,
          message: 'iqp_effective_to must be greater than or equal to iqp_effective_from',
        },
      ]);
    }
  }
  private validateQtyRange(fromQty: number, toQty: number | null): void {
    if (toQty === null) {
      return;
    }
    // iqp_to_qty is an exclusive upper bound, so it must sit strictly above the
    // inclusive lower bound.
    if (fromQty >= toQty) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: 'iqp_to_qty',
          code: ItemQtyPriceErrorCode.QTY_RANGE_INVALID,
          message: 'iqp_to_qty must be greater than iqp_from_qty',
        },
      ]);
    }
  }
  private parseRequiredDate(value: string, fieldName: string): Date {
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: fieldName,
          code: ItemQtyPriceErrorCode.DATE_INVALID,
          message: `${fieldName} must be a valid date`,
        },
      ]);
    }
    return parsedDate;
  }
  private parseOptionalDate(
    value: string | null | undefined,
    fieldName: string,
  ): Date | null | undefined {
    if (value === undefined) {
      return undefined;
    }
    if (value === null) {
      return null;
    }
    const parsedDate = new Date(value);
    if (Number.isNaN(parsedDate.getTime())) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Validation failed', [
        {
          field: fieldName,
          code: ItemQtyPriceErrorCode.DATE_INVALID,
          message: `${fieldName} must be a valid date`,
        },
      ]);
    }
    return parsedDate;
  }
  private toPayload(record: ItemQtyPriceWithNames): ItemQtyPricePayload {
    return {
      iqp_id: record.iqpId,
      iqp_company_id: record.iqpCompanyId,
      iqp_branch_id: record.iqpBranchId,
      iqp_party_id: record.iqpPartyId,
      iqp_price_level: record.iqpPriceLevel,
      iqp_item_id: record.iqpItemId,
      iqp_item_unit_id: record.iqpItemUnitId,
      iqp_from_qty: toNumber(record.iqpFromQty),
      iqp_to_qty: toNullableNumber(record.iqpToQty),
      iqp_price_mode: record.iqpPriceMode,
      iqp_disc_pct: toNullableNumber(record.iqpDiscPct),
      iqp_flat_off: toNullableNumber(record.iqpFlatOff),
      iqp_price: toNullableNumber(record.iqpPrice),
      iqp_is_tax_incl: record.iqpIsTaxIncl,
      iqp_effective_from: record.iqpEffectiveFrom?.toISOString(),
      iqp_effective_to: record.iqpEffectiveTo ? record.iqpEffectiveTo.toISOString() : null,
      iqp_is_active: record.iqpIsActive,
      iqp_is_deleted: record.iqpIsDeleted,
      iqp_sync_date: record.iqpSyncDate ? record.iqpSyncDate.toISOString() : null,
      iqp_created_on: record.iqpCreatedOn.toISOString(),
      iqp_created_by: record.iqpCreatedBy,
      iqp_modified_on: record.iqpModifiedOn.toISOString(),
      iqp_modified_by: record.iqpModifiedBy,
      // Resolved foreign-key display names (only populated on the GET/save paths
      // that join the relations; null on plain audit-trail rows).
      iqp_item_name: record.item?.itemNameEn ?? null,
      iqp_unit_name: record.itemUnitConversion?.unit?.unit_name ?? null,
      iqp_company_name: record.company?.compName ?? null,
      iqp_branch_name: record.branch?.brName ?? null,
      iqp_price_level_name: record.priceLevel?.iplName ?? null,
      iqp_party_name: record.party?.cusName ?? null,
    };
  }
  private buildDisplayName(record: ItemQtyPrice): string {
    const levelSegment = record.iqpPriceLevel ?? 'ALL';
    const upperSegment = record.iqpToQty !== null ? toNumber(record.iqpToQty) : 'ABOVE';
    return `${record.iqpItemId}:${record.iqpItemUnitId}:L${levelSegment}:[${toNumber(record.iqpFromQty)}-${upperSegment})`;
  }
  private handleWriteError(error: unknown): void {
    throwOnUniqueConstraintError<ItemQtyPriceErrorDetail>(error, 'Item qty price already exists', [
      {
        field: 'iqp_item_id',
        code: ItemQtyPriceErrorCode.DUPLICATE,
        message: 'Duplicate qty price slab is not allowed',
      },
    ]);
    if (isForeignKeyConstraintError(error)) {
      throwInventoryBadRequest<ItemQtyPriceErrorDetail>('Invalid relation reference', [
        {
          field: 'iqp_item_id',
          code: ItemQtyPriceErrorCode.REFERENCE_NOT_FOUND,
          message: 'Referenced item, unit, company, branch, or party does not exist',
        },
      ]);
    }
  }
  private throwNotFound(iqpId: string): never {
    throwInventoryNotFound<ItemQtyPriceErrorDetail>(
      'Item qty price not found',
      'iqp_id',
      `No item qty price found with id ${iqpId}`,
      ItemQtyPriceErrorCode.NOT_FOUND,
    );
  }
}
