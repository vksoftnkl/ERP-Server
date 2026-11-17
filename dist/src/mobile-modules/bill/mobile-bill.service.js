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
exports.MobileBillService = exports.MOBILE_BILL_DEVICE_TYPE = void 0;
exports.billDayOf = billDayOf;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const bill_lifecycle_service_1 = require("../../modules/sales/bill/bill-lifecycle.service");
const bill_service_1 = require("../../modules/sales/bill/bill.service");
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const mobile_scope_1 = require("../common/mobile-scope");
const mobile_item_service_1 = require("../item/mobile-item.service");
const mobile_bill_dto_1 = require("./dto/mobile-bill.dto");
exports.MOBILE_BILL_DEVICE_TYPE = 'MOBILE';
function billDayOf(sbBillDate, today) {
    return sbBillDate ? sbBillDate.slice(0, 10) : today;
}
let MobileBillService = class MobileBillService {
    prisma;
    requestContextService;
    bills;
    lifecycle;
    constructor(prisma, requestContextService, bills, lifecycle) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
        this.bills = bills;
        this.lifecycle = lifecycle;
    }
    async options(query) {
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, query.companyId);
        const device = await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, query.deviceUid);
        const branchId = await (0, mobile_scope_1.requireMobileBranch)(this.prisma, query.companyId, device.devBranchId);
        return {
            companyId: query.companyId,
            branchId,
            godowns: await this.godownsOf(this.prisma, branchId),
        };
    }
    async create(dto) {
        const userId = (0, mobile_scope_1.requireMobileLogin)(this.requestContextService.getUserId());
        const posted = { done: null };
        try {
            const answer = await this.prisma.$transaction(async (tx) => {
                await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'bill', dto.sbCompanyId, dto.sbClientUuid);
                const stored = await this.findBill(tx, {
                    companyId: dto.sbCompanyId,
                    clientUuid: dto.sbClientUuid,
                });
                if (stored) {
                    return this.resendAnswer(stored, dto);
                }
                await (0, mobile_scope_1.assertMobileCompany)(tx, dto.sbCompanyId, 'sbCompanyId');
                const device = await (0, mobile_scope_1.resolveMobileDevice)(tx, dto.deviceUid);
                const branchId = await (0, mobile_scope_1.requireMobileBranch)(tx, dto.sbCompanyId, device.devBranchId);
                const billDay = billDayOf(dto.sbBillDate, await (0, mobile_scope_1.databaseToday)(tx));
                const accYear = await (0, mobile_scope_1.requireMobileAccYear)(tx, dto.sbCompanyId, billDay, 'sbBillDate');
                await this.assertLineGodowns(tx, branchId, dto.items);
                posted.done = await this.lifecycle.saveAndPostInTx(tx, this.toSaveDto(dto, {
                    sbBranchId: branchId,
                    sbAccYear: accYear,
                    sbDeviceId: device.devId,
                    sbUserId: userId,
                    sbBillDate: billDay,
                }));
                const { sbId, sbAccYear } = posted.done.keys;
                await tx.$executeRaw `
          UPDATE sales.sale_bill
             SET sb_client_uuid = ${dto.sbClientUuid}::uuid
           WHERE sb_id = ${sbId}::uuid AND sb_acc_year = ${sbAccYear}::char(9)`;
                const saved = await this.findBill(tx, { sbId, accYear: sbAccYear });
                return this.toAnswer(saved, false);
            }, bill_lifecycle_service_1.POST_TX_OPTIONS);
            if (posted.done) {
                this.lifecycle.afterSaveAndPost(posted.done);
            }
            return answer;
        }
        catch (error) {
            if ((0, mobile_scope_1.isClientUuidClash)(error)) {
                const stored = await this.findBill(this.prisma, {
                    companyId: dto.sbCompanyId,
                    clientUuid: dto.sbClientUuid,
                });
                if (stored) {
                    return this.resendAnswer(stored, dto);
                }
            }
            this.bills.throwIfDuplicate(error);
            throw error;
        }
    }
    toSaveDto(dto, scope) {
        const { sbClientUuid: _clientUuid, deviceUid: _deviceUid, ...bill } = dto;
        void _clientUuid;
        void _deviceUid;
        return {
            ...bill,
            ...scope,
            sbDeviceType: exports.MOBILE_BILL_DEVICE_TYPE,
            sbBillType: mobile_bill_dto_1.MOBILE_BILL_TYPE,
            post: true,
        };
    }
    async assertLineGodowns(client, branchId, items) {
        const ids = [...new Set(items.map((item) => item.sbiGodownId))];
        const rows = await client.$queryRaw `
      SELECT g.gdl_id::text AS id
        FROM inventory.godown_locations g
       WHERE g.gdl_id = ANY(${ids}::uuid[])
         AND g.gdl_branch_id = ${branchId}::uuid
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true`;
        const usable = new Set(rows.map((row) => row.id));
        const errors = [];
        items.forEach((item, index) => {
            if (!usable.has(item.sbiGodownId)) {
                errors.push({
                    field: `items.${index}.sbiGodownId`,
                    message: `Line ${index + 1}: godown ${item.sbiGodownId} is not an active godown of this bill's branch.`,
                    code: mobile_error_codes_1.MobileErrorCode.GODOWN_INVALID,
                });
            }
        });
        if (errors.length > 0) {
            (0, module_shared_utils_1.throwUnprocessable)('Godown not usable', errors);
        }
    }
    async godownsOf(client, branchId) {
        return client.$queryRaw `
      SELECT g.gdl_id::text AS "godownId", g.gdl_name AS name,
             NULLIF(btrim(g.gdl_short), '') AS "shortName",
             (g.gdl_id = b.br_default_godown_id) IS TRUE AS "isDefault"
        FROM inventory.godown_locations g
        JOIN public.branch_master b ON b.br_id = g.gdl_branch_id
       WHERE g.gdl_branch_id = ${branchId}::uuid
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true
       ORDER BY 4 DESC, g.gdl_sort, lower(g.gdl_name), g.gdl_id`;
    }
    async findBill(client, key) {
        const where = 'clientUuid' in key
            ? client_1.Prisma.sql `sb.sb_company_id = ${key.companyId}::uuid
                 AND sb.sb_client_uuid = ${key.clientUuid}::uuid`
            : client_1.Prisma.sql `sb.sb_id = ${key.sbId}::uuid AND sb.sb_acc_year = ${key.accYear}::char(9)`;
        const [row] = await client.$queryRaw `
      SELECT sb.sb_id::text AS "sbId", sb.sb_company_id::text AS "sbCompanyId",
             sb.sb_branch_id::text AS "sbBranchId", btrim(sb.sb_acc_year::text) AS "sbAccYear",
             sb.sb_bill_refno AS "sbBillRefno", sb.sb_usr_refno AS "sbUsrRefno",
             sb.sb_bill_date::text AS "sbBillDate", sb.sb_bill_amt AS "sbBillAmt",
             sb.sb_status AS "sbStatus", sb.sb_is_deleted AS "sbIsDeleted",
             sb.sb_cust_id::text AS "sbCustId"
        FROM sales.sale_bill sb
       WHERE ${where}
       ORDER BY sb.sb_created_on
       LIMIT 1`;
        return row ?? null;
    }
    resendAnswer(stored, dto) {
        if ((stored.sbCustId ?? null) !== (dto.sbCustId ?? null)) {
            (0, module_shared_utils_1.throwConflict)('Bill id already used', [
                {
                    field: 'sbClientUuid',
                    message: `sbClientUuid ${dto.sbClientUuid} already names bill ${stored.sbBillRefno} of another customer.`,
                    code: mobile_error_codes_1.MobileErrorCode.CLIENT_UUID_REUSED,
                },
            ]);
        }
        return this.toAnswer(stored, true);
    }
    toAnswer(stored, duplicate) {
        return {
            sbId: stored.sbId,
            sbCompanyId: stored.sbCompanyId,
            sbBranchId: stored.sbBranchId,
            sbAccYear: stored.sbAccYear,
            sbBillRefno: stored.sbBillRefno,
            sbUsrRefno: stored.sbUsrRefno,
            sbBillDate: stored.sbBillDate.slice(0, 10),
            sbBillAmt: (0, mobile_item_service_1.moneyText)(stored.sbBillAmt ?? 0) ?? '0.00',
            sbStatus: stored.sbStatus,
            duplicate,
            sbIsDeleted: stored.sbIsDeleted,
        };
    }
};
exports.MobileBillService = MobileBillService;
exports.MobileBillService = MobileBillService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        bill_service_1.BillService,
        bill_lifecycle_service_1.BillLifecycleService])
], MobileBillService);
//# sourceMappingURL=mobile-bill.service.js.map