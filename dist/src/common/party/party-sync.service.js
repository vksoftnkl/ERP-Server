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
exports.PartySyncService = exports.NO_PARTY_SYNC = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const audit_log_service_1 = require("../../modules/audit-log/audit-log.service");
const module_shared_utils_1 = require("../utils/module-shared.utils");
const party_detail_map_1 = require("./party-detail.map");
exports.NO_PARTY_SYNC = Object.freeze({
    otherRole: null,
    otherRoleUpdated: false,
    fields: [],
});
const ROLE_TABLE = {
    CUSTOMER: { table: 'customers', screen: 'Customer Master' },
    SUPPLIER: { table: 'suppliers', screen: 'Supplier Master' },
};
const OTHER = { CUSTOMER: 'SUPPLIER', SUPPLIER: 'CUSTOMER' };
const GST_TYPE_KEY = { CUSTOMER: 'cusGstType', SUPPLIER: 'supGstType' };
let PartySyncService = class PartySyncService {
    auditLogService;
    constructor(auditLogService) {
        this.auditLogService = auditLogService;
    }
    detailsOf(role, dto, overrides = {}) {
        const details = {};
        const record = dto;
        for (const field of party_detail_map_1.PARTY_DETAIL_FIELDS) {
            const key = (0, party_detail_map_1.roleKeyOf)(field, role);
            if (key !== null && (0, module_shared_utils_1.isPresentField)(dto, key)) {
                details[field.led] = record[key];
            }
        }
        return { ...details, ...overrides };
    }
    async syncOtherRole(tx, input) {
        const otherRole = OTHER[input.role];
        const existing = await this.loadRole(tx, otherRole, input.partyId);
        if (!existing) {
            return { ...exports.NO_PARTY_SYNC, fields: [] };
        }
        const changes = {};
        for (const field of [...party_detail_map_1.PARTY_REQUIRED_FIELDS, ...party_detail_map_1.PARTY_DETAIL_FIELDS]) {
            const key = (0, party_detail_map_1.roleKeyOf)(field, otherRole);
            if (key === null || !(field.led in input.details)) {
                continue;
            }
            const value = input.details[field.led] ?? null;
            if (!sameValue(existing[key], value)) {
                changes[key] = value;
            }
        }
        const gstKey = GST_TYPE_KEY[otherRole];
        if (!sameValue(existing[gstKey], input.gstType)) {
            changes[gstKey] = input.gstType;
        }
        const fields = Object.keys(changes);
        if (fields.length === 0) {
            return { otherRole, otherRoleUpdated: false, fields: [] };
        }
        const nameKey = otherRole === 'CUSTOMER' ? 'cusName' : 'supName';
        const companyKey = otherRole === 'CUSTOMER' ? 'cusCompanyId' : 'supCompanyId';
        if (input.assertOtherNameFree && (nameKey in changes || companyKey in changes)) {
            const name = (changes[nameKey] ?? existing[nameKey]);
            const companyId = (companyKey in changes ? changes[companyKey] : existing[companyKey]);
            if (name) {
                await input.assertOtherNameFree(name, companyId);
            }
        }
        const now = new Date();
        const updated = otherRole === 'SUPPLIER'
            ? await tx.supplier.update({
                where: { supId: input.partyId },
                data: {
                    ...changes,
                    supModifiedOn: now,
                    supModifiedBy: input.actor,
                },
            })
            : await tx.customer.update({
                where: { cusId: input.partyId },
                data: {
                    ...changes,
                    cusModifiedOn: now,
                    cusModifiedBy: input.actor,
                },
            });
        const after = updated;
        const { table, screen } = ROLE_TABLE[otherRole];
        await this.auditLogService.logEntityChange({
            action: 'update',
            tableName: table,
            screenName: screen,
            screenType: 'master',
            pk: input.partyId,
            displayName: String(after[nameKey] ?? input.partyId),
            originalRecord: jsonSafe(existing),
            modifiedRecord: jsonSafe(after),
            userId: input.actor,
            notes: `Party details updated from ${ROLE_TABLE[input.role].screen}`,
        }, tx);
        return { otherRole, otherRoleUpdated: true, fields };
    }
    async loadRole(tx, role, partyId) {
        const row = role === 'SUPPLIER'
            ? await tx.supplier.findFirst({ where: { supId: partyId, supIsDeleted: false } })
            : await tx.customer.findFirst({ where: { cusId: partyId, cusIsDeleted: false } });
        return row ?? null;
    }
};
exports.PartySyncService = PartySyncService;
exports.PartySyncService = PartySyncService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [audit_log_service_1.AuditLogService])
], PartySyncService);
function sameValue(a, b) {
    const blank = (v) => v === null || v === undefined || v === '';
    if (blank(a) || blank(b)) {
        return blank(a) && blank(b);
    }
    return String(a) === String(b);
}
function jsonSafe(record) {
    const out = {};
    for (const [key, value] of Object.entries(record)) {
        if (value instanceof Date) {
            out[key] = value.toISOString();
        }
        else if (value instanceof client_1.Prisma.Decimal) {
            out[key] = value.toString();
        }
        else {
            out[key] = value;
        }
    }
    return out;
}
//# sourceMappingURL=party-sync.service.js.map