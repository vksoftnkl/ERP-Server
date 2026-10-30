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
exports.PurchaseSupplierDuesController = exports.PurchaseSupplierDuesService = exports.DuesSettleUndoDto = exports.DuesSettleDto = exports.DuesSettleRowDto = exports.SupplierDuesQueryDto = exports.SUPPLIER_DUES_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const class_transformer_1 = require("class-transformer");
const class_validator_1 = require("class-validator");
const api_version_1 = require("../../../common/constants/api-version");
const rights_1 = require("../../../common/posting/rights");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const ledger_map_helper_1 = require("../../accountsModule/ledgerRole/ledger-map.helper");
const purchase_errors_1 = require("../common/purchase.errors");
const purchase_claim_locks_1 = require("../common/purchase-claim-locks");
const purchase_doc_helpers_1 = require("../common/purchase-doc.helpers");
const purchase_return_1 = require("../return/purchase-return");
const purchase_shortage_1 = require("../shortage/purchase-shortage");
exports.SUPPLIER_DUES_MENU_ID = 297;
class SupplierDuesQueryDto {
    companyId;
    branchId;
    supplierId;
    all;
}
exports.SupplierDuesQueryDto = SupplierDuesQueryDto;
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierDuesQueryDto.prototype, "companyId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierDuesQueryDto.prototype, "branchId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], SupplierDuesQueryDto.prototype, "supplierId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'true: also settled claims / closed shortages (history).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['true', 'false']),
    __metadata("design:type", String)
], SupplierDuesQueryDto.prototype, "all", void 0);
class DuesSettleRowDto {
    returnItemId;
    shortageCloseId;
    accYear;
    amount;
}
exports.DuesSettleRowDto = DuesSettleRowDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'A return claim row: pur_return_item.pri_id (claims[].returnItemId). Give this OR shortageCloseId.' }),
    (0, class_validator_1.ValidateIf)((o) => !o.shortageCloseId),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DuesSettleRowDto.prototype, "returnItemId", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'A shortage claim: the CLAIM close row pur_shortage_close.psc_id (claims[].shortageCloseId, source SHORTAGE).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DuesSettleRowDto.prototype, "shortageCloseId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'The row\'s year (the return row\'s, or the claim close row\'s).' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], DuesSettleRowDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'CREDIT: what the party allowed on this row (default its whole open amount).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0),
    __metadata("design:type", Number)
], DuesSettleRowDto.prototype, "amount", void 0);
class DuesSettleDto {
    rows;
    deviceId;
    action;
    receivedAs;
    cnNo;
    cnDate;
    docDate;
    settleAccYear;
    writeOffRest;
    writeOffReason;
    reason;
    dryRun;
}
exports.DuesSettleDto = DuesSettleDto;
__decorate([
    (0, swagger_1.ApiProperty)({ type: [DuesSettleRowDto] }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ArrayMinSize)(1),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => DuesSettleRowDto),
    __metadata("design:type", Array)
], DuesSettleDto.prototype, "rows", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "deviceId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ enum: ['CREDIT', 'SHORT_SETTLED', 'REJECTED'] }),
    (0, class_validator_1.IsIn)(['CREDIT', 'SHORT_SETTLED', 'REJECTED']),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "action", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: ['CN', 'ADJUST'], description: 'CREDIT: a credit note, or adjust in the next bill. Cash / bank come through a Receipt.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsIn)(['CN', 'ADJUST']),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "receivedAs", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(60),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "cnNo", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "cnDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The settlement date (default today).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "docDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'The settlement\'s own year (default the row\'s).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "settleAccYear", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'CREDIT: write off what the credit leaves open on each row (a SHORT_SETTLED row, same call).' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DuesSettleDto.prototype, "writeOffRest", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'Why the rest is written off (default "short-settled").' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "writeOffReason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], DuesSettleDto.prototype, "reason", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ description: 'true: check and work out the voucher legs ("What Settle writes"), write nothing.' }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsBoolean)(),
    __metadata("design:type", Boolean)
], DuesSettleDto.prototype, "dryRun", void 0);
class DuesSettleUndoDto {
    settlementId;
    accYear;
    reason;
}
exports.DuesSettleUndoDto = DuesSettleUndoDto;
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'claims[].lastAction.settlementId (a return claim settlement or a shortage claim settlement).' }),
    (0, class_validator_1.IsUUID)(),
    __metadata("design:type", String)
], DuesSettleUndoDto.prototype, "settlementId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ description: 'claims[].lastAction.accYear.' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(9),
    __metadata("design:type", String)
], DuesSettleUndoDto.prototype, "accYear", void 0);
__decorate([
    (0, swagger_1.ApiProperty)(),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.MaxLength)(250),
    __metadata("design:type", String)
], DuesSettleUndoDto.prototype, "reason", void 0);
let PurchaseSupplierDuesService = class PurchaseSupplierDuesService {
    prisma;
    ctx;
    returns;
    shortages;
    constructor(prisma, ctx, returns, shortages) {
        this.prisma = prisma;
        this.ctx = ctx;
        this.returns = returns;
        this.shortages = shortages;
    }
    async open(q, sections) {
        const all = q.all === 'true';
        const ret = sections.claims ? (await this.returns.duesClaims({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId ?? null, all }))
            .map((c) => ({ source: 'RETURN', shortageCloseId: null, ...c })) : [];
        const shc = sections.shortages ? await this.shortages.duesClaims({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId ?? null, all }) : [];
        const claims = [...ret, ...shc];
        const shortages = sections.shortages ? (await this.shortages.open({ companyId: q.companyId, branchId: q.branchId, supplierId: q.supplierId, all: all ? 'true' : undefined })) : [];
        const sum = (rows, k) => rows.reduce((s, r) => s.plus((0, purchase_doc_helpers_1.D)(r[k])), purchase_doc_helpers_1.ZERO);
        const openClaims = claims.filter((c) => c.status === 'OPEN' || c.status === 'PART');
        const openShort = shortages.filter((s) => s.status !== 'CLOSED');
        return (0, purchase_doc_helpers_1.jsonSafe)({
            claims, shortages,
            totals: {
                openCount: openClaims.length + openShort.length,
                claims: { rows: openClaims.length, value: sum(openClaims, 'claimValue').toFixed(2), credited: sum(openClaims, 'credited').toFixed(2),
                    writtenOff: sum(openClaims, 'writtenOff').toFixed(2), open: sum(openClaims, 'open').toFixed(2) },
                shortages: { rows: openShort.length, openQtyBase: sum(openShort, 'openQty').toString(), openValue: sum(openShort, 'openValue').toFixed(2),
                    gstHeld: sum(openShort.filter((s) => s.gstPending === true), 'openGst').toFixed(2) },
            },
            sections,
            cashNote: 'Cash or bank from the party comes through a Receipt against it — Settle records a credit note or an adjustment only.',
        });
    }
    async settle(dto) {
        const actor = this.ctx.getUserId();
        if (!actor)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        if (dto.writeOffRest && dto.action !== 'CREDIT')
            (0, purchase_errors_1.purRefuse)('"Write off the rest" goes with a credit only.', 'PUR_QTY_INVALID', 'writeOffRest');
        const run = async (tx) => {
            await (0, purchase_claim_locks_1.lockClaims)(tx, (0, purchase_claim_locks_1.claimLockOrder)(dto.rows));
            const out = [];
            for (const r of dto.rows) {
                const common = { accYear: r.accYear, settleAccYear: dto.settleAccYear, deviceId: dto.deviceId, cnNo: dto.cnNo, cnDate: dto.cnDate, docDate: dto.docDate };
                const one = (action, extra, opts) => r.shortageCloseId
                    ? this.shortages.settleClaimIn(tx, { ...common, shortageCloseId: r.shortageCloseId, action, ...extra }, actor, opts)
                    : this.returns.settleIn(tx, { ...common, returnItemId: r.returnItemId, action, ...extra }, actor, opts);
                const first = await one(dto.action, { amount: dto.action === 'CREDIT' ? r.amount : undefined, receivedAs: dto.receivedAs, reason: dto.reason }, { dryRun: !!dto.dryRun });
                out.push(first);
                if (dto.writeOffRest && first.open.greaterThan(0)) {
                    out.push(await one('SHORT_SETTLED', { reason: dto.writeOffReason ?? dto.reason ?? 'Short-settled — the rest written off' }, { dryRun: !!dto.dryRun, takenAlready: dto.dryRun ? first.amount : purchase_doc_helpers_1.ZERO }));
                }
            }
            return out;
        };
        const steps = await this.prisma.$transaction(run, { timeout: 60000, maxWait: 10000 });
        const names = await this.legNames(steps);
        let credit = purchase_doc_helpers_1.ZERO, off = purchase_doc_helpers_1.ZERO, gst = purchase_doc_helpers_1.ZERO;
        for (const s of steps) {
            const re = s.gstReavailed ?? purchase_doc_helpers_1.ZERO;
            if (s.action === 'CREDIT')
                credit = credit.plus(s.amount);
            else
                off = off.plus(s.amount.minus(re));
            gst = gst.plus(re);
        }
        return (0, purchase_doc_helpers_1.jsonSafe)({
            dryRun: !!dto.dryRun,
            steps: steps.map((s) => ({
                source: s.shortageCloseId ? 'SHORTAGE' : 'RETURN', returnItemId: s.returnItemId ?? null, shortageCloseId: s.shortageCloseId ?? null,
                refno: s.refno, lineNo: s.lineNo ?? null, action: s.action, receivedAs: s.receivedAs, amount: s.amount.toFixed(2),
                gstReavailed: (s.gstReavailed ?? purchase_doc_helpers_1.ZERO).toFixed(2), openAfter: s.open.toFixed(2), settlementId: s.settlementId, accYear: s.accYear, voucherRefno: s.voucherRefno,
                legs: s.legs.map((g) => {
                    const n = names.get(g.ledgerId ?? (0, ledger_map_helper_1.roleLedgerKey)({ role: g.role, taxId: g.taxId ?? null, supplyNature: g.supplyNature ?? null }));
                    return { drCr: g.drCr, role: g.role ?? null, ledgerId: g.ledgerId ?? n?.id ?? null, ledgerName: n?.name ?? null, amount: Number(g.amount).toFixed(2), remarks: g.remarks ?? null };
                }),
            })),
            totals: { credited: credit.toFixed(2), writtenOff: off.toFixed(2), gstReavailed: gst.toFixed(2) },
            cashNote: 'Cash or bank from the party comes through a Receipt against it.',
        });
    }
    async settleUndo(dto) {
        const actor = this.ctx.getUserId();
        if (!actor)
            (0, purchase_errors_1.purRefuse)('No signed-in user on the request.', 'PUR_NO_USER', 'userId', 401);
        const kind = await this.settlementKind(dto.settlementId, dto.accYear);
        if (kind === 'RETURN') {
            const r = await this.returns.settleUndo({ settlementId: dto.settlementId, accYear: dto.accYear, reason: dto.reason });
            return { source: 'RETURN', shortageCloseId: null, ...r };
        }
        const out = await this.prisma.$transaction((tx) => this.shortages.settleClaimUndoIn(tx, dto.settlementId, dto.accYear, dto.reason, actor), { timeout: 60000, maxWait: 10000 });
        return (0, purchase_doc_helpers_1.jsonSafe)({ source: 'SHORTAGE', returnItemId: null, ...out });
    }
    async settlementKind(settlementId, accYear) {
        const [r] = await this.prisma.$queryRaw `
      SELECT CASE WHEN pcs_shortage_close_id IS NOT NULL THEN 'SHORTAGE' ELSE 'RETURN' END AS k
        FROM purchase.pur_claim_settlement WHERE pcs_id = ${settlementId}::uuid AND pcs_acc_year = ${accYear}::bpchar AND NOT pcs_is_deleted
       LIMIT 1`;
        if (!r)
            (0, purchase_errors_1.purNotFound)(`Settlement ${settlementId} not found`);
        return r.k;
    }
    async legNames(steps) {
        const out = new Map();
        const ids = [...new Set(steps.flatMap((s) => s.legs.map((g) => g.ledgerId).filter((x) => !!x)))];
        if (ids.length) {
            const rows = await this.prisma.$queryRaw `SELECT led_id AS id, led_name AS name FROM accounts.acc_ledger_master WHERE led_id = ANY(${ids}::uuid[])`;
            for (const r of rows)
                out.set(r.id, r);
        }
        const first = steps[0];
        const reqs = steps.flatMap((s) => s.legs.filter((g) => g.role && !g.ledgerId).map((g) => ({ role: g.role, taxId: g.taxId ?? null, supplyNature: g.supplyNature ?? null })));
        if (reqs.length && first) {
            const got = await (0, ledger_map_helper_1.resolveRoleLedgers)(this.prisma, reqs, { companyId: first.companyId, branchId: first.branchId, where: 'supplier dues preview' });
            for (const [k, v] of got)
                if (v)
                    out.set(k, { id: v.ledgerId, name: v.ledgerName });
        }
        return out;
    }
};
exports.PurchaseSupplierDuesService = PurchaseSupplierDuesService;
exports.PurchaseSupplierDuesService = PurchaseSupplierDuesService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService, request_context_service_1.RequestContextService,
        purchase_return_1.PurchaseReturnService, purchase_shortage_1.PurchaseShortageService])
], PurchaseSupplierDuesService);
let PurchaseSupplierDuesController = class PurchaseSupplierDuesController {
    service;
    prisma;
    ctx;
    constructor(service, prisma, ctx) {
        this.service = service;
        this.prisma = prisma;
        this.ctx = ctx;
    }
    async right(right, action) {
        await (0, rights_1.assertMenuRight)(this.prisma, { userId: this.ctx.getUserId(), menuId: exports.SUPPLIER_DUES_MENU_ID, right, codePrefix: 'SDU', action });
    }
    async open(q) {
        await this.right('view', 'see supplier dues');
        return { success: true, message: 'Supplier dues fetched', data: await this.service.open(q, { claims: true, shortages: true }) };
    }
    async settle(dto) {
        if (dto.dryRun)
            await this.right('view', 'preview a claim settlement');
        else
            await this.right('post', 'settle a claim');
        const data = await this.service.settle(dto);
        return { success: true, message: dto.dryRun ? 'What Settle writes' : `${data.steps.length} settlement${data.steps.length === 1 ? '' : 's'} posted`, data };
    }
    async settleUndo(dto) {
        await this.right('cancel', 'undo a claim settlement');
        return { success: true, message: 'Settlement undone', data: await this.service.settleUndo(dto) };
    }
};
exports.PurchaseSupplierDuesController = PurchaseSupplierDuesController;
__decorate([
    (0, common_1.Get)('open'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'The Supplier dues page: claims (money expected — return claims, source RETURN, and shortages closed as a transporter / insurer claim, source SHORTAGE, keyed by shortageCloseId: value, credited, written off, open, status, age, party, reason, last action, source bill) and shortages (goods expected — source date, age, open qty / value / GST held, last close). View on menu 297.' }),
    __param(0, (0, common_1.Query)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [SupplierDuesQueryDto]),
    __metadata("design:returntype", Promise)
], PurchaseSupplierDuesController.prototype, "open", null);
__decorate([
    (0, common_1.Post)('settle'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Settle one or several claim rows in one call — return claims (rows[].returnItemId) and shortage claims on a transporter / insurer (rows[].shortageCloseId): CREDIT (CN / ADJUST, + writeOffRest), SHORT_SETTLED or REJECTED. Cash comes through a Receipt. dryRun = "What Settle writes" (voucher legs), nothing written. Post on menu 297 (View for dryRun).' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [DuesSettleDto]),
    __metadata("design:returntype", Promise)
], PurchaseSupplierDuesController.prototype, "settle", null);
__decorate([
    (0, common_1.Post)('settle-undo'),
    (0, common_1.Version)(api_version_1.API_VERSION),
    (0, swagger_1.ApiOperation)({ summary: 'Undo one settlement (claims[].lastAction.settlementId) of a return claim or a shortage claim: a reversal row, a reversing voucher, the bill-wise credit withdrawn, the claim open again. Cancel on menu 297.' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [DuesSettleUndoDto]),
    __metadata("design:returntype", Promise)
], PurchaseSupplierDuesController.prototype, "settleUndo", null);
exports.PurchaseSupplierDuesController = PurchaseSupplierDuesController = __decorate([
    (0, swagger_1.ApiTags)('Purchase — Supplier dues'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.Controller)('purchase/supplier-dues'),
    __metadata("design:paramtypes", [PurchaseSupplierDuesService, prisma_service_1.PrismaService, request_context_service_1.RequestContextService])
], PurchaseSupplierDuesController);
//# sourceMappingURL=purchase-supplier-dues.js.map