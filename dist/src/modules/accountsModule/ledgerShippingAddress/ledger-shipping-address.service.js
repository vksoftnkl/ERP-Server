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
exports.LedgerShippingAddressService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ledger_shipping_address_enum_1 = require("./types/ledger-shipping-address-enum");
const ledger_shipping_address_validation_1 = require("./ledger-shipping-address.validation");
const LEDGER_SHIPPING_ADDRESS_TABLE_NAME = 'acc ship addrs';
const LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME = 'Ledger Shipping Address';
const DEFAULT_ADDR_TYPE = ledger_shipping_address_enum_1.SaaAddrType.SHIP_TO;
let LedgerShippingAddressService = class LedgerShippingAddressService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveLedgerShippingAddressDto) {
        if (saveLedgerShippingAddressDto.saaId) {
            return this.updateAddress(saveLedgerShippingAddressDto);
        }
        return this.createAddress(saveLedgerShippingAddressDto);
    }
    async getById(saaId) {
        const record = await this.prisma.accShipAddr.findFirst({
            where: {
                saaId,
                saaIsDeleted: false,
            },
        });
        if (!record) {
            (0, module_service_utils_1.throwAccountsNotFound)('Ledger shipping address not found', 'saaId', `No active ledger shipping address found with id ${saaId}`);
        }
        return this.toPayload(record);
    }
    async softDelete(saaId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.accShipAddr.findFirst({
                where: {
                    saaId,
                    saaIsDeleted: false,
                },
            });
            if (!existing) {
                (0, module_service_utils_1.throwAccountsNotFound)('Ledger shipping address not found', 'saaId', `No active ledger shipping address found with id ${saaId}`);
            }
            const modifiedOn = new Date();
            const result = await tx.accShipAddr.updateMany({
                where: {
                    saaId,
                    saaIsDeleted: false,
                },
                data: {
                    saaIsDeleted: true,
                    saaIsActive: false,
                    saaModifiedOn: modifiedOn,
                    saaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwAccountsNotFound)('Ledger shipping address not found', 'saaId', `No active ledger shipping address found with id ${saaId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                saaIsDeleted: true,
                saaIsActive: false,
                saaModifiedOn: modifiedOn,
                saaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            });
            await this.auditLogService.logEntityChange({
                action: 'cancel',
                tableName: LEDGER_SHIPPING_ADDRESS_TABLE_NAME,
                screenName: LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: saaId,
                displayName: this.resolveDisplayName(existing),
                originalRecord,
                modifiedRecord,
                userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                notes: 'Ledger shipping address soft deleted',
            }, tx);
            return {
                saaId,
                deleted: true,
            };
        });
    }
    async createAddress(saveLedgerShippingAddressDto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                const saaAddrType = (0, ledger_shipping_address_validation_1.assertSaaAddrType)(saveLedgerShippingAddressDto.saaAddrType ?? DEFAULT_ADDR_TYPE);
                const saaCountryCode = this.resolveCountryCode(saveLedgerShippingAddressDto.saaCountryCode);
                const saaGstin = (0, ledger_shipping_address_validation_1.assertSaaGstin)(saveLedgerShippingAddressDto.saaGstin);
                (0, ledger_shipping_address_validation_1.assertSaaStateCode)(saveLedgerShippingAddressDto.saaStateCode);
                (0, ledger_shipping_address_validation_1.assertSaaPin)(saveLedgerShippingAddressDto.saaPin, saaCountryCode);
                await this.ensureLedgerExists(saveLedgerShippingAddressDto.saaLedgerId, tx);
                if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaCompanyId') &&
                    saveLedgerShippingAddressDto.saaCompanyId !== null &&
                    saveLedgerShippingAddressDto.saaCompanyId !== undefined) {
                    await this.ensureCompanyExists(saveLedgerShippingAddressDto.saaCompanyId, tx);
                }
                if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaBranchId') &&
                    saveLedgerShippingAddressDto.saaBranchId !== null &&
                    saveLedgerShippingAddressDto.saaBranchId !== undefined) {
                    await this.ensureBranchExists(saveLedgerShippingAddressDto.saaBranchId, tx);
                }
                if (saveLedgerShippingAddressDto.saaIsDefault === true) {
                    await this.clearDefaultAddress(tx, saveLedgerShippingAddressDto.saaLedgerId, saaAddrType);
                }
                const now = new Date();
                const data = {
                    saaLedgerId: saveLedgerShippingAddressDto.saaLedgerId,
                    saaAddrType,
                    saaCountryCode,
                    saaGstin,
                    saaCreatedOn: now,
                    saaCreatedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveLedgerShippingAddressDto);
                const created = await tx.accShipAddr.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: LEDGER_SHIPPING_ADDRESS_TABLE_NAME,
                    screenName: LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.saaId,
                    displayName: this.resolveDisplayName(payload),
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Ledger shipping address created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Ledger shipping address already exists', [
                {
                    field: 'saaId',
                    message: 'Duplicate ledger shipping address unique value is not allowed',
                },
            ]);
            throw error;
        }
    }
    async updateAddress(saveLedgerShippingAddressDto) {
        const saaId = saveLedgerShippingAddressDto.saaId;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.accShipAddr.findFirst({
                    where: {
                        saaId,
                        saaIsDeleted: false,
                    },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwAccountsNotFound)('Ledger shipping address not found', 'saaId', `No active ledger shipping address found with id ${saaId}`);
                }
                const nextAddrType = (0, ledger_shipping_address_validation_1.assertSaaAddrType)(saveLedgerShippingAddressDto.saaAddrType ?? existing.saaAddrType);
                const nextLedgerId = saveLedgerShippingAddressDto.saaLedgerId;
                const nextCompanyId = (0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaCompanyId')
                    ? (saveLedgerShippingAddressDto.saaCompanyId ?? null)
                    : existing.saaCompanyId;
                const nextBranchId = (0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaBranchId')
                    ? (saveLedgerShippingAddressDto.saaBranchId ?? null)
                    : existing.saaBranchId;
                const nextCountryCode = this.resolveCountryCode(saveLedgerShippingAddressDto.saaCountryCode ?? existing.saaCountryCode);
                const nextGstin = (0, ledger_shipping_address_validation_1.assertSaaGstin)(saveLedgerShippingAddressDto.saaGstin);
                (0, ledger_shipping_address_validation_1.assertSaaStateCode)(saveLedgerShippingAddressDto.saaStateCode);
                (0, ledger_shipping_address_validation_1.assertSaaPin)(saveLedgerShippingAddressDto.saaPin, nextCountryCode);
                const nextIsDefault = (0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaIsDefault')
                    ? (saveLedgerShippingAddressDto.saaIsDefault ?? false)
                    : existing.saaIsDefault;
                await this.ensureLedgerExists(nextLedgerId, tx);
                if (nextCompanyId !== null) {
                    await this.ensureCompanyExists(nextCompanyId, tx);
                }
                if (nextBranchId !== null) {
                    await this.ensureBranchExists(nextBranchId, tx);
                }
                if (nextIsDefault) {
                    await this.clearDefaultAddress(tx, nextLedgerId, nextAddrType, saaId);
                }
                const data = {
                    saaLedgerId: nextLedgerId,
                    saaAddrType: nextAddrType,
                    saaCountryCode: nextCountryCode,
                    saaGstin: nextGstin,
                    saaModifiedOn: new Date(),
                    saaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                };
                this.applyOptionalFields(data, saveLedgerShippingAddressDto);
                const updated = await tx.accShipAddr.update({
                    where: {
                        saaId,
                    },
                    data,
                });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: LEDGER_SHIPPING_ADDRESS_TABLE_NAME,
                    screenName: LEDGER_SHIPPING_ADDRESS_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: saaId,
                    displayName: this.resolveDisplayName(payload),
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Ledger shipping address updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Ledger shipping address already exists', [
                {
                    field: 'saaId',
                    message: 'Duplicate ledger shipping address unique value is not allowed',
                },
            ]);
            throw error;
        }
    }
    async ensureLedgerExists(ledgerId, tx) {
        const ledger = await tx.accLedgerMaster.findFirst({
            where: {
                ledId: ledgerId,
                ledIsDeleted: false,
            },
            select: {
                ledId: true,
            },
        });
        if (!ledger) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Ledger does not exist', [
                {
                    field: 'saaLedgerId',
                    message: `No active ledger found with id ${ledgerId}`,
                },
            ]);
        }
    }
    async ensureCompanyExists(companyId, tx) {
        const company = await tx.company.findFirst({
            where: {
                compId: companyId,
                compIsDeleted: false,
            },
            select: {
                compId: true,
            },
        });
        if (!company) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Company does not exist', [
                {
                    field: 'saaCompanyId',
                    message: `No active company found with id ${companyId}`,
                },
            ]);
        }
    }
    async ensureBranchExists(branchId, tx) {
        const branch = await tx.branchMaster.findFirst({
            where: {
                brId: branchId,
                brIsDeleted: false,
            },
            select: {
                brId: true,
            },
        });
        if (!branch) {
            (0, module_service_utils_1.throwAccountsBadRequest)('Branch does not exist', [
                {
                    field: 'saaBranchId',
                    message: `No active branch found with id ${branchId}`,
                },
            ]);
        }
    }
    async clearDefaultAddress(tx, ledgerId, addrType, excludeSaaId) {
        await tx.accShipAddr.updateMany({
            where: {
                saaLedgerId: ledgerId,
                saaAddrType: addrType,
                saaIsDeleted: false,
                saaIsDefault: true,
                ...(excludeSaaId
                    ? {
                        saaId: {
                            not: excludeSaaId,
                        },
                    }
                    : {}),
            },
            data: {
                saaIsDefault: false,
                saaModifiedOn: new Date(),
                saaModifiedBy: this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
            },
        });
    }
    applyOptionalFields(data, saveLedgerShippingAddressDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaCompanyId')) {
            data.saaCompanyId = saveLedgerShippingAddressDto.saaCompanyId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaBranchId')) {
            data.saaBranchId = saveLedgerShippingAddressDto.saaBranchId;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaIsDefault')) {
            data.saaIsDefault = saveLedgerShippingAddressDto.saaIsDefault;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaSort')) {
            data.saaSort = saveLedgerShippingAddressDto.saaSort;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaTradeName')) {
            data.saaTradeName = saveLedgerShippingAddressDto.saaTradeName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaContactName')) {
            data.saaContactName = saveLedgerShippingAddressDto.saaContactName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaAddr1')) {
            data.saaAddr1 = saveLedgerShippingAddressDto.saaAddr1;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaAddr2')) {
            data.saaAddr2 = saveLedgerShippingAddressDto.saaAddr2;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaAddr3')) {
            data.saaAddr3 = saveLedgerShippingAddressDto.saaAddr3;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaLocation')) {
            data.saaLocation = saveLedgerShippingAddressDto.saaLocation;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaPin')) {
            data.saaPin = saveLedgerShippingAddressDto.saaPin;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaStateCode')) {
            data.saaStateCode = saveLedgerShippingAddressDto.saaStateCode;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaStateName')) {
            data.saaStateName = saveLedgerShippingAddressDto.saaStateName;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaDistanceKm')) {
            data.saaDistanceKm = saveLedgerShippingAddressDto.saaDistanceKm;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaPhone')) {
            data.saaPhone = saveLedgerShippingAddressDto.saaPhone;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaEmail')) {
            data.saaEmail = saveLedgerShippingAddressDto.saaEmail;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaSyncedOn')) {
            data.saaSyncedOn = saveLedgerShippingAddressDto.saaSyncedOn;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaIsActive')) {
            data.saaIsActive = saveLedgerShippingAddressDto.saaIsActive;
        }
        if ((0, module_service_utils_1.hasOwnProperty)(saveLedgerShippingAddressDto, 'saaRemarks')) {
            data.saaRemarks = saveLedgerShippingAddressDto.saaRemarks;
        }
    }
    resolveCountryCode(value) {
        const normalized = (value ?? ledger_shipping_address_validation_1.DEFAULT_COUNTRY_CODE).trim().toUpperCase();
        return normalized || ledger_shipping_address_validation_1.DEFAULT_COUNTRY_CODE;
    }
    resolveDisplayName(record) {
        return record.saaTradeName ?? record.saaContactName ?? record.saaId;
    }
    toPayload(record) {
        return {
            saaId: record.saaId,
            saaCompanyId: record.saaCompanyId,
            saaBranchId: record.saaBranchId,
            saaLedgerId: record.saaLedgerId,
            saaAddrType: record.saaAddrType,
            saaIsDefault: record.saaIsDefault,
            saaSort: record.saaSort,
            saaTradeName: record.saaTradeName,
            saaContactName: record.saaContactName,
            saaAddr1: record.saaAddr1,
            saaAddr2: record.saaAddr2,
            saaAddr3: record.saaAddr3,
            saaLocation: record.saaLocation,
            saaPin: record.saaPin,
            saaStateCode: record.saaStateCode,
            saaStateName: record.saaStateName,
            saaCountryCode: record.saaCountryCode,
            saaDistanceKm: record.saaDistanceKm,
            saaPhone: record.saaPhone,
            saaEmail: record.saaEmail,
            saaGstin: record.saaGstin,
            saaSyncedOn: record.saaSyncedOn ? record.saaSyncedOn.toISOString() : null,
            saaIsActive: record.saaIsActive,
            saaIsDeleted: record.saaIsDeleted,
            saaCreatedOn: record.saaCreatedOn.toISOString(),
            saaCreatedBy: record.saaCreatedBy,
            saaModifiedOn: record.saaModifiedOn.toISOString(),
            saaModifiedBy: record.saaModifiedBy,
            saaRemarks: record.saaRemarks,
        };
    }
};
exports.LedgerShippingAddressService = LedgerShippingAddressService;
exports.LedgerShippingAddressService = LedgerShippingAddressService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], LedgerShippingAddressService);
//# sourceMappingURL=ledger-shipping-address.service.js.map