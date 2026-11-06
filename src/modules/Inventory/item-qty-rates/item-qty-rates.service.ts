import { Injectable, UnprocessableEntityException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  resolveActor,
  throwInventoryBadRequest,
  throwInventoryNotFound,
  throwUnprocessable,
  type InventoryErrorDetail,
} from 'src/common/utils/module-service.utils';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AppSettingValueService } from 'src/modules/settings/appSettings/app-setting-value.service';
import { NO_RIGHTS, loadRights } from '../../../common/posting/rights';
import { CostPriceBulkGateway } from '../../stocks/cost-price-bulk/cost-price-bulk.gateway';
import {
  leftOutReasonOf,
  trackedAsOf,
  unitLink,
} from '../../stocks/cost-price-bulk/cost-price-bulk.rules';
import { COST_BULK_ITEM_NOT_FOUND } from '../../stocks/cost-price-bulk/types/cost-price-bulk.types';
import { resolveBelowCostPolicy } from '../../stocks/selling-price-bulk/below-cost-policy.helper';
import {
  MAX_PRICE_GRID_LIMIT,
  type ListSellingPriceQueryDto,
} from '../../stocks/selling-price-bulk/dto/list-selling-price-query.dto';
import type { SaveSellingPriceBulkDto } from '../../stocks/selling-price-bulk/dto/save-selling-price-bulk.dto';
import { PriceBucketGateway } from '../../stocks/selling-price-bulk/price-bucket.gateway';
import {
  SellingPriceBulkService,
  type PreparedBulkSave,
} from '../../stocks/selling-price-bulk/selling-price-bulk.service';
import { recomputeLevel } from '../../stocks/selling-price-bulk/selling-price-math.helper';
import {
  isHqUserType,
  type BelowCostPolicy,
  type PriceLevel,
  type SellingPriceProblem,
} from '../../stocks/selling-price-bulk/types/selling-price-bulk.types';
import { StockErrorCode } from '../../stocks/types/stock-error-codes';
import { PRICE_MENU_ID } from '../item-price-log/types/price-change-log.types';
import {
  HEADLINE_KEY,
  resolveEffectivePrice,
  type BucketKey,
  type PriceCallerScope,
} from '../items-price-master/price-resolver';
import type { SaveItemQtyPriceDto } from '../items-qty-price-master/dto/save-item-qty-price.dto';
import {
  ItemsQtyPriceMasterService,
  type StoredSlabScope,
} from '../items-qty-price-master/items-qty-price-master.service';
import type { SlabCard } from '../items-qty-price-master/qty-slab.rules';
import { ItemQtyPriceErrorCode } from '../items-qty-price-master/types/item-qty-price-error-codes';
import { resolveItemTaxRates } from '../utils/item-tax-rate.helper';
import type { GetItemQtyRatesQueryDto } from './dto/get-item-qty-rates-query.dto';
import type { SaveItemQtyRatesDto, SaveQtyRatesCardRowDto } from './dto/save-item-qty-rates.dto';
import { ItemQtyRatesGateway, type QtyRatesUnitRecord } from './item-qty-rates.gateway';
import {
  belowCostSeverity,
  cardProblems,
  cardRowOf,
  dec,
  judgeSlabs,
  sameCost,
  sameKey,
  scheduledFromOf,
  slabProblems,
  slabsToJudge,
  storedCardRowOf,
  storedSlabOf,
  unitCardAfter,
  type SentCardRow,
} from './item-qty-rates.rules';
import {
  QTY_RATES_MENU_ID,
  type QtyRatesProblem,
  type QtyRatesSaveResult,
  type QtyRatesUnit,
  type QtyRatesView,
} from './types/item-qty-rates.types';

/** A save logs and audits each card row and slab; the default 5 s is short for a long ladder. */
const TX = { timeout: 60_000, maxWait: 10_000 } as const;

const num = (value: Prisma.Decimal | number | null | undefined): number =>
  value === null || value === undefined ? 0 : typeof value === 'number' ? value : value.toNumber();

/** `YYYY-MM-DD` as the UTC midnight resolveItemTaxRates reads its day from. */
function dayDate(day: string): Date {
  return new Date(`${day}T00:00:00.000Z`);
}

const lower = (id: string | null | undefined) => (id ?? '').toLowerCase();

/**
 * Qty-wise Prices + Cost + Card Rate — one form, one Save (menu 244, plan
 * 2026-11-05 §4.1–§4.3; addenda 1 and 2).
 *
 * It owns no write: the card rows go through Change Selling Price's
 * prepareBulk / writeBulkInTx (PriceMasterWriter, Price Change Log
 * CHANGE_SELLING_PRICE "via Qty-wise Prices (menu 244)", one audit row each),
 * the slabs through ItemsQtyPriceMasterService (QTY_PRICE log, its audit) —
 * all in ONE transaction, all or nothing. What it adds are the checks neither
 * makes alone: Plain-stock cost / MRP, the headline's MRP, By User prices kept,
 * and every live slab judged against the card as it will stand (C7).
 */
@Injectable()
export class ItemQtyRatesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly appSettingValueService: AppSettingValueService,
    private readonly gateway: ItemQtyRatesGateway,
    private readonly costGateway: CostPriceBulkGateway,
    private readonly bulk: SellingPriceBulkService,
    private readonly bulkGateway: PriceBucketGateway,
    private readonly slabService: ItemsQtyPriceMasterService,
  ) {}

  // ── GET /item-qty-prices/get-with-rates ───────────────────────────────────

  async getWithRates(query: GetItemQtyRatesQueryDto): Promise<QtyRatesView> {
    const qtyRights = await this.slabService.assertRight('view', 'open Qty-wise Prices');
    const userId = this.requestContext.getUserId();
    const cardRights = userId
      ? await loadRights(this.prisma, userId, PRICE_MENU_ID.CHANGE_SELLING_PRICE)
      : { ...NO_RIGHTS };
    const { companyId, branchId, itemId } = query;
    const policy = await this.belowCostPolicy(companyId, branchId);
    const found = await this.findItemOr404(this.prisma, companyId, branchId, itemId);
    const today = await this.gateway.today(this.prisma);
    const [taxes, barcode, names, levels, units, priceRows, slabs, grid] = await Promise.all([
      resolveItemTaxRates(this.prisma, [itemId], dayDate(today)),
      this.gateway.barcode(this.prisma, itemId),
      this.gateway.groupAndBrand(this.prisma, itemId),
      this.gateway.levels(this.prisma),
      this.gateway.units(this.prisma, itemId),
      this.gateway.priceRows(this.prisma, itemId, companyId, branchId),
      this.slabService.listForItem(itemId),
      this.bulk.listPrices({
        companyId,
        branchId,
        itemId,
        activeOnly: false,
        limit: MAX_PRICE_GRID_LIMIT,
        offset: 0,
      } as ListSellingPriceQueryDto),
    ]);
    const tax = taxes.get(itemId);
    const plainStock = !found.presetTracks && !found.isBatchBased;
    const rights = {
      view: qtyRights.view,
      createSlab: qtyRights.create,
      editSlab: qtyRights.edit,
      deleteSlab: qtyRights.delete,
      editCard: cardRights.edit,
      allBranchSlab: isHqUserType(this.requestContext.getUserType()),
    };
    const caller: PriceCallerScope = { companyId, branchId };
    const unitsById = new Map(units.map((unit) => [unit.uomId, unit]));
    const rows: QtyRatesUnit[] = [];
    for (const row of grid.items) {
      const unit = unitsById.get(row.uomId);
      if (!unit) {
        // An inactive unit: no bill sells in it, so the card does not show it (menu 298's rule).
        continue;
      }
      const unitRows = priceRows.filter((price) => price.ipmUcUnitId === row.uomId);
      const answering = row.bucketId
        ? (priceRows.find((price) => price.ipmId === row.bucketId) ?? null)
        : null;
      const headline = row.mrp === null && row.salePrice === null;
      const link = unitLink({
        parentToBase: unit.parentToBase,
        toBase: unit.toBase,
        unitFactor: unit.unitFactor,
      });
      const rowCost = answering ? num(answering.ipmCostPrice) : null;
      const cardCost = plainStock && headline && rowCost !== null ? rowCost : row.costRate;
      const editable = plainStock && headline && rights.editCard;
      const key: BucketKey = { mrp: row.mrp, salePrice: row.salePrice };
      rows.push({
        lineNo: rows.length + 1,
        uomId: row.uomId,
        unitName: row.unitName,
        unitSlno: unit.unitSlno,
        parentUomId: unit.parentUomId,
        parentUnitName: unit.parentUnitName,
        unitsPerParent: link.unitsPerParent ? link.unitsPerParent.toNumber() : null,
        factorsAgree: link.factorsAgree,
        bucketId: row.bucketId,
        priceScope: row.priceScope,
        priceSource: row.priceSource,
        mrp: row.mrp,
        salePrice: row.salePrice,
        maxPrice: row.maxPrice,
        stockQty: row.stockQty,
        costRate: row.costRate,
        costWot: row.costWot,
        costBasis: row.costBasis,
        stockAvg: row.costBasis === 'ITEM' || row.costBasis === 'MRP' ? row.costRate : null,
        rowCost,
        rowCostWot: answering ? num(answering.ipmCostWot) : null,
        cardCost,
        profitType: answering?.ipmProfitType ?? null,
        roundOff: row.roundOff,
        minPrice: row.minPrice,
        levels: row.levels.map((level) => {
          const value = recomputeLevel(
            level.level as PriceLevel,
            level.price,
            row.taxPerc,
            cardCost,
          );
          return {
            level: value.level,
            price: value.price,
            priceWot: value.priceWot,
            markupPerc: value.markupPerc,
          };
        }),
        costEditable: editable,
        mrpEditable: editable,
        scheduledFrom: scheduledFromOf(unitRows, key, today, caller),
      });
    }
    return {
      item: {
        itemId: found.itemId,
        itemCode: found.itemCode,
        itemName: found.itemName,
        barcode,
        groupName: names.groupName,
        brandName: names.brandName,
        taxPerc: tax?.taxPerc ?? 0,
        inclTax: tax?.inclTax ?? false,
        hasCess: tax?.hasCess ?? false,
        plainStock,
        trackedAs: trackedAsOf(found.presetName),
        leftOutReason: leftOutReasonOf({
          isActive: found.isActive,
          isBatchBased: found.isBatchBased,
          presetTracks: found.presetTracks,
        }),
      },
      rights,
      belowCostPolicy: policy,
      today,
      levels: levels
        .filter((level) => level.active)
        .map((level) => ({ level: level.level, name: level.name, short: level.short })),
      units: rows,
      slabs,
    };
  }

  // ── POST /item-qty-prices/save-with-rates ─────────────────────────────────

  async saveWithRates(dto: SaveItemQtyRatesDto): Promise<QtyRatesSaveResult> {
    const slabRows = dto.slabs ?? [];
    const deleteIds = dto.deleteSlabIds ?? [];
    const cardRows = dto.rates?.rows ?? [];

    // 1 — rights, before anything is read (§4.3). 403s only.
    await this.slabService.assertRight('view', 'open Qty-wise Prices');
    if (slabRows.some((slab) => !slab.iqp_id)) {
      await this.slabService.assertRight('create', 'add qty-wise prices');
    }
    if (slabRows.some((slab) => slab.iqp_id)) {
      await this.slabService.assertRight('edit', 'change qty-wise prices');
    }
    if (deleteIds.length) {
      await this.slabService.assertRight('delete', 'remove qty-wise prices');
    }
    if (cardRows.length) {
      await this.bulk.assertCanEditPrices();
    }

    // 2 — the shape that needs no read.
    this.assertShape(dto.itemId, cardRows, slabRows, deleteIds);

    const { companyId, branchId, itemId } = dto;
    const policy = await this.belowCostPolicy(companyId, branchId);
    const actor = resolveActor(undefined, this.requestContext.getUserId());
    const via = cardRows.length ? await this.bulk.describeOriginMenu(QTY_RATES_MENU_ID) : null;
    const confirmed = dto.confirmed === true;

    return this.prisma.$transaction(async (tx) => {
      await this.gateway.lockItem(tx, itemId);

      // 2 — the shape that needs the named slabs.
      const stored = await this.slabService.readStoredSlabs(tx, [
        ...slabRows.map((slab) => slab.iqp_id).filter((id): id is string => !!id),
        ...deleteIds,
      ]);
      this.assertNamedSlabs(itemId, slabRows, deleteIds, stored);
      await this.slabService.assertSellingLevels(tx, slabRows, 'slabs.', stored);
      await this.slabService.assertChainSlabsAllowed(tx, slabRows, 'slabs.', stored);
      // D16 (C-d): not head office → only the logged-in branch's slabs.
      await this.slabService.assertOwnBranchSlabs(tx, slabRows, 'slabs.', stored);
      await this.slabService.assertOwnBranchSlabIds(
        tx,
        deleteIds,
        (index) => `deleteSlabIds.${index}`,
        stored,
      );

      // 3.1 — the item, and what may be typed on it.
      const found = await this.findItemOr404(tx, companyId, branchId, itemId);
      const plainStock = !found.presetTracks && !found.isBatchBased;
      this.assertPlainStockFields(cardRows, plainStock, trackedAsOf(found.presetName));

      // The card as it stands (read before the card is prepared: C-c needs it).
      const today = await this.gateway.today(tx);
      const caller: PriceCallerScope = { companyId, branchId };
      const levels = await this.gateway.levels(tx);
      const priceRows = await this.gateway.priceRows(tx, itemId, companyId, branchId);
      const ctx = {
        activeLevels: levels.filter((level) => level.active).map((level) => level.level),
        levelNames: new Map(levels.map((level) => [level.level, level.name])),
      };

      // 3.2 — the card: Change Selling Price's own checks (its 422s), nothing
      // written; only the active levels priced above 0 judged (C-a), and a cost
      // sent back as loaded kept as stored (C-c).
      const prepared = cardRows.length
        ? await this.bulk.prepareBulk(tx, this.bulkDtoOf(dto, cardRows), {
            actor,
            policy,
            activeLevels: ctx.activeLevels,
            keepCost: (_index, row, key) => {
              const stored = this.storedRowFor(priceRows, row.uomId, key, today, caller);
              return stored && row.costPrice !== undefined && row.costPrice !== null &&
                sameCost(dec(row.costPrice), stored.costPrice)
                ? { costRate: stored.costPrice.toNumber(), costWot: stored.costWot.toNumber() }
                : null;
            },
          })
        : null;

      // ... and as it will stand.
      const taxes = await resolveItemTaxRates(tx, [itemId], dayDate(today));
      const tax = taxes.get(itemId);
      const basis = { inclTax: tax?.inclTax ?? false, taxPerc: dec(tax?.taxPerc ?? 0) };
      const units = await this.gateway.units(tx, itemId);
      const liveSlabs = await this.gateway.liveSlabs(tx, itemId);
      const unitsById = new Map(units.map((unit) => [unit.uomId, unit]));
      const sent = prepared ? this.sentRowsOf(prepared, priceRows, unitsById, today, caller) : [];

      const problems: QtyRatesProblem[] = [];
      // 3.2's below cost (restrict has thrown already): warning asks, allow reports.
      if (prepared) {
        problems.push(...this.cardBelowCost(prepared, sent, policy));
      }
      // 3.3 / 3.4.
      problems.push(...cardProblems(sent, ctx));
      // 3.5 — every live slab against the card after the save (C7).
      const cards = await this.unitCards(tx, {
        itemId,
        companyId,
        branchId,
        today,
        caller,
        units,
        priceRows,
        sent,
        prepared,
        plainStock,
        basis,
      });
      const entries = slabsToJudge({
        stored: liveSlabs.map(storedSlabOf),
        sent: slabRows,
        deleteIds,
        companyId,
        branchId,
        today,
      });
      problems.push(
        ...slabProblems(judgeSlabs(entries, cards, ctx.activeLevels, basis), { ...ctx, policy }),
      );

      // 3.6 — the verdict. Nothing has been written yet.
      const refusals = problems.filter((problem) => problem.severity === 'REFUSE');
      if (refusals.length) {
        throw new UnprocessableEntityException({
          success: false,
          message: 'These prices cannot be saved',
          errors: refusals.map((problem) => ({
            field: problem.field,
            code: problem.code,
            message: problem.message,
          })),
          problems,
          belowCostPolicy: policy,
        });
      }
      if (!confirmed && problems.some((problem) => problem.severity === 'ASK')) {
        // 200, not an error: the popup lists them; "Save anyway" re-posts with confirmed.
        return {
          needsConfirm: true,
          rates: null,
          slabs: [],
          deletedSlabIds: [],
          problems,
          belowCostPolicy: policy,
        };
      }

      // 4 — write, in the same transaction: deletes first (a deleted slab frees
      // its range), the card, then the slabs (their overlap check runs after
      // the batch; a 409 there rolls the card and the deletes back too).
      const deleted = deleteIds.length ? await this.slabService.softDelete(deleteIds, tx) : [];
      const rates = prepared
        ? await this.bulk.writeBulkInTx(tx, prepared, { confirmed, via, policy })
        : null;
      // Every slab refusal filed under slabs.<i>. (C-e).
      const saved = slabRows.length
        ? await this.slabService.save(slabRows, tx, { fieldPrefix: 'slabs.' })
        : [];
      return {
        needsConfirm: false,
        rates,
        slabs: saved,
        deletedSlabIds: deleted.map((entry) => entry.iqp_id),
        problems,
        belowCostPolicy: policy,
      };
    }, TX);
  }

  buildSaveMessage(result: QtyRatesSaveResult): string {
    if (result.needsConfirm) {
      const asks = result.problems.filter((problem) => problem.severity === 'ASK').length;
      return `${asks} price${asks === 1 ? '' : 's'} need${asks === 1 ? 's' : ''} your OK. Save anyway to keep ${asks === 1 ? 'it' : 'them'}.`;
    }
    const parts = [
      `Saved · cost + card rate ${result.rates?.saved ?? 0} row${result.rates?.saved === 1 ? '' : 's'}`,
      `slabs ${result.slabs.length}`,
    ];
    if (result.deletedSlabIds.length) {
      parts.push(`${result.deletedSlabIds.length} removed`);
    }
    return parts.join(' · ');
  }

  // ── the checks ────────────────────────────────────────────────────────────

  /**
   * §4.2 step 2: nothing to save → 400 NOTHING_TO_SAVE; a slab of another item
   * → 400 ITEM_MISMATCH; one id twice, or both saved and deleted → 400
   * VALIDATION_ARRAY_UNIQUE.
   */
  private assertShape(
    itemId: string,
    cardRows: readonly SaveQtyRatesCardRowDto[],
    slabRows: readonly SaveItemQtyPriceDto[],
    deleteIds: readonly string[],
  ): void {
    if (!cardRows.length && !slabRows.length && !deleteIds.length) {
      throwInventoryBadRequest<InventoryErrorDetail>('Nothing to save', [
        {
          field: 'request',
          code: ItemQtyPriceErrorCode.NOTHING_TO_SAVE,
          message: 'Nothing was changed: send a card row, a slab, or a slab to remove.',
        },
      ]);
    }
    const mismatch = slabRows
      .map((slab, index) => ({ slab, index }))
      .filter(({ slab }) => lower(slab.iqp_item_id) !== lower(itemId));
    if (mismatch.length) {
      throwInventoryBadRequest<InventoryErrorDetail>('A slab of another item was sent', [
        ...mismatch.map(({ index }) => ({
          field: `slabs.${index}.iqp_item_id`,
          code: ItemQtyPriceErrorCode.ITEM_MISMATCH,
          message: `Slab ${index + 1} is for another item; this form saves item ${itemId} only.`,
        })),
      ]);
    }
    const seen = new Map<string, string>();
    const named = [
      ...slabRows.flatMap((slab, index) =>
        slab.iqp_id ? [{ id: lower(slab.iqp_id), field: `slabs.${index}.iqp_id` }] : [],
      ),
      ...deleteIds.map((id, index) => ({ id: lower(id), field: `deleteSlabIds.${index}` })),
    ];
    for (const { id, field } of named) {
      const first = seen.get(id);
      if (first) {
        throwInventoryBadRequest<InventoryErrorDetail>('Validation failed', [
          {
            field,
            code: 'VALIDATION_ARRAY_UNIQUE',
            message: `Slab ${id} is named twice (${first} and ${field}); save it, or remove it, once.`,
          },
        ]);
      }
      seen.set(id, field);
    }
  }

  /** A slab named by id is there and is this item's: else 404 NOT_FOUND / 400 ITEM_MISMATCH. */
  private assertNamedSlabs(
    itemId: string,
    slabRows: readonly SaveItemQtyPriceDto[],
    deleteIds: readonly string[],
    stored: ReadonlyMap<string, StoredSlabScope>,
  ): void {
    const named = [
      ...slabRows.flatMap((slab, index) =>
        slab.iqp_id ? [{ id: slab.iqp_id, field: `slabs.${index}.iqp_id`, edit: true }] : [],
      ),
      ...deleteIds.map((id, index) => ({ id, field: `deleteSlabIds.${index}`, edit: false })),
    ];
    for (const { id, field, edit } of named) {
      const slab = stored.get(lower(id));
      // A slab already deleted is the slab writer's 409 on delete; an edit needs a live one.
      if (!slab || (edit && slab.isDeleted)) {
        throwInventoryNotFound<InventoryErrorDetail>(
          'Item qty price not found',
          field,
          `No item qty price found with id ${id}. Load the item again.`,
          ItemQtyPriceErrorCode.NOT_FOUND,
        );
      }
      if (lower(slab.itemId) !== lower(itemId)) {
        throwInventoryBadRequest<InventoryErrorDetail>('A slab of another item was sent', [
          {
            field,
            code: ItemQtyPriceErrorCode.ITEM_MISMATCH,
            message: `Slab ${id} belongs to another item; this form saves item ${itemId} only.`,
          },
        ]);
      }
    }
  }

  /**
   * §4.2 step 3.1 (D2 / D17): a cost is typed on Plain-stock items only, and so
   * is an MRP — on any other item the cost comes from stock and the MRP is the
   * bucket key. 422 COST_NOT_PLAIN_STOCK / MRP_NOT_PLAIN_STOCK.
   */
  private assertPlainStockFields(
    cardRows: readonly SaveQtyRatesCardRowDto[],
    plainStock: boolean,
    trackedAs: string,
  ): void {
    if (plainStock) {
      return;
    }
    const errors: InventoryErrorDetail[] = [];
    cardRows.forEach((row, index) => {
      const line = row.lineNo ?? index + 1;
      if (row.costPrice !== undefined && row.costPrice !== null) {
        errors.push({
          field: `rates.rows.${index}.costPrice`,
          code: ItemQtyPriceErrorCode.COST_NOT_PLAIN_STOCK,
          message: `Line ${line}: this item is tracked as ${trackedAs}, so its cost comes from stock and can't be typed here.`,
        });
      }
      if (row.maxPrice !== undefined && row.maxPrice !== null) {
        errors.push({
          field: `rates.rows.${index}.maxPrice`,
          code: ItemQtyPriceErrorCode.MRP_NOT_PLAIN_STOCK,
          message: `Line ${line}: this item is tracked as ${trackedAs}, so its MRP belongs to the stock and can't be typed here.`,
        });
      }
    });
    if (errors.length) {
      throwUnprocessable<InventoryErrorDetail>('These prices cannot be saved', errors);
    }
  }

  // ── reading the card ──────────────────────────────────────────────────────

  /** The card rows as Change Selling Price saves them: this branch, from today, via menu 244. */
  private bulkDtoOf(
    dto: SaveItemQtyRatesDto,
    rows: readonly SaveQtyRatesCardRowDto[],
  ): SaveSellingPriceBulkDto {
    return {
      companyId: dto.companyId,
      branchId: dto.branchId,
      scope: 'BRANCH',
      confirmed: dto.confirmed === true,
      rows: rows.map((row) => ({ ...row, itemId: dto.itemId })),
      originMenuId: QTY_RATES_MENU_ID,
    } as SaveSellingPriceBulkDto;
  }

  /** Each prepared candidate with what was sent and the row it writes over (today's answer). */
  private sentRowsOf(
    prepared: PreparedBulkSave,
    priceRows: Awaited<ReturnType<ItemQtyRatesGateway['priceRows']>>,
    unitsById: ReadonlyMap<string, QtyRatesUnitRecord>,
    today: string,
    caller: PriceCallerScope,
  ): SentCardRow[] {
    return prepared.candidates.map((candidate, index) => {
      const raw = prepared.dto.rows[index];
      const key: BucketKey = { mrp: candidate.mrp, salePrice: candidate.salePrice };
      const stored = this.storedRowFor(priceRows, candidate.uomId, key, today, caller);
      const headline = key.mrp === null && key.salePrice === null;
      const sentCost =
        raw.costPrice !== undefined && raw.costPrice !== null ? dec(raw.costPrice) : null;
      return {
        index,
        lineNo: candidate.lineNo,
        uomId: candidate.uomId,
        unitName: unitsById.get(candidate.uomId)?.unitName ?? null,
        key,
        levels: candidate.levels.map((level) => ({ level: level.level, price: dec(level.price) })),
        // C-c: a cost equal to the stored one at 2 decimals is the stored one
        // (no By User question; prepareBulk kept the stored figures too).
        costPrice:
          sentCost && stored && sameCost(sentCost, stored.costPrice) ? stored.costPrice : sentCost,
        maxPrice:
          headline && raw.maxPrice !== undefined && raw.maxPrice !== null
            ? dec(raw.maxPrice)
            : null,
        minPrice: raw.minPrice !== undefined && raw.minPrice !== null ? dec(raw.minPrice) : null,
        profitType: raw.profitType ?? null,
        stored,
      };
    });
  }

  /** The row a card row writes over or copies from: the resolver's answer today here, else null. */
  private storedRowFor(
    priceRows: Awaited<ReturnType<ItemQtyRatesGateway['priceRows']>>,
    uomId: string,
    key: BucketKey,
    today: string,
    caller: PriceCallerScope,
  ) {
    const unitRows = priceRows.filter((row) => row.ipmUcUnitId === uomId);
    const answer = resolveEffectivePrice(unitRows, key, today, caller);
    return answer ? storedCardRowOf(answer.row) : null;
  }

  /** Change Selling Price's below-cost verdicts as the form's problems. */
  private cardBelowCost(
    prepared: PreparedBulkSave,
    sent: readonly SentCardRow[],
    policy: BelowCostPolicy,
  ): QtyRatesProblem[] {
    return prepared.belowCost.map((problem: SellingPriceProblem) => {
      const index = prepared.candidates.findIndex((c) => c.lineNo === problem.lineNo);
      const candidate = prepared.candidates[index];
      const row = sent[index];
      const price = candidate?.levels.find((level) => level.level === problem.level)?.price ?? null;
      return {
        source: 'CARD',
        code: StockErrorCode.PRICE_BELOW_COST,
        severity: belowCostSeverity(policy),
        lineNo: problem.lineNo,
        slabIndex: null,
        iqpId: null,
        uomId: problem.uomId,
        unitName: row?.unitName ?? null,
        level: problem.level,
        price,
        cost: candidate ? candidate.costRate : null,
        field: `rates.rows.${index < 0 ? 0 : index}.levels`,
        message: `Line ${problem.lineNo}${row?.unitName ? ` · ${row.unitName}` : ''}: ${problem.message}`,
      };
    });
  }

  /**
   * §4.2 step 3.5 — each active unit's card after the save: the row it stands
   * on (headline, else the dearest bucket), the sent row for it, and the cost
   * basis — the prepared row's own, else /stock/price-bulk's (one read for all).
   */
  private async unitCards(
    tx: Prisma.TransactionClient,
    args: {
      itemId: string;
      companyId: string;
      branchId: string;
      today: string;
      caller: PriceCallerScope;
      units: readonly QtyRatesUnitRecord[];
      priceRows: Awaited<ReturnType<ItemQtyRatesGateway['priceRows']>>;
      sent: readonly SentCardRow[];
      prepared: PreparedBulkSave | null;
      plainStock: boolean;
      basis: SlabCard['basis'];
    },
  ): Promise<Map<string, { card: SlabCard; unitName: string | null }>> {
    const plans = args.units.map((unit) => {
      const unitRows = args.priceRows.filter((row) => row.ipmUcUnitId === unit.uomId);
      const standing = cardRowOf(unitRows, args.today, args.caller);
      const key = standing?.key ?? { ...HEADLINE_KEY };
      const sentRow =
        args.sent.find((row) => row.uomId === unit.uomId && sameKey(row.key, key)) ?? null;
      return { unit, standing, key, sentRow };
    });
    const needCost = plans.filter((plan) => plan.sentRow === null);
    const costs = needCost.length
      ? await this.bulkGateway.loadRowCosts(
          tx,
          needCost.map((plan) => ({
            itemId: args.itemId,
            uomId: plan.unit.uomId,
            mrp: plan.key.mrp,
            salePrice: plan.key.salePrice,
          })),
          args.companyId,
          args.branchId,
        )
      : [];
    const cards = new Map<string, { card: SlabCard; unitName: string | null }>();
    plans.forEach((plan) => {
      const costBasisRate = plan.sentRow
        ? (args.prepared?.costs[plan.sentRow.index]?.costRate ?? 0)
        : (costs[needCost.indexOf(plan)]?.costRate ?? 0);
      cards.set(plan.unit.uomId, {
        unitName: plan.unit.unitName,
        card: unitCardAfter({
          stored: plan.standing ? storedCardRowOf(plan.standing.row) : null,
          key: plan.key,
          sent: plan.sentRow,
          plainStock: args.plainStock,
          costBasisRate: dec(costBasisRate),
          inclTax: args.basis.inclTax,
          taxPerc: args.basis.taxPerc,
        }),
      });
    });
    return cards;
  }

  private async findItemOr404(
    client: Pick<Prisma.TransactionClient, '$queryRaw'>,
    companyId: string,
    branchId: string,
    itemId: string,
  ) {
    const item = await this.costGateway.findItem(client, companyId, branchId, itemId);
    if (!item) {
      throwInventoryNotFound<InventoryErrorDetail>(
        'Item not found',
        'itemId',
        `No live item ${itemId} at this company and branch.`,
        COST_BULK_ITEM_NOT_FOUND,
      );
    }
    return item;
  }

  /** inventory.below_cost_price through the resolver (restrict / warning / allow), as menu 30 reads it. */
  private async belowCostPolicy(companyId: string, branchId: string): Promise<BelowCostPolicy> {
    const effective = await this.appSettingValueService.resolveEffective({
      companyId,
      branchId,
      deviceId: this.requestContext.getDeviceId() ?? undefined,
      userId: this.requestContext.getUserId() ?? undefined,
    });
    return resolveBelowCostPolicy(effective);
  }
}
