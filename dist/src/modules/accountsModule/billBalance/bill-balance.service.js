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
exports.BillBalanceService = void 0;
const common_1 = require("@nestjs/common");
const module_service_utils_1 = require("../../../common/utils/module-service.utils");
const pg_service_1 = require("../../../database/pg/pg.service");
let BillBalanceService = class BillBalanceService {
    pg;
    constructor(pg) {
        this.pg = pg;
    }
    async getCreditSummary(query) {
        const { partyId } = query;
        const companyId = query.companyId ?? null;
        const branchId = query.branchId ?? null;
        const accYear = query.accYear ?? null;
        const { rows } = await this.pg.query(CREDIT_SUMMARY_SQL, [
            companyId,
            branchId,
            partyId,
        ]);
        const row = rows[0];
        if (!row || !row.party_found) {
            (0, module_service_utils_1.throwAccountsNotFound)('Party not found', 'partyId', companyId
                ? `No active customer found for id ${partyId} under company ${companyId}`
                : `No active customer found for id ${partyId}`);
        }
        const isCreditCheckEnabled = row.credit_check_enabled;
        const availableCreditAmount = isCreditCheckEnabled
            ? toFixedNumber(row.available_credit_amount)
            : null;
        const availableBillCount = isCreditCheckEnabled ? row.available_bill_count : null;
        return {
            partyId,
            partyName: row.party_name,
            accYear,
            asOnDate: row.as_on_date,
            pendingAmount: toFixedNumber(row.pending_amount),
            pendingBillCount: row.pending_bill_count,
            overdueAmount: toFixedNumber(row.overdue_amount),
            overdueBillCount: row.overdue_bill_count,
            oldestOverdueDueDate: row.oldest_overdue_due_date,
            maxOverdueDays: row.max_overdue_days,
            creditAmtLimit: toFixedNumber(row.credit_amt_limit),
            creditBillLimit: row.credit_bill_limit,
            availableCreditAmount,
            availableBillCount,
            isAmtLimitExceeded: availableCreditAmount !== null && availableCreditAmount < 0,
            isBillLimitExceeded: availableBillCount !== null && availableBillCount < 0,
            isCreditCheckEnabled,
        };
    }
};
exports.BillBalanceService = BillBalanceService;
exports.BillBalanceService = BillBalanceService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], BillBalanceService);
function toFixedNumber(value) {
    if (value === null) {
        return 0;
    }
    return typeof value === 'number' ? value : Number(value);
}
const CREDIT_SUMMARY_SQL = `
WITH bill AS (
  SELECT
    -- DR is owed to us, CR is held for the party. Signed, so an advance reduces
    -- the outstanding instead of inflating it.
    COALESCE(SUM(
      CASE WHEN ab.abl_dr_cr = 'DR' THEN ab.abl_pending_amount
           ELSE -ab.abl_pending_amount END
    ), 0)::numeric(18,2)                                                  AS pending_amount,
    COUNT(*) FILTER (WHERE ab.abl_dr_cr = 'DR')::int                      AS pending_bill_count,
    COALESCE(SUM(ab.abl_pending_amount) FILTER (
      WHERE ab.abl_dr_cr = 'DR' AND ab.abl_due_date < CURRENT_DATE
    ), 0)::numeric(18,2)                                                  AS overdue_amount,
    COUNT(*) FILTER (
      WHERE ab.abl_dr_cr = 'DR' AND ab.abl_due_date < CURRENT_DATE
    )::int                                                                AS overdue_bill_count,
    MIN(ab.abl_due_date) FILTER (
      WHERE ab.abl_dr_cr = 'DR' AND ab.abl_due_date < CURRENT_DATE
    )                                                                     AS oldest_overdue_due_date
  FROM accounts.acc_bill_balance ab
  -- Party first: it is the only parameter that is always present, and the only
  -- one ix_abl_party_credit can therefore always lead its scan with.
  WHERE ab.abl_party_id = $3::uuid
    AND ($1::uuid IS NULL OR ab.abl_company_id = $1::uuid)
    AND ($2::uuid IS NULL OR ab.abl_branch_id = $2::uuid)
    AND ab.abl_is_deleted = false
    AND ab.abl_pending_amount > 0
),
cust AS (
  SELECT
    TRUE                                                AS party_found,
    cm.cus_name                                         AS party_name,
    cm.cus_credit_allowed                               AS credit_check_enabled,
    COALESCE(cm.cus_credit_amt_limit, 0)::numeric(18,2) AS credit_amt_limit,
    COALESCE(cm.cus_credit_bill_limit, 0)::int          AS credit_bill_limit
  FROM sales.customers cm
  WHERE cm.cus_id = $3::uuid
    -- With no company given the party resolves unscoped. With one, cus_company_id
    -- is nullable — a customer with no company is shared across them — so NULL
    -- passes while a customer belonging to ANOTHER company misses and 404s.
    AND ($1::uuid IS NULL OR cm.cus_company_id = $1::uuid OR cm.cus_company_id IS NULL)
    AND cm.cus_is_deleted = false
)
SELECT
  CURRENT_DATE                                                     AS as_on_date,
  c.party_found,
  c.party_name,
  COALESCE(c.credit_check_enabled, false)                          AS credit_check_enabled,
  b.pending_amount,
  b.pending_bill_count,
  b.overdue_amount,
  b.overdue_bill_count,
  b.oldest_overdue_due_date,
  COALESCE(CURRENT_DATE - b.oldest_overdue_due_date, 0)::int       AS max_overdue_days,
  COALESCE(c.credit_amt_limit, 0)                                  AS credit_amt_limit,
  COALESCE(c.credit_bill_limit, 0)                                 AS credit_bill_limit,
  (COALESCE(c.credit_amt_limit, 0) - b.pending_amount)             AS available_credit_amount,
  (COALESCE(c.credit_bill_limit, 0) - b.pending_bill_count)        AS available_bill_count
FROM bill b
-- LEFT JOIN, not CROSS: cust returns zero rows for an unknown party, and a
-- CROSS JOIN would collapse the whole result to an empty set — which the
-- service would then have to report as "no outstanding" instead of 404.
LEFT JOIN cust c ON TRUE
`;
//# sourceMappingURL=bill-balance.service.js.map