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
var StockAccountsPostingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.STOCK_COGS_MODE_PROVIDER = exports.StockAccountsPostingService = exports.STOCK_LEDGER_ROLES = exports.STOCK_ACCOUNTS_SRC_MODULE = exports.STOCK_COGS_MODE = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const voucher_posting_service_1 = require("../../../common/posting/voucher-posting.service");
const stock_cogs_mode_service_1 = require("./stock-cogs-mode.service");
exports.STOCK_COGS_MODE = Symbol('STOCK_COGS_MODE');
exports.STOCK_ACCOUNTS_SRC_MODULE = 'STOCK';
const STOCK_VOUCHER_TYPE_ID = {
    OPENING: 1,
    PHYSICAL: 6,
};
const STOCK_ADJUSTMENT_VOUCHER_TYPE_CODE = 'StkAdj';
const ADJUSTMENT_FAMILY = new Set([
    'ADJUSTMENT',
    'ISSUE',
    'DAMAGE',
    'EXPIRY_WRITEOFF',
]);
const RELOT_REASON_CODES = ['RELOT_OUT', 'RELOT_IN'];
const SHORT_SETTLE_VOUCHER_TYPE_CODE = 'Jrl';
exports.STOCK_LEDGER_ROLES = {
    INVENTORY: 'INVENTORY',
    OPENING_DIFFERENCE: 'OPENING_DIFFERENCE',
    STOCK_SHORTAGE: 'STOCK_SHORTAGE',
    STOCK_EXCESS: 'STOCK_EXCESS',
};
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VOUCHER_REFNO_MAX = 50;
let StockAccountsPostingService = StockAccountsPostingService_1 = class StockAccountsPostingService {
    voucherPosting;
    cogs;
    logger = new common_1.Logger(StockAccountsPostingService_1.name);
    constructor(voucherPosting, cogs) {
        this.voucherPosting = voucherPosting;
        this.cogs = cogs;
    }
    static postsAccounts(voucherType) {
        return voucherType in STOCK_VOUCHER_TYPE_ID || ADJUSTMENT_FAMILY.has(voucherType);
    }
    async postForVoucher(tx, input) {
        if (!StockAccountsPostingService_1.postsAccounts(input.voucherType)) {
            return null;
        }
        if ((await this.cogs.cogsMode(input.companyId, input.branchId)) !== 'PERPETUAL') {
            return null;
        }
        const voucherTypeId = STOCK_VOUCHER_TYPE_ID[input.voucherType] ??
            (await this.voucherTypeIdByCode(tx, STOCK_ADJUSTMENT_VOUCHER_TYPE_CODE));
        const header = await this.header(tx, input.svhId, input.accYear);
        const legs = input.voucherType === 'OPENING'
            ? await this.openingLegs(tx, input)
            : await this.varianceLegs(tx, input, header.reason_ledger_id);
        if (legs.length === 0) {
            return null;
        }
        const amount = legs.filter((l) => l.drCr === 'DR').reduce((s, l) => s + l.amount, 0);
        const posted = await this.voucherPosting.postLegs(tx, {
            header: {
                companyId: input.companyId,
                branchId: input.branchId,
                tenantId: header.svh_tenant_id,
                accYear: input.accYear,
                voucherTypeId,
                voucherDate: isoDate(header.svh_doc_date),
                srcModule: exports.STOCK_ACCOUNTS_SRC_MODULE,
                srcDocType: input.voucherType,
                srcDocId: input.svhId,
                docLabel: input.displayName,
                docRefno: header.svh_refno,
                docDate: isoDate(header.svh_doc_date),
                docAmount: round2(amount),
                partyId: null,
                userId: this.userFor(input.actor, header.svh_created_by, input.displayName),
                sessionId: header.svh_session_id,
                deviceId: header.svh_device_id,
                remarks: `${input.displayName} ${header.svh_refno}`,
                presetRefno: header.svh_refno.length <= VOUCHER_REFNO_MAX ? header.svh_refno : undefined,
                createdBy: input.actor === module_service_utils_1.DEFAULT_ACTOR ? 'SYSTEM' : input.actor,
            },
            legs,
        });
        this.logger.log(`${input.displayName} ${header.svh_refno}: accounts voucher ${posted.voucherRefno} — ${posted.legCount} legs, ${round2(amount)}`);
        return {
            voucherId: posted.voucherId,
            voucherRefno: posted.voucherRefno,
            amount: round2(amount),
            legCount: posted.legCount,
        };
    }
    async reverseForVoucher(tx, input) {
        const [live] = await tx.$queryRaw `
      SELECT avh_voucher_id
        FROM accounts.acc_voucher_header
       WHERE avh_company_id   = ${input.companyId}::uuid
         AND avh_src_module   = ${exports.STOCK_ACCOUNTS_SRC_MODULE}
         AND avh_src_doc_type = ${input.voucherType}
         AND avh_src_doc_id   = ${input.svhId}::uuid
         AND avh_acc_year     = ${input.accYear}::char(9)
         AND avh_is_deleted   = false
         AND avh_voucher_status = 'POSTED'
       LIMIT 1`;
        if (!live) {
            return null;
        }
        return this.voucherPosting.reverseLegs(tx, live.avh_voucher_id, input.accYear, input.reason, input.actor === module_service_utils_1.DEFAULT_ACTOR ? 'SYSTEM' : input.actor);
    }
    async postShortSettlement(tx, input) {
        if ((await this.cogs.cogsMode(input.companyId, input.branchId)) !== 'PERPETUAL') {
            return null;
        }
        const total = input.rows.reduce((s, r) => s.plus(r.shortValue), new client_1.Prisma.Decimal(0));
        if (total.lte(0)) {
            return null;
        }
        const [reason] = await tx.$queryRaw `
      SELECT srm_gl_ledger_id, srm_name FROM stock.stock_reason_master
       WHERE srm_id = ${input.reasonId}::uuid AND srm_is_deleted = false`;
        if (!reason) {
            (0, module_service_utils_1.throwStockUnprocessable)('Reason not found', [
                { field: 'reasonId', message: `No stock reason ${input.reasonId}.` },
            ]);
        }
        const journal = { vchr_type_id: await this.voucherTypeIdByCode(tx, SHORT_SETTLE_VOUCHER_TYPE_CODE) };
        const [header] = await tx.$queryRaw `
      SELECT svh_doc_date, svh_tenant_id, svh_device_id, svh_session_id, svh_created_by
        FROM stock.stock_voucher
       WHERE svh_id = ${input.outId}::uuid AND svh_acc_year = ${input.outAccYear}::bpchar`;
        const amount = round2(total.toNumber());
        const legs = [
            {
                ...(reason.srm_gl_ledger_id
                    ? { ledgerId: reason.srm_gl_ledger_id }
                    : { role: exports.STOCK_LEDGER_ROLES.STOCK_SHORTAGE }),
                roleTag: exports.STOCK_LEDGER_ROLES.STOCK_SHORTAGE,
                drCr: 'DR',
                amount,
                remarks: `${reason.srm_name}: transit short on ${input.refno}`,
                field: 'reasonId',
            },
            {
                role: exports.STOCK_LEDGER_ROLES.INVENTORY,
                roleTag: exports.STOCK_LEDGER_ROLES.INVENTORY,
                drCr: 'CR',
                amount,
                remarks: `Transit short on ${input.refno}`,
                field: 'reasonId',
            },
        ];
        const posted = await this.voucherPosting.postLegs(tx, {
            header: {
                companyId: input.companyId,
                branchId: input.branchId,
                tenantId: header?.svh_tenant_id ?? null,
                accYear: input.outAccYear,
                voucherTypeId: journal.vchr_type_id,
                voucherDate: isoDate(input.settledOn),
                srcModule: exports.STOCK_ACCOUNTS_SRC_MODULE,
                srcDocType: 'TRANSFER_OUT',
                srcDocId: input.outId,
                docLabel: 'Stock transfer short settlement',
                docRefno: input.refno,
                docDate: header ? isoDate(header.svh_doc_date) : isoDate(input.settledOn),
                docAmount: amount,
                partyId: null,
                userId: this.userFor(input.actor, header?.svh_created_by ?? null, 'Transit short settlement'),
                sessionId: header?.svh_session_id ?? null,
                deviceId: header?.svh_device_id ?? null,
                remarks: input.remarks ?? `Transit short on ${input.refno}`,
                createdBy: input.actor === module_service_utils_1.DEFAULT_ACTOR ? 'SYSTEM' : input.actor,
            },
            legs,
        });
        return {
            voucherId: posted.voucherId,
            voucherRefno: posted.voucherRefno,
            amount,
            legCount: posted.legCount,
        };
    }
    async openingLegs(tx, input) {
        const [sum] = await tx.$queryRaw `
      SELECT SUM(sml.sml_cost_value) AS value
        FROM stock.stock_ledger sml
       WHERE sml.sml_src_doc_id  = ${input.svhId}::uuid
         AND sml.sml_acc_year    = ${input.accYear}::bpchar
         AND sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = false`;
        const amount = round2(Number(sum?.value ?? 0));
        if (amount === 0) {
            return [];
        }
        return [
            {
                role: exports.STOCK_LEDGER_ROLES.INVENTORY,
                roleTag: exports.STOCK_LEDGER_ROLES.INVENTORY,
                drCr: 'DR',
                amount,
                remarks: 'Opening stock',
                field: 'lines',
            },
            {
                role: exports.STOCK_LEDGER_ROLES.OPENING_DIFFERENCE,
                roleTag: exports.STOCK_LEDGER_ROLES.OPENING_DIFFERENCE,
                drCr: 'CR',
                amount,
                remarks: 'Opening stock',
                field: 'lines',
            },
        ];
    }
    async voucherTypeIdByCode(tx, code) {
        const [row] = await tx.$queryRaw `
      SELECT vchr_type_id FROM accounts.acc_voucher_types
       WHERE vchr_type_code = ${code} AND vchr_is_active = true LIMIT 1`;
        if (!row) {
            throw new Error(`Voucher type '${code}' is missing — apply the migration that seeds it`);
        }
        return row.vchr_type_id;
    }
    async varianceLegs(tx, input, headerReasonLedgerId) {
        const rows = await tx.$queryRaw `
      SELECT sml.sml_direction, srm.srm_gl_ledger_id AS reason_ledger_id, SUM(sml.sml_cost_value) AS value
        FROM stock.stock_ledger sml
        LEFT JOIN stock.stock_reason_master srm ON srm.srm_id = sml.sml_reason_id
       WHERE sml.sml_src_doc_id  = ${input.svhId}::uuid
         AND sml.sml_acc_year    = ${input.accYear}::bpchar
         AND sml.sml_is_deleted  = false
         AND sml.sml_is_reversal = false
         AND (srm.srm_code IS NULL OR srm.srm_code <> ALL(${RELOT_REASON_CODES}::text[]))
       GROUP BY sml.sml_direction, srm.srm_gl_ledger_id`;
        const net = new Map();
        const add = (key, leg, signed) => {
            const cur = net.get(key);
            if (cur) {
                cur.amount = round2(cur.amount + signed);
            }
            else {
                net.set(key, { leg, amount: round2(signed) });
            }
        };
        for (const r of rows) {
            const value = round2(Number(r.value ?? 0));
            if (value === 0) {
                continue;
            }
            const shortage = Number(r.sml_direction) < 0;
            const ledgerId = r.reason_ledger_id ?? headerReasonLedgerId;
            const role = shortage ? exports.STOCK_LEDGER_ROLES.STOCK_SHORTAGE : exports.STOCK_LEDGER_ROLES.STOCK_EXCESS;
            const reasonKey = ledgerId ? `L:${ledgerId}` : `R:${role}`;
            add(reasonKey, {
                ...(ledgerId ? { ledgerId } : { role }),
                roleTag: role,
                remarks: shortage ? `${input.displayName}: stock out` : `${input.displayName}: stock in`,
                field: 'reasonId',
            }, shortage ? value : -value);
            add(`R:${exports.STOCK_LEDGER_ROLES.INVENTORY}`, {
                role: exports.STOCK_LEDGER_ROLES.INVENTORY,
                roleTag: exports.STOCK_LEDGER_ROLES.INVENTORY,
                remarks: `${input.displayName} ${input.svhId}`.slice(0, 250),
                field: 'lines',
            }, shortage ? -value : value);
        }
        const legs = [];
        for (const { leg, amount } of net.values()) {
            if (amount === 0) {
                continue;
            }
            legs.push({ ...leg, drCr: amount > 0 ? 'DR' : 'CR', amount: Math.abs(amount) });
        }
        return legs;
    }
    async header(tx, svhId, accYear) {
        const [row] = await tx.$queryRaw `
      SELECT svh.svh_refno, svh.svh_doc_date, svh.svh_tenant_id, svh.svh_device_id, svh.svh_session_id,
             svh.svh_created_by, svh.svh_reason_id, srm.srm_gl_ledger_id AS reason_ledger_id
        FROM stock.stock_voucher svh
        LEFT JOIN stock.stock_reason_master srm ON srm.srm_id = svh.svh_reason_id
       WHERE svh.svh_id = ${svhId}::uuid AND svh.svh_acc_year = ${accYear}::bpchar`;
        if (!row) {
            throw new Error(`Stock voucher ${svhId} (${accYear}) not found for accounts posting`);
        }
        return row;
    }
    userFor(actor, createdBy, what) {
        if (UUID.test(actor) && actor !== module_service_utils_1.DEFAULT_ACTOR) {
            return actor;
        }
        if (createdBy && UUID.test(createdBy) && createdBy !== module_service_utils_1.DEFAULT_ACTOR) {
            return createdBy;
        }
        (0, module_service_utils_1.throwStockUnprocessable)(`${what} cannot be posted to accounts`, [
            {
                field: 'userId',
                message: 'The accounts voucher needs a user to be posted by, and this request carries none.',
            },
        ]);
    }
};
exports.StockAccountsPostingService = StockAccountsPostingService;
exports.StockAccountsPostingService = StockAccountsPostingService = StockAccountsPostingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(1, (0, common_1.Inject)(exports.STOCK_COGS_MODE)),
    __metadata("design:paramtypes", [voucher_posting_service_1.VoucherPostingService, Object])
], StockAccountsPostingService);
exports.STOCK_COGS_MODE_PROVIDER = {
    provide: exports.STOCK_COGS_MODE,
    useExisting: stock_cogs_mode_service_1.StockCogsModeService,
};
function round2(v) {
    return Math.round((v + Number.EPSILON * Math.sign(v || 1)) * 100) / 100;
}
function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
//# sourceMappingURL=stock-accounts-posting.service.js.map