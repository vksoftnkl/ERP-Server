import { Injectable } from '@nestjs/common';
import { Prisma, StockTrackPolicy } from '@prisma/client';
import { PrismaService } from 'src/database/prisma/prisma.service';
import { AuditLogService } from 'src/modules/audit-log/audit-log.service';
import { RequestContextService } from 'src/common/request-context/request-context.service';
import {
  DerivedTrackPolicy,
  ItemTrackPolicySource,
  StockTrackPolicySyncResult,
} from './types/stock-track-policy.types';
const STP_TABLE_NAME = 'stock track policy';
const STP_AUDIT_SCREEN_NAME = 'Stock Track Policy';
/**
 * Written into stp_remarks on every row this service creates, and the ONLY
 * thing that distinguishes a derived row from one an admin authored by hand.
 * Rows without this marker are never written to — see syncFromItem.
 */
export const DERIVED_FROM_ITEM_REMARK = 'Auto-derived from item master';
@Injectable()
export class StockTrackPolicyService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}
  /**
   * Creates or refreshes the ITEM-scope stock.stock_track_policy row for an
   * item, derived entirely from item_master. Call it from item create AND item
   * update, inside the caller's transaction, so the item and its policy are
   * saved or rolled back together.
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
    const derived = this.deriveFromItem(item);
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
    if (atSlot && atSlot.stpRemarks !== DERIVED_FROM_ITEM_REMARK) {
      return {
        stp_id: atSlot.stpId,
        item_id: item.itemId,
        outcome: 'skipped_manual',
        track_signature: atSlot.stpTrackSignature,
      };
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
          stpRemarks: DERIVED_FROM_ITEM_REMARK,
          stpIsDeleted: false,
        },
        orderBy: { stpCreatedOn: 'asc' },
      }));
    return existing
      ? this.updateDerived(existing, item, derived, client)
      : this.createDerived(item, derived, client);
  }
  /**
   * item_master's flags, read as the six independent identity dimensions the
   * policy table actually has. The batch/mrp reading is the one already used
   * for tracking_type in ItemsMasterService.bulkLoad, kept identical so the
   * billing lookup and the policy cannot disagree:
   *
   *     item_batch_config 1  → MRP-wise
   *     item_batch_config 2, item_is_batch_based, item_is_expiry_item → batch-wise
   *
   * The difference is that a policy row is not limited to ONE of them, so an
   * MRP item that also carries an expiry date comes out tracking batch, mrp
   * AND expiry ('BME') instead of having to pick.
   *
   * Sale price, serial and supplier stay false: no item_master column expresses
   * them, and inventing one from a related flag would be a guess. They are
   * admin-only, set on a hand-authored policy row.
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
  private async createDerived(
    item: ItemTrackPolicySource,
    derived: DerivedTrackPolicy,
    client: Prisma.TransactionClient,
  ): Promise<StockTrackPolicySyncResult> {
    const actor = this.actor();
    const created = await client.stockTrackPolicy.create({
      data: {
        stpCompanyId: item.itemCompanyId,
        stpBranchId: item.itemBranchId,
        stpScope: 'ITEM',
        // stpItemId is GENERATED ALWAYS from this pair — never write it.
        stpScopeId: item.itemId,
        ...this.toColumns(derived),
        stpRemarks: DERIVED_FROM_ITEM_REMARK,
        stpCreatedBy: actor,
        // stp_effective_from/_to are left to their defaults (1900-01-01 ..
        // 9999-12-31): a derived policy has always been in force, so a receipt
        // back-dated before the item was created still keys its stock the way
        // the business expects.
      },
    });
    await this.logChange(client, created.stpId, item.itemId, null, created, actor, 'New');
    return {
      stp_id: created.stpId,
      item_id: item.itemId,
      outcome: 'created',
      track_signature: created.stpTrackSignature,
    };
  }
  private async updateDerived(
    existing: StockTrackPolicy,
    item: ItemTrackPolicySource,
    derived: DerivedTrackPolicy,
    client: Prisma.TransactionClient,
  ): Promise<StockTrackPolicySyncResult> {
    const moved =
      existing.stpCompanyId !== item.itemCompanyId || existing.stpBranchId !== item.itemBranchId;
    if (!moved && !this.hasChanged(existing, derived)) {
      // Item saves are frequent and most of them touch nothing this row cares
      // about. Skip the write and the audit row it would drag with it.
      return {
        stp_id: existing.stpId,
        item_id: item.itemId,
        outcome: 'unchanged',
        track_signature: existing.stpTrackSignature,
      };
    }
    const actor = this.actor();
    const updated = await client.stockTrackPolicy.update({
      where: { stpId: existing.stpId },
      data: {
        stpCompanyId: item.itemCompanyId,
        stpBranchId: item.itemBranchId,
        ...this.toColumns(derived),
        stpModifiedOn: new Date(),
        stpModifiedBy: actor,
      },
    });
    await this.logChange(client, existing.stpId, item.itemId, existing, updated, actor, 'update');
    return {
      stp_id: updated.stpId,
      item_id: item.itemId,
      outcome: 'updated',
      track_signature: updated.stpTrackSignature,
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
   * fk_stp_created_by points at public.user_master, so the nil-uuid
   * DEFAULT_ACTOR the string-typed *_created_by columns fall back to would
   * violate the foreign key. No user in context means no user recorded.
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
    itemId: string,
    originalRecord: StockTrackPolicy | null,
    modifiedRecord: StockTrackPolicy,
    actor: string | null,
    action: 'New' | 'update',
  ): Promise<void> {
    await this.auditLogService.logEntityChange(
      {
        action,
        tableName: STP_TABLE_NAME,
        screenName: STP_AUDIT_SCREEN_NAME,
        screenType: 'master',
        pk: stpId,
        displayName: modifiedRecord.stpTrackSignature ?? itemId,
        originalRecord: originalRecord ? this.toAuditRecord(originalRecord) : null,
        modifiedRecord: this.toAuditRecord(modifiedRecord),
        userId: actor ?? undefined,
        notes:
          action === 'New'
            ? 'Track policy derived from item master'
            : 'Track policy refreshed from item master',
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