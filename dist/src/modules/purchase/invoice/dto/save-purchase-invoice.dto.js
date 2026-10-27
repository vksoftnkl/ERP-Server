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
exports.CancelPurchaseInvoiceDto = exports.GetPurchaseInvoiceQueryDto = exports.SavePurchaseInvoiceDto = exports.PurchaseInvoiceHeaderDto = exports.PurchaseChargeDto = exports.PurchaseChargePayeeDto = exports.PurchaseInvoiceLineDto = exports.PurchaseAllocDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
class PurchaseAllocDto {
    godownId;
    bucket;
    batchNo;
    mfgDate;
    expiryDate;
    mrp;
    salePrice;
    serialNo;
    warrantyTo;
    sizeId;
    colourId;
    model;
    qty;
    freeQty;
}
exports.PurchaseAllocDto = PurchaseAllocDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['SALEABLE', 'DAMAGED'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['SALEABLE', 'DAMAGED']),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "bucket", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "batchNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "mfgDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "expiryDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseAllocDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseAllocDto.prototype, "salePrice", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "serialNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "warrantyTo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "sizeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "colourId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], PurchaseAllocDto.prototype, "model", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseAllocDto.prototype, "qty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseAllocDto.prototype, "freeQty", void 0);
class PurchaseInvoiceLineDto {
    lineNo;
    itemId;
    uomId;
    billedQty;
    receivedQty;
    damagedQty;
    freeQty;
    rate;
    discPct;
    discPerQty;
    discAmt;
    schPct;
    schPerQty;
    schAmt;
    extraDiscAmt;
    taxId;
    cessPct;
    cessPerUnit;
    weight;
    mrp;
    sellA;
    sellB;
    sellC;
    sellD;
    markupAPct;
    remarks;
    allocs;
}
exports.PurchaseInvoiceLineDto = PurchaseInvoiceLineDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(1),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "lineNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceLineDto.prototype, "itemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'item_unit_conversion.iuc_id' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceLineDto.prototype, "uomId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "billedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Defaults to billed − damaged.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "receivedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "damagedQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "freeQty", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "rate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "discPct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "discPerQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "discAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "schPct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "schPerQty", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "schAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "extraDiscAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'tax_rate_master.tax_id — the GST % is read from it.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceLineDto.prototype, "taxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "cessPct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "cessPerUnit", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "weight", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "mrp", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "sellA", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "sellB", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "sellC", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "sellD", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceLineDto.prototype, "markupAPct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], PurchaseInvoiceLineDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [PurchaseAllocDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PurchaseAllocDto),
    __metadata("design:type", Array)
], PurchaseInvoiceLineDto.prototype, "allocs", void 0);
class PurchaseChargePayeeDto {
    partyId;
    amount;
}
exports.PurchaseChargePayeeDto = PurchaseChargePayeeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Ledger id (an employee\'s own ledger, a transporter …)' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseChargePayeeDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseChargePayeeDto.prototype, "amount", void 0);
class PurchaseChargeDto {
    chgId;
    rate;
    amount;
    payees;
}
exports.PurchaseChargeDto = PurchaseChargeDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'charge_master.chg_id (module P / B)' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseChargeDto.prototype, "chgId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Per-unit rate / % / fixed amount; default = the master\'s.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseChargeDto.prototype, "rate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'A typed amount wins over the method.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseChargeDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [PurchaseChargePayeeDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PurchaseChargePayeeDto),
    __metadata("design:type", Array)
], PurchaseChargeDto.prototype, "payees", void 0);
class PurchaseInvoiceHeaderDto {
    piId;
    companyId;
    branchId;
    accYear;
    deviceId;
    sessionId;
    supplierId;
    supplierInvNo;
    supplierInvDate;
    docDate;
    goodsReceivedOn;
    godownId;
    mode;
    creditDays;
    invoiceAmountPrinted;
    tcsAmount;
    ewbNo;
    ewbDate;
    irn;
    ackNo;
    remarks;
    post;
}
exports.PurchaseInvoiceHeaderDto = PurchaseInvoiceHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Set to update a draft.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "piId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'fixed.device_master.dev_id — the number series.' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The supplier = its ledger (sup_id = led_id).' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "supplierInvNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "supplierInvDate", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Our entry / posting date.' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "goodsReceivedOn", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "godownId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['CREDIT'] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['CREDIT', 'CASH']),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "mode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseInvoiceHeaderDto.prototype, "creditDays", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The bill total as printed — compared with net payable.' }),
    (0, class_validator_1.IsNumber)(),
    __metadata("design:type", Number)
], PurchaseInvoiceHeaderDto.prototype, "invoiceAmountPrinted", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], PurchaseInvoiceHeaderDto.prototype, "tcsAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(15),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "ewbNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "ewbDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(64),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "irn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "ackNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(500),
    __metadata("design:type", String)
], PurchaseInvoiceHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Save and post in one transaction.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], PurchaseInvoiceHeaderDto.prototype, "post", void 0);
class SavePurchaseInvoiceDto {
    header;
    lines;
    charges;
}
exports.SavePurchaseInvoiceDto = SavePurchaseInvoiceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: PurchaseInvoiceHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => PurchaseInvoiceHeaderDto),
    __metadata("design:type", PurchaseInvoiceHeaderDto)
], SavePurchaseInvoiceDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [PurchaseInvoiceLineDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PurchaseInvoiceLineDto),
    __metadata("design:type", Array)
], SavePurchaseInvoiceDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: [PurchaseChargeDto] }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => PurchaseChargeDto),
    __metadata("design:type", Array)
], SavePurchaseInvoiceDto.prototype, "charges", void 0);
class GetPurchaseInvoiceQueryDto {
    piId;
    accYear;
}
exports.GetPurchaseInvoiceQueryDto = GetPurchaseInvoiceQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], GetPurchaseInvoiceQueryDto.prototype, "piId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], GetPurchaseInvoiceQueryDto.prototype, "accYear", void 0);
class CancelPurchaseInvoiceDto {
    piId;
    accYear;
    reason;
}
exports.CancelPurchaseInvoiceDto = CancelPurchaseInvoiceDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], CancelPurchaseInvoiceDto.prototype, "piId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], CancelPurchaseInvoiceDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], CancelPurchaseInvoiceDto.prototype, "reason", void 0);
//# sourceMappingURL=save-purchase-invoice.dto.js.map