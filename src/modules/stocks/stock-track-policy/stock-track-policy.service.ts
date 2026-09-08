import { Injectable } from '@nestjs/common';
import { Prisma, StockTrackPolicy, StockTrackPreset } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DerivedTrackPolicy,
  ItemGroupTrackPolicySource,
  ItemTrackPolicySource,
  StockTrackPolicySyncResult,
} from './types/stock-track-policy.types';
const STP_TABLE_NAME = 'stock track policy';
const STP_AUDIT_SCREEN_NAME = 'Stock Track Policy';
/**
 * Written into stp_remarks on every row this service creates, and the ONLY
 * thing that distinguishes a derived row from one an admin authored by hand.
 * Rows without one of these markers are never written to — see syncFromItem.
 *
 * A row derived from a PRESET carries the marker plus the code it resolved,
 * `Auto-derived from item master [preset PHARMA]`, so that later drift — an
 * admin edits PHARMA, somebody re-saves the item, the policy silently moves —
 * is visible on the row itself rather than only in the audit trail. That is
 * why the derived test is a PREFIX match and not an equality one; rows written
 * before presets existed carry the bare marker and still read as derived.
 */
export const DERIVED_FROM_ITEM_REMARK = 'Auto-derived from item master';
export const DERIVED_FROM_GROUP_REMARK = 'Auto-derived from item group master';
@Injectable()
export class StockTrackPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  /**
   * Creates or refreshes the ITEM-scope stock.stock_track_policy row for an
   * item. Call it from item create AND item update, inside the caller's
   * transaction, so the item and its policy are saved or rolled back together.
   *
   * WHERE THE VALUES COME FROM. item_track_preset_code wins outright: a preset
   * was chosen deliberately and supplies all thirteen columns, including the
   * three (sale price, serial, supplier) and the two (valuation, ageing basis)
   * that no item_master column can express. Only when there is no preset — or
   * the code names nothing this company can see — do the item's own
   * batch/expiry flags derive the policy, exactly as they always did.
   *
   * WHAT IT WILL NOT DO — an admin's policy always wins. If a row already
   * holds this item's (company, branch, ITEM) slot and does NOT carry
   * DERIVED_FROM_ITEM_REMARK, it was authored by hand and is left exactly as
   * it is ('skipped_manual'). Item-master flags are a starting point, not a
   * standing override: a shop that has deliberately set LOT_ACTUAL valuation
   * and MANUAL issue for one item must not have that undone by someone
   * renaming the item.
   *
   * MOVING AN ITEM between companies or branches retargets the derived row
   * rather than leaving a second one behind, so an item never ends up with two
   * competing derived policies.
   *
   * @param tx Required in practice — pass the caller's transaction client so
   *           the policy write shares the item's transaction. Omitted, the
   *           write runs on its own connection and can survive a rolled-back
   *           item save.
   */
  async syncFromItem(
    item: ItemTrackPolicySource,
    tx?: Prisma.TransactionClient,
  ): Promise<StockTrackPolicySyncResult> {
    const client: Prisma.TransactionClient = tx ?? this.prisma;
    const preset = await this.resolvePreset(item.itemTrackPresetId, client);
    const derived = preset ? this.presetToDerived(preset) : this.deriveFromItem(item);
    // No preset means the row was derived from the item's own flags, and the
    // remark says so — it is the only place that provenance is recorded.
    const remarks = this.derivedRemark(DERIVED_FROM_ITEM_REMARK, preset?.sptCode ?? null);
    // The slot the database itself considers "the same policy": ex_stp_overlap
    // keys on (company, branch, scope, scope_id, date range).
    const atSlot = await client.stockTrackPolicy.findFirst({
      where: {
        stpScope: 'ITEM',
        stpItemId: item.itemId,
        stpCompanyId: item.itemCompanyId,
        stpBranchId: item.itemBranchId,
        stpIsDeleted: false,
      },
      orderBy: { stpCreatedOn: 'asc' },
    });
    if (atSlot && !this.isDerivedRemark(atSlot.stpRemarks, DERIVED_FROM_ITEM_REMARK)) {
      return this.result(atSlot, item.itemId, 'ITEM', 'skipped_manual');
    }
    // Nothing in this slot: the item may still own a derived row filed under
    // the company/branch it had BEFORE this save. Move that one instead of
    // creating a second.
    const existing =
      atSlot ??
      (await client.stockTrackPolicy.findFirst({
        where: {
          stpScope: 'ITEM',
          stpItemId: item.itemId,
          stpRemarks: { startsWith: DERIVED_FROM_ITEM_REMARK },
          stpIsDeleted: false,
        },
        orderBy: { stpCreatedOn: 'asc' },
      }));
    return existing
      ? this.updateDerived(existing, item.itemId, 'ITEM', derived, remarks, client, {
          companyId: item.itemCompanyId,
          branchId: item.itemBranchId,
        })
      : this.createDerived(item.itemId, 'ITEM', derived, remarks, client, {
          companyId: item.itemCompanyId,
          branchId: item.itemBranchId,
        });
  }
  /**
   * Creates, refreshes or retires the GROUP-scope policy row for an item group.
   * Call it from group create AND group update, inside the caller's
   * transaction, exactly like syncFromItem.
   *
   * THE PRESET IS THE ONLY INPUT. item_group_master has no tracking flags of
   * its own, so there is nothing to fall back to — and a defaulted all-false
   * GROUP row would be worse than no row at all: the resolver's chain runs
   * branch+ITEM -> branch+GROUP -> branch+COMPANY -> company+ITEM ->
   * company+GROUP -> company+COMPANY, so an empty GROUP row would SHADOW the
   * company-wide policy for every item in the group and quietly untrack them.
   * No preset therefore means no write ('no_preset'), and REMOVING a preset
   * retires the row it wrote ('cleared') rather than leaving it standing.
   *
   * SCOPE. item_group_master is not company-owned, but a policy must be: two
   * companies sharing a group can legitimately track it differently. The row
   * is filed under the request context's company and left open to every branch
   * (stp_branch_id NULL), which is the level the resolver expects a group rule
   * to sit at.
   */
  async syncFromItemGroup(
    group: ItemGroupTrackPolicySource,
    tx?: Prisma.TransactionClient,
  ): Promise<StockTrackPolicySyncResult> {
    const client: Prisma.TransactionClient = tx ?? this.prisma;
    const companyId = this.requestContextService.getCompanyId();
    const preset = await this.resolvePreset(group.itgTrackPresetId, client);
    const atSlot = await client.stockTrackPolicy.findFirst({
      where: {
        stpScope: 'GROUP',
        stpGroupId: group.itgId,
        stpCompanyId: companyId,
        stpBranchId: null,
        stpIsDeleted: false,
      },
      orderBy: { stpCreatedOn: 'asc' },
    });
    if (atSlot && !this.isDerivedRemark(atSlot.stpRemarks, DERIVED_FROM_GROUP_REMARK)) {
      return this.result(atSlot, group.itgId, 'GROUP', 'skipped_manual');
    }
    if (!preset) {
      return atSlot
        ? this.retireDerived(atSlot, group.itgId, client)
        : {
            stp_id: null,
            scope_id: group.itgId,
            scope: 'GROUP',
            outcome: 'no_preset',
            track_signature: null,
            preset_code: null,
          };
    }
    const derived = this.presetToDerived(preset);
    const remarks = this.derivedRemark(DERIVED_FROM_GROUP_REMARK, preset.sptCode);
    return atSlot
      ? this.updateDerived(atSlot, group.itgId, 'GROUP', derived, remarks, client, {
          companyId,
          branchId: null,
        })
      : this.createDerived(group.itgId, 'GROUP', derived, remarks, client, {
          companyId,
          branchId: null,
        });
  }
  /**
   * The preset an id names, or null.
   *
   * A plain primary-key read: spt_id identifies exactly one row, and the
   * company MERGE that makes spt_code ambiguous was already resolved by
   * whoever picked the preset. fk_item_track_preset / fk_itg_track_preset
   * guarantee the row exists, so null here means only that the column is unset.
   *
   * Deliberately NOT filtered on sptIsActive / sptIsDeleted. Retiring a preset
   * stops it being OFFERED; it must not change what an item already configured
   * with it resolves to. Filtering here would mean that deactivating PHARMA and
   * then re-saving a pharma item silently fell back to the item's flags and
   * untracked its stock — the exact accident the fallback exists to avoid.
   */
  async resolvePreset(
    presetId: string | null | undefined,
    tx?: Prisma.TransactionClient,
  ): Promise<StockTrackPreset | null> {
    if (!presetId) {
      return null;
    }
    const client: Prisma.TransactionClient = tx ?? this.prisma;
    return client.stockTrackPreset.findUnique({ where: { sptId: presetId } });
  }
  /**
   * A preset's thirteen columns, verbatim. Nothing is recomputed or second
   * guessed: the preset table carries the SAME CHECK constraints as the policy
   * table (ck_spt_expiry_needs_batch, ck_spt_fefo_needs_expiry), precisely so
   * that anything storable as a preset is storable as a policy.
   */
  presetToDerived(preset: StockTrackPreset): DerivedTrackPolicy {
    return {
      trackBatch: preset.sptTrackBatch,
      trackMrp: preset.sptTrackMrp,
      trackSalePrice: preset.sptTrackSalePrice,
      trackExpiry: preset.sptTrackExpiry,
      trackSerial: preset.sptTrackSerial,
      trackSupplier: preset.sptTrackSupplier,
      valuationMethod: preset.sptValuationMethod,
      issueStrategy: preset.sptIssueStrategy,
      allowNegative: preset.sptAllowNegative,
      shelfLifeDays: preset.sptShelfLifeDays,
      nearExpiryDays: preset.sptNearExpiryDays,
      blockExpiredSale: preset.sptBlockExpiredSale,
      ageingBasis: preset.sptAgeingBasis,
    };
  }
  /**
   * item_master's flags, read as the six independent identity dimensions the
   * policy table actually has. Used only when the item names no preset. The
   * batch/mrp reading is the one already used for tracking_type in
   * ItemsMasterService.bulkLoad, kept identical so the billing lookup and the
   * policy cannot disagree:
   *
   *     item_batch_config 1  → MRP-wise
   *     item_batch_config 2, item_is_batch_based, item_is_expiry_item → batch-wise
   *
   * The difference is that a policy row is not limited to ONE of them, so an
   * MRP item that also carries an expiry date comes out tracking batch, mrp
   * AND expiry ('BME') instead of having to pick.
   *
   * Sale price, serial and supplier stay false: no item_master column expresses
   * them, and inventing one from a related flag would be a guess. To set them,
   * pick a preset that carries them (SP_ONLY, SERIAL, PHARMA) or hand-author
   * the policy row.
   */
  deriveFromItem(item: ItemTrackPolicySource): DerivedTrackPolicy {
    const trackMrp = item.itemBatchConfig === 1;
    const trackExpiry = item.itemIsExpiryItem;
    // ck_stp_expiry_needs_batch: two deliveries with different expiry dates and
    // no batch number are indistinguishable on the shelf, so expiry forces batch.
    const trackBatch =
      item.itemBatchConfig === 2 || item.itemIsBatchBased || item.itemIsExpiryItem;
    return {
      trackBatch,
      trackMrp,
      trackSalePrice: false,
      trackExpiry,
      trackSerial: false,
      trackSupplier: false,
      // No item_master column selects a valuation basis; WAVG is the table
      // default and switching it later needs no recomputation.
      valuationMethod: 'WAVG',
      // ck_stp_fefo_needs_expiry allows FEFO on an untracked item, but there is
      // nothing to order by — say FIFO and mean it.
      issueStrategy: trackExpiry ? 'FEFO' : 'FIFO',
      allowNegative: item.itemAllowNegStock ? 'ALLOW' : 'BLOCK',
      // ck_stp_shelf_life: NULL or strictly positive.
      shelfLifeDays: this.positiveOrNull(item.itemExpiryDays),
      // ck_stp_near_expiry: >= 0. Anything absent or nonsensical takes the
      // table's own default rather than failing an item save.
      nearExpiryDays: this.nonNegativeOr(item.itemIntimateBeforeDays, 30),
      blockExpiredSale: false,
      ageingBasis: 'INWARD_DATE',
    };
  }
  /** The policy in force for an item at its own company/branch, if any. */
  async findByItemId(
    itemId: string,
    tx?: Prisma.TransactionClient,
  ): Promise<StockTrackPolicy | null> {
    const client: Prisma.TransactionClient = tx ?? this.prisma;
    return client.stockTrackPolicy.findFirst({
      where: {
        stpScope: 'ITEM',
        stpItemId: itemId,
        stpIsDeleted: false,
      },
      orderBy: { stpCreatedOn: 'asc' },
    });
  }
  /**
   * The GROUP-scope policy for a group in a company. companyId is explicit
   * rather than read from the request context because a background caller
   * (a report, a reconciliation job) has no context to read.
   */
  async findByGroupId(
    itgId: string,
    companyId: string | null,
    tx?: Prisma.TransactionClient,
  ): Promise<StockTrackPolicy | null> {
    const client: Prisma.TransactionClient = tx ?? this.prisma;
    return client.stockTrackPolicy.findFirst({
      where: {
        stpScope: 'GROUP',
        stpGroupId: itgId,
        stpCompanyId: companyId,
        stpIsDeleted: false,
      },
      orderBy: { stpCreatedOn: 'asc' },
    });
  }
  private async createDerived(
    scopeId: string,
    scope: 'ITEM' | 'GROUP',
    derived: DerivedTrackPolicy,
    remarks: string,
    client: Prisma.TransactionClient,
    slot: { companyId: string | null; branchId: string | null },
  ): Promise<StockTrackPolicySyncResult> {
    const actor = this.actor();
    const created = await client.stockTrackPolicy.create({
      data: {
        stpCompanyId: slot.companyId,
        stpBranchId: slot.branchId,
        stpScope: scope,
        // stpItemId / stpGroupId are GENERATED ALWAYS from this pair — never
        // write either of them.
        stpScopeId: scopeId,
        ...this.toColumns(derived),
        stpRemarks: remarks,
        stpCreatedBy: actor,
        // stp_effective_from/_to are left to their defaults (1900-01-01 ..
        // 9999-12-31): a derived policy has always been in force, so a receipt
        // back-dated before the item was created still keys its stock the way
        // the business expects.
      },
    });
    await this.logChange(client, created.stpId, scopeId, scope, null, created, actor, 'New');
    return this.result(created, scopeId, scope, 'created');
  }
  private async updateDerived(
    existing: StockTrackPolicy,
    scopeId: string,
    scope: 'ITEM' | 'GROUP',
    derived: DerivedTrackPolicy,
    remarks: string,
    client: Prisma.TransactionClient,
    slot: { companyId: string | null; branchId: string | null },
  ): Promise<StockTrackPolicySyncResult> {
    const moved = existing.stpCompanyId !== slot.companyId || existing.stpBranchId !== slot.branchId;
    // Remarks are compared too, not only the thirteen values: swapping BATCH
    // for a company preset that happens to carry identical flags still changes
    // where the row came from, and the row is the only place that is recorded.
    const rewritten = existing.stpRemarks !== remarks;
    if (!moved && !rewritten && !this.hasChanged(existing, derived)) {
      // Master saves are frequent and most of them touch nothing this row cares
      // about. Skip the write and the audit row it would drag with it.
      return this.result(existing, scopeId, scope, 'unchanged');
    }
    const actor = this.actor();
    const updated = await client.stockTrackPolicy.update({
      where: { stpId: existing.stpId },
      data: {
        stpCompanyId: slot.companyId,
        stpBranchId: slot.branchId,
        ...this.toColumns(derived),
        stpRemarks: remarks,
        // A row retired by an earlier 'cleared' and then given a preset again
        // is revived rather than duplicated; ex_stp_overlap only counts active,
        // undeleted rows, so the slot was genuinely free while it was retired.
        stpIsActive: true,
        stpIsDeleted: false,
        stpModifiedOn: new Date(),
        stpModifiedBy: actor,
      },
    });
    await this.logChange(
      client,
      existing.stpId,
      scopeId,
      scope,
      existing,
      updated,
      actor,
      'update',
    );
    return this.result(updated, scopeId, scope, 'updated');
  }
  /**
   * Retires a derived GROUP row whose preset has been removed. Soft-deleted
   * rather than hard-deleted so the audit trail keeps pointing somewhere, and
   * deactivated as well because ex_stp_overlap and ix_stp_resolve are both
   * partial on `is_active AND NOT is_deleted` — a retired row occupies no slot
   * and is invisible to the resolver.
   */
  private async retireDerived(
    existing: StockTrackPolicy,
    scopeId: string,
    client: Prisma.TransactionClient,
  ): Promise<StockTrackPolicySyncResult> {
    const actor = this.actor();
    const retired = await client.stockTrackPolicy.update({
      where: { stpId: existing.stpId },
      data: {
        stpIsActive: false,
        stpIsDeleted: true,
        stpModifiedOn: new Date(),
        stpModifiedBy: actor,
      },
    });
    await this.logChange(
      client,
      existing.stpId,
      scopeId,
      'GROUP',
      existing,
      retired,
      actor,
      'update',
    );
    return this.result(retired, scopeId, 'GROUP', 'cleared');
  }
  /**
   * `Auto-derived from item master` on its own, or with the preset that
   * produced it appended. The bare form is what rows written before presets
   * existed carry, and isDerivedRemark accepts both.
   */
  private derivedRemark(marker: string, presetCode: string | null): string {
    return presetCode ? `${marker} [preset ${presetCode}]` : marker;
  }
  private isDerivedRemark(remarks: string | null, marker: string): boolean {
    return remarks === marker || (remarks?.startsWith(`${marker} [`) ?? false);
  }
  /** The preset code recorded in a remark, or null when there is none. */
  private presetCodeFromRemark(remarks: string | null): string | null {
    return /\[preset ([A-Za-z0-9_-]+)\]$/.exec(remarks ?? '')?.[1] ?? null;
  }
  private result(
    record: StockTrackPolicy,
    scopeId: string,
    scope: 'ITEM' | 'GROUP',
    outcome: StockTrackPolicySyncResult['outcome'],
  ): StockTrackPolicySyncResult {
    return {
      stp_id: record.stpId,
      scope_id: scopeId,
      scope,
      outcome,
      track_signature: record.stpTrackSignature,
      preset_code: this.presetCodeFromRemark(record.stpRemarks),
    };
  }
  private toColumns(derived: DerivedTrackPolicy) {
    return {
      stpTrackBatch: derived.trackBatch,
      stpTrackMrp: derived.trackMrp,
      stpTrackSalePrice: derived.trackSalePrice,
      stpTrackExpiry: derived.trackExpiry,
      stpTrackSerial: derived.trackSerial,
      stpTrackSupplier: derived.trackSupplier,
      stpValuationMethod: derived.valuationMethod,
      stpIssueStrategy: derived.issueStrategy,
      stpAllowNegative: derived.allowNegative,
      stpShelfLifeDays: derived.shelfLifeDays,
      stpNearExpiryDays: derived.nearExpiryDays,
      stpBlockExpiredSale: derived.blockExpiredSale,
      stpAgeingBasis: derived.ageingBasis,
    };
  }
  private hasChanged(existing: StockTrackPolicy, derived: DerivedTrackPolicy): boolean {
    const next = this.toColumns(derived);
    return (Object.keys(next) as (keyof typeof next)[]).some(
      (column) => existing[column] !== next[column],
    );
  }
  /**
   * No user in context means no user recorded. The nil-uuid DEFAULT_ACTOR the
   * sales modules fall back to is a sentinel, not an actor, and stp_created_by
   * has nothing to say about who acted when nobody did — a NULL reads that way
   * and the sentinel does not.
   *
   * stp_created_by used to be a uuid carrying fk_stp_created_by into
   * public.user_master, which made the fallback unwritable anyway. Both are
   * gone as of 20260907080000 and the column is plain TEXT, so this is now a
   * choice rather than a constraint.
   */
  private actor(): string | null {
    return this.requestContextService.getUserId() ?? null;
  }
  private positiveOrNull(value: number | null | undefined): number | null {
    return typeof value === 'number' && Number.isFinite(value) && value > 0 ? Math.trunc(value) : null;
  }
  private nonNegativeOr(value: number | null | undefined, fallback: number): number {
    return typeof value === 'number' && Number.isFinite(value) && value >= 0
      ? Math.trunc(value)
      : fallback;
  }
  private async logChange(
    client: Prisma.TransactionClient,
    stpId: string,
    scopeId: string,
    scope: 'ITEM' | 'GROUP',
    originalRecord: StockTrackPolicy | null,
    modifiedRecord: StockTrackPolicy,
    actor: string | null,
    action: 'New' | 'update',
  ): Promise<void> {
    const source = scope === 'ITEM' ? 'item master' : 'item group master';
    await this.auditLogService.logEntityChange(
      {
        action,
        tableName: STP_TABLE_NAME,
        screenName: STP_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: stpId,
        displayName: modifiedRecord.stpTrackSignature ?? scopeId,
        originalRecord: originalRecord ? this.toAuditRecord(originalRecord) : null,
        modifiedRecord: this.toAuditRecord(modifiedRecord),
        userId: actor ?? undefined,
        notes:
          action === 'New'
            ? `Track policy derived from ${source}`
            : modifiedRecord.stpIsDeleted
              ? `Track policy retired — preset removed on ${source}`
              : `Track policy refreshed from ${source}`,
      },
      client,
    );
  }
  private toAuditRecord(record: StockTrackPolicy): Record<string, unknown> {
    return {
      stp_id: record.stpId,
      stp_company_id: record.stpCompanyId,
      stp_branch_id: record.stpBranchId,
      stp_scope: record.stpScope,
      stp_scope_id: record.stpScopeId,
      stp_item_id: record.stpItemId,
      stp_group_id: record.stpGroupId,
      stp_track_batch: record.stpTrackBatch,
      stp_track_mrp: record.stpTrackMrp,
      stp_track_sale_price: record.stpTrackSalePrice,
      stp_track_expiry: record.stpTrackExpiry,
      stp_track_serial: record.stpTrackSerial,
      stp_track_supplier: record.stpTrackSupplier,
      stp_track_signature: record.stpTrackSignature,
      stp_valuation_method: record.stpValuationMethod,
      stp_issue_strategy: record.stpIssueStrategy,
      stp_allow_negative: record.stpAllowNegative,
      stp_shelf_life_days: record.stpShelfLifeDays,
      stp_near_expiry_days: record.stpNearExpiryDays,
      stp_block_expired_sale: record.stpBlockExpiredSale,
      stp_ageing_basis: record.stpAgeingBasis,
      stp_effective_from: record.stpEffectiveFrom,
      stp_effective_to: record.stpEffectiveTo,
      stp_remarks: record.stpRemarks,
      stp_is_active: record.stpIsActive,
      stp_is_deleted: record.stpIsDeleted,
    };
  }
}
