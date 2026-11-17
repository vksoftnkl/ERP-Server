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
exports.MobileOrderService = void 0;
exports.orderDayOf = orderDayOf;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const sale_order_tx_options_1 = require("../../modules/sales/sale-order/sale-order-tx.options");
const sale_order_service_1 = require("../../modules/sales/sale-order/sale-order.service");
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const mobile_scope_1 = require("../common/mobile-scope");
function orderDayOf(soOrderDate, today) {
    return soOrderDate ? soOrderDate.slice(0, 10) : today;
}
let MobileOrderService = class MobileOrderService {
    prisma;
    requestContextService;
    saleOrderService;
    constructor(prisma, requestContextService, saleOrderService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
        this.saleOrderService = saleOrderService;
    }
    async create(dto) {
        try {
            return await this.prisma.$transaction(async (tx) => {
                await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'order', dto.soCompanyId, dto.soClientUuid);
                const stored = await this.findByClientUuid(tx, dto.soCompanyId, dto.soClientUuid);
                if (stored) {
                    return this.resendAnswer(stored, dto);
                }
                await (0, mobile_scope_1.assertMobileCompany)(tx, dto.soCompanyId, 'soCompanyId');
                const device = await (0, mobile_scope_1.resolveMobileDevice)(tx, dto.deviceUid);
                const branchId = await (0, mobile_scope_1.requireMobileBranch)(tx, dto.soCompanyId, device.devBranchId);
                const orderDay = orderDayOf(dto.soOrderDate, await (0, mobile_scope_1.databaseToday)(tx));
                const accYear = await (0, mobile_scope_1.requireMobileAccYear)(tx, dto.soCompanyId, orderDay, 'soOrderDate');
                const saveDto = this.toSaveDto(dto, {
                    soBranchId: branchId,
                    soAccYear: accYear,
                    soDeviceId: device.devId,
                    soUserId: this.orderUserId(dto),
                    soOrderDate: orderDay,
                });
                this.saleOrderService.prepareSave(saveDto);
                const created = await this.saleOrderService.createOrderInTx(tx, saveDto);
                await tx.saleOrder.update({
                    where: { soId_soAccYear: { soId: created.soId, soAccYear: created.soAccYear } },
                    data: { soClientUuid: dto.soClientUuid },
                });
                return {
                    soId: created.soId,
                    soOrderRefno: created.soOrderRefno,
                    soStatus: created.soStatus,
                    soAccYear: created.soAccYear,
                    duplicate: false,
                    soIsDeleted: false,
                };
            }, sale_order_tx_options_1.ORDER_TX_OPTIONS);
        }
        catch (error) {
            if ((0, module_shared_utils_1.isUniqueConstraintError)(error)) {
                const stored = await this.findByClientUuid(this.prisma, dto.soCompanyId, dto.soClientUuid);
                if (stored) {
                    return this.resendAnswer(stored, dto);
                }
            }
            this.saleOrderService.throwIfDuplicate(error);
            throw error;
        }
    }
    orderUserId(dto) {
        const userId = this.requestContextService.getUserId() ?? dto.soUserId;
        if (!userId) {
            (0, module_shared_utils_1.throwBadRequest)('Validation failed', [
                {
                    field: 'soUserId',
                    message: "Send soUserId, or upload with the salesman's login token.",
                    code: mobile_error_codes_1.MobileErrorCode.ORDER_USER_REQUIRED,
                },
            ]);
        }
        return userId;
    }
    toSaveDto(dto, scope) {
        const { soClientUuid: _clientUuid, deviceUid: _deviceUid, ...order } = dto;
        void _clientUuid;
        void _deviceUid;
        return { ...order, ...scope };
    }
    async findByClientUuid(client, companyId, clientUuid) {
        const [row] = await client.$queryRaw `
      SELECT so.so_id AS "soId", so.so_order_refno AS "soOrderRefno", so.so_status AS "soStatus",
             so.so_acc_year::text AS "soAccYear", so.so_is_deleted AS "soIsDeleted",
             so.so_cust_id AS "soCustId"
        FROM sales.sale_order so
       WHERE so.so_company_id = ${companyId}::uuid
         AND so.so_client_uuid = ${clientUuid}::uuid
       ORDER BY so.so_created_on
       LIMIT 1`;
        return row ?? null;
    }
    resendAnswer(stored, dto) {
        if (stored.soCustId !== dto.soCustId) {
            (0, module_shared_utils_1.throwConflict)('Order id already used', [
                {
                    field: 'soClientUuid',
                    message: `soClientUuid ${dto.soClientUuid} already names order ${stored.soOrderRefno} of another customer.`,
                    code: mobile_error_codes_1.MobileErrorCode.CLIENT_UUID_REUSED,
                },
            ]);
        }
        return {
            soId: stored.soId,
            soOrderRefno: stored.soOrderRefno,
            soStatus: stored.soStatus,
            soAccYear: stored.soAccYear.trim(),
            duplicate: true,
            soIsDeleted: stored.soIsDeleted,
        };
    }
};
exports.MobileOrderService = MobileOrderService;
exports.MobileOrderService = MobileOrderService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        sale_order_service_1.SaleOrderService])
], MobileOrderService);
//# sourceMappingURL=mobile-order.service.js.map