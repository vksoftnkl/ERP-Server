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
        const created = await this.prisma
            .$transaction(async (tx) => {
            const row = await tx.promotionScheme.create({ data });
            await this.audit(tx, 'create', SCHEME_TABLE_NAME, row.prmId, row.prmName, null, (0, promotion_scheme_utils_1.toSchemePayload)({ ...row, branches: [], parties: [], items: [], slabs: [] }), 'Promotion scheme created');
            return row;
        })
            .catch((error) => {
            (0, promotion_scheme_utils_1.handlePromotionWriteError)(error);
            throw error;
        });
        return (0, promotion_scheme_utils_1.toSchemePayload)({ ...created, branches: [], parties: [], items: [], slabs: [] });
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
            if (effective.prmBenefit !== existing.prmBenefit && existing.slabs.length > 0) {
                this.throwBadRequest('Validation failed', [
                    {
                        field: 'prm_benefit',
                        message: `Cannot change prm_benefit while ${existing.slabs.length} slab band(s) exist. ` +
                            'Delete or retype the bands first.',
                    },
                ]);
            }
            const compId = data.prmCompId ?? existing.prmCompId;
            await this.assertCodeIsFree(tx, compId, effective.prmCode, prmId);
            const updated = await tx.promotionScheme.update({ where: { prmId }, data });
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
            data.prmStatus = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_status, 'prm_status', promotion_scheme_utils_1.PRM_STATUSES);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_apply_on')) {
            data.prmApplyOn = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_apply_on, 'prm_apply_on', promotion_scheme_utils_1.PRM_APPLY_ON);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_benefit')) {
            data.prmBenefit = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_benefit, 'prm_benefit', promotion_scheme_utils_1.PRM_BENEFITS);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_priority')) {
            data.prmPriority = (0, promotion_scheme_utils_1.requireInteger)(dto.prm_priority, 'prm_priority', 1, 9);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_stack_mode')) {
            data.prmStackMode = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_stack_mode, 'prm_stack_mode', promotion_scheme_utils_1.PRM_STACK_MODES);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_auto_apply'))
            data.prmAutoApply = dto.prm_auto_apply ?? true;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_allow_with_manual_disc')) {
            data.prmAllowWithManualDisc = dto.prm_allow_with_manual_disc ?? false;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_calc_on_amount_type')) {
            data.prmCalcOnAmountType = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_calc_on_amount_type, 'prm_calc_on_amount_type', promotion_scheme_utils_1.PRM_CALC_ON);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_include_tax'))
            data.prmIncludeTax = dto.prm_include_tax ?? false;
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_bill_type')) {
            data.prmBillType = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_bill_type, 'prm_bill_type', promotion_scheme_utils_1.PRM_BILL_TYPES);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_min_bill_amount')) {
            data.prmMinBillAmount = (0, promotion_scheme_utils_1.requireNumber)(dto.prm_min_bill_amount, 'prm_min_bill_amount', 0);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_min_qty')) {
            data.prmMinQty = (0, promotion_scheme_utils_1.requireNumber)(dto.prm_min_qty, 'prm_min_qty', 0);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_branch_scope')) {
            data.prmBranchScope = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_branch_scope, 'prm_branch_scope', promotion_scheme_utils_1.PRM_SCOPES);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_cust_scope')) {
            data.prmCustScope = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_cust_scope, 'prm_cust_scope', promotion_scheme_utils_1.PRM_SCOPES);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_item_scope')) {
            data.prmItemScope = (0, promotion_scheme_utils_1.requireEnum)(dto.prm_item_scope, 'prm_item_scope', promotion_scheme_utils_1.PRM_SCOPES);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_price_level_id')) {
            data.prmPriceLevelId = dto.prm_price_level_id ?? null;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_max_benefit_per_bill')) {
            data.prmMaxBenefitPerBill = (0, promotion_scheme_utils_1.requireNumber)(dto.prm_max_benefit_per_bill, 'prm_max_benefit_per_bill', 0);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_max_uses_total')) {
            data.prmMaxUsesTotal = (0, promotion_scheme_utils_1.requireInteger)(dto.prm_max_uses_total, 'prm_max_uses_total', 0);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_max_uses_per_cust')) {
            data.prmMaxUsesPerCust = (0, promotion_scheme_utils_1.requireInteger)(dto.prm_max_uses_per_cust, 'prm_max_uses_per_cust', 0);
        }
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'prm_budget_amount')) {
            data.prmBudgetAmount = (0, promotion_scheme_utils_1.requireNumber)(dto.prm_budget_amount, 'prm_budget_amount', 0);
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
            prmStartDate: pick('prmStartDate', existing?.prmStartDate ?? new Date(0)),
            prmEndDate: pick('prmEndDate', existing?.prmEndDate ?? new Date(0)),
            prmValidFromTime: pick('prmValidFromTime', existing?.prmValidFromTime ?? null),
            prmValidToTime: pick('prmValidToTime', existing?.prmValidToTime ?? null),
            prmValidWeekdays: pick('prmValidWeekdays', existing?.prmValidWeekdays ?? null),
            prmApprovedBy: pick('prmApprovedBy', existing?.prmApprovedBy ?? null),
        };
    }
    assertSchemeInvariants(scheme) {
        const errors = [];
        if (!promotion_scheme_utils_1.PRM_CODE_PATTERN.test(scheme.prmCode)) {
            errors.push({
                field: 'prm_code',
                message: 'prm_code may contain only letters, digits, underscore and hyphen',
            });
        }
        if (scheme.prmEndDate.getTime() < scheme.prmStartDate.getTime()) {
            errors.push({
                field: 'prm_end_date',
                message: 'prm_end_date must be on or after prm_start_date',
            });
        }
        if ((scheme.prmValidFromTime === null) !== (scheme.prmValidToTime === null)) {
            errors.push({
                field: 'prm_valid_to_time',
                message: 'Send both prm_valid_from_time and prm_valid_to_time, or neither',
            });
        }
        if (scheme.prmValidWeekdays && !promotion_scheme_utils_1.PRM_WEEKDAYS_PATTERN.test(scheme.prmValidWeekdays)) {
            errors.push({
                field: 'prm_valid_weekdays',
                message: 'prm_valid_weekdays must be comma-separated MON,TUE,WED,THU,FRI,SAT,SUN',
            });
        }
        if (scheme.prmBenefit === 'FIXED_PRICE' &&
            !['ITEM_QTY', 'ITEM_AMOUNT'].includes(scheme.prmApplyOn)) {
            errors.push({
                field: 'prm_apply_on',
                message: 'A FIXED_PRICE benefit needs an item trigger (ITEM_QTY or ITEM_AMOUNT) — there is no ' +
                    'line to reprice on a bill-level scheme',
            });
        }
        if (scheme.prmStatus === 'APPROVED' && !scheme.prmApprovedBy) {
            errors.push({
                field: 'prm_approved_by',
                message: 'prm_approved_by is required once prm_status is APPROVED',
            });
        }
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
    async saveBranches(dto) {
        return this.prisma
            .$transaction(async (tx) => {
            const scheme = await this.requireScheme(tx, dto.prm_id);
            this.assertNoDuplicates(dto.branches.map((row, index) => ({ key: row.prb_branch_id ?? `#${index}`, index })), 'prb_branch_id');
            const saved = [];
            for (let index = 0; index < dto.branches.length; index += 1) {
                saved.push(await this.saveBranchRow(tx, scheme.prmId, dto.branches[index], index));
            }
            return saved.map(promotion_scheme_utils_1.toBranchPayload);
        })
            .catch((error) => {
            (0, promotion_scheme_utils_1.handlePromotionWriteError)(error);
            throw error;
        });
    }
    async getBranches(prmId) {
        await this.requireScheme(this.prisma, prmId);
        const rows = await this.prisma.promotionSchemeBranch.findMany({
            where: { prbPrmId: prmId, prbIsDeleted: false },
            orderBy: [{ prbSlno: 'asc' }, { prbId: 'asc' }],
        });
        return rows.map(promotion_scheme_utils_1.toBranchPayload);
    }
    async deleteBranch(prbId, modifiedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.promotionSchemeBranch.findFirst({
                where: { prbId, prbIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('prb_id', prbId, 'Promotion scheme branch row not found');
            }
            const updated = await tx.promotionSchemeBranch.update({
                where: { prbId },
                data: {
                    prbIsDeleted: true,
                    prbIsActive: false,
                    prbModifiedOn: new Date(),
                    prbModifiedBy: this.resolveWriteActor(modifiedBy),
                },
            });
            await this.audit(tx, 'cancel', BRANCH_TABLE_NAME, prbId, `Scheme ${existing.prbPrmId} / Branch ${existing.prbSlno}`, (0, promotion_scheme_utils_1.toBranchPayload)(existing), (0, promotion_scheme_utils_1.toBranchPayload)(updated), 'Promotion scheme branch row soft deleted');
            return { deleted: true, prm_id: existing.prbPrmId, row_id: prbId };
        });
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
            const updated = await tx.promotionSchemeBranch.update({ where: { prbId: row.prb_id }, data });
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
        });
        await this.audit(tx, 'create', BRANCH_TABLE_NAME, created.prbId, `Scheme ${prmId} / Branch ${created.prbSlno}`, null, (0, promotion_scheme_utils_1.toBranchPayload)(created), 'Promotion scheme branch row created');
        return created;
    }
    async saveParties(dto) {
        return this.prisma
            .$transaction(async (tx) => {
            const scheme = await this.requireScheme(tx, dto.prm_id);
            this.assertNoDuplicates(dto.parties.map((row, index) => ({
                key: `${(row.prp_kind ?? '').toUpperCase()}:${row.prp_scope_id ?? `#${index}`}`,
                index,
            })), 'prp_scope_id');
            const saved = [];
            for (let index = 0; index < dto.parties.length; index += 1) {
                saved.push(await this.savePartyRow(tx, scheme.prmId, dto.parties[index], index));
            }
            return saved.map(promotion_scheme_utils_1.toPartyPayload);
        })
            .catch((error) => {
            (0, promotion_scheme_utils_1.handlePromotionWriteError)(error);
            throw error;
        });
    }
    async getParties(prmId) {
        await this.requireScheme(this.prisma, prmId);
        const rows = await this.prisma.promotionSchemeParty.findMany({
            where: { prpPrmId: prmId, prpIsDeleted: false },
            orderBy: [{ prpMatchPriority: 'desc' }, { prpSlno: 'asc' }, { prpId: 'asc' }],
        });
        return rows.map(promotion_scheme_utils_1.toPartyPayload);
    }
    async deleteParty(prpId, modifiedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.promotionSchemeParty.findFirst({
                where: { prpId, prpIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('prp_id', prpId, 'Promotion scheme party row not found');
            }
            const updated = await tx.promotionSchemeParty.update({
                where: { prpId },
                data: {
                    prpIsDeleted: true,
                    prpIsActive: false,
                    prpModifiedOn: new Date(),
                    prpModifiedBy: this.resolveWriteActor(modifiedBy),
                },
            });
            await this.audit(tx, 'cancel', PARTY_TABLE_NAME, prpId, `Scheme ${existing.prpPrmId} / ${existing.prpKind} ${existing.prpScopeId}`, (0, promotion_scheme_utils_1.toPartyPayload)(existing), (0, promotion_scheme_utils_1.toPartyPayload)(updated), 'Promotion scheme party row soft deleted');
            return { deleted: true, prm_id: existing.prpPrmId, row_id: prpId };
        });
    }
    async savePartyRow(tx, prmId, row, index) {
        const slno = row.prp_slno ?? index + 1;
        (0, promotion_scheme_utils_1.requireInteger)(slno, 'prp_slno', 1);
        if (row.prp_id) {
            const existing = await tx.promotionSchemeParty.findFirst({
                where: { prpId: row.prp_id, prpPrmId: prmId, prpIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('prp_id', row.prp_id, 'Promotion scheme party row not found');
            }
            const data = {
                prpModifiedOn: new Date(),
                prpModifiedBy: this.resolveWriteActor(row.prp_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_slno'))
                data.prpSlno = slno;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_kind')) {
                data.prpKind = (0, promotion_scheme_utils_1.requireEnum)(row.prp_kind, 'prp_kind', promotion_scheme_utils_1.PRP_KINDS);
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_scope_id')) {
                data.prpScopeId = (0, promotion_scheme_utils_1.requireUuid)(row.prp_scope_id, 'prp_scope_id');
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_is_exclude'))
                data.prpIsExclude = row.prp_is_exclude ?? false;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_match_priority')) {
                data.prpMatchPriority = (0, promotion_scheme_utils_1.requireInteger)(row.prp_match_priority, 'prp_match_priority', 0, 9);
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_notes'))
                data.prpNotes = (0, promotion_scheme_utils_1.normalizeNullableString)(row.prp_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prp_is_active'))
                data.prpIsActive = row.prp_is_active ?? true;
            const updated = await tx.promotionSchemeParty.update({ where: { prpId: row.prp_id }, data });
            await this.audit(tx, 'update', PARTY_TABLE_NAME, updated.prpId, `Scheme ${prmId} / ${updated.prpKind} ${updated.prpScopeId}`, (0, promotion_scheme_utils_1.toPartyPayload)(existing), (0, promotion_scheme_utils_1.toPartyPayload)(updated), 'Promotion scheme party row updated');
            return updated;
        }
        const kind = (0, promotion_scheme_utils_1.requireEnum)(row.prp_kind, 'prp_kind', promotion_scheme_utils_1.PRP_KINDS);
        const created = await tx.promotionSchemeParty.create({
            data: {
                prpPrmId: prmId,
                prpSlno: slno,
                prpKind: kind,
                prpScopeId: (0, promotion_scheme_utils_1.requireUuid)(row.prp_scope_id, 'prp_scope_id'),
                prpIsExclude: row.prp_is_exclude ?? false,
                prpMatchPriority: row.prp_match_priority ?? promotion_scheme_utils_1.PRP_DEFAULT_MATCH_PRIORITY[kind] ?? 1,
                prpNotes: (0, promotion_scheme_utils_1.normalizeNullableString)(row.prp_notes),
                prpIsActive: row.prp_is_active ?? true,
                prpCreatedBy: this.resolveWriteActor(row.prp_created_by),
            },
        });
        await this.audit(tx, 'create', PARTY_TABLE_NAME, created.prpId, `Scheme ${prmId} / ${created.prpKind} ${created.prpScopeId}`, null, (0, promotion_scheme_utils_1.toPartyPayload)(created), 'Promotion scheme party row created');
        return created;
    }
    async saveItems(dto) {
        return this.prisma
            .$transaction(async (tx) => {
            const scheme = await this.requireScheme(tx, dto.prm_id);
            this.assertNoDuplicates(dto.items.map((row, index) => ({
                key: `${(row.pri_kind ?? '').toUpperCase()}:${row.pri_scope_id ?? `#${index}`}`,
                index,
            })), 'pri_scope_id');
            const saved = [];
            for (let index = 0; index < dto.items.length; index += 1) {
                saved.push(await this.saveItemRow(tx, scheme.prmId, dto.items[index], index));
            }
            return saved.map(promotion_scheme_utils_1.toItemPayload);
        })
            .catch((error) => {
            (0, promotion_scheme_utils_1.handlePromotionWriteError)(error);
            throw error;
        });
    }
    async getItems(prmId) {
        await this.requireScheme(this.prisma, prmId);
        const rows = await this.prisma.promotionSchemeItem.findMany({
            where: { priPrmId: prmId, priIsDeleted: false },
            orderBy: [{ priMatchPriority: 'desc' }, { priSlno: 'asc' }, { priId: 'asc' }],
        });
        return rows.map(promotion_scheme_utils_1.toItemPayload);
    }
    async deleteItem(priId, modifiedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.promotionSchemeItem.findFirst({
                where: { priId, priIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('pri_id', priId, 'Promotion scheme item row not found');
            }
            const updated = await tx.promotionSchemeItem.update({
                where: { priId },
                data: {
                    priIsDeleted: true,
                    priIsActive: false,
                    priModifiedOn: new Date(),
                    priModifiedBy: this.resolveWriteActor(modifiedBy),
                },
            });
            await this.audit(tx, 'cancel', ITEM_TABLE_NAME, priId, `Scheme ${existing.priPrmId} / ${existing.priKind} ${existing.priScopeId}`, (0, promotion_scheme_utils_1.toItemPayload)(existing), (0, promotion_scheme_utils_1.toItemPayload)(updated), 'Promotion scheme item row soft deleted');
            return { deleted: true, prm_id: existing.priPrmId, row_id: priId };
        });
    }
    async saveItemRow(tx, prmId, row, index) {
        const slno = row.pri_slno ?? index + 1;
        (0, promotion_scheme_utils_1.requireInteger)(slno, 'pri_slno', 1);
        const existing = row.pri_id
            ? await tx.promotionSchemeItem.findFirst({
                where: { priId: row.pri_id, priPrmId: prmId, priIsDeleted: false },
            })
            : null;
        if (row.pri_id && !existing) {
            this.throwNotFound('pri_id', row.pri_id, 'Promotion scheme item row not found');
        }
        const kind = (0, module_service_utils_1.hasOwnProperty)(row, 'pri_kind')
            ? (0, promotion_scheme_utils_1.requireEnum)(row.pri_kind, 'pri_kind', promotion_scheme_utils_1.PRI_KINDS)
            : (existing?.priKind ?? (0, promotion_scheme_utils_1.requireEnum)(row.pri_kind, 'pri_kind', promotion_scheme_utils_1.PRI_KINDS));
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
        this.assertItemInvariants({
            kind,
            unitId,
            discPerc,
            discQty,
            discAmt,
            minQty,
            factor,
            maxBenefit,
            isExclude,
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
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_match_priority')) {
                data.priMatchPriority = (0, promotion_scheme_utils_1.requireInteger)(row.pri_match_priority, 'pri_match_priority', 0, 9);
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_notes'))
                data.priNotes = (0, promotion_scheme_utils_1.normalizeNullableString)(row.pri_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'pri_is_active'))
                data.priIsActive = row.pri_is_active ?? true;
            const updated = await tx.promotionSchemeItem.update({
                where: { priId: existing.priId },
                data,
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
                priMatchPriority: row.pri_match_priority ?? promotion_scheme_utils_1.PRI_DEFAULT_MATCH_PRIORITY[kind] ?? 1,
                priNotes: (0, promotion_scheme_utils_1.normalizeNullableString)(row.pri_notes),
                priIsActive: row.pri_is_active ?? true,
                priCreatedBy: this.resolveWriteActor(row.pri_created_by),
            },
        });
        await this.audit(tx, 'create', ITEM_TABLE_NAME, created.priId, `Scheme ${prmId} / ${created.priKind} ${created.priScopeId}`, null, (0, promotion_scheme_utils_1.toItemPayload)(created), 'Promotion scheme item row created');
        return created;
    }
    assertItemInvariants(row) {
        const errors = [];
        if ((row.kind === 'ITEM') !== (row.unitId !== null)) {
            errors.push({
                field: 'pri_unit_id',
                message: row.kind === 'ITEM'
                    ? 'pri_unit_id is required on an ITEM row — a quantity is meaningless without a unit'
                    : `pri_unit_id must be null on an ${row.kind} row — a unit belongs to one item`,
            });
        }
        const rates = Number(row.discPerc !== 0) + Number(row.discQty !== 0) + Number(row.discAmt !== 0);
        if (rates > 1) {
            errors.push({
                field: 'pri_disc_perc',
                message: 'Set at most one of pri_disc_perc, pri_disc_qty, pri_disc_amt',
            });
        }
        if (row.isExclude && (rates > 0 || row.factor !== 1)) {
            errors.push({
                field: 'pri_is_exclude',
                message: 'An exclude row gives nothing — leave every rate at 0 and pri_factor at 1',
            });
        }
        if (row.discPerc < 0 || row.discPerc > 100) {
            errors.push({ field: 'pri_disc_perc', message: 'pri_disc_perc must be between 0 and 100' });
        }
        if (row.discQty < 0) {
            errors.push({ field: 'pri_disc_qty', message: 'pri_disc_qty must be 0 or more' });
        }
        if (row.discAmt < 0) {
            errors.push({ field: 'pri_disc_amt', message: 'pri_disc_amt must be 0 or more' });
        }
        if (row.minQty < 0) {
            errors.push({ field: 'pri_min_qty', message: 'pri_min_qty must be 0 or more' });
        }
        if (!(row.factor > 0)) {
            errors.push({ field: 'pri_factor', message: 'pri_factor must be greater than 0' });
        }
        if (row.maxBenefit < 0) {
            errors.push({ field: 'pri_max_benefit', message: 'pri_max_benefit must be 0 or more' });
        }
        if (errors.length > 0) {
            this.throwBadRequest('Validation failed', errors);
        }
    }
    async saveSlabs(dto) {
        return this.prisma
            .$transaction(async (tx) => {
            const scheme = await this.requireScheme(tx, dto.prm_id);
            this.assertNoDuplicates(dto.slabs.map((row, index) => ({
                key: `${row.prs_exceeds ?? 0}:${row.prs_free_item_id ?? '-'}`,
                index,
            })), 'prs_exceeds');
            const saved = [];
            for (let index = 0; index < dto.slabs.length; index += 1) {
                saved.push(await this.saveSlabRow(tx, scheme, dto.slabs[index], index));
            }
            return saved.map(promotion_scheme_utils_1.toSlabPayload);
        })
            .catch((error) => {
            (0, promotion_scheme_utils_1.handlePromotionWriteError)(error);
            throw error;
        });
    }
    async getSlabs(prmId) {
        await this.requireScheme(this.prisma, prmId);
        const rows = await this.prisma.promotionSchemeSlab.findMany({
            where: { prsPrmId: prmId, prsIsDeleted: false },
            orderBy: [{ prsExceeds: 'asc' }, { prsSlno: 'asc' }, { prsId: 'asc' }],
        });
        return rows.map(promotion_scheme_utils_1.toSlabPayload);
    }
    async deleteSlab(prsId, modifiedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.promotionSchemeSlab.findFirst({
                where: { prsId, prsIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('prs_id', prsId, 'Promotion scheme slab row not found');
            }
            const updated = await tx.promotionSchemeSlab.update({
                where: { prsId },
                data: {
                    prsIsDeleted: true,
                    prsIsActive: false,
                    prsModifiedOn: new Date(),
                    prsModifiedBy: this.resolveWriteActor(modifiedBy),
                },
            });
            await this.audit(tx, 'cancel', SLAB_TABLE_NAME, prsId, `Scheme ${existing.prsPrmId} / Band ${existing.prsSlno}`, (0, promotion_scheme_utils_1.toSlabPayload)(existing), (0, promotion_scheme_utils_1.toSlabPayload)(updated), 'Promotion scheme slab row soft deleted');
            return { deleted: true, prm_id: existing.prsPrmId, row_id: prsId };
        });
    }
    async saveSlabRow(tx, scheme, row, index) {
        const slno = row.prs_slno ?? index + 1;
        (0, promotion_scheme_utils_1.requireInteger)(slno, 'prs_slno', 1);
        const existing = row.prs_id
            ? await tx.promotionSchemeSlab.findFirst({
                where: { prsId: row.prs_id, prsPrmId: scheme.prmId, prsIsDeleted: false },
            })
            : null;
        if (row.prs_id && !existing) {
            this.throwNotFound('prs_id', row.prs_id, 'Promotion scheme slab row not found');
        }
        const benefit = (0, module_service_utils_1.hasOwnProperty)(row, 'prs_benefit')
            ? (0, promotion_scheme_utils_1.requireEnum)(row.prs_benefit, 'prs_benefit', promotion_scheme_utils_1.PRM_BENEFITS)
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
            benefit,
            exceeds: this.pickNumber(row, 'prs_exceeds', existing?.prsExceeds, 0),
            upto: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_upto')
                ? (row.prs_upto ?? null)
                : existing?.prsUpto === undefined || existing?.prsUpto === null
                    ? null
                    : Number(existing.prsUpto.toString()),
            each: this.pickNumber(row, 'prs_each', existing?.prsEach, 1),
            isRepeat: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_is_repeat')
                ? (row.prs_is_repeat ?? false)
                : (existing?.prsIsRepeat ?? false),
            maxRepeats: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_max_repeats')
                ? (row.prs_max_repeats ?? 0)
                : (existing?.prsMaxRepeats ?? 0),
            freeItemId: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_item_id')
                ? (row.prs_free_item_id ?? null)
                : (existing?.prsFreeItemId ?? null),
            freeUnitId: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_unit_id')
                ? (row.prs_free_unit_id ?? null)
                : (existing?.prsFreeUnitId ?? null),
            freeQty: this.pickNumber(row, 'prs_free_qty', existing?.prsFreeQty, 0),
            discPerc: this.pickNumber(row, 'prs_disc_perc', existing?.prsDiscPerc, 0),
            discQty: this.pickNumber(row, 'prs_disc_qty', existing?.prsDiscQty, 0),
            discAmt: this.pickNumber(row, 'prs_disc_amt', existing?.prsDiscAmt, 0),
            fixedPrice: (0, module_service_utils_1.hasOwnProperty)(row, 'prs_fixed_price')
                ? (row.prs_fixed_price ?? null)
                : existing?.prsFixedPrice === undefined || existing?.prsFixedPrice === null
                    ? null
                    : Number(existing.prsFixedPrice.toString()),
            maxBenefitAmt: this.pickNumber(row, 'prs_max_benefit_amt', existing?.prsMaxBenefitAmt, 0),
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
                data.prsExceeds = band.exceeds;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_upto'))
                data.prsUpto = band.upto;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_each'))
                data.prsEach = band.each;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_is_repeat'))
                data.prsIsRepeat = band.isRepeat;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_max_repeats'))
                data.prsMaxRepeats = band.maxRepeats;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_item_id'))
                data.prsFreeItemId = band.freeItemId;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_unit_id'))
                data.prsFreeUnitId = band.freeUnitId;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_qty'))
                data.prsFreeQty = band.freeQty;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_free_stock_check')) {
                data.prsFreeStockCheck = row.prs_free_stock_check ?? true;
            }
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_disc_perc'))
                data.prsDiscPerc = band.discPerc;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_disc_qty'))
                data.prsDiscQty = band.discQty;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_disc_amt'))
                data.prsDiscAmt = band.discAmt;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_fixed_price'))
                data.prsFixedPrice = band.fixedPrice;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_max_benefit_amt'))
                data.prsMaxBenefitAmt = band.maxBenefitAmt;
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_notes'))
                data.prsNotes = (0, promotion_scheme_utils_1.normalizeNullableString)(row.prs_notes);
            if ((0, module_service_utils_1.hasOwnProperty)(row, 'prs_is_active'))
                data.prsIsActive = row.prs_is_active ?? true;
            const updated = await tx.promotionSchemeSlab.update({
                where: { prsId: existing.prsId },
                data,
            });
            await this.audit(tx, 'update', SLAB_TABLE_NAME, updated.prsId, `Scheme ${scheme.prmId} / Band ${updated.prsSlno}`, (0, promotion_scheme_utils_1.toSlabPayload)(existing), (0, promotion_scheme_utils_1.toSlabPayload)(updated), 'Promotion scheme slab row updated');
            return updated;
        }
        const created = await tx.promotionSchemeSlab.create({
            data: {
                prsPrmId: scheme.prmId,
                prsSlno: slno,
                prsBenefit: benefit,
                prsExceeds: band.exceeds,
                prsUpto: band.upto,
                prsEach: band.each,
                prsIsRepeat: band.isRepeat,
                prsMaxRepeats: band.maxRepeats,
                prsFreeItemId: band.freeItemId,
                prsFreeUnitId: band.freeUnitId,
                prsFreeQty: band.freeQty,
                prsFreeStockCheck: row.prs_free_stock_check ?? true,
                prsDiscPerc: band.discPerc,
                prsDiscQty: band.discQty,
                prsDiscAmt: band.discAmt,
                prsFixedPrice: band.fixedPrice,
                prsMaxBenefitAmt: band.maxBenefitAmt,
                prsNotes: (0, promotion_scheme_utils_1.normalizeNullableString)(row.prs_notes),
                prsIsActive: row.prs_is_active ?? true,
                prsCreatedBy: this.resolveWriteActor(row.prs_created_by),
            },
        });
        await this.audit(tx, 'create', SLAB_TABLE_NAME, created.prsId, `Scheme ${scheme.prmId} / Band ${created.prsSlno}`, null, (0, promotion_scheme_utils_1.toSlabPayload)(created), 'Promotion scheme slab row created');
        return created;
    }
    assertSlabInvariants(band) {
        const errors = [];
        if (band.exceeds < 0) {
            errors.push({ field: 'prs_exceeds', message: 'prs_exceeds must be 0 or more' });
        }
        if (band.upto !== null && band.upto <= band.exceeds) {
            errors.push({ field: 'prs_upto', message: 'prs_upto must be greater than prs_exceeds' });
        }
        if (!(band.each > 0)) {
            errors.push({ field: 'prs_each', message: 'prs_each must be greater than 0' });
        }
        if (band.maxRepeats < 0) {
            errors.push({ field: 'prs_max_repeats', message: 'prs_max_repeats must be 0 or more' });
        }
        if (!band.isRepeat && band.maxRepeats !== 0) {
            errors.push({
                field: 'prs_max_repeats',
                message: 'prs_max_repeats only means something when prs_is_repeat is true',
            });
        }
        if ((band.freeItemId === null) !== (band.freeUnitId === null)) {
            errors.push({
                field: 'prs_free_unit_id',
                message: 'A free item needs the unit it is issued in — send both or neither',
            });
        }
        if (band.discPerc < 0 || band.discPerc > 100) {
            errors.push({ field: 'prs_disc_perc', message: 'prs_disc_perc must be between 0 and 100' });
        }
        if (band.maxBenefitAmt < 0) {
            errors.push({
                field: 'prs_max_benefit_amt',
                message: 'prs_max_benefit_amt must be 0 or more',
            });
        }
        const noDiscounts = band.discPerc === 0 && band.discQty === 0 && band.discAmt === 0;
        const noFree = band.freeItemId === null && band.freeQty === 0;
        switch (band.benefit) {
            case 'FREE_ITEM':
                if (band.freeItemId === null || !(band.freeQty > 0)) {
                    errors.push({
                        field: 'prs_free_item_id',
                        message: 'A FREE_ITEM band needs prs_free_item_id and prs_free_qty greater than 0',
                    });
                }
                if (!noDiscounts || band.fixedPrice !== null) {
                    errors.push({
                        field: 'prs_benefit',
                        message: 'A FREE_ITEM band must leave the discount and fixed-price columns empty',
                    });
                }
                break;
            case 'DISC_PERC':
                if (!(band.discPerc > 0)) {
                    errors.push({
                        field: 'prs_disc_perc',
                        message: 'A DISC_PERC band needs prs_disc_perc greater than 0',
                    });
                }
                if (!noFree || band.discQty !== 0 || band.discAmt !== 0 || band.fixedPrice !== null) {
                    errors.push({
                        field: 'prs_benefit',
                        message: 'A DISC_PERC band must leave every other benefit column empty',
                    });
                }
                break;
            case 'DISC_AMT':
                if (band.discAmt > 0 === band.discQty > 0) {
                    errors.push({
                        field: 'prs_disc_amt',
                        message: 'A DISC_AMT band needs exactly one of prs_disc_amt (flat) or prs_disc_qty (per unit)',
                    });
                }
                if (!noFree || band.discPerc !== 0 || band.fixedPrice !== null) {
                    errors.push({
                        field: 'prs_benefit',
                        message: 'A DISC_AMT band must leave the free-item, percentage and price columns empty',
                    });
                }
                break;
            case 'FIXED_PRICE':
                if (band.fixedPrice === null) {
                    errors.push({
                        field: 'prs_fixed_price',
                        message: 'A FIXED_PRICE band needs prs_fixed_price',
                    });
                }
                if (!noFree || !noDiscounts) {
                    errors.push({
                        field: 'prs_benefit',
                        message: 'A FIXED_PRICE band must leave the free-item and discount columns empty',
                    });
                }
                break;
            default:
                errors.push({ field: 'prs_benefit', message: `Unknown benefit ${band.benefit}` });
        }
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
                },
                parties: {
                    where: { prpIsDeleted: false },
                    orderBy: [{ prpMatchPriority: 'desc' }, { prpSlno: 'asc' }, { prpId: 'asc' }],
                },
                items: {
                    where: { priIsDeleted: false },
                    orderBy: [{ priMatchPriority: 'desc' }, { priSlno: 'asc' }, { priId: 'asc' }],
                },
                slabs: {
                    where: { prsIsDeleted: false },
                    orderBy: [{ prsExceeds: 'asc' }, { prsSlno: 'asc' }, { prsId: 'asc' }],
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