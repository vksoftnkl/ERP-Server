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
exports.MobileReturnService = exports.MOBILE_RETURN_DEVICE_TYPE = void 0;
exports.adjustedOf = adjustedOf;
exports.latestApproval = latestApproval;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const rights_1 = require("../../common/posting/rights");
const module_shared_utils_1 = require("../../common/utils/module-shared.utils");
const sales_context_service_1 = require("../../modules/sales/posting/sales-context.service");
const sales_doc_utils_1 = require("../../modules/sales/posting/sales-doc.utils");
const sales_errors_1 = require("../../modules/sales/posting/sales.errors");
const posting_types_1 = require("../../modules/sales/posting/types/posting.types");
const sale_return_bill_reader_1 = require("../../modules/sales/sale-return/sale-return-bill-reader");
const sale_return_money_1 = require("../../modules/sales/sale-return/sale-return-money");
const sale_return_service_1 = require("../../modules/sales/sale-return/sale-return.service");
const mobile_error_codes_1 = require("../common/mobile-error-codes");
const mobile_login_1 = require("../common/mobile-login");
const mobile_scope_1 = require("../common/mobile-scope");
const mobile_return_dto_1 = require("./dto/mobile-return.dto");
const mobile_return_plan_1 = require("./mobile-return-plan");
exports.MOBILE_RETURN_DEVICE_TYPE = 'MOBILE';
const RETURN_TX_OPTIONS = { timeout: 120_000, maxWait: 10_000 };
const BILL_READ_BATCH = 10;
const ZERO = new client_1.Prisma.Decimal(0);
const money = (v) => new client_1.Prisma.Decimal(v ?? 0).toFixed(2);
const perc = (v) => v.toFixed(3);
const isUuidV7 = (id) => /^[0-9a-f]{8}-[0-9a-f]{4}-7/i.test(id);
let MobileReturnService = class MobileReturnService {
    prisma;
    requestContextService;
    returns;
    salesContext;
    reader = new sale_return_bill_reader_1.SaleReturnBillReader();
    constructor(prisma, requestContextService, returns, salesContext) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
        this.returns = returns;
        this.salesContext = salesContext;
    }
    async options(query) {
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, query.companyId);
        const device = await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, query.deviceUid);
        const branchId = await this.branchOf(this.prisma, query.companyId, query.branchId, device);
        const userId = this.requestContextService.getUserId();
        const [reasons, godowns, settings, rights] = await Promise.all([
            this.reasonsOf(this.prisma, query.companyId),
            this.godownsOf(this.prisma, branchId),
            this.settingsOf(query.companyId, branchId, device.devId),
            userId ? (0, rights_1.loadRights)(this.prisma, userId, sales_doc_utils_1.SALES_MENU_ID.SALE_RETURN) : Promise.resolve(null),
        ]);
        return {
            companyId: query.companyId,
            branchId,
            reasons,
            godowns,
            settings,
            rights: rights ? { create: rights.create, post: rights.post } : null,
        };
    }
    async settingsOf(companyId, branchId, deviceId) {
        const [settings, values] = await Promise.all([
            this.salesContext.settings(companyId, branchId, deviceId),
            this.salesContext.values(companyId, branchId, deviceId, [
                'sales.return_settle_default',
                'sales.return_expired_lot_days',
            ]),
        ]);
        const lotDays = Number(values['sales.return_expired_lot_days'] ?? 0);
        return {
            returnWindowDays: settings.returnWindowDays,
            freeReturnAllowed: settings.freeReturnAllowed,
            settleDefault: (0, mobile_return_plan_1.phoneSettleDefault)(values['sales.return_settle_default']),
            expiredLotDays: Number.isFinite(lotDays) && lotDays > 0 ? Math.trunc(lotDays) : null,
            billDays: (0, mobile_return_plan_1.billDaysOf)(settings.returnWindowDays),
        };
    }
    async reasonsOf(client, companyId) {
        const rows = await client.$queryRaw `
      SELECT r.srm_id::text AS "reasonId", r.srm_code AS code, r.srm_name AS name,
             r.srm_default_condition AS condition, r.srm_refund_charges AS "refundCharges",
             r.srm_sort_order AS "sortOrder"
        FROM stock.stock_reason_master r
       WHERE r.srm_is_active = true
         AND r.srm_is_deleted = false
         AND r.srm_allowed_txn_types && ARRAY['SALE_RETURN']::text[]
         AND (r.srm_company_id IS NULL OR r.srm_company_id = ${companyId}::uuid)
         AND NOT (r.srm_company_id IS NULL AND EXISTS (
               SELECT 1 FROM stock.stock_reason_master c
                WHERE c.srm_company_id = ${companyId}::uuid
                  AND c.srm_code = r.srm_code
                  AND c.srm_is_deleted = false))
       ORDER BY r.srm_sort_order, r.srm_name`;
        return rows.map((r) => ({
            reasonId: r.reasonId,
            code: r.code,
            name: r.name,
            defaultCondition: (0, mobile_return_plan_1.phoneCondition)(r.condition),
            refundCharges: r.refundCharges,
            isClaim: /_SHOP$/i.test(r.code.trim()),
            sortOrder: r.sortOrder ?? 0,
        }));
    }
    async godownsOf(client, branchId) {
        return client.$queryRaw `
      SELECT g.gdl_id::text AS "godownId", g.gdl_name AS name,
             (g.gdl_id = b.br_default_godown_id) IS TRUE AS "isDefault"
        FROM inventory.godown_locations g
        JOIN public.branch_master b ON b.br_id = g.gdl_branch_id
       WHERE g.gdl_branch_id = ${branchId}::uuid
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true
       ORDER BY 3 DESC, g.gdl_sort, lower(g.gdl_name), g.gdl_id`;
    }
    async branchOf(client, companyId, branchId, device, field = 'branchId') {
        return branchId
            ? (0, mobile_scope_1.requireMobileBranchOfCompany)(client, companyId, branchId, field)
            : (0, mobile_scope_1.requireMobileBranch)(client, companyId, device.devBranchId);
    }
    async billLines(query) {
        const page = query.page ?? 1;
        const pageSize = query.pageSize ?? mobile_return_dto_1.MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE;
        await (0, mobile_scope_1.assertMobileCompany)(this.prisma, query.companyId);
        const device = await (0, mobile_scope_1.resolveMobileDevice)(this.prisma, query.deviceUid);
        const branchId = await this.branchOf(this.prisma, query.companyId, query.branchId, device);
        const settings = await this.salesContext.settings(query.companyId, branchId, device.devId);
        const billDays = (0, mobile_return_plan_1.billDaysOf)(settings.returnWindowDays);
        const [clock] = await this.prisma.$queryRaw `
      SELECT clock_timestamp() AS "asOf",
             (CURRENT_DATE - ${billDays}::int)::text AS since`;
        const since = query.since ? query.since.slice(0, 10) : clock.since;
        const rows = await this.prisma.$queryRaw `
      SELECT sb.sb_id::text AS "sbId", btrim(sb.sb_acc_year::text) AS "accYear",
             count(*) OVER ()::int AS total
        FROM sales.sale_bill sb
       WHERE sb.sb_company_id = ${query.companyId}::uuid
         AND sb.sb_branch_id = ${branchId}::uuid
         AND sb.sb_status = 'POSTED'
         AND sb.sb_is_deleted = false
         AND sb.sb_bill_date >= ${since}::date
         AND EXISTS (SELECT 1 FROM sales.customers c
                      WHERE c.cus_id = sb.sb_cust_id AND c.cus_is_deleted = false)
       ORDER BY sb.sb_bill_date DESC, sb.sb_created_on DESC, sb.sb_id DESC
       LIMIT ${pageSize}::int OFFSET ${(page - 1) * pageSize}::int`;
        const total = rows[0]?.total ?? (page > 1 ? await this.countBills(query.companyId, branchId, since) : 0);
        const bills = [];
        for (let i = 0; i < rows.length; i += BILL_READ_BATCH) {
            const batch = await Promise.all(rows.slice(i, i + BILL_READ_BATCH).map((r) => this.billOf(r.sbId, r.accYear)));
            bills.push(...batch.filter((b) => b !== null));
        }
        return {
            asOf: clock.asOf.toISOString(),
            billDays,
            since,
            page,
            pageSize,
            total,
            hasMore: (page - 1) * pageSize + rows.length < total,
            companyId: query.companyId,
            branchId,
            bills,
        };
    }
    async countBills(companyId, branchId, since) {
        const [row] = await this.prisma.$queryRaw `
      SELECT count(*)::int AS total
        FROM sales.sale_bill sb
       WHERE sb.sb_company_id = ${companyId}::uuid
         AND sb.sb_branch_id = ${branchId}::uuid
         AND sb.sb_status = 'POSTED'
         AND sb.sb_is_deleted = false
         AND sb.sb_bill_date >= ${since}::date
         AND EXISTS (SELECT 1 FROM sales.customers c
                      WHERE c.cus_id = sb.sb_cust_id AND c.cus_is_deleted = false)`;
        return row?.total ?? 0;
    }
    async billOf(sbId, accYear) {
        const c = this.prisma;
        const bill = await this.reader.billHeader(c, sbId, accYear);
        if (!bill) {
            return null;
        }
        const [lines, prior, drafts, due] = await Promise.all([
            this.reader.billLines(c, bill),
            this.reader.priorBack(c, bill, null),
            this.reader.onDrafts(c, bill, null),
            this.reader.billDue(c, bill),
        ]);
        return {
            sbId: bill.sbId,
            accYear: bill.accYear,
            refno: bill.refno,
            date: bill.date,
            custId: bill.custId,
            branchId: bill.branchId,
            billAmount: money(bill.billAmt),
            due: money(due),
            payMode: bill.payMode,
            returnedAmt: money(bill.returnedAmt),
            returnStatus: (0, mobile_return_plan_1.billReturnStatus)(bill.returnStatus),
            lines: lines.map((l) => {
                const billBase = l.qty.times(l.factor);
                const back = prior.get(l.billItemId)?.base ?? ZERO;
                const left = client_1.Prisma.Decimal.max(ZERO, billBase.minus(back));
                return {
                    billItemId: l.billItemId,
                    accYear: l.accYear,
                    lineNo: l.lineNo,
                    itemId: l.itemId,
                    itemName: l.itemName,
                    itemUnitId: l.itemUnitId,
                    unitName: l.unitName,
                    toBaseFactor: (0, sale_return_money_1.n)(l.factor),
                    billQty: (0, sale_return_money_1.n)(l.qty),
                    billQtyBase: (0, sale_return_money_1.n)(billBase),
                    returnedQtyBase: (0, sale_return_money_1.n)(back),
                    qtyLeftBase: (0, sale_return_money_1.n)(left),
                    onOtherDraftsBase: (0, sale_return_money_1.n)(drafts.get(l.billItemId)?.base ?? ZERO),
                    ratePreTaxBase: billBase.gt(0)
                        ? l.parts.taxableAmt
                            .dividedBy(billBase)
                            .toDecimalPlaces(4, client_1.Prisma.Decimal.ROUND_HALF_UP)
                            .toFixed(4)
                        : null,
                    rate: l.perUnit.rate ? money(l.perUnit.rate) : null,
                    taxPerc: perc(l.percent.taxPerc),
                    cgstPerc: perc(l.percent.cgstPerc),
                    sgstPerc: perc(l.percent.sgstPerc),
                    igstPerc: perc(l.percent.igstPerc),
                    lotId: l.copy.lotId,
                    batchNo: l.copy.batchNo ?? l.lotBatchNo,
                    expiryDate: l.copy.expiryDate ?? l.lotExpiry,
                    godownId: l.godownId,
                    isFree: l.copy.isFree,
                    allowReturn: l.allowReturn,
                };
            }),
        };
    }
    async create(dto) {
        const userId = (0, mobile_scope_1.requireMobileLogin)(this.requestContextService.getUserId());
        const after = { fire: null };
        try {
            const answer = await this.prisma.$transaction(async (tx) => {
                await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'return', dto.srCompanyId, dto.srClientUuid);
                const stored = await this.findReturn(tx, {
                    companyId: dto.srCompanyId,
                    clientUuid: dto.srClientUuid,
                });
                if (stored) {
                    this.assertResendable(stored, dto);
                    if (stored.srStatus !== 'DRAFT') {
                        return this.answerFrom(tx, stored, { duplicate: true, status: 'POSTED' });
                    }
                }
                const saved = await this.saveDraft(tx, dto, userId, stored);
                return this.postSaved(tx, dto, userId, saved, after);
            }, RETURN_TX_OPTIONS);
            this.returns.afterPostCommit(after.fire);
            return answer;
        }
        catch (error) {
            if ((0, mobile_scope_1.isClientUuidClash)(error)) {
                const stored = await this.findReturn(this.prisma, {
                    companyId: dto.srCompanyId,
                    clientUuid: dto.srClientUuid,
                });
                if (stored) {
                    this.assertResendable(stored, dto);
                    return this.answerFrom(this.prisma, stored, {
                        duplicate: true,
                        status: stored.srStatus === 'DRAFT' ? 'SENT_BACK' : 'POSTED',
                    });
                }
            }
            throw error;
        }
    }
    assertResendable(stored, dto) {
        if (stored.srCustId !== dto.srCustId) {
            (0, module_shared_utils_1.throwConflict)('Return id already used', [
                {
                    field: 'srClientUuid',
                    message: `srClientUuid ${dto.srClientUuid} already names return ${stored.srReturnRefno ?? stored.srId} of another customer.`,
                    code: mobile_error_codes_1.MobileErrorCode.CLIENT_UUID_REUSED,
                },
            ]);
        }
        if (stored.srIsDeleted) {
            (0, module_shared_utils_1.throwConflict)('Return deleted', [
                {
                    field: 'srClientUuid',
                    message: `Return ${stored.srReturnRefno ?? stored.srId} was deleted in VK Nex: make a new return to send it again.`,
                    code: mobile_error_codes_1.MobileErrorCode.RETURN_DELETED,
                },
            ]);
        }
    }
    async saveDraft(tx, dto, userId, stored) {
        await (0, mobile_scope_1.assertMobileCompany)(tx, dto.srCompanyId, 'srCompanyId');
        const device = await (0, mobile_scope_1.resolveMobileDevice)(tx, dto.deviceUid);
        const branchId = stored
            ? stored.srBranchId
            : await this.branchOf(tx, dto.srCompanyId, dto.srBranchId, device, 'srBranchId');
        const today = await (0, mobile_scope_1.databaseToday)(tx);
        let returnDay = dto.srReturnDate ? dto.srReturnDate.slice(0, 10) : today;
        const yearOfDay = await (0, mobile_scope_1.requireMobileAccYear)(tx, dto.srCompanyId, returnDay, 'srReturnDate');
        if (stored && yearOfDay !== stored.srAccYear) {
            returnDay = stored.srReturnDate;
        }
        const accYear = stored ? stored.srAccYear : yearOfDay;
        if (stored && (await this.hasPendingApproval(tx, stored.srId))) {
            return { id: stored.srId, companyId: stored.srCompanyId, branchId, accYear };
        }
        const login = await (0, mobile_login_1.requireMobileLoginRow)(tx, userId);
        const customer = await this.requireCustomer(tx, dto.srCustId);
        await this.assertReason(tx, dto.srCompanyId, dto.srReasonId);
        const bill = await this.billOfUpload(tx, dto);
        const godowns = await this.lineGodowns(tx, branchId, dto, bill);
        const salesmen = bill
            ? bill.salesmanIds
            : await this.loginSalesman(tx, login.employeeId, dto.srCompanyId);
        const save = {
            ...(stored
                ? { srId: stored.srId }
                : isUuidV7(dto.srClientUuid)
                    ? { srId: dto.srClientUuid }
                    : {}),
            srCompanyId: dto.srCompanyId,
            srBranchId: branchId,
            srAccYear: accYear,
            srCounterId: device.devId,
            srDeviceType: exports.MOBILE_RETURN_DEVICE_TYPE,
            srDeviceId: device.devId,
            srUserId: userId,
            srCustId: customer.cusId,
            srCustName: customer.cusName,
            srIsAgainstBill: bill !== null,
            srBillId: bill?.sbId ?? null,
            srBillAccYear: bill?.accYear ?? null,
            srReasonId: dto.srReasonId,
            srSettleMode: dto.srSettleMode,
            srReturnKind: 'RETURN',
            srReturnDate: returnDay,
            srUsrRefno: dto.srUsrRefno ?? null,
            srUsrRefdate: dto.srUsrRefdate ?? null,
            srRemarks: dto.srRemarks ?? null,
            srSalesmanId: salesmen,
            ...(bill ? {} : { srPriceLevel: customer.priceLevel }),
            items: dto.lines.map((line, index) => ({
                sriLineNo: line.sriLineNo,
                sriSplitNo: line.sriSplitNo ?? 1,
                sriBillItemId: bill ? (line.sriBillItemId ?? null) : null,
                sriBillAccYear: bill ? line.sriBillAccYear?.trim() || bill.accYear : null,
                sriItemId: line.sriItemId,
                sriItemUnitId: line.sriItemUnitId,
                sriGodownId: godowns[index],
                sriReturnQty: line.sriReturnQty,
                sriFreeQty: 0,
                sriCondition: line.sriCondition,
                sriRemarks: line.sriRemarks ?? null,
                ...(bill
                    ? {}
                    : { sriBatchNo: line.sriBatchNo ?? null, sriExpiryDate: line.sriExpiryDate ?? null }),
            })),
        };
        const saved = await this.returns.saveInTx(tx, save, { skipSaveRight: true, origin: 'PHONE' });
        await tx.$executeRaw `
      UPDATE sales.sale_return
         SET sr_client_uuid = ${dto.srClientUuid}::uuid,
             sr_mobile_refno = ${dto.srMobileRefno}
       WHERE sr_id = ${saved.id}::uuid AND sr_acc_year = ${saved.accYear}::char(9)`;
        return saved;
    }
    async postSaved(tx, dto, userId, keys, after) {
        const replanned = [];
        const warnings = [];
        const gates = [];
        const rows = dto.adjustments
            ? dto.adjustments.map((a) => ({
                billId: a.billId,
                billAccYear: a.billAccYear,
                amount: new client_1.Prisma.Decimal(String(a.amount)),
            }))
            : null;
        await tx.$executeRaw `SAVEPOINT mobile_return_post`;
        try {
            after.fire = await this.returns.postInTx(tx, {
                srId: keys.id,
                srCompanyId: keys.companyId,
                srBranchId: keys.branchId,
                srAccYear: keys.accYear,
            }, {
                replanAdjust: rows
                    ? ({ bills, adjustable }) => {
                        const plan = (0, mobile_return_plan_1.replanAdjust)({ rows, bills, adjustable });
                        replanned.splice(0, replanned.length, ...plan.replanned);
                        return plan.asks;
                    }
                    : null,
                onWarnings: (notes) => warnings.push(...notes.map((w) => ({
                    code: w.code,
                    message: w.message,
                    field: w.field ?? null,
                    line: w.line ?? null,
                    level: w.level,
                    ...(w.params === undefined ? {} : { params: w.params }),
                }))),
                onGateRefused: (gate) => gates.push(gate),
            });
            await tx.$executeRaw `RELEASE SAVEPOINT mobile_return_post`;
        }
        catch (error) {
            const refusals = (0, mobile_return_plan_1.refusalsOf)(error);
            if (!refusals) {
                throw error;
            }
            await tx.$executeRaw `ROLLBACK TO SAVEPOINT mobile_return_post`;
            const outcome = (0, mobile_return_plan_1.outcomeOf)(refusals);
            if (outcome.status === 'HELD' && gates.length > 0) {
                const login = await (0, mobile_login_1.requireMobileLoginRow)(tx, userId);
                await this.returns.fileGateRequestsInTx(tx, gates, `Sent from the phone by ${login.loginName} (${dto.srMobileRefno})`);
            }
            const row = await this.findReturn(tx, { srId: keys.id, accYear: keys.accYear });
            return this.answerFrom(tx, row, {
                duplicate: false,
                status: outcome.status,
                held: outcome.status === 'HELD' ? outcome.first : null,
                refusal: outcome.status === 'SENT_BACK' ? outcome.first : null,
                refusals,
            });
        }
        const row = await this.findReturn(tx, { srId: keys.id, accYear: keys.accYear });
        return this.answerFrom(tx, row, {
            duplicate: false,
            status: 'POSTED',
            warnings,
            replanned: await this.withRefnos(tx, replanned),
        });
    }
    async withRefnos(client, rows) {
        const missing = rows.filter((r) => r.refno === null).map((r) => r.billId);
        if (missing.length === 0) {
            return rows;
        }
        const found = await client.$queryRaw `
      SELECT abl_id::text AS id, abl_doc_refno AS refno
        FROM accounts.acc_bill_balance
       WHERE abl_id = ANY(${missing}::uuid[])`;
        const byId = new Map(found.map((f) => [f.id, f.refno]));
        return rows.map((r) => (r.refno === null ? { ...r, refno: byId.get(r.billId) ?? null } : r));
    }
    async requireCustomer(client, custId) {
        const [row] = await client.$queryRaw `
      SELECT c.cus_id::text AS "cusId", c.cus_name AS "cusName",
             c.cus_price_level_id AS "priceLevel"
        FROM sales.customers c
       WHERE c.cus_id = ${custId}::uuid
         AND c.cus_is_deleted = false`;
        if (!row) {
            (0, module_shared_utils_1.throwUnprocessable)('Customer not found', [
                {
                    field: 'srCustId',
                    message: `No live customer ${custId}.`,
                    code: mobile_error_codes_1.MobileErrorCode.RETURN_CUSTOMER_NOT_FOUND,
                },
            ]);
        }
        const level = row.priceLevel;
        return {
            cusId: row.cusId,
            cusName: row.cusName ?? '',
            priceLevel: level !== null && level >= 1 && level <= 7 ? level : null,
        };
    }
    async assertReason(client, companyId, reasonId) {
        const [row] = await client.$queryRaw `
      SELECT r.srm_id::text AS id
        FROM stock.stock_reason_master r
       WHERE r.srm_id = ${reasonId}::uuid
         AND r.srm_is_active = true
         AND r.srm_is_deleted = false
         AND r.srm_allowed_txn_types && ARRAY['SALE_RETURN']::text[]
         AND (r.srm_company_id IS NULL OR r.srm_company_id = ${companyId}::uuid)
         AND NOT (r.srm_company_id IS NULL AND EXISTS (
               SELECT 1 FROM stock.stock_reason_master c
                WHERE c.srm_company_id = ${companyId}::uuid
                  AND c.srm_code = r.srm_code
                  AND c.srm_is_deleted = false))`;
        if (!row) {
            (0, module_shared_utils_1.throwUnprocessable)('Reason not usable', [
                {
                    field: 'srReasonId',
                    message: `Reason ${reasonId} is not an active sale return reason of this company.`,
                    code: mobile_error_codes_1.MobileErrorCode.RETURN_REASON_INVALID,
                },
            ]);
        }
    }
    async billOfUpload(tx, dto) {
        const billId = dto.srBillId || null;
        if (dto.srIsAgainstBill !== true || !billId) {
            return null;
        }
        const accYear = (dto.srBillAccYear ?? '').trim();
        const bill = await this.reader.billHeader(tx, billId, accYear);
        if (!bill || bill.companyId !== dto.srCompanyId || bill.status !== 'POSTED') {
            (0, sales_errors_1.throwSalesRefused)(`Bill ${billId} (${accYear}) is not a POSTED bill of this company`, posting_types_1.SALES_ERROR_CODES.RETURN_BILL_NOT_POSTED, 'srBillId');
        }
        if (bill.custId !== dto.srCustId) {
            (0, module_shared_utils_1.throwUnprocessable)('Bill of another customer', [
                {
                    field: 'srBillId',
                    message: `Bill ${bill.refno ?? bill.sbId} belongs to another customer.`,
                    code: mobile_error_codes_1.MobileErrorCode.RETURN_BILL_OTHER_CUSTOMER,
                },
            ]);
        }
        return bill;
    }
    async lineGodowns(tx, branchId, dto, bill) {
        if (dto.godownId) {
            const [ok] = await tx.$queryRaw `
        SELECT g.gdl_id::text AS id
          FROM inventory.godown_locations g
         WHERE g.gdl_id = ${dto.godownId}::uuid
           AND g.gdl_branch_id = ${branchId}::uuid
           AND g.gdl_is_deleted = false
           AND g.gdl_is_active = true`;
            if (!ok) {
                (0, module_shared_utils_1.throwUnprocessable)('Godown not usable', [
                    {
                        field: 'godownId',
                        message: `Godown ${dto.godownId} is not an active godown of this return's branch.`,
                        code: mobile_error_codes_1.MobileErrorCode.GODOWN_INVALID,
                    },
                ]);
            }
            return dto.lines.map(() => dto.godownId);
        }
        const billLines = bill
            ? await tx.$queryRaw `
          SELECT bi.sbi_id::text AS id, bi.sbi_item_id::text AS "itemId",
                 bi.sbi_godown_id::text AS "godownId"
            FROM sales.sale_bill_item bi
           WHERE bi.sbi_bill_id = ${bill.sbId}::uuid
             AND bi.sbi_acc_year = ${bill.accYear}::char(9)
             AND bi.sbi_is_deleted = false`
            : [];
        const [branch] = await tx.$queryRaw `
      SELECT g.gdl_id::text AS "godownId"
        FROM public.branch_master b
        LEFT JOIN inventory.godown_locations g
          ON g.gdl_id = b.br_default_godown_id
         AND g.gdl_branch_id = b.br_id
         AND g.gdl_is_deleted = false
         AND g.gdl_is_active = true
       WHERE b.br_id = ${branchId}::uuid`;
        const byLine = new Map(billLines.map((l) => [l.id, l.godownId]));
        const errors = [];
        const out = dto.lines.map((line, index) => {
            const same = billLines.filter((l) => l.itemId === line.sriItemId);
            const own = (line.sriBillItemId ? byLine.get(line.sriBillItemId) : undefined) ??
                (same.length === 1 ? same[0].godownId : undefined);
            const godown = own ?? branch?.godownId ?? null;
            if (!godown) {
                errors.push({
                    field: `lines.${index}.sriGodownId`,
                    message: `Line ${line.sriLineNo}: the branch has no active default godown. Send godownId.`,
                    code: mobile_error_codes_1.MobileErrorCode.GODOWN_INVALID,
                });
            }
            return godown ?? '';
        });
        if (errors.length > 0) {
            (0, module_shared_utils_1.throwUnprocessable)('No godown', errors);
        }
        return out;
    }
    async loginSalesman(client, employeeId, companyId) {
        if (!employeeId) {
            return [];
        }
        const [row] = await client.$queryRaw `
      SELECT e.emp_id::text AS id
        FROM public.employee_master e
       WHERE e.emp_id = ${employeeId}::uuid
         AND e.emp_is_deleted = false
         AND e.emp_company_id = ${companyId}::uuid`;
        return row ? [row.id] : [];
    }
    async hasPendingApproval(client, srId) {
        const [row] = await client.$queryRaw `
      SELECT count(*)::int AS n
        FROM accounts.till_approval a
       WHERE a.tap_src_doc_type = 'SALE_RETURN'
         AND a.tap_src_doc_id = ${srId}::uuid
         AND a.tap_status = 'PENDING'
         AND a.tap_is_deleted = false`;
        return (row?.n ?? 0) > 0;
    }
    async delete(dto) {
        const userId = (0, mobile_scope_1.requireMobileLogin)(this.requestContextService.getUserId());
        return this.prisma.$transaction(async (tx) => {
            await (0, mobile_scope_1.lockMobileClientUuid)(tx, 'return', dto.srCompanyId, dto.srClientUuid);
            await (0, mobile_scope_1.assertMobileCompany)(tx, dto.srCompanyId, 'srCompanyId');
            await (0, mobile_scope_1.resolveMobileDevice)(tx, dto.deviceUid);
            const stored = await this.findReturn(tx, {
                companyId: dto.srCompanyId,
                clientUuid: dto.srClientUuid,
            });
            if (!stored) {
                return {
                    deleted: false,
                    srClientUuid: dto.srClientUuid,
                    srId: null,
                    srReturnRefno: null,
                    duplicate: false,
                };
            }
            const answer = {
                deleted: true,
                srClientUuid: dto.srClientUuid,
                srId: stored.srId,
                srReturnRefno: stored.srReturnRefno,
            };
            if (stored.srIsDeleted) {
                return { ...answer, duplicate: true };
            }
            if (stored.srStatus === 'POSTED') {
                (0, sales_errors_1.throwSalesLocked)('This sale return is POSTED: the office cancels it', posting_types_1.SALES_ERROR_CODES.DOC_POSTED, 'srClientUuid');
            }
            if (stored.srStatus === 'CANCELLED') {
                (0, sales_errors_1.throwSalesLocked)('This sale return is CANCELLED', posting_types_1.SALES_ERROR_CODES.DOC_CANCELLED, 'srClientUuid');
            }
            const login = await (0, mobile_login_1.requireMobileLoginRow)(tx, userId);
            await this.returns.deleteInTx(tx, {
                id: stored.srId,
                companyId: stored.srCompanyId,
                branchId: stored.srBranchId,
                accYear: stored.srAccYear,
            }, {
                withdrawPendingNote: `Withdrawn from the phone by ${login.loginName}: the return was deleted`,
            });
            return { ...answer, duplicate: false };
        }, RETURN_TX_OPTIONS);
    }
    async findReturn(client, key) {
        const where = 'clientUuid' in key
            ? client_1.Prisma.sql `r.sr_company_id = ${key.companyId}::uuid
                 AND r.sr_client_uuid = ${key.clientUuid}::uuid`
            : client_1.Prisma.sql `r.sr_id = ${key.srId}::uuid AND r.sr_acc_year = ${key.accYear}::char(9)`;
        const [row] = await client.$queryRaw `
      SELECT r.sr_id::text AS "srId", btrim(r.sr_acc_year::text) AS "srAccYear",
             r.sr_company_id::text AS "srCompanyId", r.sr_branch_id::text AS "srBranchId",
             r.sr_cust_id::text AS "srCustId", r.sr_client_uuid::text AS "srClientUuid",
             r.sr_return_refno AS "srReturnRefno", r.sr_mobile_refno AS "srMobileRefno",
             r.sr_status AS "srStatus", r.sr_is_deleted AS "srIsDeleted",
             r.sr_return_date::text AS "srReturnDate", r.sr_return_amt AS "srReturnAmt",
             r.sr_tax_amt AS "srTaxAmt", r.sr_round_off AS "srRoundOff",
             r.sr_cash_disc AS "srCashDisc", r.sr_settle_mode AS "srSettleMode",
             r.sr_credit_amt AS "srCreditAmt", r.sr_settle_status AS "srSettleStatus"
        FROM sales.sale_return r
       WHERE ${where}
       ORDER BY r.sr_is_deleted, r.sr_created_on DESC
       LIMIT 1`;
        return row ?? null;
    }
    async answerFrom(client, row, extras) {
        const [lines, adjusted, approval] = await Promise.all([
            client.$queryRaw `
        SELECT i.sri_line_no AS "sriLineNo", i.sri_split_no AS "sriSplitNo", i.sri_id::text AS "sriId",
               i.sri_rate_source AS "rateSource", i.sri_taxable_amt AS "taxableAmt",
               i.sri_tax_amt AS "taxAmt", i.sri_net_amt AS "netAmt", i.sri_bucket AS bucket
          FROM sales.sale_return_item i
         WHERE i.sri_return_id = ${row.srId}::uuid
           AND i.sri_acc_year = ${row.srAccYear}::char(9)
           AND i.sri_is_deleted = false
         ORDER BY i.sri_line_no, i.sri_split_no`,
            adjustedOf(client, row.srId, row.srAccYear),
            latestApproval(client, row.srId),
        ]);
        const goods = lines.reduce((t, l) => t.plus(l.netAmt ?? 0), ZERO);
        const creditNote = new client_1.Prisma.Decimal(row.srReturnAmt ?? 0);
        const roundOff = new client_1.Prisma.Decimal(row.srRoundOff ?? 0);
        const chargesNet = creditNote
            .minus(goods)
            .minus(roundOff)
            .plus(row.srCashDisc ?? 0);
        return {
            duplicate: extras.duplicate,
            srId: row.srId,
            srClientUuid: row.srClientUuid ?? '',
            srReturnRefno: row.srReturnRefno,
            srMobileRefno: row.srMobileRefno,
            srAccYear: row.srAccYear,
            srBranchId: row.srBranchId,
            srStatus: row.srStatus,
            status: extras.status,
            srReturnAmt: money(creditNote),
            totals: {
                goods: money(goods),
                tax: money(row.srTaxAmt),
                chargesNet: money(chargesNet),
                roundOff: money(roundOff),
                creditNote: money(creditNote),
            },
            settlement: {
                mode: row.srSettleMode,
                credited: money(row.srCreditAmt),
                settleStatus: row.srSettleStatus,
                adjusted,
            },
            lines: lines.map((l) => ({
                sriLineNo: l.sriLineNo,
                sriSplitNo: l.sriSplitNo ?? 1,
                sriId: l.sriId,
                rateSource: l.rateSource,
                taxableAmt: money(l.taxableAmt),
                taxAmt: money(l.taxAmt),
                netAmt: money(l.netAmt),
                bucket: l.bucket,
            })),
            held: extras.held ?? null,
            refusal: extras.refusal ?? null,
            refusals: extras.refusals ?? [],
            warnings: extras.warnings ?? [],
            replanned: extras.replanned ?? [],
            approval,
        };
    }
};
exports.MobileReturnService = MobileReturnService;
exports.MobileReturnService = MobileReturnService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        sale_return_service_1.SaleReturnService,
        sales_context_service_1.SalesContextService])
], MobileReturnService);
async function adjustedOf(client, srId, accYear) {
    const rows = await client.$queryRaw `
    SELECT k.abl_id::text AS "billId", btrim(k.abl_acc_year::text) AS "billAccYear",
           k.abl_doc_refno AS refno, j.abj_amount AS amount
      FROM accounts.acc_bill_adjustment j
      JOIN accounts.acc_bill_balance b ON b.abl_id = j.abj_bill_id AND b.abl_acc_year = j.abj_bill_acc_year
      JOIN accounts.acc_bill_balance k ON k.abl_id = j.abj_against_bill_id AND k.abl_acc_year = j.abj_against_bill_acc_year
     WHERE b.abl_src_doc_id = ${srId}::uuid AND b.abl_acc_year = ${accYear}::char(9)
       AND b.abl_src_doc_type = 'SALE_RETURN' AND b.abl_is_deleted = false
       AND j.abj_is_deleted = false AND j.abj_reversal_of_id IS NULL AND j.abj_dr_cr = 'DR'
       AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment x
                        WHERE x.abj_reversal_of_id = j.abj_id AND x.abj_is_deleted = false)
       AND j.abj_adj_type = 'NOTE_ADJUST' AND j.abj_voucher_id IS NULL
       AND k.abl_dr_cr = 'DR' AND k.abl_created_on < b.abl_created_on
     ORDER BY j.abj_created_on, k.abl_id`;
    return rows.map((r) => ({
        billId: r.billId,
        billAccYear: r.billAccYear,
        refno: r.refno,
        amount: money(r.amount),
    }));
}
async function latestApproval(client, srId) {
    const [row] = await client.$queryRaw `
    SELECT a.tap_status AS status, a.tap_decision_note AS note
      FROM accounts.till_approval a
     WHERE a.tap_src_doc_type = 'SALE_RETURN'
       AND a.tap_src_doc_id = ${srId}::uuid
       AND a.tap_is_deleted = false
       AND a.tap_status <> 'CANCELLED'
     ORDER BY a.tap_requested_on DESC
     LIMIT 1`;
    const status = row ? (0, mobile_return_plan_1.phoneApprovalStatus)(row.status) : null;
    return status ? { status, note: row.note } : null;
}
//# sourceMappingURL=mobile-return.service.js.map