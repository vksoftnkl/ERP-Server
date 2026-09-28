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
exports.GetVoucherQueryDto = exports.DeleteVoucherDto = exports.CancelVoucherDto = exports.VoucherKeysDto = exports.PostVoucherDto = exports.ValidateVoucherDto = exports.VoucherPayloadDto = exports.VoucherHeaderDto = exports.VoucherNewBillDto = exports.VoucherAllocationDto = exports.VoucherLineDto = exports.VoucherInstrumentDto = exports.VoucherLineGstDto = void 0;
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const dtoDecorators_1 = require("../../../../common/dto/dtoDecorators");
const save_tender_detail_dto_1 = require("../../tenderDetail/dto/save-tender-detail.dto");
const MONEY = /^-?\d{1,16}(\.\d{1,6})?$/;
function MoneyString() {
    return (target, key) => {
        (0, class_transformer_1.Transform)(({ value }) => typeof value === 'number' ? value.toString() : value)(target, key);
        (0, class_validator_1.IsString)()(target, key);
        (0, class_validator_1.Matches)(MONEY, { message: `${String(key)} must be a plain figure, e.g. 25000 or "4000.00"` })(target, key);
    };
}
class VoucherLineGstDto {
    taxId;
    hsn;
    itcEligibility;
}
exports.VoucherLineGstDto = VoucherLineGstDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'inventory.tax_rate_master.tax_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherLineGstDto.prototype, "taxId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '998533', description: 'HSN or SAC. A leading 99 is a service.' }),
    (0, dtoDecorators_1.NullableString)(20),
    __metadata("design:type", Object)
], VoucherLineGstDto.prototype, "hsn", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        enum: ['INPUTS', 'INPUT_SERVICES', 'CAPITAL_GOODS', 'INELIGIBLE'],
        description: 'GSTR-3B table 4 class. Defaults from the ledger’s led_itc_eligibility; meaningful on input-side types only.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsIn)(['INPUTS', 'INPUT_SERVICES', 'CAPITAL_GOODS', 'INELIGIBLE']),
    __metadata("design:type", Object)
], VoucherLineGstDto.prototype, "itcEligibility", void 0);
class VoucherInstrumentDto {
    tenderId;
    refNo;
    instrumentDate;
    bankName;
    cheque;
    bankLedgerId;
    chequeBookId;
    favouring;
    acPayee;
}
exports.VoucherInstrumentDto = VoucherInstrumentDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        format: 'uuid',
        description: 'accounts.acc_tender_master.tnd_id — from GET /vouchers/instruments.',
    }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherInstrumentDto.prototype, "tenderId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 100,
        example: '445123',
        description: 'The cheque / UTR / transaction number. REQUIRED on a cheque and on any tender whose type needs a reference.',
    }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "refNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        example: '2026-10-05',
        description: 'The date on the instrument. REQUIRED on a cheque. Later than the voucher date makes it POST-DATED: ' +
            'its legs post on that day, in a voucher of their own, and its bills settle when it matures.',
    }),
    (0, dtoDecorators_1.NullableDateString)(),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "instrumentDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, maxLength: 150, example: 'KVB' }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "bankName", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: () => save_tender_detail_dto_1.TenderChequeDetailDto,
        nullable: true,
        description: 'Cheque detail (drawer, branch, IFSC, MICR). Ignored on a non-cheque tender.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => save_tender_detail_dto_1.TenderChequeDetailDto),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "cheque", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'PAYMENT: the bank account (a ledger under Bank Accounts / Bank OD) the money leaves. ' +
            'REQUIRED on a cheque, bank transfer or UPI (VCH_BANK_REQUIRED); ignored on cash, which ' +
            'posts to the CASH tender’s own ledger.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "bankLedgerId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'PAYMENT, cheque only: the book the leaf comes from (GET /vouchers/cheque-books). REQUIRED ' +
            '(VCH_BOOK_REQUIRED); it must be drawn on `bankLedgerId` (VCH_BOOK_BANK) and have a leaf left ' +
            '(VCH_BOOK_FINISHED). `refNo` is ignored — the server takes the next leaf.',
    }),
    (0, dtoDecorators_1.NullableUuid)(),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "chequeBookId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        maxLength: 150,
        description: 'PAYMENT: who the cheque / transfer is made out to. Omitted = the party’s name.',
    }),
    (0, dtoDecorators_1.NullableString)(150),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "favouring", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        nullable: true,
        default: true,
        description: 'PAYMENT, cheque only: crossed "A/c Payee" (Q8). Omitted = true.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], VoucherInstrumentDto.prototype, "acPayee", void 0);
class VoucherLineDto {
    rowNo;
    drCr;
    ledgerId;
    amount;
    remarks;
    gst;
    tdsBase;
    instrument;
}
exports.VoucherLineDto = VoucherLineDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 1,
        description: 'The operator’s row. Positive, unique within the voucher.',
    }),
    (0, dtoDecorators_1.RequiredInteger)(1),
    __metadata("design:type", Number)
], VoucherLineDto.prototype, "rowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DR', 'CR'] }),
    (0, class_validator_1.IsIn)(['DR', 'CR']),
    __metadata("design:type", String)
], VoucherLineDto.prototype, "drCr", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_ledger_master.led_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherLineDto.prototype, "ledgerId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 25000, description: 'Positive. The side is drCr.' }),
    MoneyString(),
    __metadata("design:type", String)
], VoucherLineDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 250 }),
    (0, dtoDecorators_1.NullableString)(250),
    __metadata("design:type", Object)
], VoucherLineDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: VoucherLineGstDto, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => VoucherLineGstDto),
    __metadata("design:type", Object)
], VoucherLineDto.prototype, "gst", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        description: 'Does this line’s amount count toward the TDS base? Omitted = the ledger’s led_is_tds_applicable.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Object)
], VoucherLineDto.prototype, "tdsBase", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: VoucherInstrumentDto,
        nullable: true,
        description: 'notes (54): on a type with instruments (the Receipt Voucher), the tender this line’s money came in ' +
            'by. Refused on any other type (VCH_INSTRUMENT_NOT_ALLOWED).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => VoucherInstrumentDto),
    __metadata("design:type", Object)
], VoucherLineDto.prototype, "instrument", void 0);
class VoucherAllocationDto {
    lineRowNo;
    billId;
    billAccYear;
    amount;
}
exports.VoucherAllocationDto = VoucherAllocationDto;
__decorate([
    (0, swagger_1.ApiProperty)({
        example: 0,
        description: '0 = the generated party leg (party mode ONE); n = typed line n (party mode MANY).',
    }),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], VoucherAllocationDto.prototype, "lineRowNo", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherAllocationDto.prototype, "billId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({
        example: '2026-2027',
        description: 'The bill’s OWN year — the table is partitioned on it.',
    }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], VoucherAllocationDto.prototype, "billAccYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5000 }),
    MoneyString(),
    __metadata("design:type", String)
], VoucherAllocationDto.prototype, "amount", void 0);
class VoucherNewBillDto {
    dueDays;
}
exports.VoucherNewBillDto = VoucherNewBillDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: 30,
        description: 'RAISE types: due = date + dueDays. Defaults to the party’s credit days.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.IsInt)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(3650),
    __metadata("design:type", Object)
], VoucherNewBillDto.prototype, "dueDays", void 0);
class VoucherHeaderDto {
    voucherId;
    companyId;
    branchId;
    accYear;
    typeCode;
    date;
    partyId;
    docRefno;
    docDate;
    usrRefno;
    posStcd;
    reverseCharge;
    remarks;
    employeeIds;
}
exports.VoucherHeaderDto = VoucherHeaderDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        description: 'Absent on a new voucher (the server mints uuidv7). Present to update a DRAFT or post one.',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], VoucherHeaderDto.prototype, "voucherId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherHeaderDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherHeaderDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], VoucherHeaderDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'PurA', description: 'acc_voucher_types.vchr_type_code — never an id.' }),
    (0, dtoDecorators_1.TrimmedString)(20),
    __metadata("design:type", String)
], VoucherHeaderDto.prototype, "typeCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-09-15' }),
    (0, class_validator_1.Matches)(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' }),
    __metadata("design:type", String)
], VoucherHeaderDto.prototype, "date", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        format: 'uuid',
        nullable: true,
        description: 'Party mode ONE: required. NONE: omitted. MANY: omitted (the parties are on the lines).',
    }),
    (0, dtoDecorators_1.OptionalUuid)(),
    __metadata("design:type", Object)
], VoucherHeaderDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        maxLength: 100,
        description: 'The supplier’s / customer’s document number.',
    }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], VoucherHeaderDto.prototype, "docRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: '2026-09-12' }),
    (0, dtoDecorators_1.OptionalDateString)(),
    __metadata("design:type", Object)
], VoucherHeaderDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 100 }),
    (0, dtoDecorators_1.NullableString)(100),
    __metadata("design:type", Object)
], VoucherHeaderDto.prototype, "usrRefno", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        example: '33',
        description: 'Place of supply (state code). Default: the party’s state on output-side types, the company’s on input-side / reverse charge.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null && v !== ''),
    (0, class_validator_1.Matches)(/^\d{2}$/, { message: 'posStcd must be a two-digit state code' }),
    __metadata("design:type", Object)
], VoucherHeaderDto.prototype, "posStcd", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ default: false, description: 'Purchase (Accounting) only.' }),
    (0, dtoDecorators_1.OptionalBoolean)(),
    __metadata("design:type", Boolean)
], VoucherHeaderDto.prototype, "reverseCharge", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ maxLength: 500 }),
    (0, dtoDecorators_1.NullableString)(500),
    __metadata("design:type", Object)
], VoucherHeaderDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'notes (54): the salesmen / collectors (public.employee_master ids) → avh_employee_id; the first is the ' +
            'cheque register row’s salesman. Omit or [] for none.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(20),
    (0, class_validator_1.Matches)(/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i, {
        each: true,
        message: 'each employeeId must be a valid UUID',
    }),
    __metadata("design:type", Array)
], VoucherHeaderDto.prototype, "employeeIds", void 0);
class VoucherPayloadDto {
    header;
    lines;
    allocations;
    newBill;
}
exports.VoucherPayloadDto = VoucherPayloadDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: VoucherHeaderDto }),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => VoucherHeaderDto),
    __metadata("design:type", VoucherHeaderDto)
], VoucherPayloadDto.prototype, "header", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [VoucherLineDto], description: 'TYPED lines only — never a generated leg.' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => VoucherLineDto),
    __metadata("design:type", Array)
], VoucherPayloadDto.prototype, "lines", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [VoucherAllocationDto],
        description: 'Bill-wise, against the party leg. Absent ≠ empty: omit to leave a draft’s alone.',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(500),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => VoucherAllocationDto),
    __metadata("design:type", Array)
], VoucherPayloadDto.prototype, "allocations", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: VoucherNewBillDto, nullable: true }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.ValidateIf)((_, v) => v !== null),
    (0, class_validator_1.ValidateNested)(),
    (0, class_transformer_1.Type)(() => VoucherNewBillDto),
    __metadata("design:type", Object)
], VoucherPayloadDto.prototype, "newBill", void 0);
class ValidateVoucherDto extends VoucherPayloadDto {
    overrides;
}
exports.ValidateVoucherDto = ValidateVoucherDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({
        type: [String],
        description: 'WARN codes the operator has seen and chosen to override (needs um_can_override).',
    }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMaxSize)(50),
    (0, class_validator_1.IsString)({ each: true }),
    (0, class_validator_1.MaxLength)(60, { each: true }),
    __metadata("design:type", Array)
], ValidateVoucherDto.prototype, "overrides", void 0);
class PostVoucherDto extends ValidateVoucherDto {
}
exports.PostVoucherDto = PostVoucherDto;
class VoucherKeysDto {
    companyId;
    branchId;
    accYear;
    voucherId;
}
exports.VoucherKeysDto = VoucherKeysDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherKeysDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherKeysDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-2027' }),
    (0, dtoDecorators_1.UpperMaxString)(9),
    __metadata("design:type", String)
], VoucherKeysDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    (0, dtoDecorators_1.RequiredUuid)(),
    __metadata("design:type", String)
], VoucherKeysDto.prototype, "voucherId", void 0);
class CancelVoucherDto extends VoucherKeysDto {
    reason;
}
exports.CancelVoucherDto = CancelVoucherDto;
__decorate([
    (0, swagger_1.ApiProperty)({ maxLength: 250, description: 'Required. ck_avh_cancel keeps it on the row.' }),
    (0, dtoDecorators_1.TrimmedString)(250),
    __metadata("design:type", String)
], CancelVoucherDto.prototype, "reason", void 0);
class DeleteVoucherDto extends VoucherKeysDto {
}
exports.DeleteVoucherDto = DeleteVoucherDto;
class GetVoucherQueryDto extends VoucherKeysDto {
}
exports.GetVoucherQueryDto = GetVoucherQueryDto;
//# sourceMappingURL=voucher-payload.dto.js.map