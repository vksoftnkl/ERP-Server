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
var MobileOrderService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.MobileOrderService = void 0;
exports.confirmRefusalOf = confirmRefusalOf;
exports.mobileOrderLineGodowns = mobileOrderLineGodowns;
exports.withLineGodowns = withLineGodowns;
exports.orderDayOf = orderDayOf;
const common_1 = require("@nestjs/common");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const sale_order_tx_options_1 = require("../../modules/sales/sale-order/sale-order-tx.options");
const sale_order_service_1 = require("../../modules/sales/sale-order/sale-order.service");
const sale_order_lifecycle_service_1 = require("../../modules/sales/sale-order/sale-order-lifecycle.service");
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const mobile_scope_1 = require("../common/mobile-scope");
const sale_line_godown_utils_1 = require("../../common/utils/sale-line-godown.utils");
const item_price_lookup_1 = require("../../modules/master-lookup/lookups/item-price.lookup");
const app_setting_value_service_1 = require("../../modules/settings/appSettings/app-setting-value.service");
const mobile_order_desktop_fill_1 = require("./mobile-order-desktop-fill");
const PHONE_CONFIRM = { skipPostRight: true, origin: 'PHONE' };
function confirmRefusalOf(error) {
    if (!(error instanceof common_1.HttpException)) {
        return null;
    }
    const status = error.getStatus();
    if (status < 400 || status >= 500) {
        return null;
    }
    const body = error.getResponse();
    const errors = isRecord(body) && Array.isArray(body.errors) ? body.errors : [];
    const first = errors[0];
    if (!isRecord(first) || typeof first.code !== 'string' || first.code === '') {
        return null;
    }
    return {
        code: first.code,
        field: typeof first.field === 'string' ? first.field : null,
        message: typeof first.message === 'string' ? first.message : error.message,
    };
}
function isRecord(value) {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}
async function mobileOrderLineGodowns(client, branchId, items) {
    return (0, sale_line_godown_utils_1.resolveDefaultSaleGodowns)(client, branchId, items
        .filter((item) => !item.soiGodownId)
        .map((item) => ({ itemId: item.soiItemId, iucId: item.soiItemUnitId })));
}
function withLineGodowns(items, godownByLine) {
    return items.map((item) => {
        if (item.soiGodownId)
            return item;
        const godown = godownByLine.get((0, sale_line_godown_utils_1.saleGodownKey)({ itemId: item.soiItemId, iucId: item.soiItemUnitId }));
        return godown ? { ...item, soiGodownId: godown.gdlId } : item;
    });
}
function orderDayOf(soOrderDate, today) {
    return soOrderDate ? soOrderDate.slice(0, 10) : today;
}
let MobileOrderService = MobileOrderService_1 = class MobileOrderService {
    prisma;
    requestContextService;
    saleOrderService;
    saleOrderLifecycle;
    appSettings;
    logger = new common_1.Logger(MobileOrderService_1.name);
    itemPrice;
    constructor(prisma, requestContextService, saleOrderService, saleOrderLifecycle, appSettings) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
        this.saleOrderService = saleOrderService;
        this.saleOrderLifecycle = saleOrderLifecycle;
        this.appSettings = appSettings;
        this.itemPrice = new item_price_lookup_1.ItemPriceLookup(prisma, appSettings);
    }
    async create(dto) {
        const confirmed = { keys: null };
        let answer;
        try {
            answer = await this.prisma.$transaction(async (tx) => {
                await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'order', dto.soCompanyId, dto.soClientUuid);
                const stored = await this.findByClientUuid(tx, dto.soCompanyId, dto.soClientUuid);
                if (stored) {
                    return this.resendAnswer(stored, dto);
                }
                await (0, mobile_scope_1.assertMobileCompany)(tx, dto.soCompanyId, 'soCompanyId');
                const device = await (0, mobile_scope_1.resolveMobileDevice)(tx, dto.deviceUid);
                const branchId = await this.orderBranchId(tx, dto, device.devBranchId);
                const orderDay = orderDayOf(dto.soOrderDate, await (0, mobile_scope_1.databaseToday)(tx));
                const accYear = await (0, mobile_scope_1.requireMobileAccYear)(tx, dto.soCompanyId, orderDay, 'soOrderDate');
                const items = withLineGodowns(dto.items, await mobileOrderLineGodowns(tx, branchId, dto.items));
                const desktop = await this.desktopFacts(tx, dto, items, {
                    branchId,
                    accYear,
                    orderDay,
                    deviceId: device.devId,
                });
                const saveDto = this.toSaveDto(dto, {
                    soBranchId: branchId,
                    soAccYear: accYear,
                    soDeviceId: device.devId,
                    soUserId: this.orderUserId(dto),
                    soOrderDate: orderDay,
                }, items, desktop);
                this.saleOrderService.prepareSave(saveDto);
                const created = await this.saleOrderService.createOrderInTx(tx, saveDto);
                await tx.saleOrder.update({
                    where: { soId_soAccYear: { soId: created.soId, soAccYear: created.soAccYear } },
                    data: { soClientUuid: dto.soClientUuid },
                });
                const confirm = await this.confirmInTx(tx, created);
                if (confirm.confirmedNow) {
                    confirmed.keys = {
                        soId: created.soId,
                        soCompanyId: created.soCompanyId,
                        soBranchId: created.soBranchId,
                        soAccYear: created.soAccYear,
                    };
                }
                return {
                    soId: created.soId,
                    soOrderRefno: created.soOrderRefno,
                    soStatus: confirm.soStatus,
                    soAccYear: created.soAccYear,
                    duplicate: false,
                    soIsDeleted: false,
                    confirmRefused: confirm.confirmRefused,
                    warnings: confirm.warnings,
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
        const whatsapp = confirmed.keys ? await this.whatsappAfterCommit(confirmed.keys) : null;
        return whatsapp ? { ...answer, whatsapp } : answer;
    }
    async whatsappAfterCommit(keys) {
        try {
            return await this.saleOrderLifecycle.whatsappAfterPost(keys, undefined);
        }
        catch (error) {
            this.logger.error(`WhatsApp on Post for phone order ${keys.soId} failed (the order stands): ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
    }
    async confirmInTx(tx, created) {
        await tx.$executeRaw `SAVEPOINT mobile_order_confirm`;
        try {
            const posted = await this.saleOrderLifecycle.postInTx(tx, {
                soId: created.soId,
                soCompanyId: created.soCompanyId,
                soBranchId: created.soBranchId,
                soAccYear: created.soAccYear,
            }, new Date(), PHONE_CONFIRM);
            await tx.$executeRaw `RELEASE SAVEPOINT mobile_order_confirm`;
            return {
                soStatus: posted.soStatus,
                confirmRefused: null,
                warnings: posted.warnings,
                confirmedNow: posted.confirmedNow === true,
            };
        }
        catch (error) {
            const refused = confirmRefusalOf(error);
            if (!refused) {
                throw error;
            }
            await tx.$executeRaw `ROLLBACK TO SAVEPOINT mobile_order_confirm`;
            return {
                soStatus: created.soStatus,
                confirmRefused: refused,
                warnings: [],
                confirmedNow: false,
            };
        }
    }
    orderBranchId(tx, dto, deviceBranchId) {
        return dto.soBranchId
            ? (0, mobile_scope_1.requireMobileBranchOfCompany)(tx, dto.soCompanyId, dto.soBranchId, 'soBranchId')
            : (0, mobile_scope_1.requireMobileBranch)(tx, dto.soCompanyId, deviceBranchId);
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
    toSaveDto(dto, scope, items, desktop) {
        const { soClientUuid: _clientUuid, deviceUid: _deviceUid, ...order } = dto;
        void _clientUuid;
        void _deviceUid;
        const lines = items.map((item, i) => (0, mobile_order_desktop_fill_1.withDesktopLineFigures)(item, desktop.lineFacts[i]));
        return {
            ...(0, mobile_order_desktop_fill_1.withDesktopHeaderFigures)(order, lines, desktop.customer, desktop.settings),
            items: lines,
            ...scope,
        };
    }
    async desktopFacts(tx, dto, items, scope) {
        const queryOf = (item) => ({
            item_id: item.soiItemId,
            unit_id: item.soiItemUnitId,
            company_id: dto.soCompanyId,
            branch_id: scope.branchId,
            customer_id: dto.soCustId,
            ...(item.soiGodownId ? { godown_id: item.soiGodownId } : {}),
            acccyear: scope.accYear,
            price_level: item.soiPriceLevel ?? dto.soPriceLevel,
            doc_date: scope.orderDay,
            regional: false,
        });
        const keyOf = (q) => [q.item_id, q.unit_id, q.price_level, q.godown_id ?? ''].join('|');
        const queries = new Map(items.map((item) => [keyOf(queryOf(item)), queryOf(item)]));
        const factsByKey = new Map();
        const pending = [...queries];
        const worker = async () => {
            for (let next = pending.shift(); next; next = pending.shift()) {
                const [key, query] = next;
                factsByKey.set(key, await this.lineFacts(query));
            }
        };
        const [customerRows, settings] = await Promise.all([
            tx.$queryRaw `
        SELECT c.cus_gst_type AS "gstType", NULLIF(TRIM(c.cus_state_code), '') AS "stateCode",
               sc.state_code AS "posStateCode", sc.state_name AS "posStateName"
          FROM sales.customers c
          LEFT JOIN fixed.state_codes sc
            ON sc.state_code = c.cus_state_code AND sc.is_deleted = false AND sc.is_active = true
         WHERE c.cus_id = ${dto.soCustId}::uuid`,
            this.appSettings.resolveEffective({
                companyId: dto.soCompanyId,
                branchId: scope.branchId,
                deviceId: scope.deviceId,
                userId: null,
            }),
            ...Array.from({ length: Math.min(4, pending.length) }, worker),
        ]);
        const wanted = new Set(mobile_order_desktop_fill_1.DESKTOP_ORDER_SETTING_KEYS);
        return {
            lineFacts: items.map((item) => factsByKey.get(keyOf(queryOf(item))) ?? null),
            customer: customerRows[0] ?? null,
            settings: new Map(settings.filter((s) => wanted.has(s.asdKey)).map((s) => [s.asdKey, s.value])),
        };
    }
    async lineFacts(query) {
        try {
            return (0, mobile_order_desktop_fill_1.lineFactsOf)(await this.itemPrice.getItemPriceLookup(query));
        }
        catch (error) {
            this.logger.warn(`Item lookup for phone order line (item ${query.item_id}, unit ${query.unit_id}) failed; ` +
                `the line keeps the phone's figures only: ${error instanceof Error ? error.message : String(error)}`);
            return null;
        }
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
            confirmRefused: null,
            warnings: [],
        };
    }
};
exports.MobileOrderService = MobileOrderService;
exports.MobileOrderService = MobileOrderService = MobileOrderService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        sale_order_service_1.SaleOrderService,
        sale_order_lifecycle_service_1.SaleOrderLifecycleService,
        app_setting_value_service_1.AppSettingValueService])
], MobileOrderService);
//# sourceMappingURL=mobile-order.service.js.map