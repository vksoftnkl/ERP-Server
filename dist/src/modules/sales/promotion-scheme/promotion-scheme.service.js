"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PromotionSchemeService = void 0;
const common_1 = require("@nestjs/common");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const promotion_scheme_invariants_1 = require("./utils/promotion-scheme-invariants");
const promotion_scheme_utils_1 = require("./utils/promotion-scheme.utils");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const SCREEN_NAME = 'Promotion Scheme';
const SCHEME_TABLE_NAME = 'promotion scheme';
const BRANCH_TABLE_NAME = 'promotion scheme branch';
const PARTY_TABLE_NAME = 'promotion scheme party';
const ITEM_TABLE_NAME = 'promotion scheme item';
const SLAB_TABLE_NAME = 'promotion scheme slab';
let PromotionSchemeService = class PromotionSchemeService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async saveScheme(dto) {
        return dto.prm_id ? this.updateScheme(dto) : this.createScheme(dto);
    }
    async getSchemeById(prmId) {
        const scheme = await this.findSchemeWithChildren(this.prisma, prmId);
        if (!scheme) {
            this.throwNotFound('prm_id', prmId, 'Promotion scheme not found');
        }
        return (0, promotion_scheme_utils_1.toSchemePayload)(scheme);
    }
    async checkEligibility(prmId, cusId) {
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
        const scopeMatches = [{ prpCustId: customer.cusId }];
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
    async softDeleteScheme(prmId, modifiedBy) {
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
            await this.audit(tx, 'cancel', SCHEME_TABLE_NAME, prmId, existing.prmName, (0, promotion_scheme_utils_1.toSchemePayload)(existing), (0, promotion_scheme_utils_1.toSchemePayload)({ ...updated, branches: [], parties: [], items: [], slabs: [] }), 'Promotion scheme soft deleted with all scope and slab rows');
            return { deleted: true, prm_id: prmId };
        });
    }
    async createScheme(dto) {
        const actor = this.resolveWriteActor(dto.prm_created_by);
        const data = {
            prmCompId: (0, promotion_scheme_utils_1.requireUuid)(dto.prm_comp_id, 'prm_comp_id'),
            prmCode: (0, promotion_scheme_utils_1.requireString)(dto.prm_code, 'prm_code'),
            prmName: (0, promotion_scheme_utils_1.requireString)(dto.prm_name, 'prm_name'),
            prmStartDate: (0, promotion_scheme_utils_1.parseDateOnly)(dto.prm_start_date, 'prm_start_date'),
            prmEndDate: (0, promotion_scheme_utils_1.parseDateOnly)(dto.prm_end_date, 'prm_end_date'),
            prmCreatedBy: actor,
        };
        this.applySchemeFields(data, dto);
        const effective = this.effectiveScheme(null, data);
        this.assertSchemeInvariants(effective);
        await this.assertCodeIsFree(this.prisma, data.prmCompId, effective.prmCode, null);
        return this.prisma
            .$transaction(async (tx) => {
            const row = await tx.promotionScheme.create({ data });
            await this.audit(tx, 'create', SCHEME_TABLE_NAME, row.prmId, row.prmName, null, (0, promotion_scheme_utils_1.toSchemePayload)({ ...row, branches: [], parties: [], items: [], slabs: [] }), 'Promotion scheme created');
            await this.syncChildren(tx, row, dto);
            const after = await this.findSchemeWithChildren(tx, row.prmId);
            return (0, promotion_scheme_utils_1.toSchemePayload)(after ?? { ...row, branches: [], parties: [], items: [], slabs: [] });
        })
            .catch((error) => {
            (0, promotion_scheme_utils_1.handlePromotionWriteError)(error);
            throw error;
        });
    }
    async updateScheme(dto) {
        const prmId = (0, promotion_scheme_utils_1.requireUuid)(dto.prm_id, 'prm_id');
        return this.prisma
            .$transaction(async (tx) => {
            const existing = await this.findSchemeWithChildren(tx, prmId);
            if (!existing) {
                this.throwNotFound('prm_id', prmId, 'Promotion scheme not found');
            }
            const data = {
                prmModifiedOn: new Date(),
                prmModifiedBy: this.resolveWriteActor(dto.prm_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_comp_id')) {
                data.prmCompId = (0, promotion_scheme_utils_1.requireUuid)(dto.prm_comp_id, 'prm_comp_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_code')) {
                data.prmCode = (0, promotion_scheme_utils_1.requireString)(dto.prm_code, 'prm_code');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_name')) {
                data.prmName = (0, promotion_scheme_utils_1.requireString)(dto.prm_name, 'prm_name');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_start_date')) {
                data.prmStartDate = (0, promotion_scheme_utils_1.parseDateOnly)(dto.prm_start_date, 'prm_start_date');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_end_date')) {
                data.prmEndDate = (0, promotion_scheme_utils_1.parseDateOnly)(dto.prm_end_date, 'prm_end_date');
            }
            this.applySchemeFields(data, dto);
            const effective = this.effectiveScheme(existing, data);
            this.assertSchemeInvariants(effective);
            if (effective.prmBenefit !== existing.prmBenefit &&
                existing.slabs.length > 0 &&
                dto.slabs === undefined) {
                this.throwBadRequest('Validation failed', [
                    {
                        field: 'prm_benefit',
                        message: `Cannot change prm_benefit while ${existing.slabs.length} slab band(s) exist. ` +
                            'Send the retyped bands as `slabs` in this same call, or delete them first.',
                    },
                ]);
            }
            const compId = data.prmCompId ?? existing.prmCompId;
            await this.assertCodeIsFree(tx, compId, effective.prmCode, prmId);
            const updated = await tx.promotionScheme.update({ where: { prmId }, data });
            await this.syncChildren(tx, updated, dto);
            const after = await this.findSchemeWithChildren(tx, prmId);
            await this.audit(tx, 'update', SCHEME_TABLE_NAME, prmId, updated.prmName, (0, promotion_scheme_utils_1.toSchemePayload)(existing), after ? (0, promotion_scheme_utils_1.toSchemePayload)(after) : null, 'Promotion scheme updated');
            return after
                ? (0, promotion_scheme_utils_1.toSchemePayload)(after)
                : (0, promotion_scheme_utils_1.toSchemePayload)({ ...updated, branches: [], parties: [], items: [], slabs: [] });
        })
            .catch((error) => {
            (0, promotion_scheme_utils_1.handlePromotionWriteError)(error);
            throw error;
        });
    }
    applySchemeFields(data, dto) {
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_branch_id'))
            data.prmBranchId = dto.prm_branch_id ?? null;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_tenant_id'))
            data.prmTenantId = dto.prm_tenant_id ?? null;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_status')) {
            data.prmStatus = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_status);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_apply_on')) {
            data.prmApplyOn = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_apply_on);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_benefit')) {
            data.prmBenefit = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_benefit);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_priority')) {
            data.prmPriority = dto.prm_priority;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_stack_mode')) {
            data.prmStackMode = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_stack_mode);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_auto_apply'))
            data.prmAutoApply = dto.prm_auto_apply ?? true;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_allow_with_manual_disc')) {
            data.prmAllowWithManualDisc = dto.prm_allow_with_manual_disc ?? false;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_calc_on_amount_type')) {
            data.prmCalcOnAmountType = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_calc_on_amount_type);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_include_tax'))
            data.prmIncludeTax = dto.prm_include_tax ?? false;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_bill_type')) {
            data.prmBillType = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_bill_type);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_min_bill_amount')) {
            data.prmMinBillAmount = dto.prm_min_bill_amount;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_min_qty')) {
            data.prmMinQty = dto.prm_min_qty;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_branch_scope')) {
            data.prmBranchScope = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_branch_scope);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_cust_scope')) {
            data.prmCustScope = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_cust_scope);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_item_scope')) {
            data.prmItemScope = (0, promotion_scheme_utils_1.normalizeEnum)(dto.prm_item_scope);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_price_level_id')) {
            data.prmPriceLevelId = dto.prm_price_level_id ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_max_benefit_per_bill')) {
            data.prmMaxBenefitPerBill = dto.prm_max_benefit_per_bill;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_max_uses_total')) {
            data.prmMaxUsesTotal = dto.prm_max_uses_total;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_max_uses_per_cust')) {
            data.prmMaxUsesPerCust = dto.prm_max_uses_per_cust;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_budget_amount')) {
            data.prmBudgetAmount = dto.prm_budget_amount;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_coupon_batch_id')) {
            data.prmCouponBatchId = dto.prm_coupon_batch_id ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_valid_from_time')) {
            data.prmValidFromTime = dto.prm_valid_from_time
                ? (0, promotion_scheme_utils_1.parseTimeToUtcDate)(dto.prm_valid_from_time, 'prm_valid_from_time')
                : null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_valid_to_time')) {
            data.prmValidToTime = dto.prm_valid_to_time
                ? (0, promotion_scheme_utils_1.parseTimeToUtcDate)(dto.prm_valid_to_time, 'prm_valid_to_time')
                : null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_valid_weekdays')) {
            const weekdays = (0, promotion_scheme_utils_1.normalizeNullableString)(dto.prm_valid_weekdays);
            data.prmValidWeekdays = weekdays ? weekdays.toUpperCase() : null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_remarks')) {
            data.prmRemarks = (0, promotion_scheme_utils_1.normalizeNullableString)(dto.prm_remarks);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_is_active'))
            data.prmIsActive = dto.prm_is_active ?? true;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_approved_on')) {
            const value = (0, promotion_scheme_utils_1.normalizeNullableString)(dto.prm_approved_on);
            if (value === null) {
                data.prmApprovedOn = null;
            }
            else {
                const parsed = new Date(value);
                if (Number.isNaN(parsed.getTime())) {
                    this.throwBadRequest('Validation failed', [
                        { field: 'prm_approved_on', message: 'prm_approved_on must be a valid datetime' },
                    ]);
                }
                data.prmApprovedOn = parsed;
            }
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_approved_by')) {
            data.prmApprovedBy = (0, promotion_scheme_utils_1.resolveActorUuid)(dto.prm_approved_by);
        }
    }
    effectiveScheme(existing, data) {
        const pick = (key, fallback) => {
            const value = data[key];
            return value === undefined ? fallback : value;
        };
        return {
            prmCode: pick('prmCode', existing?.prmCode ?? ''),
            prmStatus: pick('prmStatus', existing?.prmStatus ?? 'DRAFT'),
            prmApplyOn: pick('prmApplyOn', existing?.prmApplyOn ?? 'ITEM_QTY'),
            prmBenefit: pick('prmBenefit', existing?.prmBenefit ?? 'DISC_PERC'),
            prmStackMode: pick('prmStackMode', existing?.prmStackMode ?? 'EXCLUSIVE'),
            prmCalcOnAmountType: pick('prmCalcOnAmountType', existing?.prmCalcOnAmountType ?? 'NET_AMOUNT'),
            prmBillType: pick('prmBillType', existing?.prmBillType ?? 'ALL'),
            prmBranchScope: pick('prmBranchScope', existing?.prmBranchScope ?? 'ALL'),
            prmCustScope: pick('prmCustScope', existing?.prmCustScope ?? 'ALL'),
            prmItemScope: pick('prmItemScope', existing?.prmItemScope ?? 'ALL'),
            prmPriority: pick('prmPriority', existing?.prmPriority ?? 1),
            prmMinBillAmount: pick('prmMinBillAmount', (0, module_service_utils_1.toNumber)(existing?.prmMinBillAmount ?? 0)),
            prmMinQty: pick('prmMinQty', (0, module_service_utils_1.toNumber)(existing?.prmMinQty ?? 0)),
            prmMaxBenefitPerBill: pick('prmMaxBenefitPerBill', (0, module_service_utils_1.toNumber)(existing?.prmMaxBenefitPerBill ?? 0)),
            prmMaxUsesTotal: pick('prmMaxUsesTotal', existing?.prmMaxUsesTotal ?? 0),
            prmMaxUsesPerCust: pick('prmMaxUsesPerCust', existing?.prmMaxUsesPerCust ?? 0),
            prmBudgetAmount: pick('prmBudgetAmount', (0, module_service_utils_1.toNumber)(existing?.prmBudgetAmount ?? 0)),
            prmStartDate: pick('prmStartDate', existing?.prmStartDate ?? new Date(0)),
            prmEndDate: pick('prmEndDate', existing?.prmEndDate ?? new Date(0)),
            prmValidFromTime: pick('prmValidFromTime', existing?.prmValidFromTime ?? null),
            prmValidToTime: pick('prmValidToTime', existing?.prmValidToTime ?? null),
            prmValidWeekdays: pick('prmValidWeekdays', existing?.prmValidWeekdays ?? null),
            prmApprovedBy: pick('prmApprovedBy', existing?.prmApprovedBy ?? null),
        };
    }
    assertSchemeInvariants(scheme) {
        const errors = (0, promotion_scheme_invariants_1.collectSchemeInvariantErrors)(scheme);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    async assertCodeIsFree(client, compId, code, ignorePrmId) {
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
    async saveBranchRow(tx, prmId, row, index) {
        const slno = row.prb_slno ?? index + 1;
        (0, promotion_scheme_utils_1.requireInteger)(slno, 'prb_slno', 1);
        if (row.prb_id) {
            const existing = await tx.promotionSchemeBranch.findFirst({
                where: { prbId: row.prb_id, prbPrmId: prmId, prbIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('prb_id', row.prb_id, 'Promotion scheme branch row not found');
            }
            const data = {
                prbModifiedOn: new Date(),
                prbModifiedBy: this.resolveWriteActor(row.prb_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prb_slno'))
                data.prbSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prb_branch_id')) {
                data.prbBranchId = (0, promotion_scheme_utils_1.requireUuid)(row.prb_branch_id, 'prb_branch_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prb_is_exclude'))
                data.prbIsExclude = row.prb_is_exclude ?? false;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prb_notes'))
                data.prbNotes = (0, promotion_scheme_utils_1.normalizeNullableString)(row.prb_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prb_is_active'))
                data.prbIsActive = row.prb_is_active ?? true;
            const updated = await tx.promotionSchemeBranch.update({
                where: { prbId: row.prb_id },
                data,
                include: promotion_scheme_utils_1.BRANCH_LOOKUP,
            });
            await this.audit(tx, 'update', BRANCH_TABLE_NAME, updated.prbId, `Scheme ${prmId} / Branch ${updated.prbSlno}`, (0, promotion_scheme_utils_1.toBranchPayload)(existing), (0, promotion_scheme_utils_1.toBranchPayload)(updated), 'Promotion scheme branch row updated');
            return updated;
        }
        const created = await tx.promotionSchemeBranch.create({
            data: {
                prbPrmId: prmId,
                prbSlno: slno,
                prbBranchId: (0, promotion_scheme_utils_1.requireUuid)(row.prb_branch_id, 'prb_branch_id'),
                prbIsExclude: row.prb_is_exclude ?? false,
                prbNotes: (0, promotion_scheme_utils_1.normalizeNullableString)(row.prb_notes),
                prbIsActive: row.prb_is_active ?? true,
                prbCreatedBy: this.resolveWriteActor(row.prb_created_by),
            },
            include: promotion_scheme_utils_1.BRANCH_LOOKUP,
        });
        await this.audit(tx, 'create', BRANCH_TABLE_NAME, created.prbId, `Scheme ${prmId} / Branch ${created.prbSlno}`, null, (0, promotion_scheme_utils_1.toBranchPayload)(created), 'Promotion scheme branch row created');
        return created;
    }
    async savePartyRow(tx, prmId, row, index) {
        const existing = row.prp_id
            ? await tx.promotionSchemeParty.findFirst({
                where: { prpId: row.prp_id, prpPrmId: prmId, prpIsDeleted: false },
            })
            : null;
        if (row.prp_id && !existing) {
            this.throwNotFound('prp_id', row.prp_id, 'Promotion scheme party row not found');
        }
        const slno = row.prp_slno ?? existing?.prpSlno ?? index + 1;
        const kind = (0, module_service_utils_1.hasOwnProperty)(row, 'prp_kind')
            ? (0, promotion_scheme_utils_1.normalizeEnum)(row.prp_kind)
            : (existing?.prpKind ?? (0, promotion_scheme_utils_1.normalizeEnum)(row.prp_kind));
        const matchPriority = (0, module_service_utils_1.hasOwnProperty)(row, 'prp_match_priority')
            ? row.prp_match_priority
            : (existing?.prpMatchPriority ?? promotion_scheme_utils_1.PRP_DEFAULT_MATCH_PRIORITY[kind] ?? 1);
        this.assertPartyInvariants({
            prpSlno: slno,
            prpKind: kind,
            prpMatchPriority: matchPriority,
        });
        if (existing) {
            const data = {
                prpModifiedOn: new Date(),
                prpModifiedBy: this.resolveWriteActor(row.prp_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_slno'))
                data.prpSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_kind'))
                data.prpKind = kind;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_scope_id')) {
                data.prpScopeId = (0, promotion_scheme_utils_1.requireUuid)(row.prp_scope_id, 'prp_scope_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_is_exclude'))
                data.prpIsExclude = row.prp_is_exclude ?? false;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_match_priority'))
                data.prpMatchPriority = matchPriority;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_notes'))
                data.prpNotes = (0, promotion_scheme_utils_1.normalizeNullableString)(row.prp_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_is_active'))
                data.prpIsActive = row.prp_is_active ?? true;
            const updated = await tx.promotionSchemeParty.update({
                where: { prpId: existing.prpId },
                data,
                include: promotion_scheme_utils_1.PARTY_LOOKUP,
            });
            await this.audit(tx, 'update', PARTY_TABLE_NAME, updated.prpId, `Scheme ${prmId} / ${updated.prpKind} ${updated.prpScopeId}`, (0, promotion_scheme_utils_1.toPartyPayload)(existing), (0, promotion_scheme_utils_1.toPartyPayload)(updated), 'Promotion scheme party row updated');
            return updated;
        }
        const created = await tx.promotionSchemeParty.create({
            data: {
                prpPrmId: prmId,
                prpSlno: slno,
                prpKind: kind,
                prpScopeId: (0, promotion_scheme_utils_1.requireUuid)(row.prp_scope_id, 'prp_scope_id'),
                prpIsExclude: row.prp_is_exclude ?? false,
                prpMatchPriority: matchPriority,
                prpNotes: (0, promotion_scheme_utils_1.normalizeNullableString)(row.prp_notes),
                prpIsActive: row.prp_is_active ?? true,
                prpCreatedBy: this.resolveWriteActor(row.prp_created_by),
            },
            include: promotion_scheme_utils_1.PARTY_LOOKUP,
        });
        await this.audit(tx, 'create', PARTY_TABLE_NAME, created.prpId, `Scheme ${prmId} / ${created.prpKind} ${created.prpScopeId}`, null, (0, promotion_scheme_utils_1.toPartyPayload)(created), 'Promotion scheme party row created');
        return created;
    }
    async saveItemRow(tx, prmId, row, index) {
        const existing = row.pri_id
            ? await tx.promotionSchemeItem.findFirst({
                where: { priId: row.pri_id, priPrmId: prmId, priIsDeleted: false },
            })
            : null;
        if (row.pri_id && !existing) {
            this.throwNotFound('pri_id', row.pri_id, 'Promotion scheme item row not found');
        }
        const slno = row.pri_slno ?? existing?.priSlno ?? index + 1;
        const kind = (0, module_service_utils_1.hasOwnProperty)(row, 'pri_kind')
            ? (0, promotion_scheme_utils_1.normalizeEnum)(row.pri_kind)
            : (existing?.priKind ?? (0, promotion_scheme_utils_1.normalizeEnum)(row.pri_kind));
        const unitId = (0, module_service_utils_1.hasOwnProperty)(row, 'pri_unit_id')
            ? (row.pri_unit_id ?? null)
            : (existing?.priUnitId ?? null);
        const discPerc = this.pickNumber(row, 'pri_disc_perc', existing?.priDiscPerc, 0);
        const discQty = this.pickNumber(row, 'pri_disc_qty', existing?.priDiscQty, 0);
        const discAmt = this.pickNumber(row, 'pri_disc_amt', existing?.priDiscAmt, 0);
        const minQty = this.pickNumber(row, 'pri_min_qty', existing?.priMinQty, 0);
        const factor = this.pickNumber(row, 'pri_factor', existing?.priFactor, 1);
        const maxBenefit = this.pickNumber(row, 'pri_max_benefit', existing?.priMaxBenefit, 0);
        const isExclude = (0, module_service_utils_1.hasOwnProperty)(row, 'pri_is_exclude')
            ? (row.pri_is_exclude ?? false)
            : (existing?.priIsExclude ?? false);
        const matchPriority = (0, module_service_utils_1.hasOwnProperty)(row, 'pri_match_priority')
            ? row.pri_match_priority
            : (existing?.priMatchPriority ?? promotion_scheme_utils_1.PRI_DEFAULT_MATCH_PRIORITY[kind] ?? 1);
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
            const data = {
                priModifiedOn: new Date(),
                priModifiedBy: this.resolveWriteActor(row.pri_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_slno'))
                data.priSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_kind'))
                data.priKind = kind;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_scope_id')) {
                data.priScopeId = (0, promotion_scheme_utils_1.requireUuid)(row.pri_scope_id, 'pri_scope_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_unit_id'))
                data.priUnitId = unitId;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_is_exclude'))
                data.priIsExclude = isExclude;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_disc_perc'))
                data.priDiscPerc = discPerc;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_disc_qty'))
                data.priDiscQty = discQty;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_disc_amt'))
                data.priDiscAmt = discAmt;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_min_qty'))
                data.priMinQty = minQty;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_factor'))
                data.priFactor = factor;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_max_benefit'))
                data.priMaxBenefit = maxBenefit;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_match_priority'))
                data.priMatchPriority = matchPriority;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_notes'))
                data.priNotes = (0, promotion_scheme_utils_1.normalizeNullableString)(row.pri_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_is_active'))
                data.priIsActive = row.pri_is_active ?? true;
            const updated = await tx.promotionSchemeItem.update({
                where: { priId: existing.priId },
                data,
                include: promotion_scheme_utils_1.ITEM_LOOKUP,
            });
            await this.audit(tx, 'update', ITEM_TABLE_NAME, updated.priId, `Scheme ${prmId} / ${updated.priKind} ${updated.priScopeId}`, (0, promotion_scheme_utils_1.toItemPayload)(existing), (0, promotion_scheme_utils_1.toItemPayload)(updated), 'Promotion scheme item row updated');
            return updated;
        }
        const created = await tx.promotionSchemeItem.create({
            data: {
                priPrmId: prmId,
                priSlno: slno,
                priKind: kind,
                priScopeId: (0, promotion_scheme_utils_1.requireUuid)(row.pri_scope_id, 'pri_scope_id'),
                priUnitId: unitId,
                priIsExclude: isExclude,
                priDiscPerc: discPerc,
                priDiscQty: discQty,
                priDiscAmt: discAmt,
                priMinQty: minQty,
                priFactor: factor,
                priMaxBenefit: maxBenefit,
                priMatchPriority: matchPriority,
                priNotes: (0, promotion_scheme_utils_1.normalizeNullableString)(row.pri_notes),
                priIsActive: row.pri_is_active ?? true,
                priCreatedBy: this.resolveWriteActor(row.pri_created_by),
            },
            include: promotion_scheme_utils_1.ITEM_LOOKUP,
        });
        await this.audit(tx, 'create', ITEM_TABLE_NAME, created.priId, `Scheme ${prmId} / ${created.priKind} ${created.priScopeId}`, null, (0, promotion_scheme_utils_1.toItemPayload)(created), 'Promotion scheme item row created');
        return created;
    }
    assertPartyInvariants(row) {
        const errors = (0, promotion_scheme_invariants_1.collectPartyInvariantErrors)(row);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    assertItemInvariants(row) {
        const errors = (0, promotion_scheme_invariants_1.collectItemInvariantErrors)(row);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    async saveSlabRow(tx, scheme, row, index) {
        const existing = row.prs_id
            ? await tx.promotionSchemeSlab.findFirst({
                where: { prsId: row.prs_id, prsPrmId: scheme.prmId, prsIsDeleted: false },
            })
            : null;
        if (row.prs_id && !existing) {
            this.throwNotFound('prs_id', row.prs_id, 'Promotion scheme slab row not found');
        }
        const slno = row.prs_slno ?? existing?.prsSlno ?? index + 1;
        const benefit = (0, module_service_utils_1.hasOwnProperty)(row, 'prs_benefit')
            ? (0, promotion_scheme_utils_1.normalizeEnum)(row.prs_benefit)
            : scheme.prmBenefit;
        if (benefit !== scheme.prmBenefit) {
            this.throwBadRequest('Validation failed', [
                {
                    field: 'prs_benefit',
                    message: `prs_benefit must match the scheme's prm_benefit (${scheme.prmBenefit})`,
                },
            ]);
        }
        const band = {
            prsSlno: slno,
            prsBenefit: benefit,
            prsExceeds: this.pickNumber(row, 'prs_exceeds', existing?.prsExceeds, 0),
            prsUpto: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_upto')
                ? (row.prs_upto ?? null)
                : existing?.prsUpto === undefined || existing?.prsUpto === null
                    ? null
                    : Number(existing.prsUpto.toString()),
            prsEach: this.pickNumber(row, 'prs_each', existing?.prsEach, 1),
            prsIsRepeat: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_is_repeat')
                ? (row.prs_is_repeat ?? false)
                : (existing?.prsIsRepeat ?? false),
            prsMaxRepeats: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_max_repeats')
                ? (row.prs_max_repeats ?? 0)
                : (existing?.prsMaxRepeats ?? 0),
            prsFreeItemId: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_item_id')
                ? (row.prs_free_item_id ?? null)
                : (existing?.prsFreeItemId ?? null),
            prsFreeUnitId: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_unit_id')
                ? (row.prs_free_unit_id ?? null)
                : (existing?.prsFreeUnitId ?? null),
            prsFreeQty: this.pickNumber(row, 'prs_free_qty', existing?.prsFreeQty, 0),
            prsDiscPerc: this.pickNumber(row, 'prs_disc_perc', existing?.prsDiscPerc, 0),
            prsDiscQty: this.pickNumber(row, 'prs_disc_qty', existing?.prsDiscQty, 0),
            prsDiscAmt: this.pickNumber(row, 'prs_disc_amt', existing?.prsDiscAmt, 0),
            prsFixedPrice: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_fixed_price')
                ? (row.prs_fixed_price ?? null)
                : existing?.prsFixedPrice === undefined || existing?.prsFixedPrice === null
                    ? null
                    : Number(existing.prsFixedPrice.toString()),
            prsMaxBenefitAmt: this.pickNumber(row, 'prs_max_benefit_amt', existing?.prsMaxBenefitAmt, 0),
        };
        this.assertSlabInvariants(band);
        if (existing) {
            const data = {
                prsModifiedOn: new Date(),
                prsModifiedBy: this.resolveWriteActor(row.prs_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_slno'))
                data.prsSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_exceeds'))
                data.prsExceeds = band.prsExceeds;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_upto'))
                data.prsUpto = band.prsUpto;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_each'))
                data.prsEach = band.prsEach;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_is_repeat'))
                data.prsIsRepeat = band.prsIsRepeat;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_max_repeats'))
                data.prsMaxRepeats = band.prsMaxRepeats;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_item_id'))
                data.prsFreeItemId = band.prsFreeItemId;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_unit_id'))
                data.prsFreeUnitId = band.prsFreeUnitId;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_qty'))
                data.prsFreeQty = band.prsFreeQty;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_stock_check')) {
                data.prsFreeStockCheck = row.prs_free_stock_check ?? true;
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_disc_perc'))
                data.prsDiscPerc = band.prsDiscPerc;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_disc_qty'))
                data.prsDiscQty = band.prsDiscQty;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_disc_amt'))
                data.prsDiscAmt = band.prsDiscAmt;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_fixed_price'))
                data.prsFixedPrice = band.prsFixedPrice;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_max_benefit_amt'))
                data.prsMaxBenefitAmt = band.prsMaxBenefitAmt;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_notes'))
                data.prsNotes = (0, promotion_scheme_utils_1.normalizeNullableString)(row.prs_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_is_active'))
                data.prsIsActive = row.prs_is_active ?? true;
            const updated = await tx.promotionSchemeSlab.update({
                where: { prsId: existing.prsId },
                data,
                include: promotion_scheme_utils_1.SLAB_LOOKUP,
            });
            await this.audit(tx, 'update', SLAB_TABLE_NAME, updated.prsId, `Scheme ${scheme.prmId} / Band ${updated.prsSlno}`, (0, promotion_scheme_utils_1.toSlabPayload)(existing), (0, promotion_scheme_utils_1.toSlabPayload)(updated), 'Promotion scheme slab row updated');
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
                prsNotes: (0, promotion_scheme_utils_1.normalizeNullableString)(row.prs_notes),
                prsIsActive: row.prs_is_active ?? true,
                prsCreatedBy: this.resolveWriteActor(row.prs_created_by),
            },
            include: promotion_scheme_utils_1.SLAB_LOOKUP,
        });
        await this.audit(tx, 'create', SLAB_TABLE_NAME, created.prsId, `Scheme ${scheme.prmId} / Band ${created.prsSlno}`, null, (0, promotion_scheme_utils_1.toSlabPayload)(created), 'Promotion scheme slab row created');
        return created;
    }
    assertSlabInvariants(band) {
        const errors = (0, promotion_scheme_invariants_1.collectSlabInvariantErrors)(band);
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    async findSchemeWithChildren(client, prmId) {
        return client.promotionScheme.findFirst({
            where: { prmId, prmIsDeleted: false },
            include: {
                branches: {
                    where: { prbIsDeleted: false },
                    orderBy: [{ prbSlno: 'asc' }, { prbId: 'asc' }],
                    include: promotion_scheme_utils_1.BRANCH_LOOKUP,
                },
                parties: {
                    where: { prpIsDeleted: false },
                    orderBy: [{ prpMatchPriority: 'desc' }, { prpSlno: 'asc' }, { prpId: 'asc' }],
                    include: promotion_scheme_utils_1.PARTY_LOOKUP,
                },
                items: {
                    where: { priIsDeleted: false },
                    orderBy: [{ priMatchPriority: 'desc' }, { priSlno: 'asc' }, { priId: 'asc' }],
                    include: promotion_scheme_utils_1.ITEM_LOOKUP,
                },
                slabs: {
                    where: { prsIsDeleted: false },
                    orderBy: [{ prsExceeds: 'asc' }, { prsSlno: 'asc' }, { prsId: 'asc' }],
                    include: promotion_scheme_utils_1.SLAB_LOOKUP,
                },
            },
        });
    }
    async requireScheme(client, prmId) {
        const scheme = await client.promotionScheme.findFirst({
            where: { prmId, prmIsDeleted: false },
        });
        if (!scheme) {
            this.throwNotFound('prm_id', prmId, 'Promotion scheme not found');
        }
        return scheme;
    }
    async syncChildren(tx, scheme, dto) {
        const actor = dto.prm_modified_by ?? dto.prm_created_by;
        if (dto.branches !== undefined) {
            this.assertNoDuplicates(dto.branches.map((row, index) => ({ key: row.prb_branch_id ?? `#${index}`, index })), 'prb_branch_id');
            const kept = [];
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
            this.assertNoDuplicates(dto.parties.map((row, index) => ({
                key: `${(row.prp_kind ?? '').toUpperCase()}:${row.prp_scope_id ?? `#${index}`}`,
                index,
            })), 'prp_scope_id');
            const kept = [];
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
            this.assertNoDuplicates(dto.items.map((row, index) => ({
                key: `${(row.pri_kind ?? '').toUpperCase()}:${row.pri_scope_id ?? `#${index}`}`,
                index,
            })), 'pri_scope_id');
            const kept = [];
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
            this.assertNoDuplicates(dto.slabs.map((row, index) => ({
                key: `${row.prs_exceeds ?? 0}:${row.prs_free_item_id ?? '-'}`,
                index,
            })), 'prs_exceeds');
            const kept = [];
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
    async softDeleteBranchRow(tx, existing, modifiedBy) {
        const updated = await tx.promotionSchemeBranch.update({
            where: { prbId: existing.prbId },
            data: {
                prbIsDeleted: true,
                prbIsActive: false,
                prbModifiedOn: new Date(),
                prbModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', BRANCH_TABLE_NAME, existing.prbId, `Scheme ${existing.prbPrmId} / Branch ${existing.prbSlno}`, (0, promotion_scheme_utils_1.toBranchPayload)(existing), (0, promotion_scheme_utils_1.toBranchPayload)(updated), 'Promotion scheme branch row soft deleted');
    }
    async softDeletePartyRow(tx, existing, modifiedBy) {
        const updated = await tx.promotionSchemeParty.update({
            where: { prpId: existing.prpId },
            data: {
                prpIsDeleted: true,
                prpIsActive: false,
                prpModifiedOn: new Date(),
                prpModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', PARTY_TABLE_NAME, existing.prpId, `Scheme ${existing.prpPrmId} / ${existing.prpKind} ${existing.prpScopeId}`, (0, promotion_scheme_utils_1.toPartyPayload)(existing), (0, promotion_scheme_utils_1.toPartyPayload)(updated), 'Promotion scheme party row soft deleted');
    }
    async softDeleteItemRow(tx, existing, modifiedBy) {
        const updated = await tx.promotionSchemeItem.update({
            where: { priId: existing.priId },
            data: {
                priIsDeleted: true,
                priIsActive: false,
                priModifiedOn: new Date(),
                priModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', ITEM_TABLE_NAME, existing.priId, `Scheme ${existing.priPrmId} / ${existing.priKind} ${existing.priScopeId}`, (0, promotion_scheme_utils_1.toItemPayload)(existing), (0, promotion_scheme_utils_1.toItemPayload)(updated), 'Promotion scheme item row soft deleted');
    }
    async softDeleteSlabRow(tx, existing, modifiedBy) {
        const updated = await tx.promotionSchemeSlab.update({
            where: { prsId: existing.prsId },
            data: {
                prsIsDeleted: true,
                prsIsActive: false,
                prsModifiedOn: new Date(),
                prsModifiedBy: this.resolveWriteActor(modifiedBy),
            },
        });
        await this.audit(tx, 'cancel', SLAB_TABLE_NAME, existing.prsId, `Scheme ${existing.prsPrmId} / Band ${existing.prsSlno}`, (0, promotion_scheme_utils_1.toSlabPayload)(existing), (0, promotion_scheme_utils_1.toSlabPayload)(updated), 'Promotion scheme slab row soft deleted');
    }
    assertNoDuplicates(keys, field) {
        const seen = new Map();
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
    pickNumber(row, key, existing, fallback) {
        if ((0, module_service_utils_1.hasOwnProperty)(row, key)) {
            const value = row[key];
            return typeof value === 'number' ? value : fallback;
        }
        if (existing === null || existing === undefined) {
            return fallback;
        }
        return Number(existing.toString());
    }
    resolveWriteActor(explicit) {
        return (0, promotion_scheme_utils_1.resolveActor)(explicit, this.requestContextService.getUserId()) ?? module_service_utils_1.DEFAULT_AUDIT_ACTOR;
    }
    resolveAuditActor() {
        return this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_AUDIT_ACTOR;
    }
    async audit(tx, action, tableName, pk, displayName, originalRecord, modifiedRecord, notes) {
        await this.auditLogService.logEntityChange({
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
        }, tx);
    }
    throwBadRequest(message, errors) {
        (0, module_service_utils_1.throwSalesBadRequest)(message, errors);
    }
    throwConflict(message, errors) {
        (0, module_service_utils_1.throwSalesConflict)(message, errors);
    }
    throwNotFound(field, value, message) {
        (0, module_service_utils_1.throwSalesNotFound)(message, field, `${field} ${value} was not found`);
    }
};
exports.PromotionSchemeService = PromotionSchemeService;
exports.PromotionSchemeService = PromotionSchemeService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], PromotionSchemeService);
//# sourceMappingURL=promotion-scheme.service.js.map