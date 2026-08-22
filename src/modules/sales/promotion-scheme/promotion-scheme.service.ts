import { Injectable } from '@nestjs/common';
import {
  Prisma,
  PromotionScheme,
  PromotionSchemeBranch,
  PromotionSchemeItem,
  PromotionSchemeParty,
  PromotionSchemeSlab,
} from '@prisma/client';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import { PromotionSchemeBranchRowDto } from './dto/save-promotion-scheme-branch.dto';
import { PromotionSchemeItemRowDto } from './dto/save-promotion-scheme-item.dto';
import { PromotionSchemePartyRowDto } from './dto/save-promotion-scheme-party.dto';
import { PromotionSchemeSlabRowDto } from './dto/save-promotion-scheme-slab.dto';
import { SavePromotionSchemeDto } from './dto/save-promotion-scheme.dto';
import {
  PromotionSchemeDeleteResult,
  PromotionSchemeEligibilityPayload,
  PromotionSchemeErrorDetail,
  PromotionSchemeErrorResponse,
  PromotionSchemePayload,
} from './types/promotion-scheme-api.types';
import {
  EffectiveItemRow,
  EffectivePartyRow,
  EffectiveScheme,
  EffectiveSlabRow,
  collectItemInvariantErrors,
  collectPartyInvariantErrors,
  collectSchemeInvariantErrors,
  collectSlabInvariantErrors,
} from './utils/promotion-scheme-invariants';
import {
  BRANCH_LOOKUP,
  BranchRow,
  ITEM_LOOKUP,
  ItemRow,
  PARTY_LOOKUP,
  PRI_DEFAULT_MATCH_PRIORITY,
  PartyRow,
  SLAB_LOOKUP,
  SlabRow,
  PRP_DEFAULT_MATCH_PRIORITY,
  SchemeWithChildren,
  handlePromotionWriteError,
  normalizeNullableString,
  parseDateOnly,
  parseTimeToUtcDate,
  normalizeEnum,
  requireInteger,
  requireString,
  requireUuid,
  resolveActor,
  resolveActorUuid,
  toBranchPayload,
  toItemPayload,
  toPartyPayload,
  toSchemePayload,
  toSlabPayload,
} from './utils/promotion-scheme.utils';
import {
  DEFAULT_AUDIT_ACTOR,
  SalesWriteClient,
  hasOwnProperty,
  toNumber,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
} from 'src/common/utils/module-service.utils';

const SCREEN_NAME = 'Promotion Scheme';
const SCHEME_TABLE_NAME = 'promotion scheme';
const BRANCH_TABLE_NAME = 'promotion scheme branch';
const PARTY_TABLE_NAME = 'promotion scheme party';
const ITEM_TABLE_NAME = 'promotion scheme item';
const SLAB_TABLE_NAME = 'promotion scheme slab';

type WriteClient = SalesWriteClient;

@Injectable()
export class PromotionSchemeService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ─── §1 the header ──────────────────────────────────────────────────────────

  async saveScheme(dto: SavePromotionSchemeDto): Promise<PromotionSchemePayload> {
    return dto.prm_id ? this.updateScheme(dto) : this.createScheme(dto);
  }

  async getSchemeById(prmId: string): Promise<PromotionSchemePayload> {
    const scheme = await this.findSchemeWithChildren(this.prisma, prmId);
    if (!scheme) {
      this.throwNotFound('prm_id', prmId, 'Promotion scheme not found');
    }
    return toSchemePayload(scheme);
  }

  /**
   * The other direction: not "who does this scheme cover" but "does THIS
   * customer qualify". The question the till asks, one scheme at a time.
   *
   * A customer can be hit by four rows at once — by name, by their group, by
   * their area and by their city. The winner is the highest prp_match_priority
   * (CUSTOMER 4, AREA 3, CITY 2, CUSTOMER_GROUP 1 — an AREA rule beats a CITY
   * one because a city contains many areas, so the area is the more specific
   * statement about the same customer), and at equal priority an EXCLUDE beats
   * an INCLUDE. No row touching them means NOT eligible, because the scheme
   * said prm_cust_scope = 'LIST'.
   */
  async checkEligibility(prmId: string, cusId: string): Promise<PromotionSchemeEligibilityPayload> {
    const scheme = await this.requireScheme(this.prisma, prmId);

    if (scheme.prmCustScope !== 'LIST') {
      return {
        prm_id: prmId,
        cus_id: cusId,
        qualifies: true,
        decided_by: 'ALL',
        matched_by: null,
        matched_row_id: null,
        match_priority: null,
        is_exclude: null,
        reason: `YES — prm_cust_scope is ${scheme.prmCustScope}, the scheme covers every customer`,
      };
    }

    // customers carry no city key, so the CITY path is the one that is not
    // symmetrical with the others: it reaches the city through the area.
    const customer = await this.prisma.customer.findFirst({
      where: { cusId, cusIsDeleted: false },
      select: {
        cusId: true,
        cusGroupId: true,
        cusAreaId: true,
        area: { select: { armCityId: true } },
      },
    });
    if (!customer) {
      this.throwNotFound('cus_id', cusId, 'Customer not found');
    }

    // Every branch of the OR must be a non-null id. `{ prpAreaId: null }` would
    // not mean "this customer has no area", it would match every row that is
    // not an area rule.
    const scopeMatches: Prisma.PromotionSchemePartyWhereInput[] = [{ prpCustId: customer.cusId }];
    if (customer.cusGroupId) {
      scopeMatches.push({ prpCustGroupId: customer.cusGroupId });
    }
    if (customer.cusAreaId) {
      scopeMatches.push({ prpAreaId: customer.cusAreaId });
    }
    if (customer.area?.armCityId) {
      scopeMatches.push({ prpCityId: customer.area.armCityId });
    }

    const decider = await this.prisma.promotionSchemeParty.findFirst({
      where: {
        prpPrmId: prmId,
        prpIsDeleted: false,
        prpIsActive: true,
        OR: scopeMatches,
      },
      // The second key is the tie-break that makes an EXCLUDE win against an
      // INCLUDE of equal specificity.
      orderBy: [{ prpMatchPriority: 'desc' }, { prpIsExclude: 'desc' }],
    });

    if (!decider) {
      return {
        prm_id: prmId,
        cus_id: cusId,
        qualifies: false,
        decided_by: 'NO_RULE',
        matched_by: null,
        matched_row_id: null,
        match_priority: null,
        is_exclude: null,
        reason: 'NO — the scheme is scoped to a list and no row on it reaches this customer',
      };
    }

    return {
      prm_id: prmId,
      cus_id: cusId,
      qualifies: !decider.prpIsExclude,
      decided_by: 'RULE',
      matched_by: decider.prpKind,
      matched_row_id: decider.prpId,
      match_priority: decider.prpMatchPriority,
      is_exclude: decider.prpIsExclude,
      reason: decider.prpIsExclude
        ? `NO — carved out by the ${decider.prpKind} rule`
        : `YES — via ${decider.prpKind}`,
    };
  }

  /**
   * Soft delete, and take the four child sets down with it in the same
   * transaction. A live child under a dead header is the state that makes a
   * campaign reappear at a till after head office withdrew it.
   */
  async softDeleteScheme(prmId: string, modifiedBy?: string): Promise<PromotionSchemeDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findSchemeWithChildren(tx, prmId);
      if (!existing) {
        this.throwNotFound('prm_id', prmId, 'Promotion scheme not found');
      }

      const modifiedOn = new Date();
      const actor = this.resolveWriteActor(modifiedBy);

      const updated = await tx.promotionScheme.update({
        where: { prmId },
        data: {
          prmIsDeleted: true,
          prmIsActive: false,
          prmModifiedOn: modifiedOn,
          prmModifiedBy: actor,
        },
      });

      await Promise.all([
        tx.promotionSchemeBranch.updateMany({
          where: { prbPrmId: prmId, prbIsDeleted: false },
          data: {
            prbIsDeleted: true,
            prbIsActive: false,
            prbModifiedOn: modifiedOn,
            prbModifiedBy: actor,
          },
        }),
        tx.promotionSchemeParty.updateMany({
          where: { prpPrmId: prmId, prpIsDeleted: false },
          data: {
            prpIsDeleted: true,
            prpIsActive: false,
            prpModifiedOn: modifiedOn,
            prpModifiedBy: actor,
          },
        }),
        tx.promotionSchemeItem.updateMany({
          where: { priPrmId: prmId, priIsDeleted: false },
          data: {
            priIsDeleted: true,
            priIsActive: false,
            priModifiedOn: modifiedOn,
            priModifiedBy: actor,
          },
        }),
        tx.promotionSchemeSlab.updateMany({
          where: { prsPrmId: prmId, prsIsDeleted: false },
          data: {
            prsIsDeleted: true,
            prsIsActive: false,
            prsModifiedOn: modifiedOn,
            prsModifiedBy: actor,
          },
        }),
      ]);

      await this.audit(
        tx,
        'cancel',
        SCHEME_TABLE_NAME,
        prmId,
        existing.prmName,
        toSchemePayload(existing),
        toSchemePayload({ ...updated, branches: [], parties: [], items: [], slabs: [] }),
        'Promotion scheme soft deleted with all scope and slab rows',
      );

      return { deleted: true as const, prm_id: prmId };
    });
  }

  private async createScheme(dto: SavePromotionSchemeDto): Promise<PromotionSchemePayload> {
    const actor = this.resolveWriteActor(dto.prm_created_by);

    const data: Prisma.PromotionSchemeUncheckedCreateInput = {
      prmCompId: requireUuid(dto.prm_comp_id, 'prm_comp_id'),
      prmCode: requireString(dto.prm_code, 'prm_code'),
      prmName: requireString(dto.prm_name, 'prm_name'),
      prmStartDate: parseDateOnly(dto.prm_start_date, 'prm_start_date'),
      prmEndDate: parseDateOnly(dto.prm_end_date, 'prm_end_date'),
      prmCreatedBy: actor,
    };
    this.applySchemeFields(data, dto);

    const effective = this.effectiveScheme(null, data);
    this.assertSchemeInvariants(effective);
    await this.assertCodeIsFree(this.prisma, data.prmCompId, effective.prmCode, null);

    return this.prisma
      .$transaction(async (tx) => {
        const row = await tx.promotionScheme.create({ data });
        await this.audit(
          tx,
          'create',
          SCHEME_TABLE_NAME,
          row.prmId,
          row.prmName,
          null,
          toSchemePayload({ ...row, branches: [], parties: [], items: [], slabs: [] }),
          'Promotion scheme created',
        );
        // The grids audit themselves row by row as they are written, so the log
        // stays chronological: header first, then each line it carried.
        await this.syncChildren(tx, row, dto);
        const after = await this.findSchemeWithChildren(tx, row.prmId);
        return toSchemePayload(
          after ?? { ...row, branches: [], parties: [], items: [], slabs: [] },
        );
      })
      .catch((error: unknown) => {
        handlePromotionWriteError(error);
        throw error;
      });
  }

  private async updateScheme(dto: SavePromotionSchemeDto): Promise<PromotionSchemePayload> {
    const prmId = requireUuid(dto.prm_id, 'prm_id');

    return this.prisma
      .$transaction(async (tx) => {
        const existing = await this.findSchemeWithChildren(tx, prmId);
        if (!existing) {
          this.throwNotFound('prm_id', prmId, 'Promotion scheme not found');
        }

        const data: Prisma.PromotionSchemeUncheckedUpdateInput = {
          prmModifiedOn: new Date(),
          prmModifiedBy: this.resolveWriteActor(dto.prm_modified_by),
        };
        if (hasOwnProperty(dto, 'prm_comp_id')) {
          data.prmCompId = requireUuid(dto.prm_comp_id, 'prm_comp_id');
        }
        if (hasOwnProperty(dto, 'prm_code')) {
          data.prmCode = requireString(dto.prm_code, 'prm_code');
        }
        if (hasOwnProperty(dto, 'prm_name')) {
          data.prmName = requireString(dto.prm_name, 'prm_name');
        }
        if (hasOwnProperty(dto, 'prm_start_date')) {
          data.prmStartDate = parseDateOnly(dto.prm_start_date, 'prm_start_date');
        }
        if (hasOwnProperty(dto, 'prm_end_date')) {
          data.prmEndDate = parseDateOnly(dto.prm_end_date, 'prm_end_date');
        }
        this.applySchemeFields(data, dto);

        const effective = this.effectiveScheme(existing, data);
        this.assertSchemeInvariants(effective);

        if (
          effective.prmBenefit !== existing.prmBenefit &&
          existing.slabs.length > 0 &&
          dto.slabs === undefined
        ) {
          // fk_prs_scheme_benefit is ON UPDATE CASCADE, so this would silently
          // relabel every band while leaving the wrong benefit column filled.
          // Sending `slabs` in the same body is the way through: the grid is
          // rewritten after the header, against the new benefit.
          this.throwBadRequest('Validation failed', [
            {
              field: 'prm_benefit',
              message:
                `Cannot change prm_benefit while ${existing.slabs.length} slab band(s) exist. ` +
                'Send the retyped bands as `slabs` in this same call, or delete them first.',
            },
          ]);
        }

        const compId = (data.prmCompId as string | undefined) ?? existing.prmCompId;
        await this.assertCodeIsFree(tx, compId, effective.prmCode, prmId);

        const updated = await tx.promotionScheme.update({ where: { prmId }, data });
        await this.syncChildren(tx, updated, dto);
        const after = await this.findSchemeWithChildren(tx, prmId);

        await this.audit(
          tx,
          'update',
          SCHEME_TABLE_NAME,
          prmId,
          updated.prmName,
          toSchemePayload(existing),
          after ? toSchemePayload(after) : null,
          'Promotion scheme updated',
        );

        return after
          ? toSchemePayload(after)
          : toSchemePayload({ ...updated, branches: [], parties: [], items: [], slabs: [] });
      })
      .catch((error: unknown) => {
        handlePromotionWriteError(error);
        throw error;
      });
  }

  /** Only the keys actually present in the body are written. */
  private applySchemeFields(
    data: Prisma.PromotionSchemeUncheckedCreateInput | Prisma.PromotionSchemeUncheckedUpdateInput,
    dto: SavePromotionSchemeDto,
  ): void {
    if (hasOwnProperty(dto, 'prm_branch_id')) data.prmBranchId = dto.prm_branch_id ?? null;
    if (hasOwnProperty(dto, 'prm_tenant_id')) data.prmTenantId = dto.prm_tenant_id ?? null;
    if (hasOwnProperty(dto, 'prm_status')) {
      data.prmStatus = normalizeEnum(dto.prm_status);
    }
    if (hasOwnProperty(dto, 'prm_apply_on')) {
      data.prmApplyOn = normalizeEnum(dto.prm_apply_on);
    }
    if (hasOwnProperty(dto, 'prm_benefit')) {
      data.prmBenefit = normalizeEnum(dto.prm_benefit);
    }
    if (hasOwnProperty(dto, 'prm_priority')) {
      data.prmPriority = dto.prm_priority as number;
    }
    if (hasOwnProperty(dto, 'prm_stack_mode')) {
      data.prmStackMode = normalizeEnum(dto.prm_stack_mode);
    }
    if (hasOwnProperty(dto, 'prm_auto_apply')) data.prmAutoApply = dto.prm_auto_apply ?? true;
    if (hasOwnProperty(dto, 'prm_allow_with_manual_disc')) {
      data.prmAllowWithManualDisc = dto.prm_allow_with_manual_disc ?? false;
    }
    if (hasOwnProperty(dto, 'prm_calc_on_amount_type')) {
      data.prmCalcOnAmountType = normalizeEnum(dto.prm_calc_on_amount_type);
    }
    if (hasOwnProperty(dto, 'prm_include_tax')) data.prmIncludeTax = dto.prm_include_tax ?? false;
    if (hasOwnProperty(dto, 'prm_bill_type')) {
      data.prmBillType = normalizeEnum(dto.prm_bill_type);
    }
    if (hasOwnProperty(dto, 'prm_min_bill_amount')) {
      data.prmMinBillAmount = dto.prm_min_bill_amount as number;
    }
    if (hasOwnProperty(dto, 'prm_min_qty')) {
      data.prmMinQty = dto.prm_min_qty as number;
    }
    if (hasOwnProperty(dto, 'prm_branch_scope')) {
      data.prmBranchScope = normalizeEnum(dto.prm_branch_scope);
    }
    if (hasOwnProperty(dto, 'prm_cust_scope')) {
      data.prmCustScope = normalizeEnum(dto.prm_cust_scope);
    }
    if (hasOwnProperty(dto, 'prm_item_scope')) {
      data.prmItemScope = normalizeEnum(dto.prm_item_scope);
    }
    if (hasOwnProperty(dto, 'prm_price_level_id')) {
      data.prmPriceLevelId = dto.prm_price_level_id ?? null;
    }
    if (hasOwnProperty(dto, 'prm_max_benefit_per_bill')) {
      data.prmMaxBenefitPerBill = dto.prm_max_benefit_per_bill as number;
    }
    if (hasOwnProperty(dto, 'prm_max_uses_total')) {
      data.prmMaxUsesTotal = dto.prm_max_uses_total as number;
    }
    if (hasOwnProperty(dto, 'prm_max_uses_per_cust')) {
      data.prmMaxUsesPerCust = dto.prm_max_uses_per_cust as number;
    }
    if (hasOwnProperty(dto, 'prm_budget_amount')) {
      data.prmBudgetAmount = dto.prm_budget_amount as number;
    }
    if (hasOwnProperty(dto, 'prm_coupon_batch_id')) {
      data.prmCouponBatchId = dto.prm_coupon_batch_id ?? null;
    }
    if (hasOwnProperty(dto, 'prm_valid_from_time')) {
      data.prmValidFromTime = dto.prm_valid_from_time
        ? parseTimeToUtcDate(dto.prm_valid_from_time, 'prm_valid_from_time')
        : null;
    }
    if (hasOwnProperty(dto, 'prm_valid_to_time')) {
      data.prmValidToTime = dto.prm_valid_to_time
        ? parseTimeToUtcDate(dto.prm_valid_to_time, 'prm_valid_to_time')
        : null;
    }
    if (hasOwnProperty(dto, 'prm_valid_weekdays')) {
      const weekdays = normalizeNullableString(dto.prm_valid_weekdays);
      data.prmValidWeekdays = weekdays ? weekdays.toUpperCase() : null;
    }
    if (hasOwnProperty(dto, 'prm_remarks')) {
      data.prmRemarks = normalizeNullableString(dto.prm_remarks);
    }
    if (hasOwnProperty(dto, 'prm_is_active')) data.prmIsActive = dto.prm_is_active ?? true;
    if (hasOwnProperty(dto, 'prm_approved_on')) {
      const value = normalizeNullableString(dto.prm_approved_on);
      if (value === null) {
        data.prmApprovedOn = null;
      } else {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          this.throwBadRequest('Validation failed', [
            { field: 'prm_approved_on', message: 'prm_approved_on must be a valid datetime' },
          ]);
        }
        data.prmApprovedOn = parsed;
      }
    }
    if (hasOwnProperty(dto, 'prm_approved_by')) {
      data.prmApprovedBy = resolveActorUuid(dto.prm_approved_by);
    }
  }

  /** Existing row overlaid with whatever this request writes. */
  private effectiveScheme(
    existing: PromotionScheme | null,
    data: Prisma.PromotionSchemeUncheckedCreateInput | Prisma.PromotionSchemeUncheckedUpdateInput,
  ): EffectiveScheme {
    const pick = <T>(key: string, fallback: T): T => {
      const value = (data as Record<string, unknown>)[key];
      return value === undefined ? fallback : (value as T);
    };

    return {
      prmCode: pick('prmCode', existing?.prmCode ?? ''),
      prmStatus: pick('prmStatus', existing?.prmStatus ?? 'DRAFT'),
      prmApplyOn: pick('prmApplyOn', existing?.prmApplyOn ?? 'ITEM_QTY'),
      prmBenefit: pick('prmBenefit', existing?.prmBenefit ?? 'DISC_PERC'),
      prmStackMode: pick('prmStackMode', existing?.prmStackMode ?? 'EXCLUSIVE'),
      prmCalcOnAmountType: pick(
        'prmCalcOnAmountType',
        existing?.prmCalcOnAmountType ?? 'NET_AMOUNT',
      ),
      prmBillType: pick('prmBillType', existing?.prmBillType ?? 'ALL'),
      prmBranchScope: pick('prmBranchScope', existing?.prmBranchScope ?? 'ALL'),
      prmCustScope: pick('prmCustScope', existing?.prmCustScope ?? 'ALL'),
      prmItemScope: pick('prmItemScope', existing?.prmItemScope ?? 'ALL'),
      prmPriority: pick('prmPriority', existing?.prmPriority ?? 1),
      prmMinBillAmount: pick('prmMinBillAmount', toNumber(existing?.prmMinBillAmount ?? 0)),
      prmMinQty: pick('prmMinQty', toNumber(existing?.prmMinQty ?? 0)),
      prmMaxBenefitPerBill: pick(
        'prmMaxBenefitPerBill',
        toNumber(existing?.prmMaxBenefitPerBill ?? 0),
      ),
      prmMaxUsesTotal: pick('prmMaxUsesTotal', existing?.prmMaxUsesTotal ?? 0),
      prmMaxUsesPerCust: pick('prmMaxUsesPerCust', existing?.prmMaxUsesPerCust ?? 0),
      prmBudgetAmount: pick('prmBudgetAmount', toNumber(existing?.prmBudgetAmount ?? 0)),
      prmStartDate: pick('prmStartDate', existing?.prmStartDate ?? new Date(0)),
      prmEndDate: pick('prmEndDate', existing?.prmEndDate ?? new Date(0)),
      prmValidFromTime: pick('prmValidFromTime', existing?.prmValidFromTime ?? null),
      prmValidToTime: pick('prmValidToTime', existing?.prmValidToTime ?? null),
      prmValidWeekdays: pick('prmValidWeekdays', existing?.prmValidWeekdays ?? null),
      prmApprovedBy: pick('prmApprovedBy', existing?.prmApprovedBy ?? null),
    };
  }

  /**
   * Every CHECK the table does not carry, in one pass — see
   * utils/promotion-scheme-invariants.ts, where each one is a named function.
   * Collected rather than short-circuited so a bad payload is answered with all
   * of its problems at once.
   */
  private assertSchemeInvariants(scheme: EffectiveScheme): void {
    const errors = collectSchemeInvariantErrors(scheme);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  /**
   * ux_prm_code is a PARTIAL unique index, so Prisma neither declares nor
   * necessarily creates it — check here rather than hoping for a P2002.
   */
  private async assertCodeIsFree(
    client: WriteClient,
    compId: string,
    code: string,
    ignorePrmId: string | null,
  ): Promise<void> {
    const clash = await client.promotionScheme.findFirst({
      where: {
        prmCompId: compId,
        prmIsDeleted: false,
        prmCode: { equals: code, mode: 'insensitive' },
        ...(ignorePrmId ? { prmId: { not: ignorePrmId } } : {}),
      },
      select: { prmId: true },
    });
    if (clash) {
      this.throwConflict('Duplicate promotion code', [
        { field: 'prm_code', message: `prm_code ${code} already exists for this company` },
      ]);
    }
  }

  // ─── §2 branch rows ─────────────────────────────────────────────────────────

  private async saveBranchRow(
    tx: Prisma.TransactionClient,
    prmId: string,
    row: PromotionSchemeBranchRowDto,
    index: number,
  ): Promise<BranchRow> {
    const slno = row.prb_slno ?? index + 1;
    requireInteger(slno, 'prb_slno', 1);

    if (row.prb_id) {
      const existing = await tx.promotionSchemeBranch.findFirst({
        where: { prbId: row.prb_id, prbPrmId: prmId, prbIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound('prb_id', row.prb_id, 'Promotion scheme branch row not found');
      }
      const data: Prisma.PromotionSchemeBranchUncheckedUpdateInput = {
        prbModifiedOn: new Date(),
        prbModifiedBy: this.resolveWriteActor(row.prb_modified_by),
      };
      if (hasOwnProperty(row, 'prb_slno')) data.prbSlno = slno;
      if (hasOwnProperty(row, 'prb_branch_id')) {
        data.prbBranchId = requireUuid(row.prb_branch_id, 'prb_branch_id');
      }
      if (hasOwnProperty(row, 'prb_is_exclude')) data.prbIsExclude = row.prb_is_exclude ?? false;
      if (hasOwnProperty(row, 'prb_notes')) data.prbNotes = normalizeNullableString(row.prb_notes);
      if (hasOwnProperty(row, 'prb_is_active')) data.prbIsActive = row.prb_is_active ?? true;

      const updated = await tx.promotionSchemeBranch.update({
        where: { prbId: row.prb_id },
        data,
        include: BRANCH_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        BRANCH_TABLE_NAME,
        updated.prbId,
        `Scheme ${prmId} / Branch ${updated.prbSlno}`,
        toBranchPayload(existing),
        toBranchPayload(updated),
        'Promotion scheme branch row updated',
      );
      return updated;
    }

    const created = await tx.promotionSchemeBranch.create({
      data: {
        prbPrmId: prmId,
        prbSlno: slno,
        prbBranchId: requireUuid(row.prb_branch_id, 'prb_branch_id'),
        prbIsExclude: row.prb_is_exclude ?? false,
        prbNotes: normalizeNullableString(row.prb_notes),
        prbIsActive: row.prb_is_active ?? true,
        prbCreatedBy: this.resolveWriteActor(row.prb_created_by),
      },
      include: BRANCH_LOOKUP,
    });
    await this.audit(
      tx,
      'create',
      BRANCH_TABLE_NAME,
      created.prbId,
      `Scheme ${prmId} / Branch ${created.prbSlno}`,
      null,
      toBranchPayload(created),
      'Promotion scheme branch row created',
    );
    return created;
  }

  // ─── §3 party rows ──────────────────────────────────────────────────────────

  private async savePartyRow(
    tx: Prisma.TransactionClient,
    prmId: string,
    row: PromotionSchemePartyRowDto,
    index: number,
  ): Promise<PartyRow> {
    const existing = row.prp_id
      ? await tx.promotionSchemeParty.findFirst({
          where: { prpId: row.prp_id, prpPrmId: prmId, prpIsDeleted: false },
        })
      : null;
    if (row.prp_id && !existing) {
      this.throwNotFound('prp_id', row.prp_id, 'Promotion scheme party row not found');
    }

    // The row as it will stand once this write lands — the stored values
    // overlaid with whatever the caller sent — which is what the constraints
    // are actually about.
    const slno = row.prp_slno ?? existing?.prpSlno ?? index + 1;
    const kind = hasOwnProperty(row, 'prp_kind')
      ? normalizeEnum(row.prp_kind)
      : (existing?.prpKind ?? normalizeEnum(row.prp_kind));
    const matchPriority = hasOwnProperty(row, 'prp_match_priority')
      ? (row.prp_match_priority as number)
      : (existing?.prpMatchPriority ?? PRP_DEFAULT_MATCH_PRIORITY[kind] ?? 1);

    this.assertPartyInvariants({
      prpSlno: slno,
      prpKind: kind,
      prpMatchPriority: matchPriority,
    });

    if (existing) {
      const data: Prisma.PromotionSchemePartyUncheckedUpdateInput = {
        prpModifiedOn: new Date(),
        prpModifiedBy: this.resolveWriteActor(row.prp_modified_by),
      };
      if (hasOwnProperty(row, 'prp_slno')) data.prpSlno = slno;
      if (hasOwnProperty(row, 'prp_kind')) data.prpKind = kind;
      if (hasOwnProperty(row, 'prp_scope_id')) {
        data.prpScopeId = requireUuid(row.prp_scope_id, 'prp_scope_id');
      }
      if (hasOwnProperty(row, 'prp_is_exclude')) data.prpIsExclude = row.prp_is_exclude ?? false;
      if (hasOwnProperty(row, 'prp_match_priority')) data.prpMatchPriority = matchPriority;
      if (hasOwnProperty(row, 'prp_notes')) data.prpNotes = normalizeNullableString(row.prp_notes);
      if (hasOwnProperty(row, 'prp_is_active')) data.prpIsActive = row.prp_is_active ?? true;

      const updated = await tx.promotionSchemeParty.update({
        where: { prpId: existing.prpId },
        data,
        include: PARTY_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        PARTY_TABLE_NAME,
        updated.prpId,
        `Scheme ${prmId} / ${updated.prpKind} ${updated.prpScopeId}`,
        toPartyPayload(existing),
        toPartyPayload(updated),
        'Promotion scheme party row updated',
      );
      return updated;
    }

    const created = await tx.promotionSchemeParty.create({
      data: {
        prpPrmId: prmId,
        prpSlno: slno,
        prpKind: kind,
        prpScopeId: requireUuid(row.prp_scope_id, 'prp_scope_id'),
        prpIsExclude: row.prp_is_exclude ?? false,
        prpMatchPriority: matchPriority,
        prpNotes: normalizeNullableString(row.prp_notes),
        prpIsActive: row.prp_is_active ?? true,
        prpCreatedBy: this.resolveWriteActor(row.prp_created_by),
      },
      include: PARTY_LOOKUP,
    });
    await this.audit(
      tx,
      'create',
      PARTY_TABLE_NAME,
      created.prpId,
      `Scheme ${prmId} / ${created.prpKind} ${created.prpScopeId}`,
      null,
      toPartyPayload(created),
      'Promotion scheme party row created',
    );
    return created;
  }

  // ─── §4 item rows ───────────────────────────────────────────────────────────

  private async saveItemRow(
    tx: Prisma.TransactionClient,
    prmId: string,
    row: PromotionSchemeItemRowDto,
    index: number,
  ): Promise<ItemRow> {
    const existing = row.pri_id
      ? await tx.promotionSchemeItem.findFirst({
          where: { priId: row.pri_id, priPrmId: prmId, priIsDeleted: false },
        })
      : null;
    if (row.pri_id && !existing) {
      this.throwNotFound('pri_id', row.pri_id, 'Promotion scheme item row not found');
    }

    const slno = row.pri_slno ?? existing?.priSlno ?? index + 1;
    const kind = hasOwnProperty(row, 'pri_kind')
      ? normalizeEnum(row.pri_kind)
      : (existing?.priKind ?? normalizeEnum(row.pri_kind));

    const unitId = hasOwnProperty(row, 'pri_unit_id')
      ? (row.pri_unit_id ?? null)
      : (existing?.priUnitId ?? null);

    const discPerc = this.pickNumber(row, 'pri_disc_perc', existing?.priDiscPerc, 0);
    const discQty = this.pickNumber(row, 'pri_disc_qty', existing?.priDiscQty, 0);
    const discAmt = this.pickNumber(row, 'pri_disc_amt', existing?.priDiscAmt, 0);
    const minQty = this.pickNumber(row, 'pri_min_qty', existing?.priMinQty, 0);
    const factor = this.pickNumber(row, 'pri_factor', existing?.priFactor, 1);
    const maxBenefit = this.pickNumber(row, 'pri_max_benefit', existing?.priMaxBenefit, 0);
    const isExclude = hasOwnProperty(row, 'pri_is_exclude')
      ? (row.pri_is_exclude ?? false)
      : (existing?.priIsExclude ?? false);

    const matchPriority = hasOwnProperty(row, 'pri_match_priority')
      ? (row.pri_match_priority as number)
      : (existing?.priMatchPriority ?? PRI_DEFAULT_MATCH_PRIORITY[kind] ?? 1);

    this.assertItemInvariants({
      priSlno: slno,
      priKind: kind,
      priUnitId: unitId,
      priIsExclude: isExclude,
      priDiscPerc: discPerc,
      priDiscQty: discQty,
      priDiscAmt: discAmt,
      priMinQty: minQty,
      priFactor: factor,
      priMaxBenefit: maxBenefit,
      priMatchPriority: matchPriority,
    });

    if (existing) {
      const data: Prisma.PromotionSchemeItemUncheckedUpdateInput = {
        priModifiedOn: new Date(),
        priModifiedBy: this.resolveWriteActor(row.pri_modified_by),
      };
      if (hasOwnProperty(row, 'pri_slno')) data.priSlno = slno;
      if (hasOwnProperty(row, 'pri_kind')) data.priKind = kind;
      if (hasOwnProperty(row, 'pri_scope_id')) {
        data.priScopeId = requireUuid(row.pri_scope_id, 'pri_scope_id');
      }
      if (hasOwnProperty(row, 'pri_unit_id')) data.priUnitId = unitId;
      if (hasOwnProperty(row, 'pri_is_exclude')) data.priIsExclude = isExclude;
      if (hasOwnProperty(row, 'pri_disc_perc')) data.priDiscPerc = discPerc;
      if (hasOwnProperty(row, 'pri_disc_qty')) data.priDiscQty = discQty;
      if (hasOwnProperty(row, 'pri_disc_amt')) data.priDiscAmt = discAmt;
      if (hasOwnProperty(row, 'pri_min_qty')) data.priMinQty = minQty;
      if (hasOwnProperty(row, 'pri_factor')) data.priFactor = factor;
      if (hasOwnProperty(row, 'pri_max_benefit')) data.priMaxBenefit = maxBenefit;
      if (hasOwnProperty(row, 'pri_match_priority')) data.priMatchPriority = matchPriority;
      if (hasOwnProperty(row, 'pri_notes')) data.priNotes = normalizeNullableString(row.pri_notes);
      if (hasOwnProperty(row, 'pri_is_active')) data.priIsActive = row.pri_is_active ?? true;

      const updated = await tx.promotionSchemeItem.update({
        where: { priId: existing.priId },
        data,
        include: ITEM_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        ITEM_TABLE_NAME,
        updated.priId,
        `Scheme ${prmId} / ${updated.priKind} ${updated.priScopeId}`,
        toItemPayload(existing),
        toItemPayload(updated),
        'Promotion scheme item row updated',
      );
      return updated;
    }

    const created = await tx.promotionSchemeItem.create({
      data: {
        priPrmId: prmId,
        priSlno: slno,
        priKind: kind,
        priScopeId: requireUuid(row.pri_scope_id, 'pri_scope_id'),
        priUnitId: unitId,
        priIsExclude: isExclude,
        priDiscPerc: discPerc,
        priDiscQty: discQty,
        priDiscAmt: discAmt,
        priMinQty: minQty,
        priFactor: factor,
        priMaxBenefit: maxBenefit,
        priMatchPriority: matchPriority,
        priNotes: normalizeNullableString(row.pri_notes),
        priIsActive: row.pri_is_active ?? true,
        priCreatedBy: this.resolveWriteActor(row.pri_created_by),
      },
      include: ITEM_LOOKUP,
    });
    await this.audit(
      tx,
      'create',
      ITEM_TABLE_NAME,
      created.priId,
      `Scheme ${prmId} / ${created.priKind} ${created.priScopeId}`,
      null,
      toItemPayload(created),
      'Promotion scheme item row created',
    );
    return created;
  }

  /** ck_prp_kind, ck_prp_slno and ck_prp_match_priority, collected. */
  private assertPartyInvariants(row: EffectivePartyRow): void {
    const errors = collectPartyInvariantErrors(row);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  /** ck_pri_kind, ck_pri_unit, ck_pri_one_rate, ck_pri_exclude, ck_pri_values,
   *  ck_pri_slno and ck_pri_match_priority, collected. */
  private assertItemInvariants(row: EffectiveItemRow): void {
    const errors = collectItemInvariantErrors(row);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  // ─── §5 slab rows ───────────────────────────────────────────────────────────

  private async saveSlabRow(
    tx: Prisma.TransactionClient,
    scheme: PromotionScheme,
    row: PromotionSchemeSlabRowDto,
    index: number,
  ): Promise<SlabRow> {
    const existing = row.prs_id
      ? await tx.promotionSchemeSlab.findFirst({
          where: { prsId: row.prs_id, prsPrmId: scheme.prmId, prsIsDeleted: false },
        })
      : null;
    if (row.prs_id && !existing) {
      this.throwNotFound('prs_id', row.prs_id, 'Promotion scheme slab row not found');
    }

    // prs_benefit MIRRORS the header. The composite FK would refuse anything
    // else anyway; answering 400 here says why.
    const slno = row.prs_slno ?? existing?.prsSlno ?? index + 1;
    const benefit = hasOwnProperty(row, 'prs_benefit')
      ? normalizeEnum(row.prs_benefit)
      : scheme.prmBenefit;
    if (benefit !== scheme.prmBenefit) {
      this.throwBadRequest('Validation failed', [
        {
          field: 'prs_benefit',
          message: `prs_benefit must match the scheme's prm_benefit (${scheme.prmBenefit})`,
        },
      ]);
    }

    const band: EffectiveSlabRow = {
      prsSlno: slno,
      prsBenefit: benefit,
      prsExceeds: this.pickNumber(row, 'prs_exceeds', existing?.prsExceeds, 0),
      prsUpto: hasOwnProperty(row, 'prs_upto')
        ? (row.prs_upto ?? null)
        : existing?.prsUpto === undefined || existing?.prsUpto === null
          ? null
          : Number(existing.prsUpto.toString()),
      prsEach: this.pickNumber(row, 'prs_each', existing?.prsEach, 1),
      prsIsRepeat: hasOwnProperty(row, 'prs_is_repeat')
        ? (row.prs_is_repeat ?? false)
        : (existing?.prsIsRepeat ?? false),
      prsMaxRepeats: hasOwnProperty(row, 'prs_max_repeats')
        ? (row.prs_max_repeats ?? 0)
        : (existing?.prsMaxRepeats ?? 0),
      prsFreeItemId: hasOwnProperty(row, 'prs_free_item_id')
        ? (row.prs_free_item_id ?? null)
        : (existing?.prsFreeItemId ?? null),
      prsFreeUnitId: hasOwnProperty(row, 'prs_free_unit_id')
        ? (row.prs_free_unit_id ?? null)
        : (existing?.prsFreeUnitId ?? null),
      prsFreeQty: this.pickNumber(row, 'prs_free_qty', existing?.prsFreeQty, 0),
      prsDiscPerc: this.pickNumber(row, 'prs_disc_perc', existing?.prsDiscPerc, 0),
      prsDiscQty: this.pickNumber(row, 'prs_disc_qty', existing?.prsDiscQty, 0),
      prsDiscAmt: this.pickNumber(row, 'prs_disc_amt', existing?.prsDiscAmt, 0),
      prsFixedPrice: hasOwnProperty(row, 'prs_fixed_price')
        ? (row.prs_fixed_price ?? null)
        : existing?.prsFixedPrice === undefined || existing?.prsFixedPrice === null
          ? null
          : Number(existing.prsFixedPrice.toString()),
      prsMaxBenefitAmt: this.pickNumber(row, 'prs_max_benefit_amt', existing?.prsMaxBenefitAmt, 0),
    };
    this.assertSlabInvariants(band);

    if (existing) {
      const data: Prisma.PromotionSchemeSlabUncheckedUpdateInput = {
        prsModifiedOn: new Date(),
        prsModifiedBy: this.resolveWriteActor(row.prs_modified_by),
      };
      if (hasOwnProperty(row, 'prs_slno')) data.prsSlno = slno;
      if (hasOwnProperty(row, 'prs_exceeds')) data.prsExceeds = band.prsExceeds;
      if (hasOwnProperty(row, 'prs_upto')) data.prsUpto = band.prsUpto;
      if (hasOwnProperty(row, 'prs_each')) data.prsEach = band.prsEach;
      if (hasOwnProperty(row, 'prs_is_repeat')) data.prsIsRepeat = band.prsIsRepeat;
      if (hasOwnProperty(row, 'prs_max_repeats')) data.prsMaxRepeats = band.prsMaxRepeats;
      if (hasOwnProperty(row, 'prs_free_item_id')) data.prsFreeItemId = band.prsFreeItemId;
      if (hasOwnProperty(row, 'prs_free_unit_id')) data.prsFreeUnitId = band.prsFreeUnitId;
      if (hasOwnProperty(row, 'prs_free_qty')) data.prsFreeQty = band.prsFreeQty;
      if (hasOwnProperty(row, 'prs_free_stock_check')) {
        data.prsFreeStockCheck = row.prs_free_stock_check ?? true;
      }
      if (hasOwnProperty(row, 'prs_disc_perc')) data.prsDiscPerc = band.prsDiscPerc;
      if (hasOwnProperty(row, 'prs_disc_qty')) data.prsDiscQty = band.prsDiscQty;
      if (hasOwnProperty(row, 'prs_disc_amt')) data.prsDiscAmt = band.prsDiscAmt;
      if (hasOwnProperty(row, 'prs_fixed_price')) data.prsFixedPrice = band.prsFixedPrice;
      if (hasOwnProperty(row, 'prs_max_benefit_amt')) data.prsMaxBenefitAmt = band.prsMaxBenefitAmt;
      if (hasOwnProperty(row, 'prs_notes')) data.prsNotes = normalizeNullableString(row.prs_notes);
      if (hasOwnProperty(row, 'prs_is_active')) data.prsIsActive = row.prs_is_active ?? true;

      const updated = await tx.promotionSchemeSlab.update({
        where: { prsId: existing.prsId },
        data,
        include: SLAB_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        SLAB_TABLE_NAME,
        updated.prsId,
        `Scheme ${scheme.prmId} / Band ${updated.prsSlno}`,
        toSlabPayload(existing),
        toSlabPayload(updated),
        'Promotion scheme slab row updated',
      );
      return updated;
    }

    const created = await tx.promotionSchemeSlab.create({
      data: {
        prsPrmId: scheme.prmId,
        prsSlno: slno,
        prsBenefit: benefit,
        prsExceeds: band.prsExceeds,
        prsUpto: band.prsUpto,
        prsEach: band.prsEach,
        prsIsRepeat: band.prsIsRepeat,
        prsMaxRepeats: band.prsMaxRepeats,
        prsFreeItemId: band.prsFreeItemId,
        prsFreeUnitId: band.prsFreeUnitId,
        prsFreeQty: band.prsFreeQty,
        prsFreeStockCheck: row.prs_free_stock_check ?? true,
        prsDiscPerc: band.prsDiscPerc,
        prsDiscQty: band.prsDiscQty,
        prsDiscAmt: band.prsDiscAmt,
        prsFixedPrice: band.prsFixedPrice,
        prsMaxBenefitAmt: band.prsMaxBenefitAmt,
        prsNotes: normalizeNullableString(row.prs_notes),
        prsIsActive: row.prs_is_active ?? true,
        prsCreatedBy: this.resolveWriteActor(row.prs_created_by),
      },
      include: SLAB_LOOKUP,
    });
    await this.audit(
      tx,
      'create',
      SLAB_TABLE_NAME,
      created.prsId,
      `Scheme ${scheme.prmId} / Band ${created.prsSlno}`,
      null,
      toSlabPayload(created),
      'Promotion scheme slab row created',
    );
    return created;
  }

  /** ck_prs_band, ck_prs_each, ck_prs_amounts, ck_prs_free_unit_pair,
   *  ck_prs_benefit_columns and ck_prs_slno, collected. */
  private assertSlabInvariants(band: EffectiveSlabRow): void {
    const errors = collectSlabInvariantErrors(band);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  // ─── Shared plumbing ────────────────────────────────────────────────────────

  private async findSchemeWithChildren(
    client: WriteClient,
    prmId: string,
  ): Promise<SchemeWithChildren | null> {
    return client.promotionScheme.findFirst({
      where: { prmId, prmIsDeleted: false },
      include: {
        branches: {
          where: { prbIsDeleted: false },
          orderBy: [{ prbSlno: 'asc' }, { prbId: 'asc' }],
          include: BRANCH_LOOKUP,
        },
        parties: {
          where: { prpIsDeleted: false },
          orderBy: [{ prpMatchPriority: 'desc' }, { prpSlno: 'asc' }, { prpId: 'asc' }],
          include: PARTY_LOOKUP,
        },
        items: {
          where: { priIsDeleted: false },
          orderBy: [{ priMatchPriority: 'desc' }, { priSlno: 'asc' }, { priId: 'asc' }],
          include: ITEM_LOOKUP,
        },
        slabs: {
          where: { prsIsDeleted: false },
          orderBy: [{ prsExceeds: 'asc' }, { prsSlno: 'asc' }, { prsId: 'asc' }],
          include: SLAB_LOOKUP,
        },
      },
    });
  }

  private async requireScheme(client: WriteClient, prmId: string): Promise<PromotionScheme> {
    const scheme = await client.promotionScheme.findFirst({
      where: { prmId, prmIsDeleted: false },
    });
    if (!scheme) {
      this.throwNotFound('prm_id', prmId, 'Promotion scheme not found');
    }
    return scheme;
  }

  /**
   * The four grids, saved alongside the header in the same transaction.
   *
   * An array that is PRESENT replaces its grid: every row is upserted in the
   * order it arrived, then anything still on the scheme but missing from the
   * array is soft deleted. That is the whole point of the single call — the
   * screen posts the grid it is showing and the server makes the table match.
   *
   * An array that is ABSENT leaves its grid untouched, so a header-only save (a
   * status flip, an approval) can never wipe rows the caller never loaded.
   */
  private async syncChildren(
    tx: Prisma.TransactionClient,
    scheme: PromotionScheme,
    dto: SavePromotionSchemeDto,
  ): Promise<void> {
    const actor = dto.prm_modified_by ?? dto.prm_created_by;

    if (dto.branches !== undefined) {
      this.assertNoDuplicates(
        dto.branches.map((row, index) => ({ key: row.prb_branch_id ?? `#${index}`, index })),
        'prb_branch_id',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.branches.length; index += 1) {
        const saved = await this.saveBranchRow(tx, scheme.prmId, dto.branches[index], index);
        kept.push(saved.prbId);
      }
      const stale = await tx.promotionSchemeBranch.findMany({
        where: { prbPrmId: scheme.prmId, prbIsDeleted: false, prbId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeleteBranchRow(tx, row, actor);
      }
    }

    if (dto.parties !== undefined) {
      this.assertNoDuplicates(
        dto.parties.map((row, index) => ({
          key: `${(row.prp_kind ?? '').toUpperCase()}:${row.prp_scope_id ?? `#${index}`}`,
          index,
        })),
        'prp_scope_id',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.parties.length; index += 1) {
        const saved = await this.savePartyRow(tx, scheme.prmId, dto.parties[index], index);
        kept.push(saved.prpId);
      }
      const stale = await tx.promotionSchemeParty.findMany({
        where: { prpPrmId: scheme.prmId, prpIsDeleted: false, prpId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeletePartyRow(tx, row, actor);
      }
    }

    if (dto.items !== undefined) {
      this.assertNoDuplicates(
        dto.items.map((row, index) => ({
          key: `${(row.pri_kind ?? '').toUpperCase()}:${row.pri_scope_id ?? `#${index}`}`,
          index,
        })),
        'pri_scope_id',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.items.length; index += 1) {
        const saved = await this.saveItemRow(tx, scheme.prmId, dto.items[index], index);
        kept.push(saved.priId);
      }
      const stale = await tx.promotionSchemeItem.findMany({
        where: { priPrmId: scheme.prmId, priIsDeleted: false, priId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeleteItemRow(tx, row, actor);
      }
    }

    if (dto.slabs !== undefined) {
      this.assertNoDuplicates(
        dto.slabs.map((row, index) => ({
          key: `${row.prs_exceeds ?? 0}:${row.prs_free_item_id ?? '-'}`,
          index,
        })),
        'prs_exceeds',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.slabs.length; index += 1) {
        const saved = await this.saveSlabRow(tx, scheme, dto.slabs[index], index);
        kept.push(saved.prsId);
      }
      const stale = await tx.promotionSchemeSlab.findMany({
        where: { prsPrmId: scheme.prmId, prsIsDeleted: false, prsId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeleteSlabRow(tx, row, actor);
      }
    }
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeleteBranchRow(
    tx: Prisma.TransactionClient,
    existing: PromotionSchemeBranch,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.promotionSchemeBranch.update({
      where: { prbId: existing.prbId },
      data: {
        prbIsDeleted: true,
        prbIsActive: false,
        prbModifiedOn: new Date(),
        prbModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      BRANCH_TABLE_NAME,
      existing.prbId,
      `Scheme ${existing.prbPrmId} / Branch ${existing.prbSlno}`,
      toBranchPayload(existing),
      toBranchPayload(updated),
      'Promotion scheme branch row soft deleted',
    );
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeletePartyRow(
    tx: Prisma.TransactionClient,
    existing: PromotionSchemeParty,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.promotionSchemeParty.update({
      where: { prpId: existing.prpId },
      data: {
        prpIsDeleted: true,
        prpIsActive: false,
        prpModifiedOn: new Date(),
        prpModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      PARTY_TABLE_NAME,
      existing.prpId,
      `Scheme ${existing.prpPrmId} / ${existing.prpKind} ${existing.prpScopeId}`,
      toPartyPayload(existing),
      toPartyPayload(updated),
      'Promotion scheme party row soft deleted',
    );
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeleteItemRow(
    tx: Prisma.TransactionClient,
    existing: PromotionSchemeItem,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.promotionSchemeItem.update({
      where: { priId: existing.priId },
      data: {
        priIsDeleted: true,
        priIsActive: false,
        priModifiedOn: new Date(),
        priModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      ITEM_TABLE_NAME,
      existing.priId,
      `Scheme ${existing.priPrmId} / ${existing.priKind} ${existing.priScopeId}`,
      toItemPayload(existing),
      toItemPayload(updated),
      'Promotion scheme item row soft deleted',
    );
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeleteSlabRow(
    tx: Prisma.TransactionClient,
    existing: PromotionSchemeSlab,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.promotionSchemeSlab.update({
      where: { prsId: existing.prsId },
      data: {
        prsIsDeleted: true,
        prsIsActive: false,
        prsModifiedOn: new Date(),
        prsModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      SLAB_TABLE_NAME,
      existing.prsId,
      `Scheme ${existing.prsPrmId} / Band ${existing.prsSlno}`,
      toSlabPayload(existing),
      toSlabPayload(updated),
      'Promotion scheme slab row soft deleted',
    );
  }

  /**
   * The ux_* uniques on all four child tables are partial, so Prisma may not
   * have created them. Catch the same-batch duplicate here — two grid rows for
   * one brand is a typo the user can fix, not a 500 later.
   */
  private assertNoDuplicates(keys: Array<{ key: string; index: number }>, field: string): void {
    const seen = new Map<string, number>();
    for (const { key, index } of keys) {
      const first = seen.get(key);
      if (first !== undefined) {
        this.throwBadRequest('Validation failed', [
          {
            field,
            message: `Rows ${first + 1} and ${index + 1} target the same scope`,
          },
        ]);
      }
      seen.set(key, index);
    }
  }

  private pickNumber(
    row: object,
    key: string,
    existing: Prisma.Decimal | null | undefined,
    fallback: number,
  ): number {
    if (hasOwnProperty(row, key)) {
      const value = (row as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : fallback;
    }
    if (existing === null || existing === undefined) {
      return fallback;
    }
    return Number(existing.toString());
  }

  private resolveWriteActor(explicit?: string | null): string {
    return resolveActor(explicit, this.requestContextService.getUserId()) ?? DEFAULT_AUDIT_ACTOR;
  }

  private resolveAuditActor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_AUDIT_ACTOR;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: 'create' | 'update' | 'cancel',
    tableName: string,
    pk: string,
    displayName: string,
    originalRecord: unknown,
    modifiedRecord: unknown,
    notes: string,
  ): Promise<void> {
    await this.auditLogService.logEntityChange(
      {
        action,
        tableName,
        screenName: SCREEN_NAME,
        screenType: 'master',
        pk,
        displayName,
        originalRecord,
        modifiedRecord,
        userId: this.resolveAuditActor(),
        notes,
      },
      tx,
    );
  }

  private throwBadRequest(message: string, errors: PromotionSchemeErrorDetail[]): never {
    throwSalesBadRequest<PromotionSchemeErrorDetail, PromotionSchemeErrorResponse>(message, errors);
  }

  private throwConflict(message: string, errors: PromotionSchemeErrorDetail[]): never {
    throwSalesConflict<PromotionSchemeErrorDetail, PromotionSchemeErrorResponse>(message, errors);
  }

  private throwNotFound(field: string, value: string, message: string): never {
    throwSalesNotFound<PromotionSchemeErrorDetail, PromotionSchemeErrorResponse>(
      message,
      field,
      `${field} ${value} was not found`,
    );
  }
}
