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
var PartyOutstandingService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.PartyOutstandingService = exports.PARTY_OUTSTANDING_MENU_ID = void 0;
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const request_context_service_1 = require("../../../common/request-context/request-context.service");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const party_outstanding_query_dto_1 = require("./dto/party-outstanding-query.dto");
const party_outstanding_ageing_1 = require("./party-outstanding.ageing");
const party_outstanding_sql_1 = require("./party-outstanding.sql");
const party_outstanding_types_1 = require("./types/party-outstanding.types");
exports.PARTY_OUTSTANDING_MENU_ID = 279;
const EXPORT_ROW_CAP = 20_000;
const DEFAULT_PAGE_SIZE = 200;
const DUE_NEXT_DAYS = 7;
const CALENDAR_MAX_DAYS = 92;
const ZERO = new client_1.Prisma.Decimal(0);
let PartyOutstandingService = PartyOutstandingService_1 = class PartyOutstandingService {
    prisma;
    requestContext;
    logger = new common_1.Logger(PartyOutstandingService_1.name);
    constructor(prisma, requestContext) {
        this.prisma = prisma;
        this.requestContext = requestContext;
    }
    async options(q) {
        await this.assertMenuRight();
        const receivable = q.side === 'RECEIVABLE';
        const rootId = await this.rootGroupId(q.companyId, q.side);
        const [groups, areas, salesmen, branches] = await Promise.all([
            rootId
                ? this.prisma.$queryRaw `
            WITH RECURSIVE t AS (
              SELECT g.acc_group_id AS id, g.acc_group_name AS name, 0 AS depth,
                     ARRAY[lower(g.acc_group_name), g.acc_group_id::text] AS path
                FROM accounts.acc_group_master g
               WHERE g.acc_group_id = ${rootId}::uuid
              UNION ALL
              SELECT g.acc_group_id, g.acc_group_name, t.depth + 1,
                     t.path || ARRAY[lower(g.acc_group_name), g.acc_group_id::text]
                FROM accounts.acc_group_master g
                JOIN t ON g.acc_group_parent_id = t.id
               WHERE g.acc_group_is_deleted = false
                 AND (g.acc_group_company_id IS NULL OR g.acc_group_company_id = ${q.companyId}::uuid)
                 AND t.depth < 24)
            SELECT id, name, depth FROM t ORDER BY path`
                : Promise.resolve([]),
            receivable
                ? this.prisma.$queryRaw `
            SELECT arm_id, arm_name, arm_collection_days AS days
              FROM sales.area_master
             WHERE arm_is_deleted = false AND arm_is_active IS DISTINCT FROM false
             ORDER BY arm_sort NULLS LAST, lower(arm_name), arm_id`
                : Promise.resolve([]),
            receivable
                ? this.prisma.$queryRaw `
            SELECT e.emp_id, e.emp_name
              FROM public.employee_master e
             WHERE e.emp_is_deleted = false
               AND ((e.emp_is_active IS DISTINCT FROM false
                     AND (e.emp_company_id IS NULL OR e.emp_company_id = ${q.companyId}::uuid))
                    OR EXISTS (SELECT 1 FROM sales.customers c
                                WHERE c.cus_default_salesman = e.emp_id AND c.cus_is_deleted = false))
             ORDER BY lower(e.emp_name), e.emp_id`
                : Promise.resolve([]),
            this.prisma.$queryRaw `
        SELECT br_id, br_name FROM public.branch_master
         WHERE br_comp_id = ${q.companyId}::uuid AND br_is_deleted IS DISTINCT FROM true
         ORDER BY br_is_default DESC NULLS LAST, lower(br_name), br_id`,
        ]);
        return {
            groups: groups.map((g) => ({
                groupId: g.id,
                name: g.name,
                depth: Number(g.depth),
                isDefault: g.id === rootId,
            })),
            areas: areas.map((a) => ({
                areaId: a.arm_id,
                name: a.arm_name,
                collectionDays: (0, party_outstanding_ageing_1.collectionDayNames)(a.days),
            })),
            salesmen: salesmen.map((s) => ({ salesmanId: s.emp_id, name: s.emp_name })),
            branches: branches.map((b) => ({ branchId: b.br_id, name: b.br_name })),
        };
    }
    async parties(q) {
        await this.assertMenuRight();
        const scope = await this.resolveScope(q, { partyOnly: false });
        const sort = q.sort ?? 'net';
        this.assertPartySort(scope, sort);
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
        const raw = await this.partyRows(scope, sort, q.dir ?? 'desc', pageSize, (page - 1) * pageSize);
        const { tiles, totals } = this.tilesAndTotals(scope, raw[0]);
        return {
            ...head(scope),
            tiles,
            rows: raw.filter((r) => r.party_id !== null).map((r) => this.toPartyRow(scope, r)),
            totals,
            page: { page, pageSize, totalRows: Number(raw[0].t_parties) },
        };
    }
    async party(q) {
        await this.assertMenuRight();
        const scope = await this.resolveScope(q, { partyOnly: true });
        return this.card(scope, q.partyId);
    }
    async bills(q) {
        await this.assertMenuRight();
        const scope = await this.resolveScope(q, { partyOnly: true });
        const [list, closing] = await Promise.all([
            this.billRows(scope, { sort: 'date', dir: 'asc', limit: null, offset: 0, dueOn: null }),
            this.ledgerClosing(scope, q.partyId),
        ]);
        return {
            ...head(scope),
            partyId: q.partyId,
            rows: list.rows,
            totals: list.totals,
            ledgerClosing: closing,
        };
    }
    async billWise(q) {
        await this.assertMenuRight();
        const scope = await this.resolveScope(q, { partyOnly: false });
        if (q.dueOn && !(0, party_outstanding_ageing_1.isRealIsoDate)(q.dueOn)) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.RANGE_REVERSED, 'dueOn', `${q.dueOn} is not a calendar date.`);
        }
        const page = q.page ?? 1;
        const pageSize = q.pageSize ?? DEFAULT_PAGE_SIZE;
        const list = await this.billRows(scope, {
            sort: q.sort ?? 'date',
            dir: q.dir ?? 'asc',
            limit: pageSize,
            offset: (page - 1) * pageSize,
            dueOn: q.dueOn ?? null,
        });
        return {
            ...head(scope),
            rows: list.rows,
            totals: list.totals,
            page: { page, pageSize, totalRows: list.totals.bills },
        };
    }
    async billHistory(q) {
        await this.assertMenuRight();
        if (!(0, party_outstanding_ageing_1.isRealIsoDate)(q.asOn)) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS, 'asOn', `${q.asOn} is not a calendar date.`);
        }
        const [bill] = await this.prisma.$queryRaw `
      SELECT abl_id, abl_acc_year, abl_party_id,
             COALESCE(abl_doc_refno, abl_voucher_refno) AS doc_refno, abl_doc_date, abl_bill_type,
             btrim(abl_dr_cr) AS dr_cr, abl_bill_amount,
             abl_alloc_amount + abl_disc_amount + abl_writeoff_amount AS cached
        FROM accounts.acc_bill_balance
       WHERE abl_id = ${q.billId}::uuid AND abl_acc_year = ${q.accYear}::char(9)
         AND abl_company_id = ${q.companyId}::uuid AND abl_is_deleted = false`;
        if (!bill) {
            (0, module_service_utils_1.throwAccountsNotFound)('Bill not found', 'billId', `No bill ${q.billId} in ${q.accYear} for this company`);
        }
        const rows = await this.prisma.$queryRaw `
      SELECT a.abj_id, a.abj_adj_date, a.abj_adj_type, a.abj_voucher_id, a.abj_voucher_acc_year,
             h.avh_voucher_refno AS refno, t.vchr_type_name AS vtype,
             COALESCE(ab.abl_doc_refno, ab.abl_voucher_refno) AS against_refno,
             a.abj_amount, a.abj_reversal_of_id, a.abj_reversal_reason,
             COALESCE(a.abj_is_post_dated, false) AS post_dated,
             r.apd_instrument_no AS cheque_no
        FROM accounts.acc_bill_adjustment a
        LEFT JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = a.abj_voucher_id AND h.avh_acc_year = a.abj_voucher_acc_year
        LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
        LEFT JOIN accounts.acc_bill_balance ab
          ON ab.abl_id = a.abj_against_bill_id AND ab.abl_acc_year = a.abj_against_bill_acc_year
        LEFT JOIN accounts.acc_pdc_register r
          ON r.apd_id = a.abj_cheque_id AND r.apd_acc_year = a.abj_cheque_acc_year
       WHERE a.abj_bill_id = ${q.billId}::uuid AND a.abj_bill_acc_year = ${q.accYear}::char(9)
         AND a.abj_is_deleted = false
       ORDER BY a.abj_adj_date, a.abj_row_no NULLS LAST, a.abj_created_on, a.abj_id`;
        const today = (0, party_outstanding_ageing_1.istToday)();
        const docDate = isoDate(bill.abl_doc_date);
        let setD = ZERO;
        let setCache = ZERO;
        for (const r of rows) {
            const d = isoDate(r.abj_adj_date);
            if (d <= q.asOn) {
                setD = setD.plus(r.abj_amount);
            }
            if (!(r.post_dated && d > today)) {
                setCache = setCache.plus(r.abj_amount);
            }
        }
        const gap = new client_1.Prisma.Decimal(bill.cached).minus(setCache);
        const tendered = gap.greaterThan(0) ? gap : ZERO;
        const pending = docDate <= q.asOn
            ? new client_1.Prisma.Decimal(bill.abl_bill_amount).minus(setD).minus(tendered)
            : ZERO;
        return {
            asOn: q.asOn,
            bill: {
                billId: bill.abl_id,
                accYear: bill.abl_acc_year.trim(),
                partyId: bill.abl_party_id,
                docRefno: bill.doc_refno,
                docDate,
                billType: bill.abl_bill_type,
                side: bill.dr_cr === 'CR' ? 'CR' : 'DR',
                billAmount: money(bill.abl_bill_amount),
                pending: money(pending),
            },
            rows: rows.map((r) => ({
                adjustmentId: r.abj_id,
                date: isoDate(r.abj_adj_date),
                adjType: r.abj_adj_type,
                voucherId: r.abj_voucher_id,
                voucherAccYear: r.abj_voucher_acc_year?.trim() ?? null,
                voucherNo: r.refno,
                voucherType: r.vtype,
                againstDocRefno: r.against_refno,
                amount: money(r.abj_amount),
                isReversal: r.abj_reversal_of_id !== null,
                reversalReason: r.abj_reversal_reason,
                isPostDated: r.post_dated,
                chequeNo: r.cheque_no,
                effective: isoDate(r.abj_adj_date) <= q.asOn,
            })),
            tenderAtBill: tendered.greaterThan(0) ? money(tendered) : null,
            ...(gap.isNegative() ? { dataWarning: party_outstanding_types_1.BILL_DATA_WARNING.ALLOC_BELOW_ROWS } : {}),
        };
    }
    async summary(q) {
        await this.assertMenuRight();
        if (q.side === 'PAYABLE' && (q.groupBy === 'AREA' || q.groupBy === 'SALESMAN')) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.NOT_FOR_PAYABLE, 'groupBy', `${q.groupBy} applies to customers only — suppliers have no area or salesman.`);
        }
        const scope = await this.resolveScope(q, { partyOnly: false });
        const cols = (0, party_outstanding_sql_1.bucketColumns)(scope);
        const [rows, totalsRaw] = await Promise.all([
            q.groupBy === 'BRANCH'
                ? this.prisma.$queryRaw((0, party_outstanding_sql_1.branchSummarySql)(scope))
                : this.prisma.$queryRaw(this.partySummarySql(scope, q.groupBy, cols)),
            this.partyRows(scope, 'net', 'desc', 0, 0),
        ]);
        const blank = {
            AREA: '(no area)',
            GROUP: '(no group)',
            SALESMAN: '(no salesman)',
            BRANCH: '(no branch)',
        }[q.groupBy];
        const { totals } = this.tilesAndTotals(scope, totalsRaw[0]);
        return {
            ...head(scope),
            groupBy: q.groupBy,
            rows: rows
                .filter((r) => Number(r.parties) > 0 || !new client_1.Prisma.Decimal(r.net).isZero())
                .map((r) => ({
                key: r.key ?? null,
                name: r.name ?? blank,
                parties: Number(r.parties),
                owed: money(r.owed),
                onAccount: money(r.on_account),
                net: bal(r.net, scope.owedSide),
                buckets: cols.map((c) => money(r[c])),
                overdue: money(r.overdue),
            })),
            totals: {
                parties: Number(totalsRaw[0].t_parties),
                owed: totals.owed,
                onAccount: totals.onAccount,
                net: totals.net,
                buckets: totals.buckets,
                overdue: totals.overdue,
            },
        };
    }
    async dueCalendar(q) {
        await this.assertMenuRight();
        if (!(0, party_outstanding_ageing_1.isRealIsoDate)(q.from) || !(0, party_outstanding_ageing_1.isRealIsoDate)(q.to) || q.from > q.to) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.RANGE_REVERSED, 'from', `${q.from} – ${q.to} is not a range.`);
        }
        const span = (0, party_outstanding_ageing_1.daysBetween)(q.from, q.to) + 1;
        if (span > CALENDAR_MAX_DAYS) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.RANGE_TOO_LARGE, 'to', `${span} days — the calendar shows at most ${CALENDAR_MAX_DAYS}.`);
        }
        const scope = await this.resolveScope(q, { partyOnly: false });
        const rows = await this.prisma.$queryRaw `
      ${(0, party_outstanding_sql_1.billsWith)(scope, true)}
      SELECT 'D' AS kind, x.due_eff AS d, SUM(x.pending) AS amt, COUNT(*) AS n,
             COUNT(DISTINCT x.party_id) AS parties
        FROM o x
       WHERE x.is_owed AND x.due_eff BETWEEN ${q.from}::date AND ${q.to}::date
       GROUP BY x.due_eff
      UNION ALL
      SELECT 'B', NULL::date, COALESCE(SUM(x.pending), 0), COUNT(*), COUNT(DISTINCT x.party_id)
        FROM o x
       WHERE x.is_owed AND x.due_eff < ${q.from}::date
       ORDER BY 1, 2`;
        const before = rows.find((r) => r.kind === 'B');
        return {
            asOn: scope.asOn,
            side: scope.side,
            from: q.from,
            to: q.to,
            days: rows
                .filter((r) => r.kind === 'D' && r.d !== null)
                .map((r) => ({
                date: isoDate(r.d),
                amount: money(r.amt),
                bills: Number(r.n),
                parties: Number(r.parties),
            })),
            overdueBefore: { amount: money(before?.amt ?? ZERO), bills: Number(before?.n ?? 0) },
        };
    }
    async export(q) {
        await this.assertMenuRight();
        if (q.shape === 'PARTY_STATEMENT' && !q.partyId) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.PARTY_REQUIRED, 'partyId', 'A party statement needs partyId.');
        }
        const scope = await this.resolveScope(q, { partyOnly: q.shape === 'PARTY_STATEMENT' });
        const names = await this.printNames(scope, q);
        const common = {
            ...head(scope),
            printedAs: this.printedAs(scope, q, names),
            companyName: names.company,
            branchName: names.branch,
        };
        if (q.shape === 'PARTIES') {
            const sort = (q.sort ?? 'net');
            if (!party_outstanding_query_dto_1.PARTY_SORTS.includes(sort)) {
                refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.BAD_SORT, 'sort', `${sort} is not a party sort.`);
            }
            this.assertPartySort(scope, sort);
            const raw = await this.partyRows(scope, sort, q.dir ?? 'desc', EXPORT_ROW_CAP + 1, 0);
            this.assertCap(Number(raw[0].t_parties));
            const { tiles, totals } = this.tilesAndTotals(scope, raw[0]);
            const rows = raw.filter((r) => r.party_id !== null).map((r) => this.toPartyRow(scope, r));
            return { ...common, shape: 'PARTIES', rows, totals, tiles, totalRows: rows.length };
        }
        if (q.shape === 'BILLS') {
            const sort = (q.sort ?? 'date');
            if (!party_outstanding_query_dto_1.BILL_SORTS.includes(sort)) {
                refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.BAD_SORT, 'sort', `${sort} is not a bill sort.`);
            }
            const list = await this.billRows(scope, {
                sort,
                dir: q.dir ?? 'asc',
                limit: EXPORT_ROW_CAP + 1,
                offset: 0,
                dueOn: null,
            });
            this.assertCap(list.totals.bills);
            return {
                ...common,
                shape: 'BILLS',
                rows: list.rows,
                totals: list.totals,
                totalRows: list.rows.length,
            };
        }
        const partyId = q.partyId;
        const [card, list] = await Promise.all([
            this.card(scope, partyId),
            this.billRows(scope, {
                sort: 'date',
                dir: 'asc',
                limit: EXPORT_ROW_CAP + 1,
                offset: 0,
                dueOn: null,
            }),
        ]);
        this.assertCap(list.totals.bills);
        return {
            ...common,
            shape: 'PARTY_STATEMENT',
            party: card.party,
            rows: list.rows,
            totals: list.totals,
            ageing: card.ageing,
            owed: card.owed,
            onAccount: card.onAccount,
            net: card.net,
            pdcInHand: card.pdcInHand,
            totalRows: list.rows.length,
        };
    }
    async assertMenuRight() {
        const userId = this.requestContext.getUserId();
        const rows = isUuid(userId)
            ? await this.prisma.$queryRaw `
          SELECT true AS ok FROM public.user_menus
           WHERE um_user_id = ${userId}::uuid
             AND um_menu_id = ${exports.PARTY_OUTSTANDING_MENU_ID}::int
             AND um_can_view = true AND um_is_deleted = false
           LIMIT 1`
            : [];
        if (rows.length === 0) {
            (0, module_service_utils_1.throwAccountsForbidden)('No access to Party-wise Outstanding', [
                {
                    field: 'menu',
                    code: party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.NO_MENU_RIGHT,
                    message: `This user may not view menu ${exports.PARTY_OUTSTANDING_MENU_ID} (Reports › Party Outstanding).`,
                },
            ]);
        }
    }
    async resolveScope(q, opts) {
        const receivable = q.side === 'RECEIVABLE';
        if (!receivable && !opts.partyOnly) {
            const field = q.areaId
                ? 'areaId'
                : q.salesmanId
                    ? 'salesmanId'
                    : q.collectionDay
                        ? 'collectionDay'
                        : null;
            if (field) {
                refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.NOT_FOR_PAYABLE, field, 'Area, salesman and collection day apply to customers only.');
            }
        }
        const edges = (0, party_outstanding_ageing_1.parseBuckets)(q.buckets);
        if (!edges) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.BAD_BUCKETS, 'buckets', 'Buckets must be 1 to 6 rising whole numbers of days, at most 3650, e.g. 30,60,90,180.');
        }
        if (!(0, party_outstanding_ageing_1.isRealIsoDate)(q.asOn)) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS, 'asOn', `${q.asOn} is not a calendar date.`);
        }
        if (q.minDueDays !== undefined && q.maxDueDays !== undefined && q.minDueDays > q.maxDueDays) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.RANGE_REVERSED, 'minDueDays', `Due days ≥ ${q.minDueDays} and ≤ ${q.maxDueDays} cannot both hold.`);
        }
        const [fy] = await this.prisma.$queryRaw `
      SELECT fy_year_name AS name FROM public.fiscal_years
       WHERE comp_id = ${q.companyId}::uuid AND is_deleted = false
         AND ${q.asOn}::date BETWEEN fy_begin_date AND fy_end_date
       ORDER BY fy_begin_date DESC
       LIMIT 1`;
        if (!fy) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.AS_ON_OUTSIDE_YEARS, 'asOn', `${q.asOn} is outside every financial year set up for this company.`);
        }
        if (q.branchId) {
            const [br] = await this.prisma.$queryRaw `
        SELECT br_comp_id FROM public.branch_master WHERE br_id = ${q.branchId}::uuid`;
            if (!br || br.br_comp_id !== q.companyId) {
                refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.BRANCH_NOT_IN_COMPANY, 'branchId', 'That branch is not part of this company.');
            }
        }
        if (q.partyId) {
            const [hit] = await this.prisma.$queryRaw `
        SELECT EXISTS (SELECT 1 FROM accounts.acc_ledger_master
                        WHERE led_id = ${q.partyId}::uuid
                          AND (led_company_id IS NULL OR led_company_id = ${q.companyId}::uuid))
            OR EXISTS (SELECT 1 FROM accounts.acc_bill_balance
                        WHERE abl_party_id = ${q.partyId}::uuid
                          AND abl_company_id = ${q.companyId}::uuid) AS ok`;
            if (!hit?.ok) {
                refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.PARTY_NOT_IN_COMPANY, 'partyId', 'This party belongs to another company.');
            }
        }
        const rootGroupId = await this.rootGroupId(q.companyId, q.side);
        const groupId = q.groupId ?? rootGroupId;
        const today = (0, party_outstanding_ageing_1.istToday)();
        const ageBy = q.ageBy ?? 'BILL_DATE';
        const partyOnly = opts.partyOnly;
        return {
            companyId: q.companyId,
            asOn: q.asOn,
            today,
            fyName: fy.name.trim(),
            branchId: q.branchId ?? null,
            side: q.side,
            owedSide: receivable ? 'DR' : 'CR',
            traType: receivable ? 'R' : 'P',
            group: partyOnly
                ? null
                :
                    {
                        groupId: groupId ?? NIL_UUID,
                        rootRole: groupId === null || groupId === rootGroupId,
                    },
            areaId: partyOnly ? null : (q.areaId ?? null),
            salesmanId: partyOnly ? null : (q.salesmanId ?? null),
            collectionDay: partyOnly || !q.collectionDay ? null : (0, party_outstanding_ageing_1.collectionDayNumber)(q.collectionDay),
            partyId: q.partyId ?? null,
            ageBy,
            edges,
            includeOnAccount: q.includeOnAccount ?? true,
            onlyOverdue: q.onlyOverdue ?? false,
            minDueDays: q.minDueDays ?? null,
            maxDueDays: q.maxDueDays ?? null,
            deductPdc: q.deductPdc ?? false,
            hideZero: partyOnly ? false : (q.hideZero ?? true),
            labels: (0, party_outstanding_ageing_1.bucketLabels)(edges, ageBy),
            isFuture: q.asOn > today,
            rootGroupId,
        };
    }
    async rootGroupId(companyId, side) {
        const pinned = side === 'RECEIVABLE' ? party_outstanding_sql_1.SUNDRY_DEBTORS_GROUP_ID : party_outstanding_sql_1.SUNDRY_CREDITORS_GROUP_ID;
        const name = side === 'RECEIVABLE' ? 'sundry debtors' : 'sundry creditors';
        const [row] = await this.prisma.$queryRaw `
      SELECT acc_group_id AS id FROM accounts.acc_group_master
       WHERE acc_group_is_deleted = false
         AND (acc_group_company_id IS NULL OR acc_group_company_id = ${companyId}::uuid)
         AND (acc_group_id = ${pinned}::uuid OR lower(btrim(acc_group_name)) = ${name})
       ORDER BY (acc_group_id = ${pinned}::uuid) DESC, acc_group_company_id NULLS LAST
       LIMIT 1`;
        return row?.id ?? null;
    }
    assertPartySort(scope, sort) {
        const m = /^bucket(\d)$/.exec(sort);
        if (m && Number(m[1]) >= (0, party_outstanding_ageing_1.bucketCount)(scope.edges, scope.ageBy)) {
            refuse(party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.BAD_SORT, 'sort', `${sort}: these buckets have ${scope.labels.length} columns (bucket0 … bucket${scope.labels.length - 1}).`);
        }
    }
    assertCap(count) {
        if (count > EXPORT_ROW_CAP) {
            (0, module_service_utils_1.throwUnprocessable)('Range too large', [
                {
                    field: 'shape',
                    code: party_outstanding_types_1.PARTY_OUTSTANDING_ERROR.RANGE_TOO_LARGE,
                    count,
                    message: `${count} rows — the export stops at ${EXPORT_ROW_CAP}. Narrow the filters.`,
                },
            ]);
        }
    }
    async partyRows(scope, sort, dir, limit, offset) {
        const order = partyOrder(sort, dir);
        return this.prisma.$queryRaw `
      ${(0, party_outstanding_sql_1.partiesWith)(scope)}, ${(0, party_outstanding_sql_1.partyTotalsCte)(scope)},
      pg AS (
        SELECT pf.*, ROW_NUMBER() OVER (ORDER BY ${order}) AS ord
          FROM pf
         ORDER BY ${order}
         LIMIT ${limit} OFFSET ${offset})
      SELECT tot.*, pg.* FROM tot LEFT JOIN pg ON true ORDER BY pg.ord`;
    }
    toPartyRow(scope, r) {
        const net = new client_1.Prisma.Decimal(r.net ?? 0);
        const limit = r.credit_limit === null ? null : new client_1.Prisma.Decimal(r.credit_limit);
        const flags = [];
        if (r.bounced) {
            flags.push('CHQ_BOUNCED');
        }
        if (scope.side === 'RECEIVABLE' && limit && limit.greaterThan(0) && net.greaterThan(limit)) {
            flags.push('OVER_LIMIT');
        }
        if (r.oldest !== null && r.oldest > scope.edges[scope.edges.length - 1]) {
            flags.push('OVER_180');
        }
        if (net.isNegative()) {
            flags.push('ADVANCE');
        }
        return {
            partyId: r.party_id,
            name: r.name ?? '',
            area: r.area_name,
            phone: r.phone,
            creditDays: r.credit_days === null ? null : Number(r.credit_days),
            creditLimit: limit ? money(limit) : null,
            bills: Number(r.bills ?? 0),
            owed: money(r.owed ?? 0),
            onAccount: money(r.on_account ?? 0),
            net: bal(net, scope.owedSide),
            buckets: (0, party_outstanding_sql_1.bucketColumns)(scope).map((c) => money(r[c] ?? 0)),
            overdue: money(r.overdue ?? 0),
            oldestDays: r.oldest === null ? null : Number(r.oldest),
            pdcInHand: money(r.pdc_amt ?? 0),
            flags,
        };
    }
    tilesAndTotals(scope, t) {
        const owed = new client_1.Prisma.Decimal(t.t_owed);
        const overdue = new client_1.Prisma.Decimal(t.t_overdue);
        const net = bal(t.t_net, scope.owedSide);
        return {
            tiles: {
                net,
                parties: Number(t.t_parties),
                bills: Number(t.t_bills),
                overdue: money(overdue),
                overduePctOfOwed: owed.greaterThan(0)
                    ? overdue.div(owed).times(100).toDecimalPlaces(0, client_1.Prisma.Decimal.ROUND_HALF_UP).toString()
                    : '0',
                aboveDays: {
                    days: (0, party_outstanding_ageing_1.aboveDaysEdge)(scope.edges),
                    amount: money(t.t_above_amt),
                    parties: Number(t.t_above_parties),
                },
                onAccount: money(t.t_on_account),
                pdcInHand: { amount: money(t.t_pdc_amt), cheques: Number(t.t_pdc_n) },
                dueNext: {
                    days: DUE_NEXT_DAYS,
                    amount: money(t.t_due_next),
                    from: (0, party_outstanding_ageing_1.addDays)(scope.asOn, 1),
                    to: (0, party_outstanding_ageing_1.addDays)(scope.asOn, DUE_NEXT_DAYS),
                },
            },
            totals: {
                bills: Number(t.t_bills),
                owed: money(owed),
                onAccount: money(t.t_on_account),
                net,
                buckets: (0, party_outstanding_sql_1.bucketColumns)(scope).map((c) => money(t[`t_${c}`])),
                overdue: money(overdue),
                pdcInHand: money(t.t_pdc_amt),
            },
        };
    }
    partySummarySql(scope, groupBy, cols) {
        const key = { AREA: 'pf.area_id', GROUP: 'pf.group_id', SALESMAN: 'pf.salesman_id' }[groupBy];
        const name = {
            AREA: client_1.Prisma.sql `(SELECT a.arm_name FROM sales.area_master a WHERE a.arm_id = sg.key)`,
            GROUP: client_1.Prisma.sql `(SELECT g.acc_group_name FROM accounts.acc_group_master g WHERE g.acc_group_id = sg.key)`,
            SALESMAN: client_1.Prisma.sql `(SELECT e.emp_name FROM public.employee_master e WHERE e.emp_id = sg.key)`,
        }[groupBy];
        const sums = cols.map((c) => client_1.Prisma.sql `SUM(pf.${client_1.Prisma.raw(c)}) AS ${client_1.Prisma.raw(c)}`);
        return client_1.Prisma.sql `
      ${(0, party_outstanding_sql_1.partiesWith)(scope)},
      sg AS (
        SELECT ${client_1.Prisma.raw(key)} AS key, COUNT(*) AS parties, SUM(pf.owed) AS owed,
               SUM(pf.on_account) AS on_account, SUM(pf.net) AS net,
               ${client_1.Prisma.join(sums, ', ')}, SUM(pf.overdue) AS overdue
          FROM pf
         GROUP BY 1)
      SELECT sg.*, ${name} AS name FROM sg ORDER BY name NULLS LAST, sg.key`;
    }
    async billRows(scope, p) {
        const where = p.dueOn
            ? client_1.Prisma.sql `x.is_owed AND x.due_eff = ${p.dueOn}::date`
            : client_1.Prisma.sql `true`;
        const order = billOrder(p.sort, p.dir);
        const limit = p.limit === null ? client_1.Prisma.empty : client_1.Prisma.sql `LIMIT ${p.limit} OFFSET ${p.offset}`;
        const raw = await this.prisma.$queryRaw `
      ${(0, party_outstanding_sql_1.billsWith)(scope, true)},
      tot AS (
        SELECT COUNT(*) AS t_bills, COALESCE(SUM(x.bill_amount), 0) AS t_bill_amount,
               COALESCE(SUM(x.pending), 0) AS t_pending, COALESCE(SUM(x.signed), 0) AS t_net
          FROM o x WHERE ${where}),
      pg AS (
        SELECT x.*, pt.name AS party_name, pt.area_name, br.br_name,
               ROW_NUMBER() OVER (ORDER BY ${order}) AS ord
          FROM o x
          JOIN pty pt ON pt.party_id = x.party_id
          LEFT JOIN public.branch_master br ON br.br_id = x.abl_branch_id
         WHERE ${where}
         ORDER BY ${order}
         ${limit})
      SELECT tot.*, pg.* FROM tot LEFT JOIN pg ON true ORDER BY pg.ord`;
        const t = raw[0];
        const billRaw = raw.filter((r) => r.abl_id !== null);
        const remarks = await this.remarksOf(scope, billRaw);
        const rows = billRaw.map((r) => {
            const isOwed = r.is_owed === true;
            const gap = new client_1.Prisma.Decimal(r.gap ?? 0);
            const row = {
                billId: r.abl_id,
                accYear: r.abl_acc_year.trim(),
                branchName: r.br_name,
                docDate: isoDate(r.abl_doc_date),
                docRefno: r.doc_refno,
                billType: r.abl_bill_type,
                srcDocType: r.abl_src_doc_type,
                srcDocId: r.abl_src_doc_id,
                srcAccYear: r.abl_src_acc_year?.trim() ?? null,
                voucherId: r.abl_voucher_id,
                side: isOwed ? 'OWED' : 'ON_ACCOUNT',
                dueDate: r.abl_due_date ? isoDate(r.abl_due_date) : null,
                dueEff: isoDate(r.due_eff),
                billAmount: money(r.bill_amount ?? 0),
                adjusted: money(new client_1.Prisma.Decimal(r.bill_amount ?? 0).minus(r.pending ?? 0)),
                pending: money(r.pending ?? 0),
                ageDays: Number(r.age_days ?? 0),
                overdueDays: isOwed && Number(r.overdue_days) > 0 ? Number(r.overdue_days) : null,
                remarks: remarks.get(billKey(r.abl_id, r.abl_acc_year)) ?? null,
                tenderDerived: gap.greaterThan(0),
                partyId: r.party_id,
                partyName: r.party_name ?? '',
                area: r.area_name,
            };
            if (gap.isNegative()) {
                row.dataWarning = party_outstanding_types_1.BILL_DATA_WARNING.ALLOC_BELOW_ROWS;
            }
            return row;
        });
        const faulty = rows.filter((r) => r.dataWarning).map((r) => r.docRefno ?? r.billId);
        if (faulty.length > 0) {
            this.logger.warn(`${party_outstanding_types_1.BILL_DATA_WARNING.ALLOC_BELOW_ROWS}: adjustment rows exceed the cached settlement on ` +
                `${faulty.length} bill(s): ${faulty.slice(0, 10).join(', ')}`);
        }
        const billAmount = new client_1.Prisma.Decimal(t.t_bill_amount);
        return {
            rows,
            totals: {
                bills: Number(t.t_bills),
                billAmount: money(billAmount),
                adjusted: money(billAmount.minus(t.t_pending)),
                net: bal(t.t_net, scope.owedSide),
            },
        };
    }
    async remarksOf(scope, bills) {
        const out = new Map();
        const owedKeys = [];
        for (const b of bills) {
            const k = billKey(b.abl_id, b.abl_acc_year);
            if (b.abl_src_doc_type === 'CHEQUE_BOUNCE_CHARGE') {
                out.set(k, 'bounce charge');
            }
            else if (b.is_owed !== true) {
                out.set(k, 'on account');
            }
            else {
                owedKeys.push({ id: b.abl_id, yr: b.abl_acc_year });
            }
        }
        if (owedKeys.length === 0) {
            return out;
        }
        const rows = await this.prisma.$queryRaw `
      SELECT a.abj_id, a.abj_bill_id AS bill_id, a.abj_bill_acc_year AS bill_yr,
             a.abj_adj_type AS adj_type, a.abj_adj_date AS adj_date, a.abj_created_on AS created_on,
             a.abj_row_no AS row_no, a.abj_reversal_of_id AS reversal_of,
             a.abj_reversal_reason AS reason, h.avh_voucher_refno AS refno
        FROM accounts.acc_bill_adjustment a
        LEFT JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = a.abj_voucher_id AND h.avh_acc_year = a.abj_voucher_acc_year
       WHERE (a.abj_bill_id, a.abj_bill_acc_year) IN (${client_1.Prisma.join(owedKeys.map((k) => client_1.Prisma.sql `(${k.id}::uuid, ${k.yr}::char(9))`))})
         AND a.abj_is_deleted = false
         AND a.abj_adj_date <= ${scope.asOn}::date
       ORDER BY a.abj_adj_date, a.abj_created_on NULLS FIRST, a.abj_row_no NULLS FIRST, a.abj_id`;
        const byBill = new Map();
        for (const r of rows) {
            const k = billKey(r.bill_id, r.bill_yr);
            byBill.set(k, [...(byBill.get(k) ?? []), r]);
        }
        for (const [k, list] of byBill) {
            const latest = list[list.length - 1];
            if (latest.reversal_of && /bounced/i.test(latest.reason ?? '')) {
                out.set(k, 're-opened · chq bounced');
                continue;
            }
            const reversed = new Set(list.map((r) => r.reversal_of).filter((id) => !!id));
            const surviving = list.filter((r) => !r.reversal_of && !reversed.has(r.abj_id));
            const last = surviving[surviving.length - 1];
            if (last) {
                const verb = last.adj_type === 'DISCOUNT' || last.adj_type === 'ROUND_OFF'
                    ? 'disc'
                    : last.adj_type === 'WRITEOFF'
                        ? 'w/off'
                        : 'part';
                out.set(k, `${verb} ${last.refno ?? ''}`.trim());
            }
            else if (latest.reversal_of) {
                out.set(k, 're-opened');
            }
        }
        return out;
    }
    async ledgerClosing(scope, partyId) {
        const [row] = await this.prisma.$queryRaw((0, party_outstanding_sql_1.ledgerClosingSql)(scope, partyId));
        return bal(row?.bal ?? 0, 'DR');
    }
    async card(scope, partyId) {
        const cardScope = { ...scope, onlyOverdue: false, minDueDays: null, maxDueDays: null };
        const [facts, agg, onAccount, pdcs, last] = await Promise.all([
            this.partyFacts(scope, partyId),
            this.partyRows(cardScope, 'net', 'desc', 1, 0),
            this.prisma.$queryRaw `
        ${(0, party_outstanding_sql_1.billsWith)(cardScope, false)}
        SELECT abl_id, abl_acc_year, doc_refno, abl_doc_date, abl_bill_type, pending
          FROM o WHERE NOT is_owed
         ORDER BY abl_doc_date, doc_refno, abl_id`,
            this.prisma.$queryRaw `
        SELECT r.apd_id, r.apd_acc_year, r.apd_instrument_no, r.apd_bank_name,
               r.apd_instrument_date, r.apd_amount, r.apd_status
          FROM accounts.acc_pdc_register r
         WHERE r.apd_company_id = ${scope.companyId}::uuid
           AND r.apd_party_id = ${partyId}::uuid
           AND r.apd_is_deleted = false
           AND r.apd_tra_type = ${scope.traType}
           AND r.apd_status IN ('HELD', 'DEPOSITED')
           AND r.apd_received_on <= ${scope.asOn}::date
           AND (${scope.branchId}::uuid IS NULL OR r.apd_branch_id = ${scope.branchId}::uuid)
         ORDER BY r.apd_instrument_date, r.apd_instrument_no, r.apd_id`,
            this.lastSettlement(scope, partyId),
        ]);
        const a = agg.find((r) => r.party_id !== null);
        const row = a ? this.toPartyRow(scope, a) : null;
        const toPdc = (r) => ({
            pdcId: r.apd_id,
            accYear: r.apd_acc_year.trim(),
            chequeNo: r.apd_instrument_no,
            bank: r.apd_bank_name,
            chequeDate: isoDate(r.apd_instrument_date),
            amount: money(r.apd_amount),
            status: r.apd_status,
        });
        return {
            ...head(scope),
            party: facts,
            ageing: {
                labels: scope.labels,
                amounts: row?.buckets ?? scope.labels.map(() => '0.00'),
            },
            owed: row?.owed ?? '0.00',
            onAccount: row?.onAccount ?? '0.00',
            net: row?.net ?? bal(0, scope.owedSide),
            onAccountItems: onAccount.map((b) => ({
                billId: b.abl_id,
                accYear: b.abl_acc_year.trim(),
                docRefno: b.doc_refno,
                date: isoDate(b.abl_doc_date),
                type: b.abl_bill_type,
                amount: money(b.pending),
            })),
            pdcInHand: pdcs.filter((r) => isoDate(r.apd_instrument_date) > scope.asOn).map(toPdc),
            pdcEffectiveUncleared: pdcs
                .filter((r) => isoDate(r.apd_instrument_date) <= scope.asOn)
                .map(toPdc),
            lastSettlement: last,
        };
    }
    async partyFacts(scope, partyId) {
        const [r] = await this.prisma.$queryRaw `
      SELECT l.led_name, g.acc_group_name AS group_name, l.led_gstin_no, l.led_phone1,
             (c.cus_id IS NOT NULL AND c.cus_is_deleted = false) AS is_cus,
             (sp.sup_id IS NOT NULL AND sp.sup_is_deleted = false) AS is_sup,
             c.cus_phone1, c.cus_phone2, c.cus_gst_no, c.cus_credit_days, c.cus_credit_amt_limit,
             c.cus_credit_bill_limit, am.arm_name, sp.sup_phone, sp.sup_gst_no, sp.sup_credit_days
        FROM accounts.acc_ledger_master l
        LEFT JOIN accounts.acc_group_master g ON g.acc_group_id = l.led_group_id
        LEFT JOIN sales.customers c ON c.cus_id = l.led_id
        LEFT JOIN purchase.suppliers sp ON sp.sup_id = l.led_id
        LEFT JOIN sales.area_master am ON am.arm_id = c.cus_area_id
       WHERE l.led_id = ${partyId}::uuid`;
        const receivable = scope.side === 'RECEIVABLE';
        const pick = (...v) => v.map((s) => s?.trim()).find((s) => !!s) ?? null;
        const limit = r?.cus_credit_amt_limit ? new client_1.Prisma.Decimal(r.cus_credit_amt_limit) : null;
        return {
            partyId,
            name: r?.led_name ?? '',
            ledgerGroup: r?.group_name ?? null,
            area: receivable ? (r?.arm_name ?? null) : null,
            phone: receivable
                ? pick(r?.cus_phone1, r?.cus_phone2, r?.led_phone1)
                : pick(r?.sup_phone, r?.led_phone1),
            gstin: receivable
                ? pick(r?.cus_gst_no, r?.led_gstin_no)
                : pick(r?.sup_gst_no, r?.led_gstin_no),
            creditDays: receivable ? (r?.cus_credit_days ?? null) : (r?.sup_credit_days ?? null),
            creditLimit: receivable && limit && limit.greaterThan(0) ? money(limit) : null,
            creditBillLimit: receivable && r?.cus_credit_bill_limit ? Number(r.cus_credit_bill_limit) : null,
            isDualRole: !!r?.is_cus && !!r?.is_sup,
        };
    }
    async lastSettlement(scope, partyId) {
        const [r] = await this.prisma.$queryRaw `
      WITH s AS (
        SELECT a.abj_voucher_id AS vid, a.abj_voucher_acc_year AS vyr, a.abj_adj_date AS d,
               a.abj_amount AS amt, a.abj_created_on AS created_on
          FROM accounts.acc_bill_adjustment a
          JOIN accounts.acc_bill_balance b
            ON b.abl_id = a.abj_bill_id AND b.abl_acc_year = a.abj_bill_acc_year
         WHERE b.abl_company_id = ${scope.companyId}::uuid
           AND b.abl_party_id = ${partyId}::uuid
           AND b.abl_is_deleted = false
           AND btrim(b.abl_dr_cr) = ${scope.owedSide}
           AND (${scope.branchId}::uuid IS NULL OR b.abl_branch_id = ${scope.branchId}::uuid)
           AND a.abj_is_deleted = false
           AND a.abj_adj_type = 'ALLOCATION'
           AND a.abj_reversal_of_id IS NULL
           AND a.abj_voucher_id IS NOT NULL
           AND a.abj_adj_date <= ${scope.asOn}::date
           AND NOT EXISTS (SELECT 1 FROM accounts.acc_bill_adjustment rv
                            WHERE rv.abj_reversal_of_id = a.abj_id AND rv.abj_is_deleted = false)),
      last AS (SELECT vid, vyr FROM s ORDER BY d DESC, created_on DESC NULLS LAST LIMIT 1)
      SELECT s.vid, s.vyr, MAX(s.d) AS d, SUM(s.amt) AS amt,
             h.avh_voucher_refno AS refno, t.vchr_type_name AS vtype
        FROM s
        JOIN last ON last.vid = s.vid AND last.vyr = s.vyr
        LEFT JOIN accounts.acc_voucher_header h
          ON h.avh_voucher_id = s.vid AND h.avh_acc_year = s.vyr
        LEFT JOIN accounts.acc_voucher_types t ON t.vchr_type_id = h.avh_voucher_type_id
       GROUP BY s.vid, s.vyr, h.avh_voucher_refno, t.vchr_type_name`;
        if (!r) {
            return null;
        }
        return {
            date: isoDate(r.d),
            voucherId: r.vid,
            voucherAccYear: r.vyr.trim(),
            voucherNo: r.refno,
            voucherType: r.vtype,
            amount: money(r.amt),
        };
    }
    async printNames(scope, q) {
        const [r] = await this.prisma.$queryRaw `
      SELECT (SELECT comp_name FROM public.companys WHERE comp_id = ${scope.companyId}::uuid) AS company,
             (SELECT br_name FROM public.branch_master WHERE br_id = ${scope.branchId}::uuid) AS branch,
             (SELECT acc_group_name FROM accounts.acc_group_master
               WHERE acc_group_id = ${scope.group?.groupId ?? null}::uuid) AS grp,
             (SELECT arm_name FROM sales.area_master WHERE arm_id = ${q.areaId ?? null}::uuid) AS area,
             (SELECT emp_name FROM public.employee_master WHERE emp_id = ${q.salesmanId ?? null}::uuid) AS salesman,
             (SELECT led_name FROM accounts.acc_ledger_master WHERE led_id = ${q.partyId ?? null}::uuid) AS party`;
        return {
            company: r?.company ?? null,
            branch: r?.branch ?? null,
            group: r?.grp ?? null,
            area: r?.area ?? null,
            salesman: r?.salesman ?? null,
            party: r?.party ?? null,
        };
    }
    printedAs(scope, q, names) {
        const dmy = (iso) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}`;
        const parts = [
            `${scope.side === 'RECEIVABLE' ? 'Receivable' : 'Payable'} outstanding as on ${dmy(scope.asOn)}` +
                ' (as the books stand today)',
            `Branch: ${names.branch ?? 'All branches'}`,
            scope.group && names.group ? `Group: ${names.group} (+ sub-groups)` : null,
            q.partyId ? `Party: ${names.party ?? q.partyId}` : null,
            scope.areaId ? `Area: ${names.area ?? scope.areaId}` : null,
            scope.salesmanId ? `Salesman: ${names.salesman ?? scope.salesmanId}` : null,
            q.collectionDay ? `Collection: ${q.collectionDay}` : null,
            `Aged by ${scope.ageBy === 'DUE_DATE' ? 'due date' : 'bill date'}`,
            `Buckets ${scope.edges.join(', ')}`,
            scope.onlyOverdue ? 'Only overdue' : null,
            scope.minDueDays !== null ? `Due days ≥ ${scope.minDueDays}` : null,
            scope.maxDueDays !== null ? `Due days ≤ ${scope.maxDueDays}` : null,
            scope.includeOnAccount ? null : 'On-account excluded',
            scope.deductPdc ? 'PDC in hand deducted' : null,
            scope.hideZero || q.shape === 'PARTY_STATEMENT' ? null : 'Zero balances shown',
        ];
        return parts.filter(Boolean).join(' · ');
    }
};
exports.PartyOutstandingService = PartyOutstandingService;
exports.PartyOutstandingService = PartyOutstandingService = PartyOutstandingService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService,
        request_context_service_1.RequestContextService])
], PartyOutstandingService);
const NIL_UUID = '00000000-0000-0000-0000-000000000000';
function refuse(code, field, message) {
    (0, module_service_utils_1.throwUnprocessable)('Party-wise outstanding request refused', [{ field, message, code }]);
}
function head(scope) {
    return {
        asOn: scope.asOn,
        side: scope.side,
        isFuture: scope.isFuture,
        accYear: scope.fyName,
        bucketLabels: scope.labels,
    };
}
function money(value) {
    return new client_1.Prisma.Decimal(value).toFixed(2);
}
function bal(value, positiveSide) {
    const d = new client_1.Prisma.Decimal(value).toDecimalPlaces(2);
    if (d.isZero()) {
        return { amount: '0.00', side: null };
    }
    const other = positiveSide === 'DR' ? 'CR' : 'DR';
    return { amount: d.abs().toFixed(2), side: d.isNegative() ? other : positiveSide };
}
function isoDate(value) {
    return value.toISOString().slice(0, 10);
}
function billKey(id, yr) {
    return `${id}|${yr.trim()}`;
}
function partyOrder(sort, dir) {
    const bucket = /^bucket(\d)$/.exec(sort);
    const col = bucket
        ? `pf.b${bucket[1]}`
        : {
            net: 'pf.net',
            name: 'lower(pf.name)',
            overdue: 'pf.overdue',
            oldest: 'pf.oldest',
            owed: 'pf.owed',
        }[sort];
    return client_1.Prisma.raw(`${col} ${dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, lower(pf.name) ASC, pf.party_id ASC`);
}
function billOrder(sort, dir) {
    const col = {
        date: 'x.abl_doc_date',
        party: 'lower(pt.name)',
        due: 'x.due_eff',
        refno: 'x.doc_refno',
        pending: 'x.pending',
        age: 'x.age_days',
        overdue: 'x.overdue_days',
    }[sort];
    return client_1.Prisma.raw(`${col} ${dir === 'asc' ? 'ASC' : 'DESC'} NULLS LAST, x.abl_doc_date ASC, x.doc_refno ASC, x.abl_id ASC`);
}
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
function isUuid(v) {
    return !!v && UUID.test(v);
}
//# sourceMappingURL=party-outstanding.service.js.map