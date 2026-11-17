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
exports.MobileCustomerService = void 0;
exports.escapeLike = escapeLike;
exports.searchSql = searchSql;
exports.filterSql = filterSql;
exports.balancesSql = balancesSql;
exports.balanceStatusOf = balanceStatusOf;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../database/prisma/prisma.service");
const request_context_service_1 = require("../../common/request-context/request-context.service");
const party_gst_type_1 = require("../../common/party/party-gst-type");
const voucher_books_sql_1 = require("../../modules/reports/common/voucher-books.sql");
const customer_service_1 = require("../../modules/sales/customer/customer.service");
const mobile_customer_dto_1 = require("./dto/mobile-customer.dto");
function escapeLike(term) {
    return term.replace(/[\\%_]/g, '\\$&');
}
function searchSql(raw) {
    const term = raw?.trim();
    if (!term) {
        return client_1.Prisma.empty;
    }
    const like = `%${escapeLike(term)}%`;
    const digits = term.replace(/\D/g, '');
    const phoneLike = /^[\d\s+\-()]+$/.test(term) && digits.length >= 3 ? `%${digits}%` : null;
    const phoneDigits = phoneLike
        ? client_1.Prisma.sql `
        OR regexp_replace(COALESCE(c.cus_phone1, ''),      '[^0-9]', '', 'g') LIKE ${phoneLike}
        OR regexp_replace(COALESCE(c.cus_phone2, ''),      '[^0-9]', '', 'g') LIKE ${phoneLike}
        OR regexp_replace(COALESCE(c.cus_whatsapp_no, ''), '[^0-9]', '', 'g') LIKE ${phoneLike}
        OR regexp_replace(COALESCE(c.cus_tel, ''),         '[^0-9]', '', 'g') LIKE ${phoneLike}`
        : client_1.Prisma.empty;
    return client_1.Prisma.sql `
     AND (c.cus_name ILIKE ${like}
       OR c.cus_short ILIKE ${like}
       OR c.cus_code ILIKE ${like}
       OR c.cus_city ILIKE ${like}
       OR c.cus_gst_no ILIKE ${like}
       OR c.cus_phone1 ILIKE ${like}
       OR c.cus_phone2 ILIKE ${like}
       OR c.cus_whatsapp_no ILIKE ${like}
       OR c.cus_tel ILIKE ${like}
       ${phoneDigits})`;
}
function filterSql(filter) {
    switch (filter) {
        case 'OUTSTANDING':
            return client_1.Prisma.sql `b.bal > 0`;
        case 'UNREGISTERED':
            return client_1.Prisma.sql `b.is_unregistered`;
        case 'INACTIVE':
            return client_1.Prisma.sql `NOT b.cus_is_active`;
        default:
            return client_1.Prisma.sql `true`;
    }
}
function balancesSql(scope, ledgers) {
    if (!scope) {
        return client_1.Prisma.sql `SELECT NULL::uuid AS ledger_id, NULL::numeric AS bal WHERE false`;
    }
    return client_1.Prisma.sql `
      SELECT x.ledger_id, SUM(x.amt) AS bal
        FROM (SELECT o.ledger_id, o.amt
                FROM (${(0, voucher_books_sql_1.openingSetSql)(scope, ledgers)}) o
              UNION ALL
              SELECT l.av_ledger_id, l.av_signed_amount
                FROM (${(0, voucher_books_sql_1.countedLegsSql)(scope, { upTo: scope.asOn, ledgers })}) l) x
       GROUP BY x.ledger_id`;
}
function balanceStatusOf(bal, creditAmtLimit) {
    if (bal === null) {
        return null;
    }
    const amount = new client_1.Prisma.Decimal(bal);
    if (amount.gt(0)) {
        const limit = new client_1.Prisma.Decimal(creditAmtLimit ?? 0);
        return limit.gt(0) && amount.gt(limit) ? 'OVER_LIMIT' : 'OUTSTANDING';
    }
    return amount.lt(0) ? 'ADVANCE' : 'SETTLED';
}
function balanceOf(bal, creditAmtLimit) {
    return {
        balance: bal === null ? null : (0, voucher_books_sql_1.sided)(bal),
        balanceStatus: balanceStatusOf(bal, creditAmtLimit),
    };
}
let MobileCustomerService = class MobileCustomerService {
    prisma;
    requestContextService;
    customerService;
    constructor(prisma, requestContextService, customerService) {
        this.prisma = prisma;
        this.requestContextService = requestContextService;
        this.customerService = customerService;
    }
    async list(q) {
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? mobile_customer_dto_1.MOBILE_CUSTOMER_DEFAULT_PAGE_SIZE;
        const filter = q.filter ?? 'ALL';
        return this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            const scope = await this.balanceScope(tx);
            const rows = await tx.$queryRaw `
        WITH bal AS MATERIALIZED (${balancesSql(scope, null)}),
        base AS MATERIALIZED (
          SELECT c.cus_id, c.cus_name, c.cus_short, c.cus_code, c.cus_city,
                 a.arm_name AS area_name, c.cus_phone1, c.cus_whatsapp_no,
                 c.cus_gst_no, c.cus_gst_type, c.cus_is_active, c.cus_credit_amt_limit,
                 CASE WHEN ${scope !== null}::boolean THEN COALESCE(lb.bal, 0) END AS bal,
                 upper(COALESCE(btrim(c.cus_gst_type), '')) IN ('UNREGISTERED', '') AS is_unregistered
            FROM sales.customers c
            LEFT JOIN sales.area_master a ON a.arm_id = c.cus_area_id
            LEFT JOIN bal lb ON lb.ledger_id = c.cus_id
           WHERE c.cus_is_deleted = false
           ${searchSql(q.search)}
        ),
        counts AS (
          SELECT count(*)::int                                  AS n_all,
                 count(*) FILTER (WHERE b.bal > 0)::int         AS n_outstanding,
                 count(*) FILTER (WHERE b.is_unregistered)::int AS n_unregistered,
                 count(*) FILTER (WHERE NOT b.cus_is_active)::int AS n_inactive,
                 count(*) FILTER (WHERE ${filterSql(filter)})::int AS n_filtered
            FROM base b
        ),
        page AS (
          SELECT b.* FROM base b
           WHERE ${filterSql(filter)}
           ORDER BY lower(b.cus_name) NULLS LAST, b.cus_id
           LIMIT ${pageSize} OFFSET ${(page - 1) * pageSize}
        )
        SELECT k.n_all, k.n_outstanding, k.n_unregistered, k.n_inactive, k.n_filtered,
               p.cus_id, p.cus_name, p.cus_short, p.cus_code, p.cus_city, p.area_name,
               p.cus_phone1, p.cus_whatsapp_no, p.cus_gst_no, p.cus_gst_type,
               p.cus_is_active, p.cus_credit_amt_limit, p.bal
          FROM counts k
          LEFT JOIN page p ON true
         ORDER BY lower(p.cus_name) NULLS LAST, p.cus_id`;
            const head = rows[0];
            const items = rows.filter((r) => r.cus_id !== null).map((r) => this.toListItem(r));
            const total = head?.n_filtered ?? 0;
            return {
                items,
                counts: {
                    all: head?.n_all ?? 0,
                    outstanding: head?.n_outstanding ?? 0,
                    unregistered: head?.n_unregistered ?? 0,
                    inactive: head?.n_inactive ?? 0,
                },
                total,
                page,
                pageSize,
                hasMore: page * pageSize < total,
                balanceAsOn: scope?.asOn ?? null,
                accYear: scope?.accYear ?? null,
            };
        });
    }
    async getById(cusId) {
        const customer = await this.customerService.getById(cusId);
        const balance = await this.prisma.$transaction(async (tx) => {
            await tx.$executeRaw `SET LOCAL plan_cache_mode = force_custom_plan`;
            const scope = await this.balanceScope(tx);
            if (!scope) {
                return balanceOf(null, null);
            }
            const [row] = await tx.$queryRaw `
        SELECT b.bal FROM (${balancesSql(scope, { ledgerId: cusId })}) b`;
            return balanceOf(row?.bal ?? 0, customer.cusCreditAmtLimit);
        });
        return { ...customer, ...balance };
    }
    async formOptions() {
        const [areas, groups, priceLevels, states] = await Promise.all([
            this.prisma.areaMaster.findMany({
                where: { armIsDeleted: false, armIsActive: true },
                select: { armId: true, armName: true, city: { select: { ctmName: true } } },
                orderBy: [{ armSort: 'asc' }, { armName: 'asc' }],
            }),
            this.prisma.custGroup.findMany({
                where: { cgrIsDeleted: false, cgrIsActive: true },
                select: { cgrId: true, cgrName: true },
                orderBy: [{ cgrOrder: 'asc' }, { cgrName: 'asc' }],
            }),
            this.prisma.itemPriceLevel.findMany({
                where: { iplIsDeleted: false, iplStatus: true },
                select: { iplId: true, iplName: true },
                orderBy: { iplId: 'asc' },
            }),
            this.prisma.stateCode.findMany({
                where: { isDeleted: false, isActive: true },
                select: { stateCode: true, stateName: true },
                orderBy: { stateName: 'asc' },
            }),
        ]);
        return {
            areas: areas.map((a) => ({
                id: a.armId,
                name: a.armName,
                cityName: a.city?.ctmName ?? null,
            })),
            groups: groups.map((g) => ({ id: g.cgrId, name: g.cgrName })),
            priceLevels: priceLevels.map((p) => ({ id: p.iplId, name: p.iplName })),
            states: states.map((s) => ({ code: s.stateCode, name: s.stateName })),
            gstTypes: party_gst_type_1.PARTY_GST_TYPES,
        };
    }
    async balanceScope(tx) {
        const companyId = this.requestContextService.getCompanyId();
        if (!companyId) {
            return null;
        }
        const [fy] = await tx.$queryRaw `
      SELECT btrim(fy_year_name) AS name, CURRENT_DATE::text AS today
        FROM public.fiscal_years
       WHERE comp_id = ${companyId}::uuid AND is_deleted = false
         AND CURRENT_DATE BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC
       LIMIT 1`;
        return fy ? { companyId, accYear: fy.name, branchId: null, asOn: fy.today } : null;
    }
    toListItem(r) {
        return {
            cusId: r.cus_id,
            cusName: r.cus_name,
            cusShort: r.cus_short,
            cusCode: r.cus_code,
            cusCity: r.cus_city,
            cusAreaName: r.area_name,
            cusPhone1: r.cus_phone1,
            cusWhatsappNo: r.cus_whatsapp_no,
            cusGstNo: r.cus_gst_no,
            cusGstType: r.cus_gst_type,
            cusIsActive: r.cus_is_active ?? false,
            cusCreditAmtLimit: (0, voucher_books_sql_1.money)(r.cus_credit_amt_limit),
            ...balanceOf(r.bal, r.cus_credit_amt_limit),
        };
    }
};
exports.MobileCustomerService = MobileCustomerService;
exports.MobileCustomerService = MobileCustomerService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService,
        customer_service_1.CustomerService])
], MobileCustomerService);
//# sourceMappingURL=mobile-customer.service.js.map