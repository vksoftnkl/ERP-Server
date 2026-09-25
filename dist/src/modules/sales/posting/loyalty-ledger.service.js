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
var LoyaltyLedgerService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.LoyaltyLedgerService = void 0;
const node_crypto_1 = require("node:crypto");
const common_1 = require("@nestjs/common");
const client_1 = require("@prisma/client");
const prisma_service_1 = require("../../../database/prisma/prisma.service");
const posting_types_1 = require("./types/posting.types");
const sales_errors_1 = require("./sales.errors");
let LoyaltyLedgerService = LoyaltyLedgerService_1 = class LoyaltyLedgerService {
    prisma;
    logger = new common_1.Logger(LoyaltyLedgerService_1.name);
    constructor(prisma) {
        this.prisma = prisma;
    }
    async writeLedgerRows(tx, rows) {
        if (rows.length === 0) {
            return [];
        }
        const values = rows.map((r) => client_1.Prisma.sql `(
        ${r.compId}::uuid, ${r.branchId}::uuid, ${r.tenantId ?? null}::uuid,
        ${r.accYear}::char(9), ${r.memberId}::uuid, ${r.custId}::uuid,
        ${r.lscId ?? null}::uuid, ${r.lssId ?? null}::uuid, ${r.lsiId ?? null}::uuid,
        ${r.txnType}, ${r.rowNo}::int, ${dec(r.points, 4)}::numeric,
        ${r.txnDate}::date, ${r.txnTime ?? null}::time,
        ${r.lotId ?? null}::uuid, ${r.lotAccYear ?? null}::char(9),
        ${r.expiresOn ?? null}::date, ${r.activeFrom ?? null}::date,
        ${r.srcModule ?? null}, ${r.srcDocType ?? null}, ${r.srcDocId ?? null}::uuid,
        ${r.srcAccYear ?? null}::char(9), ${r.srcDocRefno ?? null},
        ${r.srcRowNo ?? null}::int,
        ${dec(r.baseAmount ?? 0, 2)}::numeric, ${dec(r.baseQty ?? 0, 4)}::numeric,
        ${dec(r.rate ?? 0, 4)}::numeric, ${dec(r.factor ?? 1, 4)}::numeric,
        ${dec(r.moneyValue ?? 0, 2)}::numeric,
        ${r.tenderId ?? null}::uuid, ${r.tenderAccYear ?? null}::char(9),
        ${r.reversalOfId ?? null}::uuid, ${r.reversalOfAccYear ?? null}::char(9),
        ${r.reversalReason ?? null},
        ${r.approvedBy ?? null}::uuid, ${r.userId ?? null}::uuid,
        ${r.sessionId ?? null}::uuid, ${r.deviceId ?? null}::uuid,
        ${r.remarks ?? null}, ${r.createdBy ?? 'SYSTEM'}
      )`);
        const written = await tx.$queryRaw `
      INSERT INTO sales.loyalty_ledger (
        lld_comp_id, lld_branch_id, lld_tenant_id,
        lld_acc_year, lld_member_id, lld_cust_id,
        lld_lsc_id, lld_lss_id, lld_lsi_id,
        lld_txn_type, lld_row_no, lld_points,
        lld_txn_date, lld_txn_time,
        lld_lot_id, lld_lot_acc_year,
        lld_expires_on, lld_active_from,
        lld_src_module, lld_src_doc_type, lld_src_doc_id,
        lld_src_acc_year, lld_src_doc_refno,
        lld_src_row_no,
        lld_base_amount, lld_base_qty,
        lld_rate, lld_factor,
        lld_money_value,
        lld_tender_id, lld_tender_acc_year,
        lld_reversal_of_id, lld_reversal_of_acc_year,
        lld_reversal_reason,
        lld_approved_by, lld_user_id,
        lld_session_id, lld_device_id,
        lld_remarks, lld_created_by
      )
      VALUES ${client_1.Prisma.join(values)}
      RETURNING lld_id, lld_acc_year`;
        const lots = new Map();
        const touch = (lotId, lotAccYear) => {
            lots.set(`${lotId}|${lotAccYear}`, { lotId, lotAccYear });
        };
        for (const r of rows) {
            if (r.lotId && r.lotAccYear) {
                touch(r.lotId, r.lotAccYear);
            }
            if (r.reversalOfId &&
                r.reversalOfAccYear &&
                (r.txnType === 'EARN' || r.txnType === 'OPENING')) {
                touch(r.reversalOfId, r.reversalOfAccYear);
            }
        }
        await this.recomputeLots(tx, [...lots.values()]);
        await this.recomputeMembers(tx, [...new Set(rows.map((r) => r.memberId))]);
        return written.map((w) => ({ id: w.lld_id, accYear: w.lld_acc_year }));
    }
    async recomputeLots(tx, lots) {
        if (lots.length === 0) {
            return;
        }
        const ids = lots.map((l) => l.lotId);
        const years = lots.map((l) => l.lotAccYear);
        await tx.$executeRaw `
      UPDATE sales.loyalty_ledger l
         SET lld_consumed_points = COALESCE(s.consumed, 0)
        FROM unnest(${ids}::uuid[], ${years}::text[]) AS k(lot_id, lot_year)
        LEFT JOIN LATERAL (
              SELECT -SUM(c.lld_points) AS consumed
                FROM sales.loyalty_ledger c
               WHERE c.lld_is_deleted = false
                 AND ((c.lld_lot_id       = k.lot_id
                   AND c.lld_lot_acc_year = k.lot_year::char(9))
                   OR c.lld_reversal_of_id = k.lot_id)
             ) s ON true
       WHERE l.lld_id       = k.lot_id
         AND l.lld_acc_year = k.lot_year::char(9)`;
    }
    async recomputeMembers(tx, memberIds) {
        const ids = [...new Set(memberIds)].filter(Boolean);
        if (ids.length === 0) {
            return;
        }
        await tx.$executeRaw `
      UPDATE sales.loyalty_member m
         SET lmb_earned_points     = COALESCE(s.earned, 0),
             lmb_redeemed_points   = COALESCE(s.redeemed, 0),
             lmb_expired_points    = COALESCE(s.expired, 0),
             lmb_gift_points       = COALESCE(s.gifted, 0),
             lmb_adjusted_points   = COALESCE(s.adjusted, 0),
             lmb_lifetime_bill_amt = COALESCE(s.bill_amt, 0),
             lmb_lifetime_bill_cnt = COALESCE(s.bill_cnt, 0),
             lmb_last_earn_on      = s.last_earn_on,
             lmb_last_redeem_on    = s.last_redeem_on,
             lmb_last_activity_on  = s.last_activity_on,
             lmb_next_expiry_on    = s.next_expiry_on,
             lmb_modified_on       = now()
        FROM unnest(${ids}::uuid[]) AS k(member_id)
        LEFT JOIN LATERAL (
              SELECT
                -- A reversal is the SAME type with the opposite sign, so each
                -- of these plain sums already nets its own reversals.
                SUM(l.lld_points) FILTER (WHERE l.lld_txn_type IN ('EARN','OPENING'))     AS earned,
               -SUM(l.lld_points) FILTER (WHERE l.lld_txn_type = 'REDEEM')                AS redeemed,
               -SUM(l.lld_points) FILTER (WHERE l.lld_txn_type = 'EXPIRE')                AS expired,
               -SUM(l.lld_points) FILTER (WHERE l.lld_txn_type = 'GIFT')                  AS gifted,
                SUM(l.lld_points) FILTER (WHERE l.lld_txn_type IN ('ADJUST','TRANSFER'))  AS adjusted,
                SUM(l.lld_base_amount) FILTER (
                      WHERE l.lld_txn_type = 'EARN' AND l.lld_src_doc_id IS NOT NULL)     AS bill_amt,
                COUNT(DISTINCT l.lld_src_doc_id) FILTER (
                      WHERE l.lld_txn_type = 'EARN' AND l.lld_src_doc_id IS NOT NULL)     AS bill_cnt,
                MAX(l.lld_txn_date) FILTER (WHERE l.lld_txn_type = 'EARN')                AS last_earn_on,
                MAX(l.lld_txn_date) FILTER (WHERE l.lld_txn_type IN ('REDEEM','GIFT'))    AS last_redeem_on,
                MAX(l.lld_txn_date)                                                       AS last_activity_on,
                MIN(l.lld_expires_on) FILTER (
                      WHERE l.lld_txn_type = 'EARN'
                        AND l.lld_lot_balance > 0
                        AND l.lld_expires_on IS NOT NULL)                                 AS next_expiry_on
                FROM sales.loyalty_ledger l
               WHERE l.lld_member_id = k.member_id
                 AND l.lld_is_deleted = false
             ) s ON true
       WHERE m.lmb_id = k.member_id`;
    }
    async lots(memberId, onDate, tx) {
        const client = tx ?? this.prisma;
        const rows = await client.$queryRaw `
      SELECT lld_id, lld_acc_year, lld_lot_balance, lld_expires_on,
             lld_active_from, lld_txn_date, lld_lsc_id, lld_branch_id
        FROM sales.loyalty_ledger
       WHERE lld_member_id  = ${memberId}::uuid
         AND lld_txn_type   = 'EARN'
         AND lld_is_deleted = false
         AND lld_lot_balance > 0
         AND (lld_active_from IS NULL OR lld_active_from <= ${onDate}::date)
         AND (lld_expires_on  IS NULL OR lld_expires_on  >= ${onDate}::date)
       -- This ORDER BY is the product's single opinion about FIFO. Do not
       -- reorder it, and do not copy it anywhere else.
       ORDER BY lld_expires_on NULLS LAST, lld_txn_date, lld_id`;
        return rows.map((r) => ({
            lotId: r.lld_id,
            lotAccYear: r.lld_acc_year,
            lotBalance: Number(r.lld_lot_balance ?? 0),
            expiresOn: dateStr(r.lld_expires_on),
            activeFrom: dateStr(r.lld_active_from),
            txnDate: dateStr(r.lld_txn_date),
            lscId: r.lld_lsc_id,
            branchId: r.lld_branch_id,
        }));
    }
    async redeemable(memberId, onDate, tx) {
        const client = tx ?? this.prisma;
        const rows = await client.$queryRaw `
      SELECT SUM(lld_lot_balance) AS total
        FROM sales.loyalty_ledger
       WHERE lld_member_id  = ${memberId}::uuid
         AND lld_txn_type   = 'EARN'
         AND lld_is_deleted = false
         AND lld_lot_balance > 0
         AND (lld_active_from IS NULL OR lld_active_from <= ${onDate}::date)
         AND (lld_expires_on  IS NULL OR lld_expires_on  >= ${onDate}::date)`;
        return Number(rows[0]?.total ?? 0);
    }
    async balance(memberId, tx) {
        const client = tx ?? this.prisma;
        const rows = await client.$queryRaw `
      SELECT lmb_balance_points FROM sales.loyalty_member WHERE lmb_id = ${memberId}::uuid`;
        return Number(rows[0]?.lmb_balance_points ?? 0);
    }
    async consume(tx, memberId, points, txnType, opts) {
        if (!(points > 0)) {
            return 0;
        }
        if (txnType === 'REDEEM' && !opts.tenderId) {
            (0, sales_errors_1.throwSalesInvalid)('A points redemption must name the tender row it settled through', posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'tenderId');
        }
        if (txnType === 'GIFT' && opts.tenderId) {
            (0, sales_errors_1.throwSalesInvalid)('A gift redemption crosses no money and must not name a tender row', posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'tenderId');
        }
        const member = await tx.$queryRaw `
      SELECT lmb_comp_id, lmb_cust_id
        FROM sales.loyalty_member
       WHERE lmb_id = ${memberId}::uuid
         FOR UPDATE`;
        if (member.length === 0) {
            (0, sales_errors_1.throwSalesInvalid)(`Loyalty member ${memberId} does not exist`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'memberId');
        }
        const { lmb_comp_id: compId, lmb_cust_id: custId } = member[0];
        const avail = await this.redeemable(memberId, opts.txnDate, tx);
        if (avail < points) {
            (0, sales_errors_1.throwSalesRefused)(`Member ${memberId} has ${avail} redeemable points on ${opts.txnDate}; ${points} were asked for`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
        }
        const lots = await this.lots(memberId, opts.txnDate, tx);
        const rate = opts.rate ?? 0;
        const rows = [];
        let left = points;
        for (const lot of lots) {
            if (left <= 0) {
                break;
            }
            const take = Math.min(left, lot.lotBalance);
            if (take <= 0) {
                continue;
            }
            rows.push({
                compId,
                custId,
                memberId,
                branchId: opts.branchId,
                accYear: opts.accYear,
                txnType,
                rowNo: rows.length + 1,
                points: -take,
                txnDate: opts.txnDate,
                lotId: lot.lotId,
                lotAccYear: lot.lotAccYear,
                lscId: opts.lscId ?? lot.lscId,
                rate,
                moneyValue: round(take * rate, 2),
                srcModule: opts.srcModule ?? 'SALES',
                srcDocType: opts.srcDocType ?? null,
                srcDocId: opts.srcDocId ?? null,
                srcAccYear: opts.srcAccYear ?? null,
                srcDocRefno: opts.srcDocRefno ?? null,
                tenderId: opts.tenderId ?? null,
                tenderAccYear: opts.tenderAccYear ?? null,
                remarks: opts.remarks ?? null,
                createdBy: opts.createdBy ?? 'SYSTEM',
                userId: opts.userId ?? null,
                sessionId: opts.sessionId ?? null,
                deviceId: opts.deviceId ?? null,
                approvedBy: opts.approvedBy ?? null,
            });
            left = round(left - take, 4);
        }
        if (left > 0) {
            throw new Error(`Loyalty lot balances and wallet balance disagree for member ${memberId}: ` +
                `${left} of ${points} points could not be allocated on ${opts.txnDate}`);
        }
        await this.writeLedgerRows(tx, rows);
        return rows.length;
    }
    async resolveMember(tx, bill, opts = {
        autoEnrol: true,
        isWalkIn: false,
    }) {
        if (bill.memberId) {
            return bill.memberId;
        }
        if (opts.isWalkIn) {
            return null;
        }
        const existing = await tx.$queryRaw `
      SELECT lmb_id
        FROM sales.loyalty_member
       WHERE lmb_comp_id    = ${bill.companyId}::uuid
         AND lmb_cust_id    = ${bill.custId}::uuid
         AND lmb_is_deleted = false
       ORDER BY lmb_created_on
       LIMIT 1`;
        if (existing.length > 0) {
            return existing[0].lmb_id;
        }
        if (!opts.autoEnrol) {
            return null;
        }
        const created = await tx.$queryRaw `
      INSERT INTO sales.loyalty_member
        (lmb_comp_id, lmb_branch_id, lmb_acc_year, lmb_cust_id, lmb_enrolled_on, lmb_created_by)
      VALUES
        (${bill.companyId}::uuid, ${bill.branchId}::uuid, ${bill.accYear}::char(9),
         ${bill.custId}::uuid, ${bill.docDate}::date, ${opts.createdBy ?? 'SYSTEM'})
      RETURNING lmb_id`;
        return created[0].lmb_id;
    }
    async resolveScheme(tx, bill, opts = {}) {
        const wantTypes = opts.forRedeem ? ['REDEEM', 'BOTH'] : ['EARN', 'BOTH'];
        const weekday = WEEKDAYS[new Date(`${bill.docDate}T00:00:00Z`).getUTCDay()];
        const atTime = opts.at ?? null;
        const rows = await tx.$queryRaw `
      SELECT s.*
        FROM sales.loyalty_scheme s
       WHERE s.lsc_comp_id    = ${bill.companyId}::uuid
         AND s.lsc_is_deleted = false
         AND s.lsc_is_active  = true
         AND s.lsc_status     = 'APPROVED'
         AND s.lsc_type       = ANY(${wantTypes}::text[])
         AND (s.lsc_start_date IS NULL OR s.lsc_start_date <= ${bill.docDate}::date)
         AND (s.lsc_end_date   IS NULL OR s.lsc_end_date   >= ${bill.docDate}::date)
         -- NULL weekday list means every day.
         AND (s.lsc_valid_weekdays IS NULL
              OR ${weekday} = ANY(string_to_array(s.lsc_valid_weekdays, ',')))
         -- A time window is only tested when the caller gave a time; a nightly
         -- re-post has no counter clock and must not be refused for it.
         AND (${atTime}::time IS NULL
              OR s.lsc_valid_from_time IS NULL OR s.lsc_valid_to_time IS NULL
              OR ${atTime}::time BETWEEN s.lsc_valid_from_time AND s.lsc_valid_to_time)
         AND (s.lsc_bill_type = 'ALL' OR s.lsc_bill_type = ${bill.billType ?? 'ALL'})
         -- Branch scope: ALL, or the branch listed and not excluded.
         AND (s.lsc_branch_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_branch b
                WHERE b.lsb_lsc_id     = s.lsc_id
                  AND b.lsb_branch_id  = ${bill.branchId}::uuid
                  AND b.lsb_is_exclude = false
                  AND b.lsb_is_deleted = false
                  AND b.lsb_is_active  = true))
         AND NOT EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_branch b
                WHERE b.lsb_lsc_id     = s.lsc_id
                  AND b.lsb_branch_id  = ${bill.branchId}::uuid
                  AND b.lsb_is_exclude = true
                  AND b.lsb_is_deleted = false
                  AND b.lsb_is_active  = true)
         -- Customer scope: the customer itself or its group.
         AND (s.lsc_cust_scope = 'ALL' OR EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_party p
                WHERE p.lsp_lsc_id     = s.lsc_id
                  AND p.lsp_is_exclude = false
                  AND p.lsp_is_deleted = false
                  AND p.lsp_is_active  = true
                  AND ((p.lsp_kind = 'CUSTOMER'       AND p.lsp_cust_id = ${bill.custId}::uuid)
                    OR (p.lsp_kind = 'CUSTOMER_GROUP' AND p.lsp_cust_group_id = ${bill.custGroupId ?? null}::uuid))))
         AND NOT EXISTS (
               SELECT 1 FROM sales.loyalty_scheme_party p
                WHERE p.lsp_lsc_id     = s.lsc_id
                  AND p.lsp_is_exclude = true
                  AND p.lsp_is_deleted = false
                  AND p.lsp_is_active  = true
                  AND ((p.lsp_kind = 'CUSTOMER'       AND p.lsp_cust_id = ${bill.custId}::uuid)
                    OR (p.lsp_kind = 'CUSTOMER_GROUP' AND p.lsp_cust_group_id = ${bill.custGroupId ?? null}::uuid)))
       -- Highest priority wins; the newest scheme breaks a tie, because that
       -- is the one somebody most recently decided on.
       ORDER BY s.lsc_priority DESC, s.lsc_created_on DESC
       LIMIT 1`;
        return rows.length === 0 ? null : toScheme(rows[0]);
    }
    async earn(tx, bill, opts = {}) {
        const empty = (reason) => ({
            memberId: opts.memberId ?? bill.memberId ?? null,
            schemeId: null,
            points: 0,
            baseAmount: 0,
            baseQty: 0,
            rowsWritten: 0,
            expiresOn: null,
            activeFrom: null,
            lines: [],
            reason,
        });
        const memberId = opts.memberId ?? bill.memberId ?? null;
        if (!memberId) {
            return empty('No loyalty member on this document');
        }
        const scheme = opts.scheme !== undefined ? opts.scheme : await this.resolveScheme(tx, bill);
        if (!scheme) {
            return empty('No approved earning scheme covers this document');
        }
        const computed = await this.computeEarn(tx, bill, scheme);
        if (computed.points <= 0) {
            return {
                ...empty(computed.reason ?? 'Scheme awards no points for this document'),
                schemeId: scheme.lscId,
            };
        }
        const expiresOn = lotExpiry(scheme, bill.docDate);
        const activeFrom = addDays(bill.docDate, scheme.activationDays);
        if (opts.dryRun) {
            return {
                memberId,
                schemeId: scheme.lscId,
                points: computed.points,
                baseAmount: computed.baseAmount,
                baseQty: computed.baseQty,
                rowsWritten: 0,
                expiresOn,
                activeFrom,
                lines: computed.lines,
            };
        }
        await this.writeLedgerRows(tx, [
            {
                compId: bill.companyId,
                branchId: bill.branchId,
                accYear: bill.accYear,
                memberId,
                custId: bill.custId,
                lscId: scheme.lscId,
                lssId: computed.lssId,
                lsiId: computed.lsiId,
                txnType: 'EARN',
                rowNo: 1,
                points: computed.points,
                txnDate: bill.docDate,
                expiresOn,
                activeFrom,
                srcModule: 'SALES',
                srcDocType: bill.docType,
                srcDocId: bill.docId,
                srcAccYear: bill.accYear,
                srcDocRefno: bill.docRefno,
                baseAmount: computed.baseAmount,
                baseQty: computed.baseQty,
                factor: 1,
                createdBy: opts.createdBy ?? 'SYSTEM',
            },
        ]);
        return {
            memberId,
            schemeId: scheme.lscId,
            points: computed.points,
            baseAmount: computed.baseAmount,
            baseQty: computed.baseQty,
            rowsWritten: 1,
            expiresOn,
            activeFrom,
            lines: computed.lines,
        };
    }
    async computeEarn(tx, bill, scheme) {
        const none = (reason) => ({
            points: 0,
            baseAmount: 0,
            baseQty: 0,
            lines: [],
            lssId: null,
            lsiId: null,
            reason,
        });
        const itemRules = await this.schemeItems(tx, scheme.lscId);
        const slabs = await this.schemeSlabs(tx, scheme.lscId);
        const eligible = bill.lines.filter((l) => {
            if (l.isFree || !l.allowLoyalty) {
                return false;
            }
            if (excludedByItemRule(l, itemRules)) {
                return false;
            }
            if (scheme.itemScope === 'LIST') {
                return matchItemRule(l, itemRules) !== null;
            }
            return true;
        });
        if (eligible.length === 0) {
            return none('No line on this document is eligible to earn');
        }
        const amountOf = (l) => {
            if (!scheme.earnOnDiscounted) {
                return l.grossAmt;
            }
            switch (scheme.amountType) {
                case 'GROSS_AMOUNT':
                    return l.grossAmt;
                case 'NET_AMOUNT':
                    return l.netAmt;
                default:
                    return l.taxableAmt;
            }
        };
        const byAmount = scheme.applyOn === 'BILL_AMOUNT' || scheme.applyOn === 'ITEM_AMOUNT';
        const perLine = scheme.applyOn === 'ITEM_AMOUNT' || scheme.applyOn === 'ITEM_QTY';
        let baseAmount = eligible.reduce((s, l) => s + amountOf(l), 0);
        const baseQty = eligible.reduce((s, l) => s + l.qty, 0);
        if (byAmount) {
            if (scheme.earnOnCharges) {
                baseAmount += bill.chargesAmt;
            }
            if (!scheme.earnWithRedeem) {
                baseAmount = Math.max(0, baseAmount - bill.redeemedAmount);
            }
        }
        baseAmount = round(baseAmount, 2);
        if (baseAmount < scheme.minBillAmount) {
            return none(`Document base ${baseAmount} is below the scheme minimum ${scheme.minBillAmount}`);
        }
        const lines = [];
        let raw = 0;
        let lssId = null;
        let lsiId = null;
        if (perLine) {
            for (const l of eligible) {
                const lineBase = byAmount ? amountOf(l) : l.qty;
                const rule = matchItemRule(l, itemRules);
                const slab = matchSlab(lineBase, slabs, l.itemId);
                let pts = rule ? award(lineBase, rule) : 0;
                if (pts <= 0 && slab) {
                    pts = award(lineBase, slab);
                    lssId ??= slab.id;
                }
                else if (pts > 0 && rule) {
                    lsiId ??= rule.id;
                }
                if (pts > 0) {
                    raw += pts;
                    lines.push({ lineNo: l.lineNo, points: pts, pv: l.qty > 0 ? pts / l.qty : 0 });
                }
            }
        }
        else {
            const base = byAmount ? baseAmount : baseQty;
            const slab = matchSlab(base, slabs, null);
            if (!slab) {
                return none(`No slab of scheme ${scheme.code} covers a base of ${base}`);
            }
            lssId = slab.id;
            raw = award(base, slab);
            const spreadOver = byAmount ? baseAmount : baseQty;
            for (const l of eligible) {
                const share = spreadOver > 0 ? (byAmount ? amountOf(l) : l.qty) / spreadOver : 0;
                const pts = raw * share;
                lines.push({ lineNo: l.lineNo, points: pts, pv: l.qty > 0 ? pts / l.qty : 0 });
            }
        }
        let points = roundPoints(raw, scheme.rounding, scheme.pointsDecimals);
        if (scheme.maxEarnPoints !== null && scheme.maxEarnPoints > 0) {
            points = Math.min(points, scheme.maxEarnPoints);
        }
        if (raw > 0 && points !== raw) {
            const k = points / raw;
            for (const l of lines) {
                l.points = round(l.points * k, 4);
                l.pv = round(l.pv * k, 4);
            }
        }
        return { points, baseAmount, baseQty, lines, lssId, lsiId };
    }
    async redeem(tx, bill, tender, opts = {}) {
        const points = tender.points;
        if (!(points > 0)) {
            return { rowsWritten: 0, points: 0, amount: 0, rate: 0 };
        }
        const memberId = opts.memberId ?? bill.memberId ?? null;
        if (!memberId) {
            (0, sales_errors_1.throwSalesRefused)('This document redeems points but names no loyalty member', posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyMemberId');
        }
        const scheme = opts.scheme !== undefined
            ? opts.scheme
            : await this.resolveScheme(tx, bill, { forRedeem: true });
        if (!scheme) {
            (0, sales_errors_1.throwSalesRefused)('No approved scheme allows a redemption against this document', posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
        }
        if (!scheme.allowPointRedeem) {
            (0, sales_errors_1.throwSalesRefused)(`Scheme ${scheme.code} does not allow point redemption`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
        }
        if (scheme.poolMode === 'BRANCH' && !scheme.allowCrossBranchRedeem) {
            const elsewhere = await tx.$queryRaw `
        SELECT COUNT(*) AS n
          FROM sales.loyalty_ledger
         WHERE lld_member_id  = ${memberId}::uuid
           AND lld_txn_type   = 'EARN'
           AND lld_is_deleted = false
           AND lld_lot_balance > 0
           AND lld_branch_id <> ${bill.branchId}::uuid`;
            if (Number(elsewhere[0]?.n ?? 0) > 0) {
                (0, sales_errors_1.throwSalesRefused)(`Scheme ${scheme.code} pools points by branch and does not allow cross-branch redemption`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
            }
        }
        const rate = scheme.redeemValuePerPoint > 0 ? scheme.redeemValuePerPoint : (tender.masterRate ?? 0);
        if (!(rate > 0)) {
            (0, sales_errors_1.throwSalesRefused)(`Scheme ${scheme.code} has no redemption rate and the tender master gave none`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyRate');
        }
        const expected = round(points * rate, 2);
        if (round(tender.amount, 2) !== expected) {
            (0, sales_errors_1.throwSalesRefused)(`Redemption amount ${tender.amount} does not equal ${points} points at ${rate} (${expected})`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'tenderAmount');
        }
        const billAmount = bill.lines.reduce((s, l) => s + l.netAmt, 0) + bill.chargesAmt;
        if (scheme.redeemMinBillAmount > 0 && billAmount < scheme.redeemMinBillAmount) {
            (0, sales_errors_1.throwSalesRefused)(`A redemption needs a bill of at least ${scheme.redeemMinBillAmount}; this one is ${round(billAmount, 2)}`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
        }
        if (scheme.minRedeemPoints > 0 && points < scheme.minRedeemPoints) {
            (0, sales_errors_1.throwSalesRefused)(`At least ${scheme.minRedeemPoints} points must be redeemed at once; ${points} were offered`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
        }
        if (scheme.maxRedeemPoints !== null &&
            scheme.maxRedeemPoints > 0 &&
            points > scheme.maxRedeemPoints) {
            (0, sales_errors_1.throwSalesRefused)(`At most ${scheme.maxRedeemPoints} points may be redeemed on one bill; ${points} were offered`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
        }
        if (scheme.maxRedeemPerc !== null && scheme.maxRedeemPerc > 0) {
            const cap = round((billAmount * scheme.maxRedeemPerc) / 100, 2);
            if (expected > cap) {
                (0, sales_errors_1.throwSalesRefused)(`Points may settle at most ${scheme.maxRedeemPerc}% of this bill (${cap}); ${expected} was offered`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'tenderAmount');
            }
        }
        if (scheme.redeemMultiple !== null && scheme.redeemMultiple > 0) {
            const steps = points / scheme.redeemMultiple;
            if (Math.abs(steps - Math.round(steps)) > 1e-9) {
                (0, sales_errors_1.throwSalesRefused)(`Points are redeemed in multiples of ${scheme.redeemMultiple}; ${points} is not one`, posting_types_1.SALES_ERROR_CODES.LOYALTY_CAP, 'loyaltyPoints');
            }
        }
        const rowsWritten = await this.consume(tx, memberId, points, 'REDEEM', {
            branchId: bill.branchId,
            accYear: bill.accYear,
            txnDate: bill.docDate,
            rate,
            srcModule: 'SALES',
            srcDocType: bill.docType,
            srcDocId: bill.docId,
            srcAccYear: bill.accYear,
            srcDocRefno: bill.docRefno,
            tenderId: tender.tenderId,
            tenderAccYear: tender.tenderAccYear,
            lscId: scheme.lscId,
            createdBy: opts.createdBy ?? 'SYSTEM',
        });
        return { rowsWritten, points, amount: expected, rate };
    }
    async reverseForCancel(tx, doc, opts = {}) {
        const originals = await tx.$queryRaw `
      SELECT lld_id, lld_acc_year, lld_comp_id, lld_branch_id, lld_member_id, lld_cust_id,
             lld_txn_type, lld_points, lld_lot_balance, lld_lot_id, lld_lot_acc_year,
             lld_lsc_id, lld_rate, lld_money_value, lld_tender_id, lld_tender_acc_year,
             lld_txn_date
        FROM sales.loyalty_ledger
       WHERE lld_src_doc_type   = ${doc.docType}
         AND lld_src_doc_id     = ${doc.docId}::uuid
         AND lld_is_deleted     = false
         AND lld_reversal_of_id IS NULL
       ORDER BY lld_txn_type, lld_row_no`;
        if (originals.length === 0) {
            return { rowsWritten: 0, earnReversed: 0, redeemReversed: 0 };
        }
        const already = await this.reversedIds(tx, originals.map((o) => o.lld_id));
        const rows = [];
        let earnReversed = 0;
        let redeemReversed = 0;
        const lastRowNo = await this.maxRowNos(tx, doc);
        const nextRowNo = (txnType) => {
            const n = (lastRowNo.get(txnType) ?? 0) + 1;
            lastRowNo.set(txnType, n);
            return n;
        };
        for (const o of originals) {
            if (already.has(o.lld_id)) {
                continue;
            }
            const base = {
                compId: o.lld_comp_id,
                branchId: o.lld_branch_id,
                accYear: doc.accYear,
                memberId: o.lld_member_id,
                custId: o.lld_cust_id,
                lscId: o.lld_lsc_id,
                txnDate: dateStr(o.lld_txn_date),
                srcModule: 'SALES',
                srcDocType: doc.docType,
                srcDocId: doc.docId,
                srcAccYear: doc.accYear,
                srcDocRefno: doc.docRefno ?? null,
                reversalOfId: o.lld_id,
                reversalOfAccYear: o.lld_acc_year,
                reversalReason: opts.reason ?? 'Document cancelled',
                createdBy: opts.createdBy ?? 'SYSTEM',
            };
            if (o.lld_txn_type === 'EARN') {
                const awarded = Number(o.lld_points);
                const left = Number(o.lld_lot_balance ?? 0);
                const take = Math.min(awarded, Math.max(0, left));
                if (take <= 0) {
                    continue;
                }
                const shortfall = round(awarded - take, 4);
                rows.push({
                    ...base,
                    txnType: 'EARN',
                    rowNo: nextRowNo('EARN'),
                    points: -take,
                    remarks: shortfall > 0
                        ? `Cancelled; ${shortfall} of ${awarded} points had already been spent and could not be taken back`
                        : null,
                });
                earnReversed += take;
            }
            else if (o.lld_txn_type === 'REDEEM' || o.lld_txn_type === 'GIFT') {
                const spent = -Number(o.lld_points);
                rows.push({
                    ...base,
                    txnType: o.lld_txn_type,
                    rowNo: nextRowNo(o.lld_txn_type),
                    points: spent,
                    lotId: o.lld_lot_id,
                    lotAccYear: o.lld_lot_acc_year,
                    rate: Number(o.lld_rate ?? 0),
                    moneyValue: Number(o.lld_money_value ?? 0),
                    tenderId: o.lld_tender_id,
                    tenderAccYear: o.lld_tender_acc_year,
                });
                redeemReversed += spent;
            }
        }
        await this.writeLedgerRows(tx, rows);
        return { rowsWritten: rows.length, earnReversed, redeemReversed };
    }
    async reverseRedeemForTender(tx, doc, opts = {}) {
        const originals = await tx.$queryRaw `
      SELECT lld_id, lld_acc_year, lld_comp_id, lld_branch_id, lld_member_id, lld_cust_id,
             lld_txn_type, lld_points, lld_lot_balance, lld_lot_id, lld_lot_acc_year,
             lld_lsc_id, lld_rate, lld_money_value, lld_tender_id, lld_tender_acc_year,
             lld_txn_date
        FROM sales.loyalty_ledger
       WHERE lld_src_doc_type   = ${doc.docType}
         AND lld_src_doc_id     = ${doc.docId}::uuid
         AND lld_tender_id      = ${doc.tenderId}::uuid
         AND lld_txn_type       = 'REDEEM'
         AND lld_is_deleted     = false
         AND lld_reversal_of_id IS NULL
       ORDER BY lld_row_no`;
        if (originals.length === 0) {
            return { rowsWritten: 0, pointsRestored: 0 };
        }
        const already = await this.reversedIds(tx, originals.map((o) => o.lld_id));
        const rows = [];
        let restored = 0;
        let rowNo = (await this.maxRowNos(tx, doc)).get('REDEEM') ?? 0;
        for (const o of originals) {
            if (already.has(o.lld_id)) {
                continue;
            }
            const spent = -Number(o.lld_points);
            rows.push({
                compId: o.lld_comp_id,
                branchId: o.lld_branch_id,
                accYear: doc.accYear,
                memberId: o.lld_member_id,
                custId: o.lld_cust_id,
                lscId: o.lld_lsc_id,
                txnDate: dateStr(o.lld_txn_date),
                srcModule: 'SALES',
                srcDocType: doc.docType,
                srcDocId: doc.docId,
                srcAccYear: doc.accYear,
                srcDocRefno: doc.docRefno ?? null,
                reversalOfId: o.lld_id,
                reversalOfAccYear: o.lld_acc_year,
                reversalReason: opts.reason ?? 'Tender voided',
                createdBy: opts.createdBy ?? 'SYSTEM',
                txnType: 'REDEEM',
                rowNo: ++rowNo,
                points: spent,
                lotId: o.lld_lot_id,
                lotAccYear: o.lld_lot_acc_year,
                rate: Number(o.lld_rate ?? 0),
                moneyValue: Number(o.lld_money_value ?? 0),
                tenderId: o.lld_tender_id,
                tenderAccYear: o.lld_tender_acc_year,
            });
            restored += spent;
        }
        await this.writeLedgerRows(tx, rows);
        return { rowsWritten: rows.length, pointsRestored: restored };
    }
    async clawbackForReturn(tx, ret, share, opts = {}) {
        if (opts.scheme && opts.scheme.returnMode === 'IGNORE') {
            return { rowsWritten: 0, clawedBack: 0, shortfall: 0 };
        }
        const earned = opts.earnedOnBill ?? 0;
        const want = round(earned * clamp01(share), 4);
        if (!(want > 0)) {
            return { rowsWritten: 0, clawedBack: 0, shortfall: 0 };
        }
        const avail = await this.redeemable(ret.memberId, ret.docDate, tx);
        const take = Math.min(want, avail);
        const shortfall = round(want - take, 4);
        if (!(take > 0)) {
            this.logger.warn(`Return ${ret.docRefno ?? ret.docId}: ${want} points to claw back, none left in the wallet`);
            return { rowsWritten: 0, clawedBack: 0, shortfall: want };
        }
        const rowsWritten = await this.consume(tx, ret.memberId, take, 'EXPIRE', {
            branchId: ret.branchId,
            accYear: ret.accYear,
            txnDate: ret.docDate,
            rate: 0,
            srcModule: 'SALES',
            srcDocType: 'SALE_RETURN',
            srcDocId: ret.docId,
            srcAccYear: ret.accYear,
            srcDocRefno: ret.docRefno ?? null,
            lscId: opts.scheme?.lscId ?? null,
            remarks: shortfall > 0
                ? `Clawed back on return ${ret.docRefno ?? ret.docId}; ${shortfall} of ${want} points had already been spent`
                : `Clawed back on return ${ret.docRefno ?? ret.docId}`,
            createdBy: opts.createdBy ?? 'SYSTEM',
        });
        return { rowsWritten, clawedBack: take, shortfall };
    }
    async preview(bill, tx) {
        const client = tx ?? this.prisma;
        const memberId = bill.memberId;
        const scheme = await this.resolveScheme(client, bill);
        const earn = memberId
            ? await this.earn(client, bill, { memberId, scheme, dryRun: true })
            : null;
        return {
            memberId,
            balance: memberId ? await this.balance(memberId, client) : 0,
            redeemable: memberId ? await this.redeemable(memberId, bill.docDate, client) : 0,
            rate: scheme?.redeemValuePerPoint ?? 0,
            minPoints: scheme?.minRedeemPoints ?? 0,
            maxPoints: scheme?.maxRedeemPoints ?? null,
            maxRedeemAmount: scheme?.maxRedeemPerc != null && scheme.maxRedeemPerc > 0
                ? round((bill.lines.reduce((s, l) => s + l.netAmt, 0) + bill.chargesAmt) *
                    (scheme.maxRedeemPerc / 100), 2)
                : null,
            multiple: scheme?.redeemMultiple ?? null,
            earnPreview: earn?.points ?? 0,
            schemeId: scheme?.lscId ?? null,
            schemeName: scheme?.name ?? null,
            allowPointRedeem: scheme?.allowPointRedeem ?? false,
        };
    }
    async expiryRun(companyId, accYear, on = today(), createdBy = 'SYSTEM') {
        const runId = deterministicUuid(`${companyId}|${on}`);
        return this.prisma.$transaction(async (tx) => {
            const lapsed = await tx.$queryRaw `
        SELECT lld_id, lld_acc_year, lld_comp_id, lld_branch_id, lld_member_id, lld_cust_id,
               lld_txn_type, lld_points, lld_lot_balance, lld_lot_id, lld_lot_acc_year,
               lld_lsc_id, lld_rate, lld_money_value, lld_tender_id, lld_tender_acc_year,
               lld_txn_date
          FROM sales.loyalty_ledger
         WHERE lld_comp_id    = ${companyId}::uuid
           AND lld_txn_type   = 'EARN'
           AND lld_is_deleted = false
           AND lld_lot_balance > 0
           AND lld_expires_on IS NOT NULL
           AND lld_expires_on < ${on}::date
         ORDER BY lld_expires_on, lld_txn_date, lld_id`;
            if (lapsed.length === 0) {
                return 0;
            }
            const rows = lapsed.map((lot, i) => ({
                compId: lot.lld_comp_id,
                branchId: lot.lld_branch_id,
                accYear,
                memberId: lot.lld_member_id,
                custId: lot.lld_cust_id,
                lscId: lot.lld_lsc_id,
                txnType: 'EXPIRE',
                rowNo: i + 1,
                points: -Number(lot.lld_lot_balance ?? 0),
                txnDate: on,
                lotId: lot.lld_id,
                lotAccYear: lot.lld_acc_year,
                srcModule: 'SALES',
                srcDocType: 'EXPIRY_RUN',
                srcDocId: runId,
                srcAccYear: accYear,
                remarks: `Lapsed on ${on}`,
                createdBy,
            }));
            await this.writeLedgerRows(tx, rows);
            return rows.length;
        });
    }
    async couponExpiryRun(companyId, accYear, on = today(), createdBy = 'SYSTEM') {
        const runId = deterministicUuid(`${companyId}|coupon|${on}`);
        return this.prisma.$transaction(async (tx) => {
            const lapsed = await tx.$queryRaw `
        SELECT c.lcp_id, c.lcp_acc_year, c.lcp_comp_id, c.lcp_branch_id,
               b.lcb_branch_id, c.lcp_lcb_id, c.lcp_cust_id, c.lcp_member_id,
               c.lcp_balance_value
          FROM sales.loyalty_coupon c
          JOIN sales.loyalty_coupon_batch b ON b.lcb_id = c.lcp_lcb_id
         WHERE c.lcp_comp_id    = ${companyId}::uuid
           AND c.lcp_is_deleted = false
           AND c.lcp_balance_value > 0
           AND c.lcp_valid_upto IS NOT NULL
           AND c.lcp_valid_upto < ${on}::date
           AND c.lcp_status IN ('ISSUED', 'PARTIAL')
         ORDER BY c.lcp_valid_upto, c.lcp_id`;
            if (lapsed.length === 0) {
                return 0;
            }
            await this.writeCouponTxnRows(tx, lapsed.map((c) => ({
                compId: c.lcp_comp_id,
                branchId: c.lcp_branch_id ?? c.lcb_branch_id ?? '',
                accYear,
                lcpId: c.lcp_id,
                lcbId: c.lcp_lcb_id,
                custId: c.lcp_cust_id,
                memberId: c.lcp_member_id,
                txnType: 'EXPIRE',
                rowNo: 1,
                amount: Number(c.lcp_balance_value ?? 0),
                txnDate: on,
                srcModule: 'SALES',
                srcDocType: 'EXPIRY_RUN',
                srcDocId: runId,
                srcAccYear: accYear,
                remarks: `Lapsed on ${on}`,
                createdBy,
            })));
            await tx.$executeRaw `
        UPDATE sales.loyalty_coupon
           SET lcp_status      = 'EXPIRED',
               lcp_modified_on = now(),
               lcp_modified_by = ${createdBy}
         WHERE lcp_id = ANY(${lapsed.map((c) => c.lcp_id)}::uuid[])`;
            return lapsed.length;
        });
    }
    async writeCouponTxnRows(tx, rows) {
        if (rows.length === 0) {
            return 0;
        }
        const values = rows.map((r) => client_1.Prisma.sql `(
        ${r.compId}::uuid, ${r.branchId}::uuid, ${r.accYear}::char(9),
        ${r.lcpId}::uuid, ${r.lcbId}::uuid, ${r.custId ?? null}::uuid,
        ${r.memberId ?? null}::uuid, ${r.txnType}, ${r.rowNo}::int,
        ${dec(r.amount, 2)}::numeric, ${r.txnDate}::date,
        ${dec(r.billAmount ?? 0, 2)}::numeric, ${dec(r.percentApplied ?? 0, 2)}::numeric,
        ${r.srcModule ?? null}, ${r.srcDocType ?? null}, ${r.srcDocId ?? null}::uuid,
        ${r.srcAccYear ?? null}::char(9), ${r.srcDocRefno ?? null},
        ${r.tenderId ?? null}::uuid, ${r.tenderAccYear ?? null}::char(9),
        ${r.reversalOfId ?? null}::uuid, ${r.reversalOfAccYear ?? null}::char(9),
        ${r.reversalReason ?? null}, ${r.approvedBy ?? null}::uuid,
        ${r.remarks ?? null}, ${r.createdBy ?? 'SYSTEM'}
      )`);
        await tx.$executeRaw `
      INSERT INTO sales.loyalty_coupon_txn (
        lct_comp_id, lct_branch_id, lct_acc_year,
        lct_lcp_id, lct_lcb_id, lct_cust_id,
        lct_member_id, lct_txn_type, lct_row_no,
        lct_amount, lct_txn_date,
        lct_bill_amount, lct_percent_applied,
        lct_src_module, lct_src_doc_type, lct_src_doc_id,
        lct_src_acc_year, lct_src_doc_refno,
        lct_tender_id, lct_tender_acc_year,
        lct_reversal_of_id, lct_reversal_of_acc_year,
        lct_reversal_reason, lct_approved_by,
        lct_remarks, lct_created_by
      )
      VALUES ${client_1.Prisma.join(values)}`;
        const couponIds = [...new Set(rows.map((r) => r.lcpId))];
        const batchIds = [...new Set(rows.map((r) => r.lcbId))];
        await this.recomputeCoupons(tx, couponIds);
        await this.recomputeCouponBatches(tx, batchIds);
        return rows.length;
    }
    async recomputeCoupons(tx, couponIds) {
        const ids = [...new Set(couponIds)].filter(Boolean);
        if (ids.length === 0) {
            return;
        }
        await tx.$executeRaw `
      UPDATE sales.loyalty_coupon c
         SET lcp_used_value   = COALESCE(s.used, 0),
             lcp_topup_value  = COALESCE(s.topup, 0),
             lcp_use_count    = COALESCE(s.use_count, 0),
             lcp_last_used_on = s.last_used_on,
             lcp_status       = CASE
                 -- Only the three arithmetic states. A decision state is left
                 -- exactly as the admin path or the sweep set it.
                 WHEN c.lcp_status IN ('EXPIRED','CANCELLED','BLOCKED') THEN c.lcp_status
                 WHEN (c.lcp_face_value + COALESCE(s.topup,0) - COALESCE(s.used,0)) <= 0 THEN 'REDEEMED'
                 WHEN COALESCE(s.used, 0) > 0 THEN 'PARTIAL'
                 ELSE 'ISSUED'
             END,
             lcp_modified_on  = now()
        FROM unnest(${ids}::uuid[]) AS k(coupon_id)
        LEFT JOIN LATERAL (
              SELECT SUM(t.lct_amount) FILTER (
                       WHERE t.lct_txn_type IN ('REDEEM','EXPIRE','CANCEL'))        AS used,
                     SUM(t.lct_amount) FILTER (WHERE t.lct_txn_type = 'TOPUP')      AS topup,
                     COUNT(*) FILTER (
                       WHERE t.lct_txn_type = 'REDEEM' AND t.lct_amount > 0)        AS use_count,
                     MAX(t.lct_txn_date)                                            AS last_used_on
                FROM sales.loyalty_coupon_txn t
               WHERE t.lct_lcp_id     = k.coupon_id
                 AND t.lct_is_deleted = false
             ) s ON true
       WHERE c.lcp_id = k.coupon_id`;
    }
    async recomputeCouponBatches(tx, batchIds) {
        const ids = [...new Set(batchIds)].filter(Boolean);
        if (ids.length === 0) {
            return;
        }
        await tx.$executeRaw `
      UPDATE sales.loyalty_coupon_batch b
         SET lcb_issued_count   = COALESCE(s.issued, 0),
             lcb_redeemed_count = COALESCE(s.redeemed, 0),
             lcb_modified_on    = now()
        FROM unnest(${ids}::uuid[]) AS k(batch_id)
        LEFT JOIN LATERAL (
              SELECT COUNT(*)                                                  AS issued,
                     COUNT(*) FILTER (WHERE c.lcp_status = 'REDEEMED')         AS redeemed
                FROM sales.loyalty_coupon c
               WHERE c.lcp_lcb_id     = k.batch_id
                 AND c.lcp_is_deleted = false
             ) s ON true
       WHERE b.lcb_id = k.batch_id`;
    }
    async schemeItems(tx, lscId) {
        const rows = await tx.$queryRaw `
      SELECT lsi_id, lsi_kind, lsi_item_id, lsi_group_id, lsi_category_id,
             lsi_brand_id, lsi_section_id, lsi_is_exclude, lsi_factor,
             lsi_points, lsi_max_points, lsi_match_priority
        FROM sales.loyalty_scheme_item
       WHERE lsi_lsc_id     = ${lscId}::uuid
         AND lsi_is_deleted = false
         AND lsi_is_active  = true`;
        return rows.map((r) => ({
            id: r.lsi_id,
            kind: r.lsi_kind,
            itemId: r.lsi_item_id,
            groupId: r.lsi_group_id,
            categoryId: r.lsi_category_id,
            brandId: r.lsi_brand_id,
            sectionId: r.lsi_section_id,
            isExclude: r.lsi_is_exclude,
            factor: numOrNull(r.lsi_factor),
            points: numOrNull(r.lsi_points),
            maxPoints: numOrNull(r.lsi_max_points),
            matchPriority: r.lsi_match_priority ?? 0,
        }));
    }
    async schemeSlabs(tx, lscId) {
        const rows = await tx.$queryRaw `
      SELECT lss_id, lss_item_id, lss_exceeds, lss_upto, lss_each,
             lss_points, lss_factor, lss_max_points
        FROM sales.loyalty_scheme_slab
       WHERE lss_lsc_id     = ${lscId}::uuid
         AND lss_is_deleted = false
         AND lss_is_active  = true
       ORDER BY lss_exceeds NULLS FIRST, lss_slno`;
        return rows.map((r) => ({
            id: r.lss_id,
            itemId: r.lss_item_id,
            exceeds: numOrNull(r.lss_exceeds),
            upto: numOrNull(r.lss_upto),
            each: numOrNull(r.lss_each),
            points: numOrNull(r.lss_points),
            factor: numOrNull(r.lss_factor),
            maxPoints: numOrNull(r.lss_max_points),
        }));
    }
    async reversedIds(tx, ids) {
        if (ids.length === 0) {
            return new Set();
        }
        const rows = await tx.$queryRaw `
      SELECT DISTINCT lld_reversal_of_id
        FROM sales.loyalty_ledger
       WHERE lld_reversal_of_id = ANY(${ids}::uuid[])
         AND lld_is_deleted = false`;
        return new Set(rows.map((r) => r.lld_reversal_of_id));
    }
    async maxRowNos(tx, doc) {
        const rows = await tx.$queryRaw `
      SELECT lld_txn_type, MAX(lld_row_no)::int AS max_row_no
        FROM sales.loyalty_ledger
       WHERE lld_src_doc_type = ${doc.docType}
         AND lld_src_doc_id   = ${doc.docId}::uuid
         AND lld_acc_year     = ${doc.accYear}::char(9)
         AND lld_is_deleted   = false
       GROUP BY lld_txn_type`;
        return new Map(rows.map((r) => [r.lld_txn_type, Number(r.max_row_no)]));
    }
};
exports.LoyaltyLedgerService = LoyaltyLedgerService;
exports.LoyaltyLedgerService = LoyaltyLedgerService = LoyaltyLedgerService_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [prisma_service_1.PrismaService])
], LoyaltyLedgerService);
const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
function toScheme(r) {
    return {
        lscId: r.lsc_id,
        code: r.lsc_code,
        name: r.lsc_name,
        type: r.lsc_type,
        priority: r.lsc_priority,
        applyOn: r.lsc_apply_on,
        amountType: r.lsc_calc_on_amount_type,
        includeTax: r.lsc_include_tax,
        billType: r.lsc_bill_type,
        itemScope: r.lsc_item_scope,
        branchScope: r.lsc_branch_scope,
        custScope: r.lsc_cust_scope,
        minBillAmount: Number(r.lsc_min_bill_amount ?? 0),
        maxEarnPoints: numOrNull(r.lsc_max_earn_points),
        earnOnDiscounted: r.lsc_earn_on_discounted,
        earnOnCharges: r.lsc_earn_on_charges,
        earnWithRedeem: r.lsc_earn_with_redeem,
        rounding: r.lsc_rounding_method,
        pointsDecimals: r.lsc_points_decimals ?? 0,
        allowPointRedeem: r.lsc_allow_point_redeem,
        redeemValuePerPoint: Number(r.lsc_redeem_value_per_point ?? 0),
        minRedeemPoints: Number(r.lsc_min_redeem_points ?? 0),
        maxRedeemPoints: numOrNull(r.lsc_max_redeem_points),
        maxRedeemPerc: numOrNull(r.lsc_max_redeem_perc),
        redeemMinBillAmount: Number(r.lsc_redeem_min_bill_amount ?? 0),
        redeemMultiple: numOrNull(r.lsc_redeem_multiple),
        redeemTenderId: r.lsc_redeem_tender_id,
        expiryBasis: r.lsc_expiry_basis,
        pointsValidDays: r.lsc_points_valid_days,
        activationDays: r.lsc_activation_days ?? 0,
        returnMode: r.lsc_return_mode,
        startDate: dateStr(r.lsc_start_date),
        endDate: dateStr(r.lsc_end_date),
        poolMode: r.lsc_pool_mode,
        allowCrossBranchRedeem: r.lsc_allow_cross_branch_redeem,
    };
}
const KIND_SPECIFICITY = {
    ITEM: 5,
    ITEM_GROUP: 4,
    ITEM_CATEGORY: 3,
    ITEM_BRAND: 2,
    ITEM_SECTION: 1,
};
function ruleMatchesLine(rule, line) {
    switch (rule.kind) {
        case 'ITEM':
            return rule.itemId !== null && rule.itemId === line.itemId;
        case 'ITEM_GROUP':
            return rule.groupId !== null && rule.groupId === line.groupId;
        case 'ITEM_CATEGORY':
            return rule.categoryId !== null && rule.categoryId === line.categoryId;
        case 'ITEM_BRAND':
            return rule.brandId !== null && rule.brandId === line.brandId;
        case 'ITEM_SECTION':
            return rule.sectionId !== null && rule.sectionId === line.sectionId;
        default:
            return false;
    }
}
function matchItemRule(line, rules) {
    const hits = rules.filter((r) => !r.isExclude && ruleMatchesLine(r, line));
    if (hits.length === 0) {
        return null;
    }
    return hits.sort((a, b) => b.matchPriority - a.matchPriority ||
        (KIND_SPECIFICITY[b.kind] ?? 0) - (KIND_SPECIFICITY[a.kind] ?? 0))[0];
}
function excludedByItemRule(line, rules) {
    return rules.some((r) => r.isExclude && ruleMatchesLine(r, line));
}
function matchSlab(base, slabs, itemId) {
    const hits = slabs.filter((s) => (s.itemId === null || s.itemId === itemId) &&
        (s.exceeds === null || base > s.exceeds) &&
        (s.upto === null || base <= s.upto));
    if (hits.length === 0) {
        return null;
    }
    return hits.sort((a, b) => (b.itemId ? 1 : 0) - (a.itemId ? 1 : 0))[0];
}
function award(base, rule) {
    let p = 0;
    if (rule.each && rule.each > 0) {
        p = Math.floor(base / rule.each) * (rule.points ?? 0);
    }
    else if (rule.points && rule.points > 0) {
        p = rule.points;
    }
    else if (rule.factor && rule.factor > 0) {
        p = base * rule.factor;
    }
    if (rule.maxPoints !== null && rule.maxPoints !== undefined && rule.maxPoints > 0) {
        p = Math.min(p, rule.maxPoints);
    }
    return p;
}
function lotExpiry(scheme, docDate) {
    const d = new Date(`${docDate}T00:00:00Z`);
    switch (scheme.expiryBasis) {
        case 'EARN_DATE':
            return addDays(docDate, scheme.pointsValidDays ?? 0);
        case 'MONTH_END':
            return isoDate(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 0)));
        case 'YEAR_END':
            return d.getUTCMonth() + 1 >= 4
                ? `${d.getUTCFullYear() + 1}-03-31`
                : `${d.getUTCFullYear()}-03-31`;
        case 'SCHEME_END_DATE':
            return scheme.endDate;
        default:
            return null;
    }
}
function roundPoints(value, method, decimals) {
    const f = Math.pow(10, Math.max(0, decimals));
    switch (method) {
        case 'FLOOR':
            return Math.floor(value * f) / f;
        case 'CEIL':
            return Math.ceil(value * f) / f;
        case 'NONE':
            return value;
        default:
            return Math.round(value * f) / f;
    }
}
function round(value, decimals) {
    const f = Math.pow(10, decimals);
    return Math.round((value + Number.EPSILON * Math.sign(value || 1)) * f) / f;
}
function dec(value, decimals) {
    return round(value, decimals).toFixed(decimals);
}
function numOrNull(v) {
    return v === null || v === undefined ? null : Number(v);
}
function clamp01(v) {
    return Math.min(1, Math.max(0, v));
}
function isoDate(d) {
    return d.toISOString().slice(0, 10);
}
function dateStr(d) {
    return d === null ? null : isoDate(d);
}
function addDays(date, days) {
    const d = new Date(`${date}T00:00:00Z`);
    d.setUTCDate(d.getUTCDate() + days);
    return isoDate(d);
}
function today() {
    return isoDate(new Date());
}
function deterministicUuid(seed) {
    const hex = (0, node_crypto_1.createHash)('md5').update(seed, 'utf8').digest('hex');
    return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}
//# sourceMappingURL=loyalty-ledger.service.js.map