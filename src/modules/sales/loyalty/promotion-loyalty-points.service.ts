import { Injectable } from '@nestjs/common';
import {
  LoyaltyScheme,
  LoyaltySchemeBranch,
  LoyaltySchemeGift,
  LoyaltySchemeItem,
  LoyaltySchemeParty,
  LoyaltySchemeSlab,
  Prisma,
} from '@prisma/client';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { AuditLogService } from '../../audit-log/audit-log.service';
import type { AuditAction } from '../../audit-log/types/audit-log.types';
import { ListLoyaltySchemeQueryDto } from './dto/list-loyalty-scheme-query.dto';
import { LoyaltySchemeBranchRowDto } from './dto/save-loyalty-scheme-branch.dto';
import { LoyaltySchemeGiftRowDto } from './dto/save-loyalty-scheme-gift.dto';
import { LoyaltySchemeItemRowDto } from './dto/save-loyalty-scheme-item.dto';
import { LoyaltySchemePartyRowDto } from './dto/save-loyalty-scheme-party.dto';
import { LoyaltySchemeSlabRowDto } from './dto/save-loyalty-scheme-slab.dto';
import { SaveLoyaltySchemeDto } from './dto/save-loyalty-scheme.dto';
import {
  LoyaltySchemeDeleteResult,
  LoyaltySchemeEligibilityPayload,
  LoyaltySchemePayload,
  PromotionLoyaltyPointsErrorDetail,
  PromotionLoyaltyPointsErrorResponse,
} from './types/promotion-loyalty-points-api.types';
import {
  EffectiveBranchRow,
  EffectiveGiftRow,
  EffectiveItemRow,
  EffectivePartyRow,
  EffectiveScheme,
  EffectiveSlabRow,
  collectBranchInvariantErrors,
  collectGiftInvariantErrors,
  collectItemInvariantErrors,
  collectPartyInvariantErrors,
  collectSchemeInvariantErrors,
  collectSlabInvariantErrors,
} from './utils/loyalty-scheme-invariants';
import {
  BRANCH_LOOKUP,
  BranchRow,
  GIFT_LOOKUP,
  GiftRow,
  ITEM_LOOKUP,
  ItemRow,
  LSI_DEFAULT_MATCH_PRIORITY,
  LSP_DEFAULT_MATCH_PRIORITY,
  PARTY_LOOKUP,
  PartyRow,
  SCHEME_LOOKUP,
  SLAB_LOOKUP,
  SchemeWithChildren,
  SlabRow,
  handleLoyaltyWriteError,
  normalizeEnum,
  normalizeNullableString,
  parseDateOnly,
  parseNullableDateOnly,
  parseTimeToUtcDate,
  requireInteger,
  requireString,
  requireUuid,
  resolveActor,
  resolveActorUuid,
  toBranchPayload,
  toGiftPayload,
  toItemPayload,
  toPartyPayload,
  toSchemePayload,
  toSlabPayload,
} from './utils/loyalty.utils';
import {
  DEFAULT_AUDIT_ACTOR,
  SalesWriteClient,
  hasOwnProperty,
  throwSalesBadRequest,
  throwSalesConflict,
  throwSalesNotFound,
  toNumber,
} from 'src/common/utils/module-service.utils';

const SCREEN_NAME = 'Promotion Loyalty Points';
const SCHEME_TABLE_NAME = 'loyalty scheme';
const BRANCH_TABLE_NAME = 'loyalty scheme branch';
const PARTY_TABLE_NAME = 'loyalty scheme party';
const ITEM_TABLE_NAME = 'loyalty scheme item';
const SLAB_TABLE_NAME = 'loyalty scheme slab';
const GIFT_TABLE_NAME = 'loyalty scheme gift';

type WriteClient = SalesWriteClient;

/** Every child row, deleted ones dropped, in entry order — the read the GRID needs. */
const EDITABLE_CHILDREN_INCLUDE = {
  branches: {
    where: { lsbIsDeleted: false },
    orderBy: [{ lsbSlno: 'asc' }, { lsbId: 'asc' }],
    include: BRANCH_LOOKUP,
  },
  parties: {
    where: { lspIsDeleted: false },
    orderBy: [{ lspSlno: 'asc' }, { lspId: 'asc' }],
    include: PARTY_LOOKUP,
  },
  items: {
    where: { lsiIsDeleted: false },
    orderBy: [{ lsiSlno: 'asc' }, { lsiId: 'asc' }],
    include: ITEM_LOOKUP,
  },
  slabs: {
    where: { lssIsDeleted: false },
    orderBy: [{ lssExceeds: 'asc' }, { lssSlno: 'asc' }, { lssId: 'asc' }],
    include: SLAB_LOOKUP,
  },
  gifts: {
    where: { lsgIsDeleted: false },
    orderBy: [{ lsgRedeemPoints: 'asc' }, { lsgSlno: 'asc' }, { lsgId: 'asc' }],
    include: GIFT_LOOKUP,
  },
} satisfies Prisma.LoyaltySchemeInclude;

/**
 * The five grids as GET /list wants them: live rows only.
 *
 * Stricter than the include /get uses, which drops deleted rows but keeps
 * deactivated ones so a grid can still show — and let the operator switch back
 * on — a row somebody turned off. /list makes the same promise about the child
 * rows that it makes about the header.
 */
const LIVE_CHILDREN_INCLUDE = {
  branches: {
    where: { lsbIsDeleted: false, lsbIsActive: true },
    orderBy: [{ lsbSlno: 'asc' }, { lsbId: 'asc' }],
    include: BRANCH_LOOKUP,
  },
  parties: {
    where: { lspIsDeleted: false, lspIsActive: true },
    orderBy: [{ lspSlno: 'asc' }, { lspId: 'asc' }],
    include: PARTY_LOOKUP,
  },
  items: {
    where: { lsiIsDeleted: false, lsiIsActive: true },
    orderBy: [{ lsiSlno: 'asc' }, { lsiId: 'asc' }],
    include: ITEM_LOOKUP,
  },
  slabs: {
    where: { lssIsDeleted: false, lssIsActive: true },
    orderBy: [{ lssExceeds: 'asc' }, { lssSlno: 'asc' }, { lssId: 'asc' }],
    include: SLAB_LOOKUP,
  },
  gifts: {
    where: { lsgIsDeleted: false, lsgIsActive: true },
    orderBy: [{ lsgRedeemPoints: 'asc' }, { lsgSlno: 'asc' }, { lsgId: 'asc' }],
    include: GIFT_LOOKUP,
  },
} satisfies Prisma.LoyaltySchemeInclude;

const EMPTY_CHILDREN = {
  branches: [] as BranchRow[],
  parties: [] as PartyRow[],
  items: [] as ItemRow[],
  slabs: [] as SlabRow[],
  gifts: [] as GiftRow[],
};

@Injectable()
export class PromotionLoyaltyPointsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly auditLogService: AuditLogService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // ─── §1 the header ──────────────────────────────────────────────────────────

  async saveScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    return dto.lsc_id ? this.updateScheme(dto) : this.createScheme(dto);
  }

  /**
   * Every live campaign, each one WHOLE — the header plus its branches,
   * parties, items, slabs and gifts, the same graph GET /get answers with for a
   * single scheme.
   *
   * Both parameters are optional narrowings, applied only when sent. Two
   * filters are NOT parameters and cannot be turned off — is_deleted = false and
   * is_active = true — and they are applied to the child rows as well as to the
   * header, so a deactivated band cannot ride into a response on the back of a
   * live scheme.
   */
  async listSchemes(query: ListLoyaltySchemeQueryDto): Promise<LoyaltySchemePayload[]> {
    const schemes = await this.prisma.loyaltyScheme.findMany({
      where: {
        ...(query.lsc_comp_id ? { lscCompId: query.lsc_comp_id } : {}),
        ...(query.lsc_branch_id ? { lscBranchId: query.lsc_branch_id } : {}),
        lscIsDeleted: false,
        lscIsActive: true,
      },
      orderBy: [{ lscCode: 'asc' }, { lscId: 'asc' }],
      include: { ...SCHEME_LOOKUP, ...LIVE_CHILDREN_INCLUDE },
    });

    return schemes.map(toSchemePayload);
  }

  async getSchemeById(lscId: string): Promise<LoyaltySchemePayload> {
    const scheme = await this.findSchemeWithChildren(this.prisma, lscId);
    if (!scheme) {
      this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
    }
    return toSchemePayload(scheme);
  }

  /**
   * The other direction: not "who does this scheme cover" but "does THIS
   * customer earn on it". The question the till asks, one scheme at a time.
   *
   * A customer can be hit by two rows at once — by name and by their group. The
   * winner is the highest lsp_match_priority (CUSTOMER 2, CUSTOMER_GROUP 1), and
   * at equal priority an EXCLUDE beats an INCLUDE. No row touching them means
   * NOT eligible, because the scheme said lsc_cust_scope = 'LIST'.
   */
  async checkEligibility(lscId: string, cusId: string): Promise<LoyaltySchemeEligibilityPayload> {
    const scheme = await this.requireScheme(this.prisma, lscId);

    if (scheme.lscCustScope !== 'LIST') {
      return {
        lsc_id: lscId,
        cus_id: cusId,
        qualifies: true,
        decided_by: 'ALL',
        matched_by: null,
        matched_row_id: null,
        match_priority: null,
        is_exclude: null,
        reason: `YES — lsc_cust_scope is ${scheme.lscCustScope}, the scheme covers every customer`,
      };
    }

    const customer = await this.prisma.customer.findFirst({
      where: { cusId, cusIsDeleted: false },
      select: { cusId: true, cusGroupId: true },
    });
    if (!customer) {
      this.throwNotFound('cus_id', cusId, 'Customer not found');
    }

    // Every branch of the OR must be a non-null id. `{ lspCustGroupId: null }`
    // would not mean "this customer has no group", it would match every row that
    // is not a group rule.
    const scopeMatches: Prisma.LoyaltySchemePartyWhereInput[] = [{ lspCustId: customer.cusId }];
    if (customer.cusGroupId) {
      scopeMatches.push({ lspCustGroupId: customer.cusGroupId });
    }

    const decider = await this.prisma.loyaltySchemeParty.findFirst({
      where: {
        lspLscId: lscId,
        lspIsDeleted: false,
        lspIsActive: true,
        OR: scopeMatches,
      },
      // The second key is the tie-break that makes an EXCLUDE win against an
      // INCLUDE of equal specificity.
      orderBy: [{ lspMatchPriority: 'desc' }, { lspIsExclude: 'desc' }],
    });

    if (!decider) {
      return {
        lsc_id: lscId,
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
      lsc_id: lscId,
      cus_id: cusId,
      qualifies: !decider.lspIsExclude,
      decided_by: 'RULE',
      matched_by: decider.lspKind,
      matched_row_id: decider.lspId,
      match_priority: decider.lspMatchPriority,
      is_exclude: decider.lspIsExclude,
      reason: decider.lspIsExclude
        ? `NO — carved out by the ${decider.lspKind} rule`
        : `YES — via ${decider.lspKind}`,
    };
  }

  /**
   * Soft delete, and take the five child sets down with it in the same
   * transaction. A live child under a dead header is the state that makes a
   * campaign reappear at a till after head office withdrew it.
   */
  async softDeleteScheme(lscId: string, modifiedBy?: string): Promise<LoyaltySchemeDeleteResult> {
    return this.prisma.$transaction(async (tx) => {
      const existing = await this.findSchemeWithChildren(tx, lscId);
      if (!existing) {
        this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
      }

      const modifiedOn = new Date();
      const actor = this.resolveWriteActor(modifiedBy);

      const updated = await tx.loyaltyScheme.update({
        where: { lscId },
        data: {
          lscIsDeleted: true,
          lscIsActive: false,
          lscModifiedOn: modifiedOn,
          lscModifiedBy: actor,
        },
      });

      await Promise.all([
        tx.loyaltySchemeBranch.updateMany({
          where: { lsbLscId: lscId, lsbIsDeleted: false },
          data: {
            lsbIsDeleted: true,
            lsbIsActive: false,
            lsbModifiedOn: modifiedOn,
            lsbModifiedBy: actor,
          },
        }),
        tx.loyaltySchemeParty.updateMany({
          where: { lspLscId: lscId, lspIsDeleted: false },
          data: {
            lspIsDeleted: true,
            lspIsActive: false,
            lspModifiedOn: modifiedOn,
            lspModifiedBy: actor,
          },
        }),
        tx.loyaltySchemeItem.updateMany({
          where: { lsiLscId: lscId, lsiIsDeleted: false },
          data: {
            lsiIsDeleted: true,
            lsiIsActive: false,
            lsiModifiedOn: modifiedOn,
            lsiModifiedBy: actor,
          },
        }),
        tx.loyaltySchemeSlab.updateMany({
          where: { lssLscId: lscId, lssIsDeleted: false },
          data: {
            lssIsDeleted: true,
            lssIsActive: false,
            lssModifiedOn: modifiedOn,
            lssModifiedBy: actor,
          },
        }),
        tx.loyaltySchemeGift.updateMany({
          where: { lsgLscId: lscId, lsgIsDeleted: false },
          data: {
            lsgIsDeleted: true,
            lsgIsActive: false,
            lsgModifiedOn: modifiedOn,
            lsgModifiedBy: actor,
          },
        }),
      ]);

      await this.audit(
        tx,
        'cancel',
        SCHEME_TABLE_NAME,
        lscId,
        existing.lscName,
        toSchemePayload(existing),
        toSchemePayload({ ...updated, ...EMPTY_CHILDREN }),
        'Loyalty scheme soft deleted with all scope, slab and gift rows',
      );

      return { deleted: true as const, lsc_id: lscId };
    });
  }

  private async createScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    const actor = this.resolveWriteActor(dto.lsc_created_by);

    const data: Prisma.LoyaltySchemeUncheckedCreateInput = {
      lscCompId: requireUuid(dto.lsc_comp_id, 'lsc_comp_id'),
      lscCode: requireString(dto.lsc_code, 'lsc_code'),
      lscName: requireString(dto.lsc_name, 'lsc_name'),
      lscStartDate: parseDateOnly(dto.lsc_start_date, 'lsc_start_date'),
      lscEndDate: parseDateOnly(dto.lsc_end_date, 'lsc_end_date'),
      lscCreatedBy: actor,
    };
    this.applySchemeFields(data, dto);

    const effective = this.effectiveScheme(null, data);
    this.assertSchemeInvariants(effective);
    await this.assertCodeIsFree(this.prisma, data.lscCompId, effective.lscCode, null);
    await this.assertPrimaryIsFree(this.prisma, data, effective, null);

    return this.prisma
      .$transaction(async (tx) => {
        const row = await tx.loyaltyScheme.create({ data });
        await this.audit(
          tx,
          'insert',
          SCHEME_TABLE_NAME,
          row.lscId,
          row.lscName,
          null,
          toSchemePayload({ ...row, ...EMPTY_CHILDREN }),
          'Loyalty scheme created',
        );
        // The grids audit themselves row by row as they are written, so the log
        // stays chronological: header first, then each line it carried.
        await this.syncChildren(tx, row, dto);
        const after = await this.findSchemeWithChildren(tx, row.lscId);
        return toSchemePayload(after ?? { ...row, ...EMPTY_CHILDREN });
      })
      .catch((error: unknown) => {
        handleLoyaltyWriteError(error);
        throw error;
      });
  }

  private async updateScheme(dto: SaveLoyaltySchemeDto): Promise<LoyaltySchemePayload> {
    const lscId = requireUuid(dto.lsc_id, 'lsc_id');

    return this.prisma
      .$transaction(async (tx) => {
        const existing = await this.findSchemeWithChildren(tx, lscId);
        if (!existing) {
          this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
        }

        const data: Prisma.LoyaltySchemeUncheckedUpdateInput = {
          lscModifiedOn: new Date(),
          lscModifiedBy: this.resolveWriteActor(dto.lsc_modified_by),
        };
        if (hasOwnProperty(dto, 'lsc_comp_id')) {
          data.lscCompId = requireUuid(dto.lsc_comp_id, 'lsc_comp_id');
        }
        if (hasOwnProperty(dto, 'lsc_code')) {
          data.lscCode = requireString(dto.lsc_code, 'lsc_code');
        }
        if (hasOwnProperty(dto, 'lsc_name')) {
          data.lscName = requireString(dto.lsc_name, 'lsc_name');
        }
        if (hasOwnProperty(dto, 'lsc_start_date')) {
          data.lscStartDate = parseDateOnly(dto.lsc_start_date, 'lsc_start_date');
        }
        if (hasOwnProperty(dto, 'lsc_end_date')) {
          data.lscEndDate = parseDateOnly(dto.lsc_end_date, 'lsc_end_date');
        }
        this.applySchemeFields(data, dto);

        const effective = this.effectiveScheme(existing, data);
        this.assertSchemeInvariants(effective);

        const compId = (data.lscCompId as string | undefined) ?? existing.lscCompId;
        await this.assertCodeIsFree(tx, compId, effective.lscCode, lscId);
        await this.assertPrimaryIsFree(tx, { ...existing, ...data }, effective, lscId);

        const updated = await tx.loyaltyScheme.update({ where: { lscId }, data });
        await this.syncChildren(tx, updated, dto);
        const after = await this.findSchemeWithChildren(tx, lscId);

        await this.audit(
          tx,
          'update',
          SCHEME_TABLE_NAME,
          lscId,
          updated.lscName,
          toSchemePayload(existing),
          after ? toSchemePayload(after) : null,
          'Loyalty scheme updated',
        );

        return after ? toSchemePayload(after) : toSchemePayload({ ...updated, ...EMPTY_CHILDREN });
      })
      .catch((error: unknown) => {
        handleLoyaltyWriteError(error);
        throw error;
      });
  }

  /** Only the keys actually present in the body are written. */
  private applySchemeFields(
    data: Prisma.LoyaltySchemeUncheckedCreateInput | Prisma.LoyaltySchemeUncheckedUpdateInput,
    dto: SaveLoyaltySchemeDto,
  ): void {
    if (hasOwnProperty(dto, 'lsc_branch_id')) data.lscBranchId = dto.lsc_branch_id ?? null;
    if (hasOwnProperty(dto, 'lsc_tenant_id')) data.lscTenantId = dto.lsc_tenant_id ?? null;
    if (hasOwnProperty(dto, 'lsc_type')) data.lscType = normalizeEnum(dto.lsc_type);
    if (hasOwnProperty(dto, 'lsc_status')) data.lscStatus = normalizeEnum(dto.lsc_status);
    if (hasOwnProperty(dto, 'lsc_priority')) data.lscPriority = dto.lsc_priority as number;
    if (hasOwnProperty(dto, 'lsc_auto_apply')) data.lscAutoApply = dto.lsc_auto_apply ?? true;

    if (hasOwnProperty(dto, 'lsc_apply_on')) data.lscApplyOn = normalizeEnum(dto.lsc_apply_on);
    if (hasOwnProperty(dto, 'lsc_calc_on_amount_type')) {
      data.lscCalcOnAmountType = normalizeEnum(dto.lsc_calc_on_amount_type);
    }
    if (hasOwnProperty(dto, 'lsc_include_tax')) data.lscIncludeTax = dto.lsc_include_tax ?? false;
    if (hasOwnProperty(dto, 'lsc_bill_type')) data.lscBillType = normalizeEnum(dto.lsc_bill_type);
    if (hasOwnProperty(dto, 'lsc_min_bill_amount')) {
      data.lscMinBillAmount = dto.lsc_min_bill_amount as number;
    }
    if (hasOwnProperty(dto, 'lsc_max_earn_points')) {
      data.lscMaxEarnPoints = dto.lsc_max_earn_points as number;
    }
    if (hasOwnProperty(dto, 'lsc_earn_on_discounted')) {
      data.lscEarnOnDiscounted = dto.lsc_earn_on_discounted ?? true;
    }
    if (hasOwnProperty(dto, 'lsc_earn_on_charges')) {
      data.lscEarnOnCharges = dto.lsc_earn_on_charges ?? false;
    }
    if (hasOwnProperty(dto, 'lsc_earn_with_redeem')) {
      data.lscEarnWithRedeem = dto.lsc_earn_with_redeem ?? false;
    }
    if (hasOwnProperty(dto, 'lsc_rounding_method')) {
      data.lscRoundingMethod = normalizeEnum(dto.lsc_rounding_method);
    }
    if (hasOwnProperty(dto, 'lsc_points_decimals')) {
      data.lscPointsDecimals = dto.lsc_points_decimals as number;
    }

    if (hasOwnProperty(dto, 'lsc_branch_scope')) {
      data.lscBranchScope = normalizeEnum(dto.lsc_branch_scope);
    }
    if (hasOwnProperty(dto, 'lsc_cust_scope')) {
      data.lscCustScope = normalizeEnum(dto.lsc_cust_scope);
    }
    if (hasOwnProperty(dto, 'lsc_item_scope')) {
      data.lscItemScope = normalizeEnum(dto.lsc_item_scope);
    }
    if (hasOwnProperty(dto, 'lsc_price_level_id')) {
      data.lscPriceLevelId = dto.lsc_price_level_id ?? null;
    }

    if (hasOwnProperty(dto, 'lsc_pool_mode')) data.lscPoolMode = normalizeEnum(dto.lsc_pool_mode);
    if (hasOwnProperty(dto, 'lsc_allow_cross_branch_redeem')) {
      data.lscAllowCrossBranchRedeem = dto.lsc_allow_cross_branch_redeem ?? true;
    }

    if (hasOwnProperty(dto, 'lsc_allow_point_redeem')) {
      data.lscAllowPointRedeem = dto.lsc_allow_point_redeem ?? false;
    }
    if (hasOwnProperty(dto, 'lsc_allow_gift_redeem')) {
      data.lscAllowGiftRedeem = dto.lsc_allow_gift_redeem ?? false;
    }
    if (hasOwnProperty(dto, 'lsc_redeem_tender_id')) {
      data.lscRedeemTenderId = dto.lsc_redeem_tender_id ?? null;
    }
    if (hasOwnProperty(dto, 'lsc_redeem_value_per_point')) {
      data.lscRedeemValuePerPoint = dto.lsc_redeem_value_per_point as number;
    }
    if (hasOwnProperty(dto, 'lsc_min_redeem_points')) {
      data.lscMinRedeemPoints = dto.lsc_min_redeem_points as number;
    }
    if (hasOwnProperty(dto, 'lsc_max_redeem_points')) {
      data.lscMaxRedeemPoints = dto.lsc_max_redeem_points as number;
    }
    if (hasOwnProperty(dto, 'lsc_max_redeem_perc')) {
      data.lscMaxRedeemPerc = dto.lsc_max_redeem_perc as number;
    }
    if (hasOwnProperty(dto, 'lsc_redeem_min_bill_amount')) {
      data.lscRedeemMinBillAmount = dto.lsc_redeem_min_bill_amount as number;
    }
    if (hasOwnProperty(dto, 'lsc_redeem_multiple')) {
      data.lscRedeemMultiple = dto.lsc_redeem_multiple as number;
    }

    if (hasOwnProperty(dto, 'lsc_expiry_basis')) {
      data.lscExpiryBasis = normalizeEnum(dto.lsc_expiry_basis);
    }
    if (hasOwnProperty(dto, 'lsc_points_valid_days')) {
      data.lscPointsValidDays = dto.lsc_points_valid_days as number;
    }
    if (hasOwnProperty(dto, 'lsc_activation_days')) {
      data.lscActivationDays = dto.lsc_activation_days as number;
    }
    if (hasOwnProperty(dto, 'lsc_return_mode')) {
      data.lscReturnMode = normalizeEnum(dto.lsc_return_mode);
    }

    if (hasOwnProperty(dto, 'lsc_valid_from_time')) {
      data.lscValidFromTime = dto.lsc_valid_from_time
        ? parseTimeToUtcDate(dto.lsc_valid_from_time, 'lsc_valid_from_time')
        : null;
    }
    if (hasOwnProperty(dto, 'lsc_valid_to_time')) {
      data.lscValidToTime = dto.lsc_valid_to_time
        ? parseTimeToUtcDate(dto.lsc_valid_to_time, 'lsc_valid_to_time')
        : null;
    }
    if (hasOwnProperty(dto, 'lsc_valid_weekdays')) {
      const weekdays = normalizeNullableString(dto.lsc_valid_weekdays);
      data.lscValidWeekdays = weekdays ? weekdays.toUpperCase() : null;
    }
    if (hasOwnProperty(dto, 'lsc_remarks')) {
      data.lscRemarks = normalizeNullableString(dto.lsc_remarks);
    }
    if (hasOwnProperty(dto, 'lsc_is_active')) data.lscIsActive = dto.lsc_is_active ?? true;
    if (hasOwnProperty(dto, 'lsc_approved_on')) {
      const value = normalizeNullableString(dto.lsc_approved_on);
      if (value === null) {
        data.lscApprovedOn = null;
      } else {
        const parsed = new Date(value);
        if (Number.isNaN(parsed.getTime())) {
          this.throwBadRequest('Validation failed', [
            { field: 'lsc_approved_on', message: 'lsc_approved_on must be a valid datetime' },
          ]);
        }
        data.lscApprovedOn = parsed;
      }
    }
    if (hasOwnProperty(dto, 'lsc_approved_by')) {
      data.lscApprovedBy = resolveActorUuid(dto.lsc_approved_by);
    }
  }

  /** Existing row overlaid with whatever this request writes. */
  private effectiveScheme(
    existing: LoyaltyScheme | null,
    data: Prisma.LoyaltySchemeUncheckedCreateInput | Prisma.LoyaltySchemeUncheckedUpdateInput,
  ): EffectiveScheme {
    const pick = <T>(key: string, fallback: T): T => {
      const value = (data as Record<string, unknown>)[key];
      return value === undefined ? fallback : (value as T);
    };

    return {
      lscCode: pick('lscCode', existing?.lscCode ?? ''),
      lscType: pick('lscType', existing?.lscType ?? 'BOTH'),
      lscStatus: pick('lscStatus', existing?.lscStatus ?? 'DRAFT'),
      lscApplyOn: pick('lscApplyOn', existing?.lscApplyOn ?? 'BILL_AMOUNT'),
      lscCalcOnAmountType: pick(
        'lscCalcOnAmountType',
        existing?.lscCalcOnAmountType ?? 'NET_AMOUNT',
      ),
      lscBillType: pick('lscBillType', existing?.lscBillType ?? 'ALL'),
      lscRoundingMethod: pick('lscRoundingMethod', existing?.lscRoundingMethod ?? 'FLOOR'),
      lscBranchScope: pick('lscBranchScope', existing?.lscBranchScope ?? 'ALL'),
      lscCustScope: pick('lscCustScope', existing?.lscCustScope ?? 'ALL'),
      lscItemScope: pick('lscItemScope', existing?.lscItemScope ?? 'ALL'),
      lscPoolMode: pick('lscPoolMode', existing?.lscPoolMode ?? 'COMPANY'),
      lscReturnMode: pick('lscReturnMode', existing?.lscReturnMode ?? 'REVERSE'),
      lscExpiryBasis: pick('lscExpiryBasis', existing?.lscExpiryBasis ?? 'EARN_DATE'),
      lscPriority: pick('lscPriority', existing?.lscPriority ?? 1),
      lscPointsDecimals: pick('lscPointsDecimals', existing?.lscPointsDecimals ?? 2),
      lscActivationDays: pick('lscActivationDays', existing?.lscActivationDays ?? 0),
      lscPointsValidDays: pick('lscPointsValidDays', existing?.lscPointsValidDays ?? 0),
      lscMinBillAmount: pick('lscMinBillAmount', toNumber(existing?.lscMinBillAmount ?? 0)),
      lscMaxEarnPoints: pick('lscMaxEarnPoints', toNumber(existing?.lscMaxEarnPoints ?? 0)),
      lscAllowPointRedeem: pick('lscAllowPointRedeem', existing?.lscAllowPointRedeem ?? false),
      lscRedeemValuePerPoint: pick(
        'lscRedeemValuePerPoint',
        toNumber(existing?.lscRedeemValuePerPoint ?? 0),
      ),
      lscMinRedeemPoints: pick('lscMinRedeemPoints', toNumber(existing?.lscMinRedeemPoints ?? 0)),
      lscMaxRedeemPoints: pick('lscMaxRedeemPoints', toNumber(existing?.lscMaxRedeemPoints ?? 0)),
      lscMaxRedeemPerc: pick('lscMaxRedeemPerc', toNumber(existing?.lscMaxRedeemPerc ?? 100)),
      lscRedeemMinBillAmount: pick(
        'lscRedeemMinBillAmount',
        toNumber(existing?.lscRedeemMinBillAmount ?? 0),
      ),
      lscRedeemMultiple: pick('lscRedeemMultiple', toNumber(existing?.lscRedeemMultiple ?? 0)),
      lscStartDate: pick('lscStartDate', existing?.lscStartDate ?? new Date(0)),
      lscEndDate: pick('lscEndDate', existing?.lscEndDate ?? new Date(0)),
      lscValidFromTime: pick('lscValidFromTime', existing?.lscValidFromTime ?? null),
      lscValidToTime: pick('lscValidToTime', existing?.lscValidToTime ?? null),
      lscValidWeekdays: pick('lscValidWeekdays', existing?.lscValidWeekdays ?? null),
      lscApprovedBy: pick('lscApprovedBy', existing?.lscApprovedBy ?? null),
    };
  }

  /**
   * Every CHECK the table carries, run first — see
   * utils/loyalty-scheme-invariants.ts, where each one is a named function.
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
   * ux_lsc_code is a PARTIAL unique index, so Prisma neither declares nor
   * necessarily creates it — check here rather than hoping for a P2002.
   */
  private async assertCodeIsFree(
    client: WriteClient,
    compId: string,
    code: string,
    ignoreLscId: string | null,
  ): Promise<void> {
    const clash = await client.loyaltyScheme.findFirst({
      where: {
        lscCompId: compId,
        lscIsDeleted: false,
        lscCode: { equals: code, mode: 'insensitive' },
        ...(ignoreLscId ? { lscId: { not: ignoreLscId } } : {}),
      },
      select: { lscId: true },
    });
    if (clash) {
      this.throwConflict('Duplicate loyalty scheme code', [
        { field: 'lsc_code', message: `lsc_code ${code} already exists for this company` },
      ]);
    }
  }

  /**
   * ux_lsc_primary — one APPROVED, active, priority-1 scheme per company /
   * branch / type. Also a partial index Prisma cannot see, and the tie it
   * prevents is the one the resolver cannot break: two primaries on the same
   * bill and whichever the till reads first wins.
   */
  private async assertPrimaryIsFree(
    client: WriteClient,
    data: { lscCompId?: unknown; lscBranchId?: unknown; lscIsActive?: unknown },
    effective: EffectiveScheme,
    ignoreLscId: string | null,
  ): Promise<void> {
    // The index is partial on all four: a scheme written inactive, or not yet
    // approved, or at a lower priority, cannot clash — and must not be blocked.
    // lscIsActive is not part of EffectiveScheme, so it is read off the merged
    // row, where it defaults true exactly as the column does.
    const isActive = data.lscIsActive === undefined ? true : Boolean(data.lscIsActive);
    if (effective.lscPriority !== 1 || effective.lscStatus !== 'APPROVED' || !isActive) {
      return;
    }

    const compId = data.lscCompId as string | undefined;
    if (!compId) {
      return;
    }
    const branchId = (data.lscBranchId as string | null | undefined) ?? null;

    const clash = await client.loyaltyScheme.findFirst({
      where: {
        lscCompId: compId,
        lscBranchId: branchId,
        lscType: effective.lscType,
        lscPriority: 1,
        lscStatus: 'APPROVED',
        lscIsActive: true,
        lscIsDeleted: false,
        ...(ignoreLscId ? { lscId: { not: ignoreLscId } } : {}),
      },
      select: { lscId: true, lscCode: true },
    });
    if (clash) {
      this.throwConflict('Conflicting primary loyalty scheme', [
        {
          field: 'lsc_priority',
          message:
            `Scheme ${clash.lscCode} is already the approved primary (priority 1) ` +
            `${effective.lscType} scheme for this company and branch. Lower this scheme's ` +
            'priority, or retire that one.',
        },
      ]);
    }
  }

  // ─── §2 branch rows ─────────────────────────────────────────────────────────

  private async saveBranchRow(
    tx: Prisma.TransactionClient,
    lscId: string,
    row: LoyaltySchemeBranchRowDto,
    index: number,
  ): Promise<BranchRow> {
    const slno = row.lsb_slno ?? index + 1;
    requireInteger(slno, 'lsb_slno', 1);
    this.assertBranchInvariants({ lsbSlno: slno });

    if (row.lsb_id) {
      const existing = await tx.loyaltySchemeBranch.findFirst({
        where: { lsbId: row.lsb_id, lsbLscId: lscId, lsbIsDeleted: false },
      });
      if (!existing) {
        this.throwNotFound('lsb_id', row.lsb_id, 'Loyalty scheme branch row not found');
      }
      const data: Prisma.LoyaltySchemeBranchUncheckedUpdateInput = {
        lsbModifiedOn: new Date(),
        lsbModifiedBy: this.resolveWriteActor(row.lsb_modified_by),
      };
      if (hasOwnProperty(row, 'lsb_slno')) data.lsbSlno = slno;
      if (hasOwnProperty(row, 'lsb_branch_id')) {
        data.lsbBranchId = requireUuid(row.lsb_branch_id, 'lsb_branch_id');
      }
      if (hasOwnProperty(row, 'lsb_is_exclude')) data.lsbIsExclude = row.lsb_is_exclude ?? false;
      if (hasOwnProperty(row, 'lsb_notes')) data.lsbNotes = normalizeNullableString(row.lsb_notes);
      if (hasOwnProperty(row, 'lsb_is_active')) data.lsbIsActive = row.lsb_is_active ?? true;

      const updated = await tx.loyaltySchemeBranch.update({
        where: { lsbId: row.lsb_id },
        data,
        include: BRANCH_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        BRANCH_TABLE_NAME,
        updated.lsbId,
        `Scheme ${lscId} / Branch ${updated.lsbSlno}`,
        toBranchPayload(existing),
        toBranchPayload(updated),
        'Loyalty scheme branch row updated',
      );
      return updated;
    }

    const created = await tx.loyaltySchemeBranch.create({
      data: {
        lsbLscId: lscId,
        lsbSlno: slno,
        lsbBranchId: requireUuid(row.lsb_branch_id, 'lsb_branch_id'),
        lsbIsExclude: row.lsb_is_exclude ?? false,
        lsbNotes: normalizeNullableString(row.lsb_notes),
        lsbIsActive: row.lsb_is_active ?? true,
        lsbCreatedBy: this.resolveWriteActor(row.lsb_created_by),
      },
      include: BRANCH_LOOKUP,
    });
    await this.audit(
      tx,
      'insert',
      BRANCH_TABLE_NAME,
      created.lsbId,
      `Scheme ${lscId} / Branch ${created.lsbSlno}`,
      null,
      toBranchPayload(created),
      'Loyalty scheme branch row created',
    );
    return created;
  }

  // ─── §3 party rows ──────────────────────────────────────────────────────────

  private async savePartyRow(
    tx: Prisma.TransactionClient,
    lscId: string,
    row: LoyaltySchemePartyRowDto,
    index: number,
  ): Promise<PartyRow> {
    const existing = row.lsp_id
      ? await tx.loyaltySchemeParty.findFirst({
          where: { lspId: row.lsp_id, lspLscId: lscId, lspIsDeleted: false },
        })
      : null;
    if (row.lsp_id && !existing) {
      this.throwNotFound('lsp_id', row.lsp_id, 'Loyalty scheme party row not found');
    }

    // The row as it will stand once this write lands — the stored values
    // overlaid with whatever the caller sent — which is what the constraints are
    // actually about.
    const slno = row.lsp_slno ?? existing?.lspSlno ?? index + 1;
    const kind = hasOwnProperty(row, 'lsp_kind')
      ? normalizeEnum(row.lsp_kind)
      : (existing?.lspKind ?? normalizeEnum(row.lsp_kind));
    const matchPriority = hasOwnProperty(row, 'lsp_match_priority')
      ? (row.lsp_match_priority as number)
      : (existing?.lspMatchPriority ?? LSP_DEFAULT_MATCH_PRIORITY[kind] ?? 1);

    this.assertPartyInvariants({
      lspSlno: slno,
      lspKind: kind,
      lspMatchPriority: matchPriority,
    });

    if (existing) {
      const data: Prisma.LoyaltySchemePartyUncheckedUpdateInput = {
        lspModifiedOn: new Date(),
        lspModifiedBy: this.resolveWriteActor(row.lsp_modified_by),
      };
      if (hasOwnProperty(row, 'lsp_slno')) data.lspSlno = slno;
      if (hasOwnProperty(row, 'lsp_kind')) data.lspKind = kind;
      if (hasOwnProperty(row, 'lsp_scope_id')) {
        data.lspScopeId = requireUuid(row.lsp_scope_id, 'lsp_scope_id');
      }
      if (hasOwnProperty(row, 'lsp_is_exclude')) data.lspIsExclude = row.lsp_is_exclude ?? false;
      if (hasOwnProperty(row, 'lsp_match_priority')) data.lspMatchPriority = matchPriority;
      if (hasOwnProperty(row, 'lsp_notes')) data.lspNotes = normalizeNullableString(row.lsp_notes);
      if (hasOwnProperty(row, 'lsp_is_active')) data.lspIsActive = row.lsp_is_active ?? true;

      const updated = await tx.loyaltySchemeParty.update({
        where: { lspId: existing.lspId },
        data,
        include: PARTY_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        PARTY_TABLE_NAME,
        updated.lspId,
        `Scheme ${lscId} / ${updated.lspKind} ${updated.lspScopeId}`,
        toPartyPayload(existing),
        toPartyPayload(updated),
        'Loyalty scheme party row updated',
      );
      return updated;
    }

    const created = await tx.loyaltySchemeParty.create({
      data: {
        lspLscId: lscId,
        lspSlno: slno,
        lspKind: kind,
        lspScopeId: requireUuid(row.lsp_scope_id, 'lsp_scope_id'),
        lspIsExclude: row.lsp_is_exclude ?? false,
        lspMatchPriority: matchPriority,
        lspNotes: normalizeNullableString(row.lsp_notes),
        lspIsActive: row.lsp_is_active ?? true,
        lspCreatedBy: this.resolveWriteActor(row.lsp_created_by),
      },
      include: PARTY_LOOKUP,
    });
    await this.audit(
      tx,
      'insert',
      PARTY_TABLE_NAME,
      created.lspId,
      `Scheme ${lscId} / ${created.lspKind} ${created.lspScopeId}`,
      null,
      toPartyPayload(created),
      'Loyalty scheme party row created',
    );
    return created;
  }

  // ─── §4 item rows ───────────────────────────────────────────────────────────

  private async saveItemRow(
    tx: Prisma.TransactionClient,
    lscId: string,
    row: LoyaltySchemeItemRowDto,
    index: number,
  ): Promise<ItemRow> {
    const existing = row.lsi_id
      ? await tx.loyaltySchemeItem.findFirst({
          where: { lsiId: row.lsi_id, lsiLscId: lscId, lsiIsDeleted: false },
        })
      : null;
    if (row.lsi_id && !existing) {
      this.throwNotFound('lsi_id', row.lsi_id, 'Loyalty scheme item row not found');
    }

    const slno = row.lsi_slno ?? existing?.lsiSlno ?? index + 1;
    const kind = hasOwnProperty(row, 'lsi_kind')
      ? normalizeEnum(row.lsi_kind)
      : (existing?.lsiKind ?? normalizeEnum(row.lsi_kind));

    const factor = this.pickNumber(row, 'lsi_factor', existing?.lsiFactor, 1);
    const points = this.pickNumber(row, 'lsi_points', existing?.lsiPoints, 0);
    const maxPoints = this.pickNumber(row, 'lsi_max_points', existing?.lsiMaxPoints, 0);
    const isExclude = hasOwnProperty(row, 'lsi_is_exclude')
      ? (row.lsi_is_exclude ?? false)
      : (existing?.lsiIsExclude ?? false);
    const matchPriority = hasOwnProperty(row, 'lsi_match_priority')
      ? (row.lsi_match_priority as number)
      : (existing?.lsiMatchPriority ?? LSI_DEFAULT_MATCH_PRIORITY[kind] ?? 1);

    this.assertItemInvariants({
      lsiSlno: slno,
      lsiKind: kind,
      lsiIsExclude: isExclude,
      lsiFactor: factor,
      lsiPoints: points,
      lsiMaxPoints: maxPoints,
      lsiMatchPriority: matchPriority,
    });

    if (existing) {
      const data: Prisma.LoyaltySchemeItemUncheckedUpdateInput = {
        lsiModifiedOn: new Date(),
        lsiModifiedBy: this.resolveWriteActor(row.lsi_modified_by),
      };
      if (hasOwnProperty(row, 'lsi_slno')) data.lsiSlno = slno;
      if (hasOwnProperty(row, 'lsi_kind')) data.lsiKind = kind;
      if (hasOwnProperty(row, 'lsi_scope_id')) {
        data.lsiScopeId = requireUuid(row.lsi_scope_id, 'lsi_scope_id');
      }
      if (hasOwnProperty(row, 'lsi_is_exclude')) data.lsiIsExclude = isExclude;
      if (hasOwnProperty(row, 'lsi_factor')) data.lsiFactor = factor;
      if (hasOwnProperty(row, 'lsi_points')) data.lsiPoints = points;
      if (hasOwnProperty(row, 'lsi_max_points')) data.lsiMaxPoints = maxPoints;
      if (hasOwnProperty(row, 'lsi_match_priority')) data.lsiMatchPriority = matchPriority;
      if (hasOwnProperty(row, 'lsi_notes')) data.lsiNotes = normalizeNullableString(row.lsi_notes);
      if (hasOwnProperty(row, 'lsi_is_active')) data.lsiIsActive = row.lsi_is_active ?? true;

      const updated = await tx.loyaltySchemeItem.update({
        where: { lsiId: existing.lsiId },
        data,
        include: ITEM_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        ITEM_TABLE_NAME,
        updated.lsiId,
        `Scheme ${lscId} / ${updated.lsiKind} ${updated.lsiScopeId}`,
        toItemPayload(existing),
        toItemPayload(updated),
        'Loyalty scheme item row updated',
      );
      return updated;
    }

    const created = await tx.loyaltySchemeItem.create({
      data: {
        lsiLscId: lscId,
        lsiSlno: slno,
        lsiKind: kind,
        lsiScopeId: requireUuid(row.lsi_scope_id, 'lsi_scope_id'),
        lsiIsExclude: isExclude,
        lsiFactor: factor,
        lsiPoints: points,
        lsiMaxPoints: maxPoints,
        lsiMatchPriority: matchPriority,
        lsiNotes: normalizeNullableString(row.lsi_notes),
        lsiIsActive: row.lsi_is_active ?? true,
        lsiCreatedBy: this.resolveWriteActor(row.lsi_created_by),
      },
      include: ITEM_LOOKUP,
    });
    await this.audit(
      tx,
      'insert',
      ITEM_TABLE_NAME,
      created.lsiId,
      `Scheme ${lscId} / ${created.lsiKind} ${created.lsiScopeId}`,
      null,
      toItemPayload(created),
      'Loyalty scheme item row created',
    );
    return created;
  }

  // ─── §5 slab rows ───────────────────────────────────────────────────────────

  private async saveSlabRow(
    tx: Prisma.TransactionClient,
    lscId: string,
    row: LoyaltySchemeSlabRowDto,
    index: number,
  ): Promise<SlabRow> {
    const existing = row.lss_id
      ? await tx.loyaltySchemeSlab.findFirst({
          where: { lssId: row.lss_id, lssLscId: lscId, lssIsDeleted: false },
        })
      : null;
    if (row.lss_id && !existing) {
      this.throwNotFound('lss_id', row.lss_id, 'Loyalty scheme slab row not found');
    }

    const band: EffectiveSlabRow = {
      lssSlno: row.lss_slno ?? existing?.lssSlno ?? index + 1,
      lssExceeds: this.pickNumber(row, 'lss_exceeds', existing?.lssExceeds, 0),
      lssUpto: this.pickNullableNumber(row, 'lss_upto', existing?.lssUpto),
      lssEach: this.pickNumber(row, 'lss_each', existing?.lssEach, 1),
      lssPoints: this.pickNumber(row, 'lss_points', existing?.lssPoints, 0),
      lssFactor: this.pickNumber(row, 'lss_factor', existing?.lssFactor, 1),
      lssMaxPoints: this.pickNumber(row, 'lss_max_points', existing?.lssMaxPoints, 0),
    };
    this.assertSlabInvariants(band);

    if (existing) {
      const data: Prisma.LoyaltySchemeSlabUncheckedUpdateInput = {
        lssModifiedOn: new Date(),
        lssModifiedBy: this.resolveWriteActor(row.lss_modified_by),
      };
      if (hasOwnProperty(row, 'lss_slno')) data.lssSlno = band.lssSlno;
      if (hasOwnProperty(row, 'lss_item_id')) data.lssItemId = row.lss_item_id ?? null;
      if (hasOwnProperty(row, 'lss_unit_id')) data.lssUnitId = row.lss_unit_id ?? null;
      if (hasOwnProperty(row, 'lss_exceeds')) data.lssExceeds = band.lssExceeds;
      if (hasOwnProperty(row, 'lss_upto')) data.lssUpto = band.lssUpto;
      if (hasOwnProperty(row, 'lss_each')) data.lssEach = band.lssEach;
      if (hasOwnProperty(row, 'lss_points')) data.lssPoints = band.lssPoints;
      if (hasOwnProperty(row, 'lss_factor')) data.lssFactor = band.lssFactor;
      if (hasOwnProperty(row, 'lss_max_points')) data.lssMaxPoints = band.lssMaxPoints;
      if (hasOwnProperty(row, 'lss_notes')) data.lssNotes = normalizeNullableString(row.lss_notes);
      if (hasOwnProperty(row, 'lss_is_active')) data.lssIsActive = row.lss_is_active ?? true;

      const updated = await tx.loyaltySchemeSlab.update({
        where: { lssId: existing.lssId },
        data,
        include: SLAB_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        SLAB_TABLE_NAME,
        updated.lssId,
        `Scheme ${lscId} / Band ${updated.lssSlno}`,
        toSlabPayload(existing),
        toSlabPayload(updated),
        'Loyalty scheme slab row updated',
      );
      return updated;
    }

    const created = await tx.loyaltySchemeSlab.create({
      data: {
        lssLscId: lscId,
        lssSlno: band.lssSlno,
        lssItemId: row.lss_item_id ?? null,
        lssUnitId: row.lss_unit_id ?? null,
        lssExceeds: band.lssExceeds,
        lssUpto: band.lssUpto,
        lssEach: band.lssEach,
        lssPoints: band.lssPoints,
        lssFactor: band.lssFactor,
        lssMaxPoints: band.lssMaxPoints,
        lssNotes: normalizeNullableString(row.lss_notes),
        lssIsActive: row.lss_is_active ?? true,
        lssCreatedBy: this.resolveWriteActor(row.lss_created_by),
      },
      include: SLAB_LOOKUP,
    });
    await this.audit(
      tx,
      'insert',
      SLAB_TABLE_NAME,
      created.lssId,
      `Scheme ${lscId} / Band ${created.lssSlno}`,
      null,
      toSlabPayload(created),
      'Loyalty scheme slab row created',
    );
    return created;
  }

  // ─── §6 gift rows ───────────────────────────────────────────────────────────

  private async saveGiftRow(
    tx: Prisma.TransactionClient,
    lscId: string,
    row: LoyaltySchemeGiftRowDto,
    index: number,
  ): Promise<GiftRow> {
    const existing = row.lsg_id
      ? await tx.loyaltySchemeGift.findFirst({
          where: { lsgId: row.lsg_id, lsgLscId: lscId, lsgIsDeleted: false },
        })
      : null;
    if (row.lsg_id && !existing) {
      this.throwNotFound('lsg_id', row.lsg_id, 'Loyalty scheme gift row not found');
    }

    const validFrom = hasOwnProperty(row, 'lsg_valid_from')
      ? parseNullableDateOnly(row.lsg_valid_from, 'lsg_valid_from')
      : (existing?.lsgValidFrom ?? null);
    const validUpto = hasOwnProperty(row, 'lsg_valid_upto')
      ? parseNullableDateOnly(row.lsg_valid_upto, 'lsg_valid_upto')
      : (existing?.lsgValidUpto ?? null);

    const gift: EffectiveGiftRow = {
      lsgSlno: row.lsg_slno ?? existing?.lsgSlno ?? index + 1,
      lsgItemQty: this.pickNumber(row, 'lsg_item_qty', existing?.lsgItemQty, 1),
      lsgRedeemPoints: this.pickNumber(row, 'lsg_redeem_points', existing?.lsgRedeemPoints, 0),
      lsgMaxQtyPerBill: this.pickNumber(row, 'lsg_max_qty_per_bill', existing?.lsgMaxQtyPerBill, 0),
      lsgValidFrom: validFrom,
      lsgValidUpto: validUpto,
    };
    this.assertGiftInvariants(gift);

    if (existing) {
      const data: Prisma.LoyaltySchemeGiftUncheckedUpdateInput = {
        lsgModifiedOn: new Date(),
        lsgModifiedBy: this.resolveWriteActor(row.lsg_modified_by),
      };
      if (hasOwnProperty(row, 'lsg_slno')) data.lsgSlno = gift.lsgSlno;
      if (hasOwnProperty(row, 'lsg_item_id')) {
        data.lsgItemId = requireUuid(row.lsg_item_id, 'lsg_item_id');
      }
      if (hasOwnProperty(row, 'lsg_unit_id')) {
        data.lsgUnitId = requireUuid(row.lsg_unit_id, 'lsg_unit_id');
      }
      if (hasOwnProperty(row, 'lsg_item_qty')) data.lsgItemQty = gift.lsgItemQty;
      if (hasOwnProperty(row, 'lsg_redeem_points')) data.lsgRedeemPoints = gift.lsgRedeemPoints;
      if (hasOwnProperty(row, 'lsg_repeat')) data.lsgRepeat = row.lsg_repeat ?? false;
      if (hasOwnProperty(row, 'lsg_max_qty_per_bill')) {
        data.lsgMaxQtyPerBill = gift.lsgMaxQtyPerBill;
      }
      if (hasOwnProperty(row, 'lsg_stock_check')) data.lsgStockCheck = row.lsg_stock_check ?? true;
      if (hasOwnProperty(row, 'lsg_valid_from')) data.lsgValidFrom = validFrom;
      if (hasOwnProperty(row, 'lsg_valid_upto')) data.lsgValidUpto = validUpto;
      if (hasOwnProperty(row, 'lsg_notes')) data.lsgNotes = normalizeNullableString(row.lsg_notes);
      if (hasOwnProperty(row, 'lsg_is_active')) data.lsgIsActive = row.lsg_is_active ?? true;

      const updated = await tx.loyaltySchemeGift.update({
        where: { lsgId: existing.lsgId },
        data,
        include: GIFT_LOOKUP,
      });
      await this.audit(
        tx,
        'update',
        GIFT_TABLE_NAME,
        updated.lsgId,
        `Scheme ${lscId} / Gift ${updated.lsgSlno}`,
        toGiftPayload(existing),
        toGiftPayload(updated),
        'Loyalty scheme gift row updated',
      );
      return updated;
    }

    const created = await tx.loyaltySchemeGift.create({
      data: {
        lsgLscId: lscId,
        lsgSlno: gift.lsgSlno,
        lsgItemId: requireUuid(row.lsg_item_id, 'lsg_item_id'),
        lsgUnitId: requireUuid(row.lsg_unit_id, 'lsg_unit_id'),
        lsgItemQty: gift.lsgItemQty,
        lsgRedeemPoints: gift.lsgRedeemPoints,
        lsgRepeat: row.lsg_repeat ?? false,
        lsgMaxQtyPerBill: gift.lsgMaxQtyPerBill,
        lsgStockCheck: row.lsg_stock_check ?? true,
        lsgValidFrom: validFrom,
        lsgValidUpto: validUpto,
        lsgNotes: normalizeNullableString(row.lsg_notes),
        lsgIsActive: row.lsg_is_active ?? true,
        lsgCreatedBy: this.resolveWriteActor(row.lsg_created_by),
      },
      include: GIFT_LOOKUP,
    });
    await this.audit(
      tx,
      'insert',
      GIFT_TABLE_NAME,
      created.lsgId,
      `Scheme ${lscId} / Gift ${created.lsgSlno}`,
      null,
      toGiftPayload(created),
      'Loyalty scheme gift row created',
    );
    return created;
  }

  /** ck_lsb_slno. */
  private assertBranchInvariants(row: EffectiveBranchRow): void {
    const errors = collectBranchInvariantErrors(row);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  /** ck_lsp_kind, ck_lsp_slno and ck_lsp_match_priority, collected. */
  private assertPartyInvariants(row: EffectivePartyRow): void {
    const errors = collectPartyInvariantErrors(row);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  /** ck_lsi_kind, ck_lsi_exclude, ck_lsi_values, ck_lsi_slno and
   *  ck_lsi_match_priority, collected. */
  private assertItemInvariants(row: EffectiveItemRow): void {
    const errors = collectItemInvariantErrors(row);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  /** ck_lss_band, ck_lss_values and ck_lss_slno, collected. */
  private assertSlabInvariants(band: EffectiveSlabRow): void {
    const errors = collectSlabInvariantErrors(band);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  /** ck_lsg_qty, ck_lsg_points, ck_lsg_validity and ck_lsg_slno, collected. */
  private assertGiftInvariants(row: EffectiveGiftRow): void {
    const errors = collectGiftInvariantErrors(row);
    if (errors.length > 0) {
      this.throwBadRequest('Validation failed', errors);
    }
  }

  // ─── Shared plumbing ────────────────────────────────────────────────────────

  private async findSchemeWithChildren(
    client: WriteClient,
    lscId: string,
  ): Promise<SchemeWithChildren | null> {
    return client.loyaltyScheme.findFirst({
      where: { lscId, lscIsDeleted: false },
      include: { ...SCHEME_LOOKUP, ...EDITABLE_CHILDREN_INCLUDE },
    });
  }

  private async requireScheme(client: WriteClient, lscId: string): Promise<LoyaltyScheme> {
    const scheme = await client.loyaltyScheme.findFirst({
      where: { lscId, lscIsDeleted: false },
    });
    if (!scheme) {
      this.throwNotFound('lsc_id', lscId, 'Loyalty scheme not found');
    }
    return scheme;
  }

  /**
   * The five grids, saved alongside the header in the same transaction.
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
    scheme: LoyaltyScheme,
    dto: SaveLoyaltySchemeDto,
  ): Promise<void> {
    const actor = dto.lsc_modified_by ?? dto.lsc_created_by;

    if (dto.branches !== undefined) {
      this.assertNoDuplicates(
        dto.branches.map((row, index) => ({ key: row.lsb_branch_id ?? `#${index}`, index })),
        'lsb_branch_id',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.branches.length; index += 1) {
        const saved = await this.saveBranchRow(tx, scheme.lscId, dto.branches[index], index);
        kept.push(saved.lsbId);
      }
      const stale = await tx.loyaltySchemeBranch.findMany({
        where: { lsbLscId: scheme.lscId, lsbIsDeleted: false, lsbId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeleteBranchRow(tx, row, actor);
      }
    }

    if (dto.parties !== undefined) {
      this.assertNoDuplicates(
        dto.parties.map((row, index) => ({
          key: `${(row.lsp_kind ?? '').toUpperCase()}:${row.lsp_scope_id ?? `#${index}`}`,
          index,
        })),
        'lsp_scope_id',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.parties.length; index += 1) {
        const saved = await this.savePartyRow(tx, scheme.lscId, dto.parties[index], index);
        kept.push(saved.lspId);
      }
      const stale = await tx.loyaltySchemeParty.findMany({
        where: { lspLscId: scheme.lscId, lspIsDeleted: false, lspId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeletePartyRow(tx, row, actor);
      }
    }

    if (dto.items !== undefined) {
      this.assertNoDuplicates(
        dto.items.map((row, index) => ({
          key: `${(row.lsi_kind ?? '').toUpperCase()}:${row.lsi_scope_id ?? `#${index}`}`,
          index,
        })),
        'lsi_scope_id',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.items.length; index += 1) {
        const saved = await this.saveItemRow(tx, scheme.lscId, dto.items[index], index);
        kept.push(saved.lsiId);
      }
      const stale = await tx.loyaltySchemeItem.findMany({
        where: { lsiLscId: scheme.lscId, lsiIsDeleted: false, lsiId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeleteItemRow(tx, row, actor);
      }
    }

    if (dto.slabs !== undefined) {
      // ux_lss_band is (scheme, COALESCE(item, nil uuid), exceeds): two bands
      // may share a lower bound only if they name different items.
      this.assertNoDuplicates(
        dto.slabs.map((row, index) => ({
          key: `${row.lss_item_id ?? '-'}:${row.lss_exceeds ?? 0}`,
          index,
        })),
        'lss_exceeds',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.slabs.length; index += 1) {
        const saved = await this.saveSlabRow(tx, scheme.lscId, dto.slabs[index], index);
        kept.push(saved.lssId);
      }
      const stale = await tx.loyaltySchemeSlab.findMany({
        where: { lssLscId: scheme.lscId, lssIsDeleted: false, lssId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeleteSlabRow(tx, row, actor);
      }
    }

    if (dto.gifts !== undefined) {
      this.assertNoDuplicates(
        dto.gifts.map((row, index) => ({
          key: `${row.lsg_item_id ?? `#${index}`}:${row.lsg_unit_id ?? '-'}`,
          index,
        })),
        'lsg_item_id',
      );
      const kept: string[] = [];
      for (let index = 0; index < dto.gifts.length; index += 1) {
        const saved = await this.saveGiftRow(tx, scheme.lscId, dto.gifts[index], index);
        kept.push(saved.lsgId);
      }
      const stale = await tx.loyaltySchemeGift.findMany({
        where: { lsgLscId: scheme.lscId, lsgIsDeleted: false, lsgId: { notIn: kept } },
      });
      for (const row of stale) {
        await this.softDeleteGiftRow(tx, row, actor);
      }
    }
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeleteBranchRow(
    tx: Prisma.TransactionClient,
    existing: LoyaltySchemeBranch,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.loyaltySchemeBranch.update({
      where: { lsbId: existing.lsbId },
      data: {
        lsbIsDeleted: true,
        lsbIsActive: false,
        lsbModifiedOn: new Date(),
        lsbModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      BRANCH_TABLE_NAME,
      existing.lsbId,
      `Scheme ${existing.lsbLscId} / Branch ${existing.lsbSlno}`,
      toBranchPayload(existing),
      toBranchPayload(updated),
      'Loyalty scheme branch row soft deleted',
    );
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeletePartyRow(
    tx: Prisma.TransactionClient,
    existing: LoyaltySchemeParty,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.loyaltySchemeParty.update({
      where: { lspId: existing.lspId },
      data: {
        lspIsDeleted: true,
        lspIsActive: false,
        lspModifiedOn: new Date(),
        lspModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      PARTY_TABLE_NAME,
      existing.lspId,
      `Scheme ${existing.lspLscId} / ${existing.lspKind} ${existing.lspScopeId}`,
      toPartyPayload(existing),
      toPartyPayload(updated),
      'Loyalty scheme party row soft deleted',
    );
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeleteItemRow(
    tx: Prisma.TransactionClient,
    existing: LoyaltySchemeItem,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.loyaltySchemeItem.update({
      where: { lsiId: existing.lsiId },
      data: {
        lsiIsDeleted: true,
        lsiIsActive: false,
        lsiModifiedOn: new Date(),
        lsiModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      ITEM_TABLE_NAME,
      existing.lsiId,
      `Scheme ${existing.lsiLscId} / ${existing.lsiKind} ${existing.lsiScopeId}`,
      toItemPayload(existing),
      toItemPayload(updated),
      'Loyalty scheme item row soft deleted',
    );
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeleteSlabRow(
    tx: Prisma.TransactionClient,
    existing: LoyaltySchemeSlab,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.loyaltySchemeSlab.update({
      where: { lssId: existing.lssId },
      data: {
        lssIsDeleted: true,
        lssIsActive: false,
        lssModifiedOn: new Date(),
        lssModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      SLAB_TABLE_NAME,
      existing.lssId,
      `Scheme ${existing.lssLscId} / Band ${existing.lssSlno}`,
      toSlabPayload(existing),
      toSlabPayload(updated),
      'Loyalty scheme slab row soft deleted',
    );
  }

  /** Soft delete one row plus its audit entry, inside a caller's transaction. */
  private async softDeleteGiftRow(
    tx: Prisma.TransactionClient,
    existing: LoyaltySchemeGift,
    modifiedBy?: string,
  ): Promise<void> {
    const updated = await tx.loyaltySchemeGift.update({
      where: { lsgId: existing.lsgId },
      data: {
        lsgIsDeleted: true,
        lsgIsActive: false,
        lsgModifiedOn: new Date(),
        lsgModifiedBy: this.resolveWriteActor(modifiedBy),
      },
    });
    await this.audit(
      tx,
      'cancel',
      GIFT_TABLE_NAME,
      existing.lsgId,
      `Scheme ${existing.lsgLscId} / Gift ${existing.lsgSlno}`,
      toGiftPayload(existing),
      toGiftPayload(updated),
      'Loyalty scheme gift row soft deleted',
    );
  }

  /**
   * The ux_* uniques on all five child tables are partial, so Prisma may not
   * have created them. Catch the same-batch duplicate here — two grid rows for
   * one brand is a typo the user can fix, not a 500 later.
   */
  private assertNoDuplicates(keys: Array<{ key: string; index: number }>, field: string): void {
    const seen = new Map<string, number>();
    for (const { key, index } of keys) {
      const first = seen.get(key);
      if (first !== undefined) {
        this.throwBadRequest('Validation failed', [
          { field, message: `Rows ${first + 1} and ${index + 1} target the same scope` },
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

  private pickNullableNumber(
    row: object,
    key: string,
    existing: Prisma.Decimal | null | undefined,
  ): number | null {
    if (hasOwnProperty(row, key)) {
      const value = (row as Record<string, unknown>)[key];
      return typeof value === 'number' ? value : null;
    }
    return existing === null || existing === undefined ? null : Number(existing.toString());
  }

  private resolveWriteActor(explicit?: string | null): string {
    return resolveActor(explicit, this.requestContextService.getUserId()) ?? DEFAULT_AUDIT_ACTOR;
  }

  private resolveAuditActor(): string {
    return this.requestContextService.getUserId() ?? DEFAULT_AUDIT_ACTOR;
  }

  private async audit(
    tx: Prisma.TransactionClient,
    action: Extract<AuditAction, 'insert' | 'update' | 'cancel'>,
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

  private throwBadRequest(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never {
    throwSalesBadRequest<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
      message,
      errors,
    );
  }

  private throwConflict(message: string, errors: PromotionLoyaltyPointsErrorDetail[]): never {
    throwSalesConflict<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
      message,
      errors,
    );
  }

  private throwNotFound(field: string, value: string, message: string): never {
    throwSalesNotFound<PromotionLoyaltyPointsErrorDetail, PromotionLoyaltyPointsErrorResponse>(
      message,
      field,
      `${field} ${value} was not found`,
    );
  }
}
