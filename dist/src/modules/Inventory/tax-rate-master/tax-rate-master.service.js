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
exports.TaxRateMasterService = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const ledger_map_helper_1 = require("../../accountsModule/ledgerRole/ledger-map.helper");
const tax_rate_ledger_guard_1 = require("./utils/tax-rate-ledger.guard");
const tax_rate_utils_1 = require("./utils/tax-rate.utils");
const SCREEN_NAME = 'Tax Rate Master';
const TAX_TABLE_NAME = 'tax rate master';
const LINE_TABLE_NAME = 'tax rate ledger';
const MAX_SUPERSEDE_DEPTH = 50;
const EDITABLE_LINES_INCLUDE = {
    ledgerOverrides: {
        where: { trlIsDeleted: false },
        orderBy: [{ trlRole: 'asc' }, { trlSupplyNature: 'asc' }, { trlId: 'asc' }],
        include: tax_rate_utils_1.LEDGER_LINE_LOOKUP,
    },
};
const LIVE_LINES_INCLUDE = {
    ledgerOverrides: {
        where: { trlIsDeleted: false, trlIsActive: true },
        orderBy: [{ trlRole: 'asc' }, { trlSupplyNature: 'asc' }, { trlId: 'asc' }],
        include: tax_rate_utils_1.LEDGER_LINE_LOOKUP,
    },
};
let TaxRateMasterService = class TaxRateMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async getById(taxId) {
        const row = await this.findWithLines(this.prisma, taxId);
        if (!row) {
            this.throwNotFound('tax_id', taxId, 'Tax rate not found');
        }
        return (0, tax_rate_utils_1.toTaxRatePayload)(row);
    }
    async list(query) {
        const activeOnly = query.active_only ?? true;
        const search = query.search?.trim();
        const rows = await this.prisma.taxRateMaster.findMany({
            where: {
                taxIsDeleted: false,
                ...(activeOnly ? { taxIsActive: true } : {}),
                ...(query.tax_taxability ? { taxTaxability: query.tax_taxability } : {}),
                ...(query.tax_rate_perc !== undefined ? { taxRatePerc: query.tax_rate_perc } : {}),
                ...(search
                    ? {
                        OR: [
                            { taxName: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                            { taxCode: { contains: search, mode: client_1.Prisma.QueryMode.insensitive } },
                        ],
                    }
                    : {}),
            },
            orderBy: [{ taxSortOrder: 'asc' }, { taxName: 'asc' }, { taxId: 'asc' }],
            include: { ...tax_rate_utils_1.TAX_RATE_LOOKUP, ...LIVE_LINES_INCLUDE },
        });
        return rows.map(tax_rate_utils_1.toTaxRatePayload);
    }
    async resolveLedgers(query) {
        const rate = await this.prisma.taxRateMaster.findFirst({
            where: { taxId: query.tax_id, taxIsDeleted: false },
            select: { taxId: true, taxName: true },
        });
        if (!rate) {
            this.throwNotFound('tax_id', query.tax_id, 'Tax rate not found');
        }
        const supplyNature = query.supply_nature ?? null;
        if (supplyNature !== null && !(0, ledger_map_helper_1.isSupplyNature)(supplyNature)) {
            (0, tax_rate_utils_1.throwTaxRateBadRequest)('Validation failed', [
                {
                    field: 'supply_nature',
                    message: `supply_nature must be ${ledger_map_helper_1.SUPPLY_NATURES.join(' or ')}, or omitted for the answer that serves both`,
                },
            ]);
        }
        const roles = await this.prisma.accLedgerRole.findMany({
            where: { alrByRate: true, alrIsActive: true },
            orderBy: [{ alrSortOrder: 'asc' }, { alrRole: 'asc' }],
            select: { alrRole: true, alrLabel: true, alrGroup: true },
        });
        const requests = roles.map((role) => ({
            role: role.alrRole,
            taxId: rate.taxId,
            supplyNature,
            field: role.alrRole,
        }));
        const resolved = await (0, ledger_map_helper_1.resolveRoleLedgers)(this.prisma, requests, {
            companyId: query.company_id ?? null,
            branchId: query.branch_id ?? null,
            where: 'tax_rate_master',
        });
        return {
            tax_id: rate.taxId,
            tax_name: rate.taxName,
            supply_nature: supplyNature,
            roles: roles.map((role, index) => {
                const answer = resolved.get((0, ledger_map_helper_1.roleLedgerKey)(requests[index])) ?? null;
                return {
                    role: role.alrRole,
                    role_label: role.alrLabel,
                    role_group: role.alrGroup,
                    supply_nature: supplyNature,
                    ledger_id: answer?.ledgerId ?? null,
                    ledger_name: answer?.ledgerName ?? null,
                    source: answer === null ? 'UNMAPPED' : answer.source === 'TAX_RATE' ? 'OVERRIDE' : 'DEFAULT',
                    source_row_id: answer?.sourceRowId ?? null,
                };
            }),
        };
    }
    async save(dto) {
        return dto.tax_id ? this.updateTaxRate(dto) : this.createTaxRate(dto);
    }
    async createTaxRate(dto) {
        const actor = this.resolveWriteActor(dto.tax_created_by);
        return this.prisma
            .$transaction(async (tx) => {
            const data = {
                taxName: dto.tax_name,
                taxCreatedBy: actor,
            };
            this.applyHeaderFields(data, dto);
            const effective = this.effectiveTaxRate(null, dto);
            const errors = this.collectHeaderErrors(effective);
            errors.push(...(await this.collectLineErrors(tx, dto.lines ?? [])));
            if (errors.length > 0) {
                (0, tax_rate_utils_1.throwTaxRateBadRequest)('Validation failed', errors);
            }
            await this.assertNameIsFree(tx, effective.taxName, null);
            await this.assertCodeIsFree(tx, effective.taxCode, null);
            await this.assertSupersedesExists(tx, effective.taxSupersedesId);
            const created = await tx.taxRateMaster.create({ data });
            await this.audit(tx, 'insert', TAX_TABLE_NAME, created.taxId, created.taxName, null, (0, tax_rate_utils_1.toTaxRatePayload)({ ...created, ledgerOverrides: [] }), 'Tax rate created');
            await this.syncLines(tx, created.taxId, dto);
            const after = await this.findWithLines(tx, created.taxId);
            return (0, tax_rate_utils_1.toTaxRatePayload)(after ?? { ...created, ledgerOverrides: [] });
        })
            .catch((error) => {
            (0, tax_rate_utils_1.handleTaxRateWriteError)(error);
            throw error;
        });
    }
    async updateTaxRate(dto) {
        const taxId = dto.tax_id;
        return this.prisma
            .$transaction(async (tx) => {
            const existing = await this.findWithLines(tx, taxId);
            if (!existing) {
                this.throwNotFound('tax_id', taxId, 'Tax rate not found');
            }
            const data = {
                taxModifiedOn: new Date(),
                taxModifiedBy: this.resolveWriteActor(dto.tax_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(dto, 'tax_name')) {
                data.taxName = dto.tax_name;
            }
            this.applyHeaderFields(data, dto);
            const effective = this.effectiveTaxRate(existing, dto);
            const errors = this.collectHeaderErrors(effective);
            errors.push(...(await this.collectLineErrors(tx, dto.lines ?? [])));
            if (errors.length > 0) {
                (0, tax_rate_utils_1.throwTaxRateBadRequest)('Validation failed', errors);
            }
            await this.assertNameIsFree(tx, effective.taxName, taxId);
            await this.assertCodeIsFree(tx, effective.taxCode, taxId);
            await this.assertSupersedesExists(tx, effective.taxSupersedesId);
            await this.assertNoSupersedeCycle(tx, taxId, effective.taxSupersedesId);
            const updated = await tx.taxRateMaster.update({ where: { taxId }, data });
            await this.syncLines(tx, taxId, dto);
            const after = await this.findWithLines(tx, taxId);
            await this.audit(tx, 'update', TAX_TABLE_NAME, taxId, updated.taxName, (0, tax_rate_utils_1.toTaxRatePayload)(existing), after ? (0, tax_rate_utils_1.toTaxRatePayload)(after) : null, 'Tax rate updated');
            return (0, tax_rate_utils_1.toTaxRatePayload)(after ?? { ...updated, ledgerOverrides: [] });
        })
            .catch((error) => {
            (0, tax_rate_utils_1.handleTaxRateWriteError)(error);
            throw error;
        });
    }
    async softDelete(taxId, modifiedBy) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await this.findWithLines(tx, taxId);
            if (!existing || existing.taxIsDeleted) {
                this.throwNotFound('tax_id', taxId, 'Tax rate not found');
            }
            const actor = this.resolveWriteActor(modifiedBy);
            const modifiedOn = new Date();
            const liveLines = (existing.ledgerOverrides ?? []).filter((line) => !line.trlIsDeleted);
            for (const line of liveLines) {
                await this.softDeleteLineRow(tx, line, actor, modifiedOn);
            }
            const updated = await tx.taxRateMaster.update({
                where: { taxId },
                data: {
                    taxIsDeleted: true,
                    taxIsActive: false,
                    taxModifiedOn: modifiedOn,
                    taxModifiedBy: actor,
                },
            });
            await this.audit(tx, 'cancel', TAX_TABLE_NAME, taxId, updated.taxName, (0, tax_rate_utils_1.toTaxRatePayload)(existing), (0, tax_rate_utils_1.toTaxRatePayload)({ ...updated, ledgerOverrides: [] }), 'Tax rate soft deleted');
            return { tax_id: taxId, deleted: true, lines_deleted: liveLines.length };
        });
    }
    applyHeaderFields(data, dto) {
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'tax_code'))
            data.taxCode = (0, module_service_utils_1.normalizeNullableString)(dto.tax_code);
        if ((0, module_service_utils_1.hasOwnProperty)(dto, 'tax_supersedes_id'))
            data.taxSupersedesId = dto.tax_supersedes_id ?? null;
        if (isPresent(dto.tax_sort_order))
            data.taxSortOrder = dto.tax_sort_order;
        if (isPresent(dto.tax_taxability))
            data.taxTaxability = dto.tax_taxability;
        if (isPresent(dto.tax_is_reverse_charge))
            data.taxIsReverseCharge = dto.tax_is_reverse_charge;
        if (isPresent(dto.tax_rate_perc))
            data.taxRatePerc = dto.tax_rate_perc;
        if (isPresent(dto.tax_cess_basis))
            data.taxCessBasis = dto.tax_cess_basis;
        if (isPresent(dto.tax_cess_perc))
            data.taxCessPerc = dto.tax_cess_perc;
        if (isPresent(dto.tax_cess_per_unit))
            data.taxCessPerUnit = dto.tax_cess_per_unit;
        if (isPresent(dto.tax_acess_basis))
            data.taxAcessBasis = dto.tax_acess_basis;
        if (isPresent(dto.tax_acess_perc))
            data.taxAcessPerc = dto.tax_acess_perc;
        if (isPresent(dto.tax_acess_per_unit))
            data.taxAcessPerUnit = dto.tax_acess_per_unit;
        if (isPresent(dto.tax_is_active))
            data.taxIsActive = dto.tax_is_active;
    }
    effectiveTaxRate(existing, dto) {
        const num = (sent, stored) => isPresent(sent) ? sent : stored !== undefined ? (0, module_service_utils_1.toNumber)(stored) : 0;
        return {
            taxName: (0, module_service_utils_1.hasOwnProperty)(dto, 'tax_name')
                ? (dto.tax_name ?? '').trim()
                : (existing?.taxName ?? ''),
            taxCode: (0, module_service_utils_1.hasOwnProperty)(dto, 'tax_code')
                ? ((0, module_service_utils_1.normalizeNullableString)(dto.tax_code) ?? null)
                : (existing?.taxCode ?? null),
            taxTaxability: isPresent(dto.tax_taxability)
                ? dto.tax_taxability
                : (existing?.taxTaxability ?? 'TAXABLE'),
            taxRatePerc: num(dto.tax_rate_perc, existing?.taxRatePerc),
            taxCessBasis: isPresent(dto.tax_cess_basis)
                ? dto.tax_cess_basis
                : (existing?.taxCessBasis ?? 'NONE'),
            taxCessPerc: num(dto.tax_cess_perc, existing?.taxCessPerc),
            taxCessPerUnit: num(dto.tax_cess_per_unit, existing?.taxCessPerUnit),
            taxAcessBasis: isPresent(dto.tax_acess_basis)
                ? dto.tax_acess_basis
                : (existing?.taxAcessBasis ?? 'NONE'),
            taxAcessPerc: num(dto.tax_acess_perc, existing?.taxAcessPerc),
            taxAcessPerUnit: num(dto.tax_acess_per_unit, existing?.taxAcessPerUnit),
            taxSupersedesId: (0, module_service_utils_1.hasOwnProperty)(dto, 'tax_supersedes_id')
                ? (dto.tax_supersedes_id ?? null)
                : (existing?.taxSupersedesId ?? null),
        };
    }
    collectHeaderErrors(rate) {
        const errors = [];
        if (!rate.taxName) {
            (0, tax_rate_utils_1.pushError)(errors, 'tax_name', 'tax_name is required');
        }
        if (!tax_rate_utils_1.TAX_TAXABILITIES.includes(rate.taxTaxability)) {
            (0, tax_rate_utils_1.pushError)(errors, 'tax_taxability', `tax_taxability must be one of ${tax_rate_utils_1.TAX_TAXABILITIES.join(', ')}`);
        }
        if (rate.taxRatePerc < 0 || rate.taxRatePerc > tax_rate_utils_1.MAX_TAX_RATE_PERC) {
            (0, tax_rate_utils_1.pushError)(errors, 'tax_rate_perc', `tax_rate_perc must be between 0 and ${tax_rate_utils_1.MAX_TAX_RATE_PERC}`);
        }
        this.collectCessErrors(errors, 'tax_cess', rate.taxCessBasis, rate.taxCessPerc, rate.taxCessPerUnit);
        this.collectCessErrors(errors, 'tax_acess', rate.taxAcessBasis, rate.taxAcessPerc, rate.taxAcessPerUnit);
        if (tax_rate_utils_1.ZERO_ONLY_TAXABILITIES.includes(rate.taxTaxability)) {
            const charged = rate.taxRatePerc !== 0 ||
                rate.taxCessPerc !== 0 ||
                rate.taxCessPerUnit !== 0 ||
                rate.taxAcessPerc !== 0 ||
                rate.taxAcessPerUnit !== 0;
            if (charged) {
                (0, tax_rate_utils_1.pushError)(errors, 'tax_taxability', `A ${rate.taxTaxability} rate charges nothing by definition — the rate and both cess ` +
                    'figures must all be 0. Use ZERO_RATED for an export, which is taxable at 0%.');
            }
        }
        return errors;
    }
    collectCessErrors(errors, prefix, basis, perc, perUnit) {
        if (!tax_rate_utils_1.CESS_BASES.includes(basis)) {
            (0, tax_rate_utils_1.pushError)(errors, `${prefix}_basis`, `${prefix}_basis must be one of ${tax_rate_utils_1.CESS_BASES.join(', ')}`);
            return;
        }
        if (perc < 0)
            (0, tax_rate_utils_1.pushError)(errors, `${prefix}_perc`, `${prefix}_perc must not be negative`);
        if (perUnit < 0) {
            (0, tax_rate_utils_1.pushError)(errors, `${prefix}_per_unit`, `${prefix}_per_unit must not be negative`);
        }
        const wantsPerc = basis === 'PERCENT' || basis === 'BOTH';
        const wantsPerUnit = basis === 'PER_UNIT' || basis === 'BOTH';
        if (wantsPerc && perc <= 0) {
            (0, tax_rate_utils_1.pushError)(errors, `${prefix}_perc`, `${prefix}_basis is ${basis}, so ${prefix}_perc must be > 0`);
        }
        if (!wantsPerc && perc !== 0) {
            (0, tax_rate_utils_1.pushError)(errors, `${prefix}_perc`, `${prefix}_basis is ${basis}, so ${prefix}_perc must be 0`);
        }
        if (wantsPerUnit && perUnit <= 0) {
            (0, tax_rate_utils_1.pushError)(errors, `${prefix}_per_unit`, `${prefix}_basis is ${basis}, so ${prefix}_per_unit must be > 0`);
        }
        if (!wantsPerUnit && perUnit !== 0) {
            (0, tax_rate_utils_1.pushError)(errors, `${prefix}_per_unit`, `${prefix}_basis is ${basis}, so ${prefix}_per_unit must be 0`);
        }
    }
    async assertNameIsFree(client, taxName, excludeTaxId) {
        if (!taxName)
            return;
        const clash = await client.taxRateMaster.findFirst({
            where: {
                taxIsDeleted: false,
                taxName: { equals: taxName, mode: client_1.Prisma.QueryMode.insensitive },
                ...(excludeTaxId ? { taxId: { not: excludeTaxId } } : {}),
            },
            select: { taxId: true, taxName: true },
        });
        if (clash) {
            (0, tax_rate_utils_1.throwTaxRateConflict)('Tax rate name already exists', [
                {
                    field: 'tax_name',
                    message: `"${clash.taxName}" is already in use by rate ${clash.taxId}`,
                },
            ]);
        }
    }
    async assertCodeIsFree(client, taxCode, excludeTaxId) {
        if (!taxCode)
            return;
        const clash = await client.taxRateMaster.findFirst({
            where: {
                taxIsDeleted: false,
                taxCode: { equals: taxCode, mode: client_1.Prisma.QueryMode.insensitive },
                ...(excludeTaxId ? { taxId: { not: excludeTaxId } } : {}),
            },
            select: { taxId: true, taxCode: true },
        });
        if (clash) {
            (0, tax_rate_utils_1.throwTaxRateConflict)('Tax rate code already exists', [
                {
                    field: 'tax_code',
                    message: `"${clash.taxCode}" is already in use by rate ${clash.taxId}`,
                },
            ]);
        }
    }
    async assertSupersedesExists(client, supersedesId) {
        if (!supersedesId)
            return;
        const target = await client.taxRateMaster.findFirst({
            where: { taxId: supersedesId },
            select: { taxId: true },
        });
        if (!target) {
            this.throwNotFound('tax_supersedes_id', supersedesId, 'Superseded tax rate not found');
        }
    }
    async assertNoSupersedeCycle(client, taxId, supersedesId) {
        if (!supersedesId)
            return;
        if (supersedesId === taxId) {
            (0, tax_rate_utils_1.throwTaxRateBadRequest)('Validation failed', [
                { field: 'tax_supersedes_id', message: 'A tax rate cannot supersede itself' },
            ]);
        }
        let cursor = supersedesId;
        for (let depth = 0; cursor && depth < MAX_SUPERSEDE_DEPTH; depth += 1) {
            const node = await client.taxRateMaster.findFirst({
                where: { taxId: cursor },
                select: { taxSupersedesId: true },
            });
            cursor = node?.taxSupersedesId ?? null;
            if (cursor === taxId) {
                (0, tax_rate_utils_1.throwTaxRateBadRequest)('Validation failed', [
                    {
                        field: 'tax_supersedes_id',
                        message: 'That rate already supersedes this one — the chain would loop',
                    },
                ]);
            }
        }
    }
    async syncLines(tx, taxId, dto) {
        if (dto.lines === undefined)
            return;
        const actor = this.resolveWriteActor(dto.tax_modified_by ?? dto.tax_created_by);
        const kept = [];
        for (let index = 0; index < dto.lines.length; index += 1) {
            const saved = await this.saveLineRow(tx, taxId, dto.lines[index]);
            kept.push(saved.trlId);
        }
        const stale = await tx.taxRateLedger.findMany({
            where: { trlTaxId: taxId, trlIsDeleted: false, trlId: { notIn: kept } },
        });
        const now = new Date();
        for (const row of stale) {
            await this.softDeleteLineRow(tx, row, actor, now);
        }
    }
    collectLineErrors(tx, lines) {
        return (0, tax_rate_ledger_guard_1.collectTaxRateLedgerErrors)(tx, lines, { companyId: null });
    }
    async saveLineRow(tx, taxId, line) {
        if (line.trl_id) {
            const existing = await tx.taxRateLedger.findFirst({
                where: { trlId: line.trl_id, trlTaxId: taxId, trlIsDeleted: false },
            });
            if (!existing) {
                this.throwNotFound('trl_id', line.trl_id, 'Tax rate ledger line not found on this rate');
            }
            const data = {
                trlModifiedOn: new Date(),
                trlModifiedBy: this.resolveWriteActor(line.trl_modified_by),
            };
            if ((0, module_service_utils_1.hasOwnProperty)(line, 'trl_role'))
                data.trlRole = line.trl_role;
            if ((0, module_service_utils_1.hasOwnProperty)(line, 'trl_supply_nature')) {
                data.trlSupplyNature = line.trl_supply_nature ?? null;
            }
            if ((0, module_service_utils_1.hasOwnProperty)(line, 'trl_ledger_id'))
                data.trlLedgerId = line.trl_ledger_id;
            if ((0, module_service_utils_1.hasOwnProperty)(line, 'trl_remarks')) {
                data.trlRemarks = (0, module_service_utils_1.normalizeNullableString)(line.trl_remarks);
            }
            if (isPresent(line.trl_is_active))
                data.trlIsActive = line.trl_is_active;
            const updated = await tx.taxRateLedger.update({
                where: { trlId: line.trl_id },
                data,
                include: tax_rate_utils_1.LEDGER_LINE_LOOKUP,
            });
            await this.audit(tx, 'update', LINE_TABLE_NAME, updated.trlId, this.describeLine(updated), (0, tax_rate_utils_1.toLedgerLinePayload)(existing), (0, tax_rate_utils_1.toLedgerLinePayload)(updated), 'Tax rate ledger line updated');
            return updated;
        }
        const created = await tx.taxRateLedger.create({
            data: {
                trlTaxId: taxId,
                trlRole: line.trl_role,
                trlSupplyNature: line.trl_supply_nature ?? null,
                trlLedgerId: line.trl_ledger_id,
                trlRemarks: (0, module_service_utils_1.normalizeNullableString)(line.trl_remarks) ?? null,
                ...(isPresent(line.trl_is_active) ? { trlIsActive: line.trl_is_active } : {}),
                trlCreatedBy: this.resolveWriteActor(line.trl_created_by),
            },
            include: tax_rate_utils_1.LEDGER_LINE_LOOKUP,
        });
        await this.audit(tx, 'insert', LINE_TABLE_NAME, created.trlId, this.describeLine(created), null, (0, tax_rate_utils_1.toLedgerLinePayload)(created), 'Tax rate ledger line created');
        return created;
    }
    async softDeleteLineRow(tx, existing, actor, modifiedOn) {
        const updated = await tx.taxRateLedger.update({
            where: { trlId: existing.trlId },
            data: {
                trlIsDeleted: true,
                trlIsActive: false,
                trlModifiedOn: modifiedOn,
                trlModifiedBy: actor,
            },
            include: tax_rate_utils_1.LEDGER_LINE_LOOKUP,
        });
        await this.audit(tx, 'cancel', LINE_TABLE_NAME, updated.trlId, this.describeLine(updated), (0, tax_rate_utils_1.toLedgerLinePayload)(existing), (0, tax_rate_utils_1.toLedgerLinePayload)(updated), 'Tax rate ledger line soft deleted');
    }
    describeLine(row) {
        return `${row.trlRole}${row.trlSupplyNature ? ` / ${row.trlSupplyNature}` : ''}`;
    }
    async findWithLines(client, taxId) {
        return client.taxRateMaster.findFirst({
            where: { taxId, taxIsDeleted: false },
            include: { ...tax_rate_utils_1.TAX_RATE_LOOKUP, ...EDITABLE_LINES_INCLUDE },
        });
    }
    resolveWriteActor(explicit) {
        return (0, module_service_utils_1.resolveActor)(explicit, this.requestContextService.getUserId());
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
            userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_AUDIT_ACTOR,
            notes,
        }, tx);
    }
    throwNotFound(field, value, message) {
        (0, module_service_utils_1.throwInventoryNotFound)(message, field, `${field} ${value} was not found`);
    }
};
exports.TaxRateMasterService = TaxRateMasterService;
exports.TaxRateMasterService = TaxRateMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], TaxRateMasterService);
function isPresent(value) {
    return value !== null && value !== undefined;
}
//# sourceMappingURL=tax-rate-master.service.js.map