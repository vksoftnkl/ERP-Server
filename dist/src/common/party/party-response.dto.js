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
exports.PartyDeleteCheckSuccessDto = exports.PartyDeleteCheckDto = exports.PartyRefusalDto = exports.PartyUserWordingDto = exports.PartyDeleteWarningsDto = exports.PartyDeleteBalanceDto = exports.PartySyncDto = void 0;
const swagger_1 = require("@nestjs/swagger");
class PartySyncDto {
    otherRole;
    otherRoleUpdated;
    fields;
}
exports.PartySyncDto = PartySyncDto;
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['CUSTOMER', 'SUPPLIER'], nullable: true, description: 'The other role on the same ledger, when live.' }),
    __metadata("design:type", Object)
], PartySyncDto.prototype, "otherRole", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The other role row was written (a synced value differed).' }),
    __metadata("design:type", Boolean)
], PartySyncDto.prototype, "otherRoleUpdated", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: String, isArray: true, example: ['supAddr1', 'supPhone'], description: "The other role's own keys that changed." }),
    __metadata("design:type", Array)
], PartySyncDto.prototype, "fields", void 0);
class PartyDeleteBalanceDto {
    companyId;
    companyName;
    amount;
    drCr;
}
exports.PartyDeleteBalanceDto = PartyDeleteBalanceDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PartyDeleteBalanceDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true }),
    __metadata("design:type", Object)
], PartyDeleteBalanceDto.prototype, "companyName", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '1250.00', description: 'Always positive, 2 decimals; the side is drCr.' }),
    __metadata("design:type", String)
], PartyDeleteBalanceDto.prototype, "amount", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['DR', 'CR'] }),
    __metadata("design:type", String)
], PartyDeleteBalanceDto.prototype, "drCr", void 0);
class PartyDeleteWarningsDto {
    draftDocs;
    openBills;
    chequesInHand;
}
exports.PartyDeleteWarningsDto = PartyDeleteWarningsDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Unposted drafts naming the party (they cannot be posted after the delete).' }),
    __metadata("design:type", Number)
], PartyDeleteWarningsDto.prototype, "draftDocs", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Bills with a pending amount (allowed when the balance nets to 0).' }),
    __metadata("design:type", Number)
], PartyDeleteWarningsDto.prototype, "openBills", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'Cheques HELD / DEPOSITED that post on clearing.' }),
    __metadata("design:type", Number)
], PartyDeleteWarningsDto.prototype, "chequesInHand", void 0);
class PartyUserWordingDto {
    title;
    line;
    todo;
}
exports.PartyUserWordingDto = PartyUserWordingDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PartyUserWordingDto.prototype, "title", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PartyUserWordingDto.prototype, "line", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PartyUserWordingDto.prototype, "todo", void 0);
class PartyRefusalDto {
    field;
    code;
    message;
    user;
}
exports.PartyRefusalDto = PartyRefusalDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PartyRefusalDto.prototype, "field", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PartyRefusalDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PartyRefusalDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ type: PartyUserWordingDto, description: 'Plain words with the real figures.' }),
    __metadata("design:type", PartyUserWordingDto)
], PartyRefusalDto.prototype, "user", void 0);
class PartyDeleteCheckDto {
    partyId;
    role;
    otherRoleLive;
    ledgerWouldBeDeleted;
    canDelete;
    refusalCode;
    balances;
    warnings;
    refusals;
}
exports.PartyDeleteCheckDto = PartyDeleteCheckDto;
__decorate([
    (0, swagger_1.ApiProperty)({ format: 'uuid' }),
    __metadata("design:type", String)
], PartyDeleteCheckDto.prototype, "partyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['CUSTOMER', 'SUPPLIER'] }),
    __metadata("design:type", String)
], PartyDeleteCheckDto.prototype, "role", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], PartyDeleteCheckDto.prototype, "otherRoleLive", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], PartyDeleteCheckDto.prototype, "ledgerWouldBeDeleted", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", Boolean)
], PartyDeleteCheckDto.prototype, "canDelete", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ nullable: true, example: 'CUSTOMER_HAS_BALANCE' }),
    __metadata("design:type", Object)
], PartyDeleteCheckDto.prototype, "refusalCode", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyDeleteBalanceDto, isArray: true }),
    __metadata("design:type", Array)
], PartyDeleteCheckDto.prototype, "balances", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyDeleteWarningsDto }),
    __metadata("design:type", PartyDeleteWarningsDto)
], PartyDeleteCheckDto.prototype, "warnings", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyRefusalDto, isArray: true, description: 'What DELETE would refuse with.' }),
    __metadata("design:type", Array)
], PartyDeleteCheckDto.prototype, "refusals", void 0);
class PartyDeleteCheckSuccessDto {
    success;
    message;
    data;
}
exports.PartyDeleteCheckSuccessDto = PartyDeleteCheckSuccessDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: true }),
    __metadata("design:type", Boolean)
], PartyDeleteCheckSuccessDto.prototype, "success", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    __metadata("design:type", String)
], PartyDeleteCheckSuccessDto.prototype, "message", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: PartyDeleteCheckDto }),
    __metadata("design:type", PartyDeleteCheckDto)
], PartyDeleteCheckSuccessDto.prototype, "data", void 0);
//# sourceMappingURL=party-response.dto.js.map