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
exports.ItemsTaxMasterService = void 0;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const audit_log_service_1 = require("../../audit-log/audit-log.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const ITEM_TAX_TABLE_NAME = 'item tax master';
const ITEM_TAX_AUDIT_SCREEN_NAME = 'Item Tax Master';
let ItemsTaxMasterService = class ItemsTaxMasterService {
    prisma;
    auditLogService;
    requestContextService;
    constructor(prisma, auditLogService, requestContextService) {
        this.prisma = prisma;
        this.auditLogService = auditLogService;
        this.requestContextService = requestContextService;
    }
    async save(saveItemTaxDto) {
        if (saveItemTaxDto.tax_id) {
            return this.updateItemTax(saveItemTaxDto);
        }
        return this.createItemTax(saveItemTaxDto);
    }
    async getById(taxId) {
        const record = await this.prisma.itemTaxMaster.findFirst({
            where: { taxId, taxIsDeleted: false },
        });
        if (!record) {
            (0, module_service_utils_1.throwInventoryNotFound)('Item tax not found', 'tax_id', `No active item tax found with id ${taxId}`);
        }
        const payload = this.toPayload(record);
        const ledgerNames = await this.loadLedgerNameMap(record);
        payload.tax_sales_ledger_name = this.ledgerName(ledgerNames, record.taxSalesLedgerId);
        payload.tax_sales_return_ledger_name = this.ledgerName(ledgerNames, record.taxSalesReturnLedgerId);
        payload.tax_purchase_ledger_name = this.ledgerName(ledgerNames, record.taxPurchaseLedgerId);
        payload.tax_purchase_return_ledger_name = this.ledgerName(ledgerNames, record.taxPurchaseReturnLedgerId);
        payload.tax_cgst_output_ledger_name = this.ledgerName(ledgerNames, record.taxCgstOutputLedgerId);
        payload.tax_sgst_output_ledger_name = this.ledgerName(ledgerNames, record.taxSgstOutputLedgerId);
        payload.tax_igst_output_ledger_name = this.ledgerName(ledgerNames, record.taxIgstOutputLedgerId);
        payload.tax_cess_output_ledger_name = this.ledgerName(ledgerNames, record.taxCessOutputLedgerId);
        payload.tax_cgst_input_ledger_name = this.ledgerName(ledgerNames, record.taxCgstInputLedgerId);
        payload.tax_sgst_input_ledger_name = this.ledgerName(ledgerNames, record.taxSgstInputLedgerId);
        payload.tax_igst_input_ledger_name = this.ledgerName(ledgerNames, record.taxIgstInputLedgerId);
        payload.tax_cess_input_ledger_name = this.ledgerName(ledgerNames, record.taxCessInputLedgerId);
        return payload;
    }
    async loadLedgerNameMap(record) {
        const ids = [
            record.taxSalesLedgerId,
            record.taxSalesReturnLedgerId,
            record.taxPurchaseLedgerId,
            record.taxPurchaseReturnLedgerId,
            record.taxCgstOutputLedgerId,
            record.taxSgstOutputLedgerId,
            record.taxIgstOutputLedgerId,
            record.taxCessOutputLedgerId,
            record.taxCgstInputLedgerId,
            record.taxSgstInputLedgerId,
            record.taxIgstInputLedgerId,
            record.taxCessInputLedgerId,
        ].filter((id) => Boolean(id));
        if (ids.length === 0) {
            return new Map();
        }
        const ledgers = await this.prisma.accLedgerMaster.findMany({
            where: { ledId: { in: [...new Set(ids)] } },
            select: { ledId: true, ledName: true },
        });
        return new Map(ledgers.map((ledger) => [ledger.ledId, ledger.ledName]));
    }
    ledgerName(nameById, ledgerId) {
        return ledgerId ? (nameById.get(ledgerId) ?? null) : null;
    }
    async toggleDelete(taxId) {
        return this.prisma.$transaction(async (tx) => {
            const existing = await tx.itemTaxMaster.findFirst({
                where: { taxId },
            });
            if (!existing) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item tax not found', 'tax_id', `No item tax found with id ${taxId}`);
            }
            const wasDeleted = existing.taxIsDeleted;
            const nextDeleted = !wasDeleted;
            const modifiedOn = new Date();
            const userId = this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR;
            const result = await tx.itemTaxMaster.updateMany({
                where: { taxId, taxIsDeleted: wasDeleted },
                data: { taxIsDeleted: nextDeleted, taxModifiedOn: modifiedOn, taxModifiedBy: userId },
            });
            if (result.count === 0) {
                (0, module_service_utils_1.throwInventoryNotFound)('Item tax not found', 'tax_id', `No item tax found with id ${taxId}`);
            }
            const originalRecord = this.toPayload(existing);
            const modifiedRecord = this.toPayload({
                ...existing,
                taxIsDeleted: nextDeleted,
                taxModifiedOn: modifiedOn,
                taxModifiedBy: userId,
            });
            await this.auditLogService.logEntityChange({
                action: nextDeleted ? 'cancel' : 'update',
                tableName: ITEM_TAX_TABLE_NAME,
                screenName: ITEM_TAX_AUDIT_SCREEN_NAME,
                screenType: 'master',
                pk: taxId,
                displayName: existing.taxName,
                originalRecord,
                modifiedRecord,
                userId,
                notes: nextDeleted ? 'Item tax soft deleted' : 'Item tax restored',
            }, tx);
            return { tax_id: taxId, deleted: nextDeleted };
        });
    }
    async createItemTax(saveItemTaxDto) {
        const taxName = saveItemTaxDto.tax_name?.trim();
        if (!taxName) {
            (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                { field: 'tax_name', message: 'tax_name is required' },
            ]);
        }
        const now = new Date();
        const createdBy = (0, module_service_utils_1.resolveActor)(saveItemTaxDto.tax_created_by, this.requestContextService.getUserId());
        const modifiedBy = (0, module_service_utils_1.resolveActor)(saveItemTaxDto.tax_modified_by, createdBy);
        const data = {
            taxName,
            taxCreatedOn: now,
            taxCreatedBy: createdBy,
        };
        this.applyOptionalFields(data, saveItemTaxDto);
        try {
            return await this.prisma.$transaction(async (tx) => {
                const created = await tx.itemTaxMaster.create({ data });
                const payload = this.toPayload(created);
                await this.auditLogService.logEntityChange({
                    action: 'New',
                    tableName: ITEM_TAX_TABLE_NAME,
                    screenName: ITEM_TAX_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: payload.tax_id,
                    displayName: payload.tax_name,
                    originalRecord: null,
                    modifiedRecord: payload,
                    userId: createdBy,
                    notes: 'Item tax created',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    async updateItemTax(saveItemTaxDto) {
        const taxId = saveItemTaxDto.tax_id;
        try {
            return await this.prisma.$transaction(async (tx) => {
                const existing = await tx.itemTaxMaster.findFirst({
                    where: { taxId, taxIsDeleted: false },
                });
                if (!existing) {
                    (0, module_service_utils_1.throwInventoryNotFound)('Item tax not found', 'tax_id', `No active item tax found with id ${taxId}`);
                }
                const taxName = saveItemTaxDto.tax_name?.trim();
                if (!taxName) {
                    (0, module_service_utils_1.throwInventoryBadRequest)('Validation failed', [
                        { field: 'tax_name', message: 'tax_name cannot be empty' },
                    ]);
                }
                const data = {
                    taxName,
                    taxModifiedOn: new Date(),
                    taxModifiedBy: (0, module_service_utils_1.resolveActor)(saveItemTaxDto.tax_modified_by, this.requestContextService.getUserId()),
                };
                this.applyOptionalFields(data, saveItemTaxDto);
                const updated = await tx.itemTaxMaster.update({ where: { taxId }, data });
                const payload = this.toPayload(updated);
                await this.auditLogService.logEntityChange({
                    action: 'update',
                    tableName: ITEM_TAX_TABLE_NAME,
                    screenName: ITEM_TAX_AUDIT_SCREEN_NAME,
                    screenType: 'master',
                    pk: taxId,
                    displayName: payload.tax_name,
                    originalRecord: this.toPayload(existing),
                    modifiedRecord: payload,
                    userId: payload.tax_modified_by ?? this.requestContextService.getUserId() ?? module_service_utils_1.DEFAULT_ACTOR,
                    notes: 'Item tax updated',
                }, tx);
                return payload;
            });
        }
        catch (error) {
            this.handleWriteError(error);
            throw error;
        }
    }
    applyOptionalFields(data, saveItemTaxDto) {
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_code'))
            data.taxCode = saveItemTaxDto.tax_code;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_taxability_type'))
            data.taxTaxabilityType = saveItemTaxDto.tax_taxability_type;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_is_reverse_charge'))
            data.taxIsReverseCharge = saveItemTaxDto.tax_is_reverse_charge;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cgst_perc'))
            data.taxCgstPerc = saveItemTaxDto.tax_cgst_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_sgst_perc'))
            data.taxSgstPerc = saveItemTaxDto.tax_sgst_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_igst_perc'))
            data.taxIgstPerc = saveItemTaxDto.tax_igst_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cgst_pur_perc'))
            data.taxCgstPurPerc = saveItemTaxDto.tax_cgst_pur_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_sgst_pur_perc'))
            data.taxSgstPurPerc = saveItemTaxDto.tax_sgst_pur_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_igst_pur_perc'))
            data.taxIgstPurPerc = saveItemTaxDto.tax_igst_pur_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cess_type'))
            data.taxCessType = saveItemTaxDto.tax_cess_type;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cess_perc'))
            data.taxCessPerc = saveItemTaxDto.tax_cess_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cess_unit'))
            data.taxCessUnit = saveItemTaxDto.tax_cess_unit;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cess_pur_perc'))
            data.taxCessPurPerc = saveItemTaxDto.tax_cess_pur_perc;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cess_pur_unit'))
            data.taxCessPurUnit = saveItemTaxDto.tax_cess_pur_unit;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_gst_rate_total'))
            data.taxGstRateTotal = saveItemTaxDto.tax_gst_rate_total;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_sales_ledger_id'))
            data.taxSalesLedgerId = saveItemTaxDto.tax_sales_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_sales_return_ledger_id'))
            data.taxSalesReturnLedgerId = saveItemTaxDto.tax_sales_return_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_purchase_ledger_id'))
            data.taxPurchaseLedgerId = saveItemTaxDto.tax_purchase_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_purchase_return_ledger_id'))
            data.taxPurchaseReturnLedgerId = saveItemTaxDto.tax_purchase_return_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cgst_output_ledger_id'))
            data.taxCgstOutputLedgerId = saveItemTaxDto.tax_cgst_output_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_sgst_output_ledger_id'))
            data.taxSgstOutputLedgerId = saveItemTaxDto.tax_sgst_output_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_igst_output_ledger_id'))
            data.taxIgstOutputLedgerId = saveItemTaxDto.tax_igst_output_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cess_output_ledger_id'))
            data.taxCessOutputLedgerId = saveItemTaxDto.tax_cess_output_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cgst_input_ledger_id'))
            data.taxCgstInputLedgerId = saveItemTaxDto.tax_cgst_input_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_sgst_input_ledger_id'))
            data.taxSgstInputLedgerId = saveItemTaxDto.tax_sgst_input_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_igst_input_ledger_id'))
            data.taxIgstInputLedgerId = saveItemTaxDto.tax_igst_input_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_cess_input_ledger_id'))
            data.taxCessInputLedgerId = saveItemTaxDto.tax_cess_input_ledger_id;
        if ((0, module_service_utils_1.hasOwnProperty)(saveItemTaxDto, 'tax_is_active'))
            data.taxIsActive = saveItemTaxDto.tax_is_active;
    }
    toPayload(record) {
        return {
            tax_id: record.taxId,
            tax_name: record.taxName,
            tax_code: record.taxCode,
            tax_taxability_type: record.taxTaxabilityType,
            tax_is_reverse_charge: record.taxIsReverseCharge,
            tax_cgst_perc: (0, module_service_utils_1.toNumber)(record.taxCgstPerc),
            tax_sgst_perc: (0, module_service_utils_1.toNumber)(record.taxSgstPerc),
            tax_igst_perc: (0, module_service_utils_1.toNumber)(record.taxIgstPerc),
            tax_cgst_pur_perc: (0, module_service_utils_1.toNumber)(record.taxCgstPurPerc),
            tax_sgst_pur_perc: (0, module_service_utils_1.toNumber)(record.taxSgstPurPerc),
            tax_igst_pur_perc: (0, module_service_utils_1.toNumber)(record.taxIgstPurPerc),
            tax_cess_type: record.taxCessType,
            tax_cess_perc: (0, module_service_utils_1.toNumber)(record.taxCessPerc),
            tax_cess_unit: (0, module_service_utils_1.toNumber)(record.taxCessUnit),
            tax_cess_pur_perc: (0, module_service_utils_1.toNumber)(record.taxCessPurPerc),
            tax_cess_pur_unit: (0, module_service_utils_1.toNumber)(record.taxCessPurUnit),
            tax_gst_rate_total: (0, module_service_utils_1.toNumber)(record.taxGstRateTotal),
            tax_sales_ledger_id: record.taxSalesLedgerId,
            tax_sales_return_ledger_id: record.taxSalesReturnLedgerId,
            tax_purchase_ledger_id: record.taxPurchaseLedgerId,
            tax_purchase_return_ledger_id: record.taxPurchaseReturnLedgerId,
            tax_cgst_output_ledger_id: record.taxCgstOutputLedgerId,
            tax_sgst_output_ledger_id: record.taxSgstOutputLedgerId,
            tax_igst_output_ledger_id: record.taxIgstOutputLedgerId,
            tax_cess_output_ledger_id: record.taxCessOutputLedgerId,
            tax_cgst_input_ledger_id: record.taxCgstInputLedgerId,
            tax_sgst_input_ledger_id: record.taxSgstInputLedgerId,
            tax_igst_input_ledger_id: record.taxIgstInputLedgerId,
            tax_cess_input_ledger_id: record.taxCessInputLedgerId,
            tax_is_active: record.taxIsActive,
            tax_is_deleted: record.taxIsDeleted,
            tax_sync_date: record.taxSyncDate ? record.taxSyncDate.toISOString() : null,
            tax_created_on: record.taxCreatedOn.toISOString(),
            tax_created_by: record.taxCreatedBy,
            tax_modified_on: record.taxModifiedOn.toISOString(),
            tax_modified_by: record.taxModifiedBy,
        };
    }
    handleWriteError(error) {
        (0, module_service_utils_1.throwOnUniqueConstraintError)(error, 'Item tax name already exists', [
            { field: 'tax_name', message: 'Duplicate tax_name is not allowed' },
        ]);
    }
};
exports.ItemsTaxMasterService = ItemsTaxMasterService;
exports.ItemsTaxMasterService = ItemsTaxMasterService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        audit_log_service_1.AuditLogService,
        request_context_service_1.RequestContextService])
], ItemsTaxMasterService);
//# sourceMappingURL=items-tax-master.service.js.map