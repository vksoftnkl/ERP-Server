import { Injectable } from '@nestjs/common';
import { StockTrackPreset } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import { GetStockTrackPresetsQueryDto } from './dto/get-stock-track-presets-query.dto';
import { throwNotFound, type ModuleErrorDetail } from 'src/common/utils/module-shared.utils';
import {
  DEFAULT_ACTOR,
  isUniqueConstraintError,
  resolveActor,
  throwStockConflict,
  throwStockNotFound,
  throwStockUnprocessable,
} from 'src/common/utils/module-service.utils';
import type { StockErrorDetail, StockErrorResponse } from '../stock-voucher/types/stock-voucher.types';
import { StockErrorCode } from '../types/stock-error-codes';
import {
  PRESET_TRACK_FIELDS,
  type DeactivateStockTrackPresetDto,
  type PresetTrackField,
  type SaveStockTrackPresetDto,
} from './dto/save-stock-track-preset.dto';
import { mergePresets, presetScopeFilter } from './preset-merge';
import {
  StockTrackPresetsGetMeta,
  StockTrackPresetsPayload,
} from './types/stock-track-presets-api.types';

/** The preset as a save would leave it — the write rules judge this. */
export interface PresetValues {
  code: string;
  name: string;
  description: string | null;
  trackBatch: boolean;
  trackMrp: boolean;
  trackSalePrice: boolean;
  trackExpiry: boolean;
  trackSerial: boolean;
  trackSupplier: boolean;
  valuationMethod: string;
  issueStrategy: string;
  allowNegative: string;
  shelfLifeDays: number | null;
  nearExpiryDays: number;
  blockExpiredSale: boolean;
  ageingBasis: string;
  sortOrder: number;
  remarks: string | null;
}

interface PresetUsage {
  items: number;
  groups: number;
  activeItems: number;
  activeGroups: number;
}

const NO_USAGE: PresetUsage = { items: 0, groups: 0, activeItems: 0, activeGroups: 0 };

const TRACK_COLUMN: Record<PresetTrackField, keyof StockTrackPreset> = {
  trackBatch: 'sptTrackBatch',
  trackMrp: 'sptTrackMrp',
  trackSalePrice: 'sptTrackSalePrice',
  trackExpiry: 'sptTrackExpiry',
  trackSerial: 'sptTrackSerial',
  trackSupplier: 'sptTrackSupplier',
};

const TRACK_WORDS: Record<PresetTrackField, string> = {
  trackBatch: 'batch',
  trackMrp: 'MRP',
  trackSalePrice: 'sale price',
  trackExpiry: 'expiry',
  trackSerial: 'serial',
  trackSupplier: 'supplier',
};

/** What ck_spt_valuation_tracks demands of these flags. */
export function valuationFor(values: Pick<PresetValues, PresetTrackField>): 'LOT_ACTUAL' | 'WAVG' {
  return PRESET_TRACK_FIELDS.some((f) => values[f]) ? 'LOT_ACTUAL' : 'WAVG';
}

/**
 * The table's three cross-field CHECKs as worded 422 details (notes 159 §4),
 * judged before the write so the database never answers with a raw error.
 */
export function presetRuleErrors(values: PresetValues): StockErrorDetail[] {
  const errors: StockErrorDetail[] = [];
  if (values.trackExpiry && !values.trackBatch) {
    errors.push({
      field: 'trackExpiry',
      code: StockErrorCode.PRESET_EXPIRY_NEEDS_BATCH,
      message: 'Expiry is kept per batch: track batches too, or stop tracking expiry.',
    });
  }
  if (values.issueStrategy === 'FEFO' && values.trackBatch && !values.trackExpiry) {
    errors.push({
      field: 'issueStrategy',
      code: StockErrorCode.PRESET_FEFO_NEEDS_EXPIRY,
      message: 'First-expiry-first-out needs expiry dates: track expiry, or issue FIFO, LIFO or by hand.',
    });
  }
  const valuation = valuationFor(values);
  if (values.valuationMethod !== valuation) {
    errors.push({
      field: 'valuationMethod',
      code: StockErrorCode.PRESET_VALUATION_MISMATCH,
      message:
        valuation === 'LOT_ACTUAL'
          ? `A preset that tracks lots is valued at each lot's own cost (LOT_ACTUAL), not ${values.valuationMethod}.`
          : `A preset that tracks nothing is valued at the weighted average (WAVG), not ${values.valuationMethod}.`,
    });
  }
  return errors;
}

/**
 * Once an item or group uses the preset, the fields that decide how its stock
 * splits into lots are fixed (notes 159 §4) — changing them would re-split
 * stock already held. One detail per field that would change.
 */
export function lockedFieldErrors(
  existing: StockTrackPreset,
  next: PresetValues,
  usage: PresetUsage,
): StockErrorDetail[] {
  if (usage.items + usage.groups === 0) {
    return [];
  }
  const users = usedByWords(usage.items, usage.groups);
  const errors: StockErrorDetail[] = [];
  if (next.code !== existing.sptCode) {
    errors.push({
      field: 'code',
      code: StockErrorCode.PRESET_IN_USE,
      message: `${existing.sptCode} is used by ${users}; its code cannot change. Create another preset instead.`,
    });
  }
  for (const field of PRESET_TRACK_FIELDS) {
    if (next[field] !== existing[TRACK_COLUMN[field]]) {
      errors.push({
        field,
        code: StockErrorCode.PRESET_IN_USE,
        message: `${existing.sptCode} is used by ${users}; ${next[field] ? 'starting' : 'stopping'} ${TRACK_WORDS[field]} tracking would re-split the stock they hold into different lots. Create another preset instead.`,
      });
    }
  }
  if (next.valuationMethod !== existing.sptValuationMethod) {
    errors.push({
      field: 'valuationMethod',
      code: StockErrorCode.PRESET_IN_USE,
      message: `${existing.sptCode} is used by ${users}; its valuation (${existing.sptValuationMethod}) cannot change.`,
    });
  }
  return errors;
}

function usedByWords(items: number, groups: number, adjective = ''): string {
  const parts = [
    items ? `${items} ${adjective}item${items === 1 ? '' : 's'}` : null,
    groups ? `${groups} ${adjective}item group${groups === 1 ? '' : 's'}` : null,
  ].filter(Boolean);
  return parts.join(' and ');
}

@Injectable()
export class StockTrackPresetsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  /**
   * The presets a company may pick from: its own, plus every shared one it has
   * not overridden. `spt_id` fetches one directly and skips the merge — an id
   * already names a single row, and a screen re-opening a saved item needs to
   * show the preset it was configured with even if a company row has since
   * overridden that code.
   */
  async get(
    queryDto: GetStockTrackPresetsQueryDto,
  ): Promise<{ items: StockTrackPresetsPayload[]; meta: StockTrackPresetsGetMeta }> {
    const companyId = queryDto.company_id ?? this.requestContextService.getCompanyId();
    if (queryDto.spt_id) {
      const record = await this.prisma.stockTrackPreset.findUnique({
        where: { sptId: queryDto.spt_id },
      });
      if (!record) {
        throwNotFound<ModuleErrorDetail>(
          `Stock track preset not found for spt_id ${queryDto.spt_id}`,
          'spt_id',
          `Stock track preset not found for spt_id ${queryDto.spt_id}`,
          StockErrorCode.PRESET_NOT_FOUND,
        );
      }
      const usage = await this.usageOf([record.sptId]);
      return {
        items: [this.toPayload(record, record.sptCompanyId !== null, usage.get(record.sptId))],
        meta: { company_id: companyId, spt_id: queryDto.spt_id, count: 1 },
      };
    }
    const rows = await this.prisma.stockTrackPreset.findMany({
      where: {
        ...presetScopeFilter(companyId),
        ...(queryDto.spt_code ? { sptCode: queryDto.spt_code } : {}),
      },
      orderBy: [{ sptSortOrder: 'asc' }, { sptCode: 'asc' }],
    });
    // The merge collapses at most two rows per code and runs over a couple of
    // dozen presets, so it costs nothing to do here — and doing it here rather
    // than in SQL keeps the rule in one readable place (see preset-merge.ts).
    const merged = mergePresets(rows);
    const usage = await this.usageOf(merged.map((r) => r.sptId));
    const items = merged.map((record) =>
      this.toPayload(record, record.sptCompanyId !== null, usage.get(record.sptId)),
    );
    return {
      items,
      meta: {
        company_id: companyId,
        spt_code: queryDto.spt_code,
        count: items.length,
      },
    };
  }
  private toPayload(
    record: StockTrackPreset,
    isCompanyOverride: boolean,
    usage: PresetUsage = NO_USAGE,
  ): StockTrackPresetsPayload {
    return {
      spt_id: record.sptId,
      spt_company_id: record.sptCompanyId,
      spt_code: record.sptCode,
      spt_name: record.sptName,
      spt_description: record.sptDescription,
      spt_track_batch: record.sptTrackBatch,
      spt_track_mrp: record.sptTrackMrp,
      spt_track_sale_price: record.sptTrackSalePrice,
      spt_track_expiry: record.sptTrackExpiry,
      spt_track_serial: record.sptTrackSerial,
      spt_track_supplier: record.sptTrackSupplier,
      spt_track_signature: record.sptTrackSignature,
      spt_valuation_method: record.sptValuationMethod,
      spt_issue_strategy: record.sptIssueStrategy,
      spt_allow_negative: record.sptAllowNegative,
      spt_shelf_life_days: record.sptShelfLifeDays,
      spt_near_expiry_days: record.sptNearExpiryDays,
      spt_block_expired_sale: record.sptBlockExpiredSale,
      spt_ageing_basis: record.sptAgeingBasis,
      spt_sort_order: record.sptSortOrder,
      spt_remarks: record.sptRemarks,
      spt_is_company_override: isCompanyOverride,
      spt_is_active: record.sptIsActive,
      usedByItems: usage.items,
      usedByGroups: usage.groups,
    };
  }

  /**
   * POST /stock-track-presets/save (notes 159 §4): create or update the
   * company's OWN preset. A shared preset is read-only; a company overrides
   * it by creating its own with the same code.
   */
  async save(dto: SaveStockTrackPresetDto): Promise<StockTrackPresetsPayload> {
    const existing = dto.sptId ? await this.ownPreset(dto.companyId, dto.sptId, 'save') : null;
    if (!existing) {
      const missing: StockErrorDetail[] = [];
      if (!dto.code) {
        missing.push({ field: 'code', code: StockErrorCode.PRESET_FIELD_REQUIRED, message: 'A new preset needs a code.' });
      }
      if (!dto.name) {
        missing.push({ field: 'name', code: StockErrorCode.PRESET_FIELD_REQUIRED, message: 'A new preset needs a name.' });
      }
      if (missing.length) {
        throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Stock track preset cannot be saved', missing);
      }
    }
    const next = this.nextValues(dto, existing);
    const usage = existing ? (await this.usageOf([existing.sptId])).get(existing.sptId) ?? NO_USAGE : NO_USAGE;
    // A locked field is the 409; the CHECK wording would only repeat it.
    const locked = existing ? lockedFieldErrors(existing, next, usage) : [];
    if (locked.length) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Stock track preset is in use', locked);
    }
    const ruleErrors = presetRuleErrors(next);
    if (ruleErrors.length) {
      throwStockUnprocessable<StockErrorDetail, StockErrorResponse>('Stock track preset cannot be saved', ruleErrors);
    }
    await this.assertCodeFree(dto.companyId, next.code, existing?.sptId ?? null);

    const author = this.author();
    const now = new Date();
    const data = {
      sptCode: next.code,
      sptName: next.name,
      sptDescription: next.description,
      sptTrackBatch: next.trackBatch,
      sptTrackMrp: next.trackMrp,
      sptTrackSalePrice: next.trackSalePrice,
      sptTrackExpiry: next.trackExpiry,
      sptTrackSerial: next.trackSerial,
      sptTrackSupplier: next.trackSupplier,
      sptValuationMethod: next.valuationMethod,
      sptIssueStrategy: next.issueStrategy,
      sptAllowNegative: next.allowNegative,
      sptShelfLifeDays: next.shelfLifeDays,
      sptNearExpiryDays: next.nearExpiryDays,
      sptBlockExpiredSale: next.blockExpiredSale,
      sptAgeingBasis: next.ageingBasis,
      sptSortOrder: next.sortOrder,
      sptRemarks: next.remarks,
    };
    let saved: StockTrackPreset;
    try {
      saved = existing
        ? await this.prisma.stockTrackPreset.update({
            where: { sptId: existing.sptId },
            data: { ...data, sptModifiedOn: now, sptModifiedBy: author },
          })
        : await this.prisma.stockTrackPreset.create({
            data: { ...data, sptCompanyId: dto.companyId, sptCreatedOn: now, sptCreatedBy: author },
          });
    } catch (error) {
      // ux_spt_code, when a second save of the same code got in between.
      if (isUniqueConstraintError(error)) {
        this.throwCodeTaken(next.code);
      }
      throw error;
    }
    return this.toPayload(saved, true, usage);
  }

  /**
   * POST /stock-track-presets/deactivate (notes 159 §4). Refused while any
   * ACTIVE item or group uses the preset; an inactive or deleted one does not
   * hold it. `reactivate` turns it back on.
   */
  async deactivate(dto: DeactivateStockTrackPresetDto): Promise<StockTrackPresetsPayload> {
    const existing = await this.ownPreset(dto.companyId, dto.sptId, dto.reactivate ? 'reactivate' : 'deactivate');
    const usage = (await this.usageOf([existing.sptId])).get(existing.sptId) ?? NO_USAGE;
    if (!dto.reactivate && usage.activeItems + usage.activeGroups > 0) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Stock track preset is in use', [
        {
          field: 'sptId',
          code: StockErrorCode.PRESET_IN_USE,
          message: `${existing.sptCode} is used by ${usedByWords(usage.activeItems, usage.activeGroups, 'active ')}; move them to another preset, or deactivate them, first.`,
        },
      ]);
    }
    const saved = await this.prisma.stockTrackPreset.update({
      where: { sptId: existing.sptId },
      data: { sptIsActive: dto.reactivate === true, sptModifiedOn: new Date(), sptModifiedBy: this.author() },
    });
    return this.toPayload(saved, true, usage);
  }

  /** The company's own live preset, or the refusal: shared 409, missing / another company's 404. */
  private async ownPreset(companyId: string, sptId: string, verb: string): Promise<StockTrackPreset> {
    const record = await this.prisma.stockTrackPreset.findUnique({ where: { sptId } });
    if (!record || record.sptIsDeleted || (record.sptCompanyId !== null && record.sptCompanyId !== companyId)) {
      throwStockNotFound<StockErrorDetail, StockErrorResponse>(
        'Stock track preset not found',
        'sptId',
        `No stock track preset ${sptId} for this company.`,
        StockErrorCode.PRESET_NOT_FOUND,
      );
    }
    if (record.sptCompanyId === null) {
      throwStockConflict<StockErrorDetail, StockErrorResponse>('Shared presets are read-only', [
        {
          field: 'sptId',
          code: StockErrorCode.PRESET_SHARED_READ_ONLY,
          message:
            verb === 'save'
              ? `${record.sptCode} is shared with every company. To change it for this company, create the company's own preset with the same code; it then replaces the shared one.`
              : `${record.sptCode} is shared with every company and cannot be ${verb}d here.`,
        },
      ]);
    }
    return record;
  }

  /** The dto over the stored row (update) or the column defaults (create). */
  private nextValues(dto: SaveStockTrackPresetDto, existing: StockTrackPreset | null): PresetValues {
    const flags = {
      trackBatch: dto.trackBatch ?? existing?.sptTrackBatch ?? false,
      trackMrp: dto.trackMrp ?? existing?.sptTrackMrp ?? false,
      trackSalePrice: dto.trackSalePrice ?? existing?.sptTrackSalePrice ?? false,
      trackExpiry: dto.trackExpiry ?? existing?.sptTrackExpiry ?? false,
      trackSerial: dto.trackSerial ?? existing?.sptTrackSerial ?? false,
      trackSupplier: dto.trackSupplier ?? existing?.sptTrackSupplier ?? false,
    };
    return {
      code: dto.code ?? existing?.sptCode ?? '',
      name: dto.name ?? existing?.sptName ?? '',
      description: dto.description !== undefined ? dto.description : existing?.sptDescription ?? null,
      ...flags,
      // Left out = what the flags demand, so a screen need not send it.
      valuationMethod: dto.valuationMethod ?? valuationFor(flags),
      issueStrategy:
        dto.issueStrategy ??
        existing?.sptIssueStrategy ??
        (flags.trackBatch && !flags.trackExpiry ? 'FIFO' : 'FEFO'),
      allowNegative: dto.allowNegative ?? existing?.sptAllowNegative ?? 'ALLOW',
      shelfLifeDays: dto.shelfLifeDays !== undefined ? dto.shelfLifeDays : existing?.sptShelfLifeDays ?? null,
      nearExpiryDays: dto.nearExpiryDays ?? existing?.sptNearExpiryDays ?? 30,
      blockExpiredSale: dto.blockExpiredSale ?? existing?.sptBlockExpiredSale ?? false,
      ageingBasis: dto.ageingBasis ?? existing?.sptAgeingBasis ?? 'INWARD_DATE',
      sortOrder: dto.sortOrder ?? existing?.sptSortOrder ?? 0,
      remarks: dto.remarks !== undefined ? dto.remarks : existing?.sptRemarks ?? null,
    };
  }

  /** Items and groups naming each preset: deleted rows never count, inactive ones count toward the lock only. */
  private async usageOf(sptIds: string[]): Promise<Map<string, PresetUsage>> {
    const usage = new Map<string, PresetUsage>();
    if (!sptIds.length) {
      return usage;
    }
    const rows = await this.prisma.$queryRaw<
      Array<{ spt_id: string; items: number; groups: number; active_items: number; active_groups: number }>
    >`
      SELECT p.spt_id,
             (SELECT count(*) FROM inventory.item_master i
               WHERE i.item_track_preset_id = p.spt_id AND NOT i.item_is_deleted)::int                       AS items,
             (SELECT count(*) FROM inventory.item_group_master g
               WHERE g.itg_track_preset_id = p.spt_id AND NOT g.itg_is_deleted)::int                         AS groups,
             (SELECT count(*) FROM inventory.item_master i
               WHERE i.item_track_preset_id = p.spt_id AND NOT i.item_is_deleted AND i.item_is_active)::int  AS active_items,
             (SELECT count(*) FROM inventory.item_group_master g
               WHERE g.itg_track_preset_id = p.spt_id AND NOT g.itg_is_deleted AND g.itg_is_active)::int     AS active_groups
        FROM unnest(${sptIds}::uuid[]) AS p(spt_id)
    `;
    for (const r of rows) {
      usage.set(r.spt_id, {
        items: r.items,
        groups: r.groups,
        activeItems: r.active_items,
        activeGroups: r.active_groups,
      });
    }
    return usage;
  }

  private async assertCodeFree(companyId: string, code: string, exceptId: string | null): Promise<void> {
    const clash = await this.prisma.stockTrackPreset.findFirst({
      where: {
        sptCompanyId: companyId,
        sptCode: code,
        sptIsDeleted: false,
        ...(exceptId ? { NOT: { sptId: exceptId } } : {}),
      },
      select: { sptId: true },
    });
    if (clash) {
      this.throwCodeTaken(code);
    }
  }

  private throwCodeTaken(code: string): never {
    throwStockConflict<StockErrorDetail, StockErrorResponse>('Code already in use', [
      { field: 'code', code: StockErrorCode.PRESET_CODE_TAKEN, message: `This company already has a preset coded ${code}.` },
    ]);
  }

  private author(): string | null {
    const actor = resolveActor(null, this.requestContextService.getUserId());
    return actor === DEFAULT_ACTOR ? null : actor;
  }
}
