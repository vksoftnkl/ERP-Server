import { Injectable, NotFoundException } from '@nestjs/common';
import { ItemPriceMaster, Prisma } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { assertMenuRight } from 'src/common/posting/rights';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { resolveEffectivePrice } from '../items-price-master/price-resolver';
import {
  bucketKeyFor,
  readBucketTrackFlags,
} from '../../stocks/stock-voucher/stock-voucher-posting.helper';
import { PrintTemplateAssignmentService } from '../../settings/print-template-assignment/print-template-assignment.service';
import { StickerRefusal, refuseSticker } from './sticker.errors';
import {
  BarcodeSource,
  DesignSource,
  LABEL_COST_CODE_SETTING,
  LabelPurposeCode,
  STICKER_BARCODE_MAX,
  STICKER_BATCH_MAX,
  STICKER_DEFAULT_PRICE_LEVEL,
  STICKER_MAX_LABELS_PER_LINE,
  STICKER_MENU_ID,
  asLabelPurpose,
  bodyHasBarcode,
  cipherCode,
  istDateTimeText,
  isoDay,
  money,
  pickLot,
} from './sticker.rules';
import { STICKER_ERROR } from './types/sticker-error-codes';
import {
  BuiltStickerLine,
  StickerAssignment,
  StickerLine,
  StickerLotPayload,
} from './types/sticker.types';

/**
 * THE line builder of Sticker Printing (plan S-P1 §4.5 / §4.6 / §7.5).
 *
 * Every route that shows or prints a sticker line goes through `buildLines`:
 * Add items (from-items), scan / type (resolve), the preview, and the job
 * print, which re-resolves every line itself and never stores a figure the
 * client sent (decision 26). S-P2 (stickers from a GRN / purchase bill) calls
 * it with the document's lines. For one line it decides:
 *
 *   - the unit: the scanned EAN's unit, else the one named, else the item's
 *     Def unit (S5 / SM11);
 *   - the design (§4.5): F7's for this job (JOB) → the item's own Sticker
 *     design when it is a published label design of the list's purpose (ITEM)
 *     → the purpose's assignment for this counter (PURPOSE) → none (NONE);
 *   - the lot (SM7): the lots with SALEABLE stock at this branch, newest
 *     first; one MRP → the newest, several MRPs → `lotRequired`;
 *   - the barcode (decision 36): a textile lot's batch → the unit's EAN
 *     (default first) → item_default_barcode (Def unit only) → none;
 *   - MRP (S9): the lot's, else the price line's `ipm_max_price`;
 *   - Our price: resolveEffectivePrice for the unit and the lot's bucket at
 *     this company / branch today, column A-D by the price level;
 *   - cost / price code (S14, PQ1): the lot's cost (per base unit × the unit's
 *     factor) else the price line's cost, ciphered with the company's letters;
 *   - Last printed: the newest job line of this item + unit at this branch.
 *
 * A line that cannot print comes back with a `problem` (code + words) rather
 * than failing the call; the job service turns a problem into its refusal.
 */

export interface StickerPurpose {
  ppoId: string;
  ppoCode: LabelPurposeCode;
  ppoName: string;
}

export interface StickerScope {
  companyId: string;
  branchId: string;
  deviceId: string | null;
  purpose: StickerPurpose;
  /** 1-4 (A-D). */
  priceLevel: number;
  assignment: StickerAssignment;
  /** One design for every line (a job, the preview): designSource JOB. */
  jobTemplateId?: string | null;
}

export interface StickerLineInput {
  key: string;
  /** A scanned / typed code: EAN, item barcode, item code or batch no. */
  code?: string | null;
  itemId?: string | null;
  unitId?: string | null;
  lotId?: string | null;
  /** F7 "Design for this job" for this line. */
  templateId?: string | null;
  labels?: number | null;
}

interface ItemRow {
  item_id: string;
  item_name_en: string;
  item_name_ta: string | null;
  item_code: string | null;
  default_barcode: string | null;
  sticker_id: string | null;
  brand_name: string | null;
  group_name: string | null;
}

interface UnitRow {
  iuc_id: string;
  iuc_item_id: string;
  is_default: boolean;
  is_base: boolean;
  factor: Prisma.Decimal;
  unit_name: string | null;
  decimals: number;
}

interface LotRow {
  lot_id: string;
  item_id: string;
  company_id: string | null;
  batch_no: string | null;
  mrp: Prisma.Decimal | null;
  sale_price: Prisma.Decimal | null;
  mfg_date: string | null;
  expiry_date: string | null;
  first_inward_date: string | null;
  cost_rate: Prisma.Decimal | null;
  /** Base units; SALEABLE at this branch (0 for a lot named but not stocked). */
  on_hand: Prisma.Decimal;
}

export interface DesignRow {
  ptl_id: string;
  ptl_name: string;
  ptl_company_id: string | null;
  ptl_is_active: boolean;
  ptl_is_deleted: boolean;
  ppo_code: string;
  ptv_id: string | null;
  ptv_rev_no: number | null;
  ptv_status: string | null;
  ptv_is_deleted: boolean | null;
  ptv_label_width_mm: Prisma.Decimal | null;
  ptv_label_height_mm: Prisma.Decimal | null;
  ptv_label_across: number | null;
  ptv_label_down: number | null;
  ptv_paper_code: string | null;
  ptv_body: string | null;
}

interface CodeHit {
  itemId: string;
  unitId: string | null;
  lotId: string | null;
}

/** A Prisma Decimal from a raw numeric (string or Decimal), or null. */
const dec = (value: unknown): Prisma.Decimal | null =>
  value === null || value === undefined ? null : new Prisma.Decimal(value as Prisma.Decimal.Value);

/** A positive amount, else null (0 is how a shop says "no MRP"). */
const positive = (value: Prisma.Decimal | null): Prisma.Decimal | null =>
  value && value.greaterThan(0) ? value : null;

@Injectable()
export class StickerLinesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
    private readonly assignments: PrintTemplateAssignmentService,
  ) {}

  // ═══ Gates shared by every route ══════════════════════════════════════════

  /** View / Print on menu 32 (STICKER_RIGHT_VIEW / _PRINT). */
  async assertRight(right: 'view' | 'print'): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: STICKER_MENU_ID,
      right,
      codePrefix: 'STICKER',
      action: right === 'view' ? 'open Sticker Printing' : 'print stickers',
    });
  }

  /** The branch must belong to the company (STICKER_BRANCH_NOT_IN_COMPANY). */
  async assertBranchInCompany(companyId: string, branchId: string): Promise<void> {
    const [row] = await this.prisma.$queryRaw<{ ok: number }[]>`
      SELECT 1 AS ok FROM public.branch_master
       WHERE br_id = ${branchId}::uuid AND br_comp_id = ${companyId}::uuid AND br_is_deleted = false`;
    if (!row) {
      refuseSticker(
        STICKER_ERROR.BRANCH_NOT_IN_COMPANY,
        `Branch ${branchId} is not a live branch of company ${companyId}`,
        'branchId',
      );
    }
  }

  /** One of the three label purposes: this company's own fork first, else the shipped row. */
  async loadPurpose(companyId: string, purposeCode: string): Promise<StickerPurpose> {
    const code = asLabelPurpose(purposeCode);
    const purpose = code
      ? await this.prisma.printPurpose.findFirst({
          where: {
            ppoCode: code,
            ppoIsDeleted: false,
            ppoIsActive: true,
            OR: [{ ppoCompanyId: null }, { ppoCompanyId: companyId }],
          },
          orderBy: [{ ppoCompanyId: { sort: 'asc', nulls: 'last' } }],
          select: { ppoId: true, ppoName: true },
        })
      : null;
    if (!code || !purpose) {
      refuseSticker(
        STICKER_ERROR.PURPOSE_INVALID,
        `purposeCode "${purposeCode}" is not ITEM_LABEL, PACK_LABEL or SHELF_LABEL (or the purpose is retired)`,
        'purposeCode',
      );
    }
    return { ppoId: purpose.ppoId, ppoCode: code, ppoName: purpose.ppoName };
  }

  /**
   * The purpose's assignment for this counter, output PRINT (§4.5 step 3):
   * counter → branch → company → every company. Nothing assigned is a normal
   * answer (all nulls), not an error: the line then has no design.
   * `lastPriceLevel` (SM6, decision 31) rides along: this counter's last job's.
   */
  async assignmentFor(
    purpose: StickerPurpose,
    companyId: string,
    branchId: string,
    deviceId: string | null,
  ): Promise<StickerAssignment> {
    const none: StickerAssignment = {
      purposeId: purpose.ppoId,
      purposeCode: purpose.ppoCode,
      purposeName: purpose.ppoName,
      ptaId: null,
      scope: null,
      templateId: null,
      templateName: null,
      printerName: null,
      printerSource: null,
      lastPriceLevel: await this.lastPriceLevel(companyId, deviceId),
    };
    try {
      const resolved = await this.assignments.resolve({
        purposeId: purpose.ppoId,
        companyId,
        branchId,
        ...(deviceId ? { deviceId } : {}),
        outputMode: 'PRINT',
      });
      return {
        ...none,
        ptaId: resolved.ptaId,
        scope: resolved.scope as StickerAssignment['scope'],
        templateId: resolved.ptaTemplateId,
        templateName: resolved.ptaTemplateName,
        printerName: resolved.ptaPrinterName?.trim() || null,
        printerSource: resolved.printerSource as StickerAssignment['printerSource'],
      };
    } catch (error) {
      if (error instanceof NotFoundException) {
        return none;
      }
      throw error;
    }
  }

  /** The whole scope of a lines call, after its gates. */
  async scopeFor(args: {
    companyId: string;
    branchId: string;
    purposeCode: string;
    priceLevel: number;
    jobTemplateId?: string | null;
  }): Promise<StickerScope> {
    await this.assertBranchInCompany(args.companyId, args.branchId);
    const purpose = await this.loadPurpose(args.companyId, args.purposeCode);
    const deviceId = this.requestContext.getDeviceId();
    const assignment = await this.assignmentFor(purpose, args.companyId, args.branchId, deviceId);
    return {
      companyId: args.companyId,
      branchId: args.branchId,
      deviceId,
      purpose,
      priceLevel: args.priceLevel,
      assignment,
      ...(args.jobTemplateId !== undefined ? { jobTemplateId: args.jobTemplateId } : {}),
    };
  }

  /**
   * SM6 / decision 31: "Our price" is remembered per counter = the price level
   * of THIS counter's newest job (any kind, any status, by printed_on) in this
   * company; RET (2) when the counter has printed none, or the session has no
   * counter. No setting of its own.
   */
  async lastPriceLevel(companyId: string, deviceId: string | null): Promise<number> {
    if (!deviceId) {
      return STICKER_DEFAULT_PRICE_LEVEL;
    }
    const [row] = await this.prisma.$queryRaw<{ level: number }[]>`
      SELECT lbj_price_level::int AS level
        FROM inventory.label_job
       WHERE lbj_device_id = ${deviceId}::uuid AND lbj_company_id = ${companyId}::uuid
       ORDER BY lbj_printed_on DESC
       LIMIT 1`;
    return row?.level ?? STICKER_DEFAULT_PRICE_LEVEL;
  }

  // ═══ Designs ══════════════════════════════════════════════════════════════

  async loadDesigns(ids: readonly (string | null | undefined)[]): Promise<Map<string, DesignRow>> {
    const wanted = [...new Set(ids.filter((id): id is string => !!id))];
    if (wanted.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<DesignRow[]>`
      SELECT t.ptl_id, t.ptl_name, t.ptl_company_id, t.ptl_is_active, t.ptl_is_deleted, p.ppo_code,
             v.ptv_id, v.ptv_rev_no, v.ptv_status, v.ptv_is_deleted,
             v.ptv_label_width_mm, v.ptv_label_height_mm, v.ptv_label_across, v.ptv_label_down,
             v.ptv_paper_code, v.ptv_body
        FROM public.print_template t
        JOIN public.print_purpose p ON p.ppo_id = t.ptl_purpose_id
        LEFT JOIN public.print_template_version v ON v.ptv_id = t.ptl_published_rev_id
       WHERE t.ptl_id = ANY(${wanted}::uuid[])`;
    return new Map(rows.map((row) => [row.ptl_id, row]));
  }

  /**
   * Can this design print this list's labels? null = yes. Else the refusal:
   * not there (or another company's) → NOT_FOUND; no live published revision
   * → NOT_PUBLISHED; no label sheet → NOT_LABEL; a label design of another
   * purpose → NOT_LABEL rule=PURPOSE.
   */
  designVerdict(
    templateId: string,
    design: DesignRow | undefined,
    purposeCode: string,
    companyId: string,
  ): StickerRefusal | null {
    if (
      !design ||
      design.ptl_is_deleted ||
      !design.ptl_is_active ||
      (design.ptl_company_id !== null && design.ptl_company_id !== companyId)
    ) {
      return new StickerRefusal(
        STICKER_ERROR.DESIGN_NOT_FOUND,
        `No live sticker design ${templateId} for this company`,
        'templateId',
      );
    }
    if (!design.ptv_id || design.ptv_is_deleted || design.ptv_status !== 'PUBLISHED') {
      return new StickerRefusal(
        STICKER_ERROR.DESIGN_NOT_PUBLISHED,
        `${design.ptl_name} has no published revision`,
        'templateId',
      );
    }
    if (design.ptv_label_width_mm === null) {
      return new StickerRefusal(
        STICKER_ERROR.DESIGN_NOT_LABEL,
        `${design.ptl_name} has no label sheet, so it cannot print stickers`,
        'templateId',
      );
    }
    if (design.ppo_code !== purposeCode) {
      return new StickerRefusal(
        STICKER_ERROR.DESIGN_NOT_LABEL,
        `${design.ptl_name} is a ${design.ppo_code} design, not ${purposeCode}`,
        'templateId',
        { rule: 'PURPOSE' },
      );
    }
    return null;
  }

  // ═══ Lots (GET /stickers/lots) ═══════════════════════════════════════════

  async lots(args: {
    companyId: string;
    branchId: string;
    itemId: string;
    unitId: string;
  }): Promise<StickerLotPayload[]> {
    await this.assertBranchInCompany(args.companyId, args.branchId);
    const items = await this.loadItems(args.companyId, [args.itemId]);
    if (!items.has(args.itemId)) {
      refuseSticker(
        STICKER_ERROR.ITEM_NOT_FOUND,
        `No live item ${args.itemId} in this company`,
        'itemId',
      );
    }
    const unit = (await this.loadUnits([args.itemId]))
      .get(args.itemId)
      ?.find((row) => row.iuc_id === args.unitId);
    if (!unit) {
      refuseSticker(
        STICKER_ERROR.UNIT_NOT_OF_ITEM,
        `Unit ${args.unitId} is not one of this item's units`,
        'unitId',
      );
    }
    const lots =
      (await this.loadStockedLots(args.companyId, args.branchId, [args.itemId])).get(args.itemId) ??
      [];
    return lots.map((lot) => ({
      lotId: lot.lot_id,
      batchNo: lot.batch_no,
      mrp: money(lot.mrp),
      salePrice: money(lot.sale_price),
      mfgDate: lot.mfg_date,
      expiryDate: lot.expiry_date,
      onHandQty: Number(lot.on_hand.dividedBy(unit.factor).toFixed(3)),
      firstInwardDate: lot.first_inward_date,
    }));
  }

  // ═══ Add items (GET /stickers/lines/from-items) ═══════════════════════════

  /** The ids of the items the filters pick, at most `limit` (name order). */
  async itemIdsFor(args: {
    companyId: string;
    groupId?: string | null;
    brandId?: string | null;
    supplierId?: string | null;
    name?: string | null;
    stickerOnly: boolean;
    limit: number;
  }): Promise<string[]> {
    const name = (args.name ?? '').trim();
    const pattern = `%${name.replace(/[\\%_]/g, (match) => `\\${match}`)}%`;
    const rows = await this.prisma.$transaction(async (tx) => {
      // The filters are `$x IS NULL OR …`; a generic plan of them is slow (house note).
      await tx.$executeRaw`SET LOCAL plan_cache_mode = force_custom_plan`;
      return tx.$queryRaw<{ item_id: string }[]>`
        SELECT i.item_id
          FROM inventory.item_master i
          LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
         WHERE i.item_is_deleted = false
           AND i.item_is_active = true
           AND i.item_is_service = false
           AND (i.item_company_id IS NULL OR i.item_company_id = ${args.companyId}::uuid)
           AND (${args.stickerOnly}::boolean = false OR i.item_barcode_sticker = true)
           AND (${args.groupId ?? null}::uuid IS NULL
                OR i.item_group_id = ${args.groupId ?? null}::uuid
                OR ${args.groupId ?? null}::uuid = ANY(g.itg_path_ids_cache))
           AND (${args.brandId ?? null}::uuid IS NULL OR i.item_brand_id = ${args.brandId ?? null}::uuid)
           AND (${args.supplierId ?? null}::uuid IS NULL OR i.item_supplier_id = ${args.supplierId ?? null}::uuid)
           AND (${name} = ''
                OR i.item_name_en ILIKE ${pattern}
                OR i.item_alias ILIKE ${pattern}
                OR i.item_code ILIKE ${pattern})
         ORDER BY i.item_name_en, i.item_id
         LIMIT ${args.limit}`;
    });
    return rows.map((row) => row.item_id);
  }

  // ═══ THE builder ══════════════════════════════════════════════════════════

  async buildLines(
    scope: StickerScope,
    inputs: readonly StickerLineInput[],
  ): Promise<BuiltStickerLine[]> {
    const { companyId, branchId } = scope;

    // 1. Codes → item / unit / lot.
    const codes = [
      ...new Set(
        inputs
          .filter((input) => !input.itemId && input.code && input.code.trim())
          .map((input) => (input.code as string).trim()),
      ),
    ];
    const hits = await this.lookupCodes(companyId, codes);

    const itemIdOf = (input: StickerLineInput): string | null =>
      input.itemId ?? (input.code ? (hits.get(input.code.trim())?.itemId ?? null) : null);
    const itemIds = [...new Set(inputs.map(itemIdOf).filter((id): id is string => !!id))];

    // 2. Everything about those items, one read each.
    const [items, units, eans, stocked, totals, levelNames, lastPrinted, letters, today] =
      await Promise.all([
        this.loadItems(companyId, itemIds),
        this.loadUnits(itemIds),
        this.loadEans(itemIds),
        this.loadStockedLots(companyId, branchId, itemIds),
        this.loadStockTotals(companyId, branchId, itemIds),
        this.loadPriceLevelNames(),
        this.loadLastPrinted(companyId, branchId, itemIds),
        this.costLetters(companyId, branchId),
        this.today(),
      ]);

    const namedLotIds = inputs
      .map((input) => input.lotId ?? (input.code ? hits.get(input.code.trim())?.lotId : null))
      .filter((id): id is string => !!id);
    const namedLots = await this.loadLotsById(companyId, branchId, namedLotIds);

    const designs = await this.loadDesigns([
      scope.jobTemplateId,
      scope.assignment.templateId,
      ...inputs.map((input) => input.templateId),
      ...[...items.values()].map((item) => item.sticker_id),
    ]);

    const priceRows = itemIds.length
      ? await this.prisma.itemPriceMaster.findMany({
          where: { ipmItemId: { in: itemIds }, ipmIsDeleted: false },
        })
      : [];
    const flags = await readBucketTrackFlags(
      this.prisma,
      itemIds.map((itemId) => ({ itemId, companyId, branchId })),
      today,
    );
    const flagsOf = new Map(itemIds.map((itemId, index) => [itemId, flags[index]]));

    // Textile lots: the batch's size / colour / model (and "is a tag" for the barcode).
    const batchKeys: Array<{ itemId: string; batchNo: string }> = [];
    for (const lots of [...stocked.values(), [...namedLots.values()]]) {
      for (const lot of lots) {
        if (lot.batch_no) batchKeys.push({ itemId: lot.item_id, batchNo: lot.batch_no });
      }
    }
    const batchDetails = await this.loadBatchDetails(companyId, batchKeys);

    // 3. One line at a time, in the order asked.
    return inputs.map((input) =>
      this.buildOne(scope, input, {
        hit: input.code ? (hits.get(input.code.trim()) ?? null) : null,
        itemId: itemIdOf(input),
        items,
        units,
        eans,
        stocked,
        namedLots,
        totals,
        designs,
        priceRows,
        flagsOf,
        batchDetails,
        levelNames,
        lastPrinted,
        letters,
        today,
      }),
    );
  }

  private buildOne(
    scope: StickerScope,
    input: StickerLineInput,
    ctx: {
      hit: CodeHit | null;
      itemId: string | null;
      items: Map<string, ItemRow>;
      units: Map<string, UnitRow[]>;
      eans: Map<string, string[]>;
      stocked: Map<string, LotRow[]>;
      namedLots: Map<string, LotRow>;
      totals: Map<string, Prisma.Decimal>;
      designs: Map<string, DesignRow>;
      priceRows: ItemPriceMaster[];
      flagsOf: Map<string, { trackMrp: boolean; trackSalePrice: boolean }>;
      batchDetails: Map<
        string,
        { size: string | null; colour: string | null; model: string | null }
      >;
      levelNames: Map<number, string>;
      lastPrinted: Map<string, { printedOn: Date; labels: number }>;
      letters: string | null;
      today: string;
    },
  ): BuiltStickerLine {
    const line: StickerLine = {
      key: input.key,
      itemId: null,
      itemName: null,
      itemNameTa: null,
      itemCode: null,
      unitId: null,
      unitName: null,
      isDefaultUnit: false,
      barcode: null,
      barcodeSource: null,
      lotId: null,
      batchNo: null,
      mfgDate: null,
      expiryDate: null,
      lotRequired: false,
      lotCount: 0,
      mrp: null,
      price: null,
      priceLevel: scope.priceLevel,
      costCode: null,
      priceCode: null,
      templateId: null,
      templateName: null,
      designSource: 'NONE',
      designHasBarcode: false,
      labelWidthMm: null,
      labelHeightMm: null,
      labelsAcross: null,
      labelsDown: null,
      paperCode: null,
      labels: input.labels ?? 1,
      stockQty: null,
      lastPrintedOn: null,
      lastPrintedLabels: null,
      problem: null,
    };
    const built: BuiltStickerLine = {
      line,
      facts: {
        mrp: null,
        price: null,
        cost: null,
        versionId: null,
        brand: null,
        groupName: null,
        size: null,
        colour: null,
        model: null,
        priceLevelShort: ctx.levelNames.get(scope.priceLevel) ?? null,
        unitHasDecimals: false,
      },
    };
    const fail = (refusal: StickerRefusal): BuiltStickerLine => {
      line.problem ??= refusal.toProblem();
      built.refusal ??= refusal;
      return built;
    };

    // ── The design (§4.5) — decided even for a bad line, so it sits in its group.
    this.applyDesign(scope, input, ctx, built);

    // ── The item.
    if (!ctx.itemId) {
      return input.code && !input.itemId
        ? fail(
            new StickerRefusal(
              STICKER_ERROR.CODE_NOT_FOUND,
              `No item of this company has the barcode or code "${input.code.trim()}"`,
              'code',
            ),
          )
        : fail(
            new StickerRefusal(STICKER_ERROR.ITEM_NOT_FOUND, 'The line names no item', 'itemId'),
          );
    }
    const item = ctx.items.get(ctx.itemId);
    if (!item) {
      return fail(
        new StickerRefusal(
          STICKER_ERROR.ITEM_NOT_FOUND,
          `No live item ${ctx.itemId} in this company`,
          'itemId',
        ),
      );
    }
    line.itemId = item.item_id;
    line.itemName = item.item_name_en;
    line.itemNameTa = item.item_name_ta;
    line.itemCode = item.item_code;
    built.facts.brand = item.brand_name;
    built.facts.groupName = item.group_name;

    // ── The unit: named, else the scanned EAN's, else Def, else base.
    const units = ctx.units.get(item.item_id) ?? [];
    const wantedUnit = input.unitId ?? ctx.hit?.unitId ?? null;
    const unit = wantedUnit
      ? units.find((row) => row.iuc_id === wantedUnit)
      : (units.find((row) => row.is_default) ?? units.find((row) => row.is_base) ?? units[0]);
    if (!unit) {
      return fail(
        new StickerRefusal(
          STICKER_ERROR.UNIT_NOT_OF_ITEM,
          wantedUnit
            ? `Unit ${wantedUnit} is not one of ${item.item_name_en}'s units`
            : `${item.item_name_en} has no unit`,
          'unitId',
        ),
      );
    }
    line.unitId = unit.iuc_id;
    line.unitName = unit.unit_name;
    line.isDefaultUnit = unit.is_default;
    built.facts.unitHasDecimals = unit.decimals > 0;
    const total = ctx.totals.get(item.item_id);
    line.stockQty = total ? Number(total.dividedBy(unit.factor).toFixed(3)) : 0;
    const last = ctx.lastPrinted.get(`${item.item_id}|${unit.iuc_id}`);
    if (last) {
      line.lastPrintedOn = istDateTimeText(last.printedOn);
      line.lastPrintedLabels = last.labels;
    }

    // ── The lot (SM7).
    const lots = ctx.stocked.get(item.item_id) ?? [];
    line.lotCount = lots.length;
    const namedLotId = input.lotId ?? ctx.hit?.lotId ?? null;
    let lot: LotRow | null = null;
    if (namedLotId) {
      lot = lots.find((row) => row.lot_id === namedLotId) ?? ctx.namedLots.get(namedLotId) ?? null;
      if (!lot || lot.item_id !== item.item_id) {
        return fail(
          new StickerRefusal(
            STICKER_ERROR.LOT_NOT_OF_ITEM,
            `Lot ${namedLotId} is not one of ${item.item_name_en}'s lots`,
            'lotId',
          ),
        );
      }
    } else {
      const picked = pickLot(lots.map((row) => ({ lotId: row.lot_id, mrp: row.mrp })));
      line.lotRequired = picked.lotRequired;
      lot = picked.lotId ? (lots.find((row) => row.lot_id === picked.lotId) ?? null) : null;
    }
    if (lot) {
      line.lotId = lot.lot_id;
      line.batchNo = lot.batch_no;
      line.mfgDate = lot.mfg_date;
      line.expiryDate = lot.expiry_date;
      const detail = lot.batch_no
        ? ctx.batchDetails.get(`${item.item_id}|${lot.batch_no}`)
        : undefined;
      if (detail) {
        built.facts.size = detail.size;
        built.facts.colour = detail.colour;
        built.facts.model = detail.model;
      }
    }

    // ── The barcode (decision 36). Never written while printing (S8).
    const textileLot =
      lot?.batch_no && ctx.batchDetails.has(`${item.item_id}|${lot.batch_no}`)
        ? lot.batch_no
        : null;
    const unitEan = (ctx.eans.get(unit.iuc_id) ?? [])[0] ?? null;
    let barcode: string | null = null;
    let source: BarcodeSource | null = null;
    if (textileLot) {
      barcode = textileLot;
      source = 'LOT';
    } else if (unitEan) {
      barcode = unitEan;
      source = 'UNIT';
    } else if (unit.is_default && item.default_barcode) {
      barcode = item.default_barcode;
      source = 'ITEM';
    }
    line.barcode = barcode;
    line.barcodeSource = source;

    // ── MRP, Our price, codes (S9, SM6, PQ1).
    const rows = ctx.priceRows.filter(
      (row) => row.ipmItemId === item.item_id && row.ipmUcUnitId === unit.iuc_id,
    );
    const key = bucketKeyFor(ctx.flagsOf.get(item.item_id), {
      mrp: lot?.mrp ? lot.mrp.toNumber() : null,
      salePrice: lot?.sale_price ? lot.sale_price.toNumber() : null,
    });
    const resolved = resolveEffectivePrice(rows, key, ctx.today, {
      companyId: scope.companyId,
      branchId: scope.branchId,
    });
    const priceRow = resolved?.row ?? null;
    const levelColumn = priceRow
      ? [
          priceRow.ipmSalesPriceA,
          priceRow.ipmSalesPriceB,
          priceRow.ipmSalesPriceC,
          priceRow.ipmSalesPriceD,
        ][scope.priceLevel - 1]
      : null;
    const mrp = positive(lot?.mrp ?? null) ?? positive(dec(priceRow?.ipmMaxPrice ?? null));
    const price = positive(dec(levelColumn ?? null));
    const lotCost = lot?.cost_rate ? lot.cost_rate.times(unit.factor) : null;
    const cost = positive(lotCost) ?? positive(dec(priceRow?.ipmCostPrice ?? null));
    built.facts.mrp = mrp;
    built.facts.price = price;
    built.facts.cost = cost;
    line.mrp = money(mrp);
    line.price = money(price);
    line.costCode = cipherCode(cost, ctx.letters);
    line.priceCode = cipherCode(price, ctx.letters);

    // ── What a job line cannot hold (varchar(50) / (60)): a problem, never a truncation.
    if (barcode && barcode.length > STICKER_BARCODE_MAX) {
      return fail(
        new StickerRefusal(
          STICKER_ERROR.BARCODE_TOO_LONG,
          `The barcode "${barcode}" is longer than ${STICKER_BARCODE_MAX} characters`,
          'barcode',
        ),
      );
    }
    if (lot?.batch_no && lot.batch_no.length > STICKER_BATCH_MAX) {
      return fail(
        new StickerRefusal(
          STICKER_ERROR.BATCH_TOO_LONG,
          `The batch "${lot.batch_no}" is longer than ${STICKER_BATCH_MAX} characters`,
          'lotId',
        ),
      );
    }
    if (
      !Number.isInteger(line.labels) ||
      line.labels < 1 ||
      line.labels > STICKER_MAX_LABELS_PER_LINE
    ) {
      return fail(
        new StickerRefusal(
          STICKER_ERROR.LABELS_INVALID,
          `labels must be 1 to ${STICKER_MAX_LABELS_PER_LINE}, got ${line.labels}`,
          'labels',
        ),
      );
    }
    return built;
  }

  /** §4.5: JOB → ITEM → PURPOSE → NONE, with the design's sheet on the line. */
  private applyDesign(
    scope: StickerScope,
    input: StickerLineInput,
    ctx: { itemId: string | null; items: Map<string, ItemRow>; designs: Map<string, DesignRow> },
    built: BuiltStickerLine,
  ): void {
    const { line } = built;
    const purposeCode = scope.purpose.ppoCode;
    let templateId: string | null = null;
    let source: DesignSource = 'NONE';
    let verdict: StickerRefusal | null = null;

    const jobDesign = input.templateId ?? scope.jobTemplateId ?? null;
    const itemDesign = ctx.itemId ? (ctx.items.get(ctx.itemId)?.sticker_id ?? null) : null;
    if (jobDesign) {
      templateId = jobDesign;
      source = 'JOB';
      verdict = this.designVerdict(
        jobDesign,
        ctx.designs.get(jobDesign),
        purposeCode,
        scope.companyId,
      );
    } else if (
      itemDesign &&
      !this.designVerdict(itemDesign, ctx.designs.get(itemDesign), purposeCode, scope.companyId)
    ) {
      templateId = itemDesign;
      source = 'ITEM';
    } else if (scope.assignment.templateId) {
      templateId = scope.assignment.templateId;
      source = 'PURPOSE';
      verdict = this.designVerdict(
        templateId,
        ctx.designs.get(templateId),
        purposeCode,
        scope.companyId,
      );
    }

    line.designSource = source;
    line.templateId = templateId;
    const design = templateId ? ctx.designs.get(templateId) : undefined;
    if (design) {
      line.templateName = design.ptl_name;
      line.designHasBarcode = bodyHasBarcode(design.ptv_body);
      line.labelWidthMm = design.ptv_label_width_mm ? design.ptv_label_width_mm.toNumber() : null;
      line.labelHeightMm = design.ptv_label_height_mm
        ? design.ptv_label_height_mm.toNumber()
        : null;
      line.labelsAcross = design.ptv_label_across;
      line.labelsDown = design.ptv_label_down;
      line.paperCode = design.ptv_paper_code;
      built.facts.versionId = design.ptv_id;
    }
    if (verdict) {
      line.problem = verdict.toProblem();
      built.refusal = verdict;
    }
  }

  // ═══ Reads ════════════════════════════════════════════════════════════════

  /** Today in IST, as the price lines' `effective_from / _to` read it. */
  async today(): Promise<string> {
    const [row] = await this.prisma.$queryRaw<{ d: string }[]>`
      SELECT (now() AT TIME ZONE 'Asia/Kolkata')::date::text AS d`;
    return row.d;
  }

  /** The company's cost-code letters (inventory.label_cost_code), through the resolver. */
  async costLetters(companyId: string, branchId: string): Promise<string | null> {
    const [row] = await this.prisma.$queryRaw<{ value: string | null }[]>`
      SELECT out_effective_value AS value
        FROM public.fn_app_settings_effective(${companyId}::uuid, ${branchId}::uuid, NULL::uuid, NULL::uuid)
       WHERE out_asd_key = ${LABEL_COST_CODE_SETTING}`;
    const letters = row?.value?.trim().toUpperCase() ?? '';
    return letters || null;
  }

  /**
   * A scanned / typed code, in this order: an EAN of a unit (default first) →
   * an item's own barcode → an item code (any case) → a lot's batch number.
   */
  private async lookupCodes(
    companyId: string,
    codes: readonly string[],
  ): Promise<Map<string, CodeHit>> {
    const hits = new Map<string, CodeHit>();
    if (codes.length === 0) {
      return hits;
    }
    const rows = await this.prisma.$queryRaw<
      Array<{
        code: string;
        item_id: string;
        unit_id: string | null;
        lot_id: string | null;
        rank: number;
      }>
    >`
      WITH q AS (SELECT DISTINCT unnest(${[...codes]}::text[]) AS code)
      SELECT q.code, e.ean_item_id AS item_id, e.ean_uc_unit_id AS unit_id, NULL::uuid AS lot_id, 1 AS rank
        FROM q
        JOIN inventory.item_ean_codes e ON e.ean_code = q.code AND e.ean_is_deleted = false AND e.ean_is_active = true
        JOIN inventory.item_master i ON i.item_id = e.ean_item_id AND i.item_is_deleted = false
                                    AND (i.item_company_id IS NULL OR i.item_company_id = ${companyId}::uuid)
      UNION ALL
      SELECT q.code, i.item_id, NULL::uuid, NULL::uuid, 2
        FROM q
        JOIN inventory.item_master i ON btrim(i.item_default_barcode) = q.code AND i.item_is_deleted = false
                                    AND (i.item_company_id IS NULL OR i.item_company_id = ${companyId}::uuid)
      UNION ALL
      SELECT q.code, i.item_id, NULL::uuid, NULL::uuid, 3
        FROM q
        JOIN inventory.item_master i ON upper(btrim(i.item_code)) = upper(q.code) AND i.item_is_deleted = false
                                    AND (i.item_company_id IS NULL OR i.item_company_id = ${companyId}::uuid)
      UNION ALL
      SELECT q.code, l.slt_item_id, NULL::uuid, l.slt_id, 4
        FROM q
        JOIN stock.stock_lot l ON l.slt_batch_no = q.code AND l.slt_is_deleted = false
                              AND (l.slt_company_id IS NULL OR l.slt_company_id = ${companyId}::uuid)
       ORDER BY 1, 5`;
    for (const row of rows) {
      if (!hits.has(row.code)) {
        hits.set(row.code, { itemId: row.item_id, unitId: row.unit_id, lotId: row.lot_id });
      }
    }
    return hits;
  }

  private async loadItems(
    companyId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, ItemRow>> {
    if (itemIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<ItemRow[]>`
      SELECT i.item_id, i.item_name_en, NULLIF(btrim(i.item_name_ta), '') AS item_name_ta,
             NULLIF(btrim(i.item_code), '') AS item_code,
             NULLIF(btrim(i.item_default_barcode), '') AS default_barcode,
             i.item_barcode_sticker_id AS sticker_id,
             b.brand_name, g.itg_name AS group_name
        FROM inventory.item_master i
        LEFT JOIN inventory.item_brand_master b ON b.brand_id = i.item_brand_id
        LEFT JOIN inventory.item_group_master g ON g.itg_id = i.item_group_id
       WHERE i.item_id = ANY(${[...itemIds]}::uuid[])
         AND i.item_is_deleted = false
         AND (i.item_company_id IS NULL OR i.item_company_id = ${companyId}::uuid)`;
    return new Map(rows.map((row) => [row.item_id, row]));
  }

  private async loadUnits(itemIds: readonly string[]): Promise<Map<string, UnitRow[]>> {
    const byItem = new Map<string, UnitRow[]>();
    if (itemIds.length === 0) {
      return byItem;
    }
    const rows = await this.prisma.$queryRaw<
      Array<Omit<UnitRow, 'factor' | 'decimals'> & { factor: unknown; decimals: number | null }>
    >`
      SELECT c.iuc_id, c.iuc_item_id, c.iuc_is_default_unit AS is_default, c.iuc_is_base_unit AS is_base,
             COALESCE(NULLIF(c.iuc_to_base_factor, 0), 1) AS factor,
             u.unit_name, COALESCE(u.unit_decimal_count, 0)::int AS decimals
        FROM inventory.item_unit_conversion c
        LEFT JOIN inventory.item_unit_master u ON u.unit_id = c.iuc_unit_id
       WHERE c.iuc_item_id = ANY(${[...itemIds]}::uuid[]) AND c.iuc_is_deleted = false
       ORDER BY c.iuc_item_id, c.iuc_is_default_unit DESC, c.iuc_unit_slno`;
    for (const row of rows) {
      const list = byItem.get(row.iuc_item_id) ?? [];
      list.push({
        ...row,
        factor: dec(row.factor) ?? new Prisma.Decimal(1),
        decimals: row.decimals ?? 0,
      });
      byItem.set(row.iuc_item_id, list);
    }
    return byItem;
  }

  /** The EANs of each unit (by iuc_id), default first. */
  private async loadEans(itemIds: readonly string[]): Promise<Map<string, string[]>> {
    const byUnit = new Map<string, string[]>();
    if (itemIds.length === 0) {
      return byUnit;
    }
    const rows = await this.prisma.$queryRaw<Array<{ unit_id: string; code: string }>>`
      SELECT e.ean_uc_unit_id AS unit_id, btrim(e.ean_code) AS code
        FROM inventory.item_ean_codes e
       WHERE e.ean_item_id = ANY(${[...itemIds]}::uuid[])
         AND e.ean_is_deleted = false AND e.ean_is_active = true
         AND e.ean_uc_unit_id IS NOT NULL AND btrim(e.ean_code) <> ''
       ORDER BY e.ean_is_default DESC, e.ean_sl_no NULLS LAST, e.ean_created_on`;
    for (const row of rows) {
      const list = byUnit.get(row.unit_id) ?? [];
      list.push(row.code);
      byUnit.set(row.unit_id, list);
    }
    return byUnit;
  }

  private static readonly LOT_COLUMNS = Prisma.sql`
             l.slt_id AS lot_id, l.slt_item_id AS item_id, l.slt_company_id AS company_id,
             NULLIF(btrim(l.slt_batch_no), '') AS batch_no, l.slt_mrp AS mrp, l.slt_sale_price AS sale_price,
             l.slt_mfg_date::text AS mfg_date, l.slt_expiry_date::text AS expiry_date,
             l.slt_first_inward_date::text AS first_inward_date, l.slt_cost_rate AS cost_rate`;

  /** Lots with SALEABLE stock > 0 at this branch (any godown), newest first (§4.6). */
  private async loadStockedLots(
    companyId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, LotRow[]>> {
    const byItem = new Map<string, LotRow[]>();
    if (itemIds.length === 0) {
      return byItem;
    }
    const rows = await this.prisma.$queryRaw<
      Array<Omit<LotRow, 'on_hand' | 'mrp' | 'sale_price' | 'cost_rate'> & Record<string, unknown>>
    >`
      SELECT ${StickerLinesService.LOT_COLUMNS}, s.on_hand
        FROM (SELECT b.sbl_lot_id, SUM(b.sbl_on_hand_qty) AS on_hand
                FROM stock.stock_balance b
               WHERE b.sbl_company_id = ${companyId}::uuid
                 AND b.sbl_branch_id = ${branchId}::uuid
                 AND b.sbl_item_id = ANY(${[...itemIds]}::uuid[])
                 AND b.sbl_bucket = 'SALEABLE'
                 AND b.sbl_is_deleted = false
               GROUP BY b.sbl_lot_id
              HAVING SUM(b.sbl_on_hand_qty) > 0) s
        JOIN stock.stock_lot l ON l.slt_id = s.sbl_lot_id AND l.slt_is_deleted = false
       ORDER BY l.slt_first_inward_date DESC NULLS LAST, l.slt_created_on DESC, l.slt_id DESC`;
    for (const row of rows) {
      const lot = this.toLot(row);
      const list = byItem.get(lot.item_id) ?? [];
      list.push(lot);
      byItem.set(lot.item_id, list);
    }
    return byItem;
  }

  /** Lots a line names (picked in the lot list, or by a batch scan), stocked or not. */
  private async loadLotsById(
    companyId: string,
    branchId: string,
    lotIds: readonly string[],
  ): Promise<Map<string, LotRow>> {
    const wanted = [...new Set(lotIds)];
    if (wanted.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<Array<Record<string, unknown>>>`
      SELECT ${StickerLinesService.LOT_COLUMNS},
             COALESCE((SELECT SUM(b.sbl_on_hand_qty) FROM stock.stock_balance b
                        WHERE b.sbl_lot_id = l.slt_id AND b.sbl_branch_id = ${branchId}::uuid
                          AND b.sbl_bucket = 'SALEABLE' AND b.sbl_is_deleted = false), 0) AS on_hand
        FROM stock.stock_lot l
       WHERE l.slt_id = ANY(${wanted}::uuid[]) AND l.slt_is_deleted = false
         AND (l.slt_company_id IS NULL OR l.slt_company_id = ${companyId}::uuid)`;
    return new Map(
      rows.map((row) => {
        const lot = this.toLot(row);
        return [lot.lot_id, lot];
      }),
    );
  }

  private toLot(row: Record<string, unknown>): LotRow {
    return {
      lot_id: row.lot_id as string,
      item_id: row.item_id as string,
      company_id: (row.company_id as string | null) ?? null,
      batch_no: (row.batch_no as string | null) ?? null,
      mrp: dec(row.mrp),
      sale_price: dec(row.sale_price),
      mfg_date: isoDay(row.mfg_date as string | null),
      expiry_date: isoDay(row.expiry_date as string | null),
      first_inward_date: isoDay(row.first_inward_date as string | null),
      cost_rate: dec(row.cost_rate),
      on_hand: dec(row.on_hand) ?? new Prisma.Decimal(0),
    };
  }

  /** SALEABLE stock of each item at this branch, in BASE units (decision 37). */
  private async loadStockTotals(
    companyId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, Prisma.Decimal>> {
    if (itemIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<Array<{ item_id: string; on_hand: unknown }>>`
      SELECT b.sbl_item_id AS item_id, SUM(b.sbl_on_hand_qty) AS on_hand
        FROM stock.stock_balance b
       WHERE b.sbl_company_id = ${companyId}::uuid
         AND b.sbl_branch_id = ${branchId}::uuid
         AND b.sbl_item_id = ANY(${[...itemIds]}::uuid[])
         AND b.sbl_bucket = 'SALEABLE'
         AND b.sbl_is_deleted = false
       GROUP BY b.sbl_item_id`;
    return new Map(rows.map((row) => [row.item_id, dec(row.on_hand) ?? new Prisma.Decimal(0)]));
  }

  /** stock_batch_detail (textile): size / colour / model of a batch of an item. */
  private async loadBatchDetails(
    companyId: string,
    keys: ReadonlyArray<{ itemId: string; batchNo: string }>,
  ): Promise<Map<string, { size: string | null; colour: string | null; model: string | null }>> {
    const unique = [...new Map(keys.map((key) => [`${key.itemId}|${key.batchNo}`, key])).values()];
    if (unique.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<
      Array<{
        item_id: string;
        batch_no: string;
        size: string | null;
        colour: string | null;
        model: string | null;
      }>
    >`
      SELECT DISTINCT ON (d.sbd_item_id, d.sbd_batch_no)
             d.sbd_item_id AS item_id, d.sbd_batch_no AS batch_no,
             sz.isz_name AS size, cl.icl_name AS colour, NULLIF(btrim(d.sbd_model), '') AS model
        FROM unnest(${unique.map((key) => key.itemId)}::uuid[], ${unique.map((key) => key.batchNo)}::text[])
             AS q(item_id, batch_no)
        JOIN stock.stock_batch_detail d
          ON d.sbd_item_id = q.item_id AND d.sbd_batch_no = q.batch_no
         AND d.sbd_company_id = ${companyId}::uuid AND d.sbd_is_deleted = false
        LEFT JOIN inventory.item_size_master sz ON sz.isz_id = d.sbd_size_id
        LEFT JOIN inventory.item_colour_master cl ON cl.icl_id = d.sbd_colour_id
       ORDER BY d.sbd_item_id, d.sbd_batch_no, d.sbd_created_on DESC`;
    return new Map(
      rows.map((row) => [
        `${row.item_id}|${row.batch_no}`,
        { size: row.size, colour: row.colour, model: row.model },
      ]),
    );
  }

  private async loadPriceLevelNames(): Promise<Map<number, string>> {
    const rows = await this.prisma.$queryRaw<Array<{ id: number; short: string | null }>>`
      SELECT price_lvl_id::int AS id, NULLIF(btrim(price_lvl_short), '') AS short
        FROM fixed.price_levels WHERE price_lvl_id BETWEEN 1 AND 4`;
    return new Map(rows.filter((row) => row.short).map((row) => [row.id, row.short as string]));
  }

  /** "Last printed" (§4.6): the newest non-failed job line of each item + unit at this branch. */
  private async loadLastPrinted(
    companyId: string,
    branchId: string,
    itemIds: readonly string[],
  ): Promise<Map<string, { printedOn: Date; labels: number }>> {
    if (itemIds.length === 0) {
      return new Map();
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ item_id: string; unit_id: string; printed_on: Date; labels: number }>
    >`
      SELECT DISTINCT ON (l.lbjl_item_id, l.lbjl_unit_id)
             l.lbjl_item_id AS item_id, l.lbjl_unit_id AS unit_id, j.lbj_printed_on AS printed_on,
             l.lbjl_labels AS labels
        FROM inventory.label_job_line l
        JOIN inventory.label_job j ON j.lbj_id = l.lbjl_job_id AND j.lbj_acc_year = l.lbjl_acc_year
       WHERE l.lbjl_item_id = ANY(${[...itemIds]}::uuid[])
         AND j.lbj_company_id = ${companyId}::uuid
         AND j.lbj_branch_id = ${branchId}::uuid
         AND j.lbj_status <> 'FAILED'
       ORDER BY l.lbjl_item_id, l.lbjl_unit_id, j.lbj_printed_on DESC`;
    return new Map(
      rows.map((row) => [
        `${row.item_id}|${row.unit_id}`,
        { printedOn: row.printed_on, labels: row.labels },
      ]),
    );
  }
}
