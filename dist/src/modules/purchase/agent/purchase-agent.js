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
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.PurchaseAgentController = exports.PurchaseAgentService = exports.AgentActiveDto = exports.AgentRefDto = exports.SaveAgentDto = exports.AGENT_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const account_ledger_masters_service_1 = require("../../accountsModule/accountLedgerMasters/account-ledger-masters.service");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
exports.AGENT_MENU_ID = 28;
const AGENT_LEDGER_GROUP_ID = '019eee86-f34b-7d73-8a79-f5c6f036439a';
const trimOrNull = (v) => (v && v.trim() ? v.trim() : null);
class SaveAgentDto {
    pagId;
    companyId;
    code;
    name;
    alias;
    mobile1;
    mobile2;
    addr1;
    addr2;
    city;
    district;
    state;
    pincode;
    panNo;
    gstin;
    defaultCommPct;
    remarks;
    isActive;
}
exports.SaveAgentDto = SaveAgentDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Present = update that agent (= its ledger id).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "pagId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(30),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "code", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "name", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(150),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "alias", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "mobile1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(20),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "mobile2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "addr1", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(200),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "addr2", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "city", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "district", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(100),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "state", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "pincode", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(10),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "panNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(15),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "gstin", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Commission % the agent usually earns (charged as a purchase charge).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    (0, class_validator_1.Max)(100),
    __metadata("design:type", Number)
], SaveAgentDto.prototype, "defaultCommPct", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], SaveAgentDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], SaveAgentDto.prototype, "isActive", void 0);
class AgentRefDto {
    pagId;
}
exports.AgentRefDto = AgentRefDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], AgentRefDto.prototype, "pagId", void 0);
class AgentActiveDto extends AgentRefDto {
    active;
}
exports.AgentActiveDto = AgentActiveDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], AgentActiveDto.prototype, "active", void 0);
let PurchaseAgentService = class PurchaseAgentService {
    prisma;
    ctx;
    ledgers;
    constructor(prisma, ctx, ledgers) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.ledgers = ledgers;
    }
    actor() {
        const u = this.ctx.getUserId();
        if (!u)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        return u;
    }
    async save(dto) {
        const actor = this.actor();
        const name = dto.name.replace(/\s+/g, ' ').trim();
        if (!name)
            (0, purchase_errors_1.purRefuse)('Give the agent a name.', purchase_errors_1.PUR.QTY_INVALID, 'name');
        const gstin = trimOrNull(dto.gstin)?.toUpperCase() ?? null;
        if (gstin && !/^[0-9]{2}[A-Z0-9]{13}$/.test(gstin))
            (0, purchase_errors_1.purRefuse)('GSTIN is 15 characters, starting with the 2-digit state code.', purchase_errors_1.PUR.QTY_INVALID, 'gstin');
        const pan = trimOrNull(dto.panNo)?.toUpperCase() ?? null;
        if (pan && !/^[A-Z]{5}[0-9]{4}[A-Z]$/.test(pan))
            (0, purchase_errors_1.purRefuse)('PAN is 10 characters: 5 letters, 4 digits, a letter.', purchase_errors_1.PUR.QTY_INVALID, 'panNo');
        const id = await this.prisma.$transaction(async (tx) => {
            const [dup] = await tx.$queryRaw `
        SELECT pag_id FROM purchase.pur_agent
         WHERE upper(pag_name) = upper(${name}) AND NOT pag_is_deleted
           AND (pag_company_id IS NULL OR pag_company_id = ${dto.companyId}::uuid)
           AND (${dto.pagId ?? null}::uuid IS NULL OR pag_id <> ${dto.pagId ?? null}::uuid) LIMIT 1`;
            if (dup)
                (0, purchase_errors_1.purConflict)(`An agent named "${name}" already exists.`, 'PUR_AGENT_NAME_EXISTS', 'name');
            const data = {
                pagCompanyId: dto.companyId, pagCode: trimOrNull(dto.code), pagName: name, pagAlias: trimOrNull(dto.alias),
                pagMobile1: trimOrNull(dto.mobile1), pagMobile2: trimOrNull(dto.mobile2), pagAddr1: trimOrNull(dto.addr1), pagAddr2: trimOrNull(dto.addr2),
                pagCity: trimOrNull(dto.city), pagDistrict: trimOrNull(dto.district), pagState: trimOrNull(dto.state), pagPincode: trimOrNull(dto.pincode),
                pagPanNo: pan, pagGstin: gstin, pagDefaultCommPct: dto.defaultCommPct === undefined || dto.defaultCommPct === null ? null : (0, purchase_doc_helpers_1.D)(dto.defaultCommPct),
                pagRemarks: trimOrNull(dto.remarks), pagIsActive: dto.isActive ?? true,
            };
            if (!dto.pagId) {
                const ledger = await this.ledgers.createLedgerWithinTx({
                    ledGroupId: AGENT_LEDGER_GROUP_ID, ledName: name, ledCompanyId: dto.companyId,
                    ledPhone1: data.pagMobile1, ledPhone2: data.pagMobile2, ledIsBillByBill: true,
                }, tx);
                const ledId = ledger.ledId;
                await tx.purAgent.create({ data: { pagId: ledId, ...data, pagCreatedBy: actor } });
                return ledId;
            }
            const cur = await tx.purAgent.findFirst({ where: { pagId: dto.pagId, pagIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Agent ${dto.pagId} not found`);
            await tx.purAgent.update({ where: { pagId: dto.pagId }, data: { ...data, pagModifiedBy: actor, pagModifiedOn: new Date() } });
            const led = await tx.accLedgerMaster.findFirst({ where: { ledId: dto.pagId, ledIsDeleted: false }, select: { ledGroupId: true } });
            if (led) {
                await this.ledgers.updateLedgerWithinTx({
                    ledId: dto.pagId, ledGroupId: led.ledGroupId, ledName: name, ledCompanyId: dto.companyId,
                    ledPhone1: data.pagMobile1, ledPhone2: data.pagMobile2, ledIsActive: data.pagIsActive,
                }, tx);
            }
            return dto.pagId;
        }, { timeout: 30000, maxWait: 10000 });
        return this.get(id);
    }
    async setActive(dto) {
        const actor = this.actor();
        await this.prisma.$transaction(async (tx) => {
            const cur = await tx.purAgent.findFirst({ where: { pagId: dto.pagId, pagIsDeleted: false } });
            if (!cur)
                (0, purchase_errors_1.purNotFound)(`Agent ${dto.pagId} not found`);
            await tx.purAgent.update({ where: { pagId: dto.pagId }, data: { pagIsActive: dto.active, pagModifiedBy: actor, pagModifiedOn: new Date() } });
            await tx.accLedgerMaster.updateMany({ where: { ledId: dto.pagId, ledIsDeleted: false }, data: { ledIsActive: dto.active, ledModifiedBy: actor, ledModifiedOn: new Date() } });
        });
        return this.get(dto.pagId);
    }
    async get(pagId) {
        const [row] = await this.prisma.$queryRaw `
      SELECT a.*, l.led_name, g.acc_group_name AS ledger_group,
             (SELECT count(*) FROM purchase.pur_order o WHERE o.po_agent_id = a.pag_id AND NOT o.po_is_deleted) AS po_count,
             (SELECT count(*) FROM purchase.pur_invoice p WHERE p.pi_agent_id = a.pag_id AND NOT p.pi_is_deleted) AS bill_count
        FROM purchase.pur_agent a
        LEFT JOIN accounts.acc_ledger_master l ON l.led_id = a.pag_id
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
       WHERE a.pag_id = ${pagId}::uuid AND NOT a.pag_is_deleted`;
        if (!row)
            (0, purchase_errors_1.purNotFound)(`Agent ${pagId} not found`);
        return (0, purchase_doc_helpers_1.jsonSafe)(row);
    }
};
exports.PurchaseAgentService = PurchaseAgentService;
exports.PurchaseAgentService = PurchaseAgentService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService,
        account_ledger_masters_service_1.AccountLedgerMastersService])
], PurchaseAgentService);
let PurchaseAgentController = class PurchaseAgentController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.AGENT_MENU_ID, right, codePrefix: 'AGT', action });
    }
    async save(dto) {
        await this.right(dto.pagId ? 'edit' : 'create', 'save an agent');
        const data = await this.service.save(dto);
        return { success: true, message: `Agent ${String(data.pag_name)} saved`, data };
    }
    async active(dto) {
        await this.right('edit', 'switch an agent on or off');
        const data = await this.service.setActive(dto);
        return { success: true, message: dto.active ? 'Agent reactivated' : 'Agent deactivated', data };
    }
    async get(q) {
        await this.right('view', 'open an agent');
        return { success: true, message: 'Agent fetched', data: await this.service.get(q.pagId) };
    }
};
exports.PurchaseAgentController = PurchaseAgentController;
__decorate([
    (0, common_1.Post)('save'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Create an agent (and his ledger under Sundry Creditors, one id) or update one (the ledger is renamed with him).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SaveAgentDto]),
    __metadata("design:returntype", Promise)
], PurchaseAgentController.prototype, "save", null);
__decorate([
    (0, common_1.Post)('active'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Switch an agent (and his ledger) on or off.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AgentActiveDto]),
    __metadata("design:returntype", Promise)
], PurchaseAgentController.prototype, "active", null);
__decorate([
    (0, common_1.Get)('get'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'One agent with his ledger and how many POs / bills name him.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [AgentRefDto]),
    __metadata("design:returntype", Promise)
], PurchaseAgentController.prototype, "get", null);
exports.PurchaseAgentController = PurchaseAgentController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Agents'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/agents'),
    __metadata("design:paramtypes", [PurchaseAgentService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseAgentController);
//# sourceMappingURL=purchase-agent.js.map