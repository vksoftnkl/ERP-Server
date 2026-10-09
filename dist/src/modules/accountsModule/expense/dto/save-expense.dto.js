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
exports.ExpenseReasonQueryDto = exports.ExpenseLedgerPickQueryDto = exports.SaveExpenseDto = exports.ExpenseGstBillDto = exports.ExpenseTenderDto = exports.ExpenseLineDto = exports.CancelExpenseDto = exports.ExpenseKeyDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const expense_enum_1 = require("../types/expense-enum");
class ExpenseKeyDto {
    companyId;
    branchId;
    accYear;
    voucherId;
}
exports.ExpenseKeyDto = ExpenseKeyDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ExpenseKeyDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ExpenseKeyDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027', description: 'acc_voucher_header is partitioned by year.' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], ExpenseKeyDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ExpenseKeyDto.prototype, "voucherId", void 0);
class CancelExpenseDto extends ExpenseKeyDto {
    reason;
}
exports.CancelExpenseDto = CancelExpenseDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'Entered twice', maxLength: 250 }),
    (0, dtoDecorators_1.UpperMaxString)(250),
    __metadata("design:type", String)
], CancelExpenseDto.prototype, "reason", void 0);
class ExpenseLineDto {
    rowNo;
    ledgerId;
    amount;
    description;
    costCentreId;
    taxId;
    hsn;
    itc;
}
exports.ExpenseLineDto = ExpenseLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, example: 1 }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], ExpenseLineDto.prototype, "rowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'An expense ledger (under an Expenses group). A party, cash, bank or tax ledger is refused.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ExpenseLineDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 250,
        minimum: 0.01,
        description: 'Without a GST bill: the whole amount. With one: the taxable value; the tax is worked out.',
    }),
    (0, dtoDecorators_1.RequiredNumber)(0.01),
    __metadata("design:type", Number)
], ExpenseLineDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250, example: 'Tea for the staff' }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], ExpenseLineDto.prototype, "description", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ExpenseLineDto.prototype, "costCentreId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'With a GST bill: inventory.tax_rate_master.tax_id. Ignored without one.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], ExpenseLineDto.prototype, "taxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 10, example: '996331' }),
    (0, dtoDecorators_1.NullableString)(10),
    __metadata("design:type", Object)
], ExpenseLineDto.prototype, "hsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        default: true,
        description: 'With a GST bill: claim the input tax. False = the tax is part of the expense.',
    }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], ExpenseLineDto.prototype, "itc", void 0);
class ExpenseTenderDto {
    tdId;
    tdRowNo;
    tdTenderId;
    tdTenderTypeId;
    tdTenderLedgerId;
    tdAmount;
    tdReceivedAmt;
    tdChangeAmt;
    tdRefNo;
    tdBankName;
    tdPayerVpa;
    tdNotes;
}
exports.ExpenseTenderDto = ExpenseTenderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = update that row.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ExpenseTenderDto.prototype, "tdId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ minimum: 1, example: 1 }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], ExpenseTenderDto.prototype, "tdRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_tender_master.tnd_id.' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ExpenseTenderDto.prototype, "tdTenderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'acc_tender_types.ttm_type_id (1 = CASH), checked against the master.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], ExpenseTenderDto.prototype, "tdTenderTypeId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Only when the tender master allows editing its ledger (tnd_edit_ledger).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], ExpenseTenderDto.prototype, "tdTenderLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 250, minimum: 0 }),
    (0, dtoDecorators_1.RequiredNumber)(0),
    __metadata("design:type", Number)
], ExpenseTenderDto.prototype, "tdAmount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 500, minimum: 0, description: 'Cash only.' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], ExpenseTenderDto.prototype, "tdReceivedAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 250, minimum: 0, description: 'Cash only.' }),
    (0, dtoDecorators_1.OptionalNumber)(0),
    __metadata("design:type", Number)
], ExpenseTenderDto.prototype, "tdChangeAmt", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 100,
        description: 'UTR / transaction id / last 4.',
    }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], ExpenseTenderDto.prototype, "tdRefNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 150 }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], ExpenseTenderDto.prototype, "tdBankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], ExpenseTenderDto.prototype, "tdPayerVpa", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], ExpenseTenderDto.prototype, "tdNotes", void 0);
class ExpenseGstBillDto {
    supplierGstin;
    invoiceNo;
    invoiceDate;
    placeOfSupplyCode;
}
exports.ExpenseGstBillDto = ExpenseGstBillDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '33AAACT1234F1Z5',
        description: 'Defaults to the supplier ledger’s GSTIN.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{2}[A-Z0-9]{13}$/, { message: 'supplierGstin must be a 15-character GSTIN' }),
    __metadata("design:type", Object)
], ExpenseGstBillDto.prototype, "supplierGstin", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'INV-2231', maxLength: 50 }),
    (0, dtoDecorators_1.UpperMaxString)(50),
    __metadata("design:type", String)
], ExpenseGstBillDto.prototype, "invoiceNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-10-08' }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], ExpenseGstBillDto.prototype, "invoiceDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '33',
        description: 'Place of supply, 2-digit state code. Defaults to the GSTIN’s state; INTER when it is not the company’s.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.Matches)(/^\d{2}$/, { message: 'placeOfSupplyCode must be a 2-digit state code' }),
    __metadata("design:type", Object)
], ExpenseGstBillDto.prototype, "placeOfSupplyCode", void 0);
class SaveExpenseDto {
    voucherId;
    companyId;
    branchId;
    tenantId;
    accYear;
    voucherDate;
    partyId;
    usrRefno;
    remarks;
    reasonId;
    sessionId;
    lines;
    tenders;
    gstBill;
}
exports.SaveExpenseDto = SaveExpenseDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', description: 'Present = edit that DRAFT.' }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", String)
], SaveExpenseDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveExpenseDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], SaveExpenseDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ format: 'uuid', nullable: true }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveExpenseDto.prototype, "tenantId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], SaveExpenseDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-10-08',
        description: 'The voucher date — on a till, the business date.',
    }),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], SaveExpenseDto.prototype, "voucherDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Optional supplier ledger. The expense is still paid now (no outstanding); required with a GST bill.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveExpenseDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 50 }),
    (0, dtoDecorators_1.NullableString)(50),
    __metadata("design:type", Object)
], SaveExpenseDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 500, description: 'Paid to / notes.' }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], SaveExpenseDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The EXPENSE till reason picked (quick-reasons); kept with the draft.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveExpenseDto.prototype, "reasonId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'The client’s till session. The server decides at post (the device’s live session).',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], SaveExpenseDto.prototype, "sessionId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => ExpenseLineDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(expense_enum_1.EXPENSE_LINES_MAX),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExpenseLineDto),
    __metadata("design:type", Array)
], SaveExpenseDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: () => ExpenseTenderDto, isArray: true }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ArrayMaxSize)(expense_enum_1.EXPENSE_TENDERS_MAX),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => ExpenseTenderDto),
    __metadata("design:type", Array)
], SaveExpenseDto.prototype, "tenders", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: () => ExpenseGstBillDto, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => ExpenseGstBillDto),
    __metadata("design:type", Object)
], SaveExpenseDto.prototype, "gstBill", void 0);
class ExpenseLedgerPickQueryDto {
    companyId;
    search;
}
exports.ExpenseLedgerPickQueryDto = ExpenseLedgerPickQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ExpenseLedgerPickQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100, description: 'Part of the name.' }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], ExpenseLedgerPickQueryDto.prototype, "search", void 0);
class ExpenseReasonQueryDto {
    companyId;
}
exports.ExpenseReasonQueryDto = ExpenseReasonQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], ExpenseReasonQueryDto.prototype, "companyId", void 0);
//# sourceMappingURL=save-expense.dto.js.map