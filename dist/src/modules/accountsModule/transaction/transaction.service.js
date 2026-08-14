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
exports.TransactionService = void 0;
const common_1 = require("@nestjs/common");
const pg_service_1 = require("../../../database/pg/pg.service");
const transaction_api_types_1 = require("./types/transaction-api.types");
let TransactionService = class TransactionService {
    pg;
    constructor(pg) {
        this.pg = pg;
    }
    async getPartyAdjustableCredits(query) {
        const { rows } = await this.pg.query(ADJUSTABLE_CREDITS_SQL, [
            query.partyId,
            query.companyId,
            ADJUSTABLE_BILL_TYPES,
        ]);
        return rows.map((row) => toAdjustableCredit(row));
    }
};
exports.TransactionService = TransactionService;
exports.TransactionService = TransactionService = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [pg_service_1.PgService])
], TransactionService);
const ADJUSTABLE_BILL_TYPES = Object.values(transaction_api_types_1.AdjustableCreditBillType);
function toAdjustableCredit(row) {
    const billType = row.abl_bill_type;
    const routing = transaction_api_types_1.CREDIT_ADJUSTMENT_ROUTING[billType];
    return {
        billId: row.abl_id,
        billAccYear: row.abl_acc_year,
        billType,
        docRefno: row.abl_doc_refno,
        docDate: row.abl_doc_date,
        billAmount: Number(row.abl_bill_amount),
        pendingAmount: Number(row.abl_pending_amount),
        status: row.abl_status,
        srcModule: row.abl_src_module,
        srcDocType: row.abl_src_doc_type,
        srcDocId: row.abl_src_doc_id,
        srcAccYear: row.abl_src_acc_year,
        narration: row.abl_narration,
        adjType: routing.adjType,
        settlementMode: routing.settlementMode,
    };
}
const ADJUSTABLE_CREDITS_SQL = `
SELECT
    abl_id,                 -- the key the adjustment posts against
    -- The routing column. Not decoration and not droppable after filtering:
    -- every row carries it back because it decides how that row settles
    -- (ADVANCE -> ADVANCE_ADJUST/ADVANCE, SALES_RETURN -> NOTE_ADJUST/CREDIT_NOTE).
    -- That is what lets ONE tender row hold a mixed set instead of needing a
    -- separate row per kind of credit.
    abl_bill_type,
    abl_doc_refno,          -- "SO-2201" / "SR-4412"
    abl_doc_date,
    abl_bill_amount,        -- face value — tooltip only, the panel shows what is LEFT
    abl_pending_amount,     -- GENERATED: bill - alloc - disc - writeoff
    abl_status,             -- OPEN | PARTIAL  (GENERATED; CLOSED is filtered out)
    -- The FY the credit originated in. The bill is keyed on (id, year), so this
    -- travels with abl_id into abj_bill_acc_year.
    abl_acc_year,
    -- Which document this credit came from. abl_src_doc_id is the sale order
    -- (or sale return) id, and it is what the bill screen matches on to
    -- pre-fill the panel automatically when an order is imported.
    abl_src_module,
    abl_src_doc_type,
    abl_src_doc_id,
    abl_src_acc_year,
    abl_narration
FROM   accounts.acc_bill_balance
WHERE  abl_party_id      = $1::uuid
  AND  abl_company_id    = $2::uuid
  AND  abl_is_deleted    = false
  AND  abl_is_active     = true

  -- CR = payable = the company owes the party. Required alongside the type
  -- filter, not instead of it: ADVANCE is bidirectional in this schema (a
  -- SUPPLIER advance is money paid out, and lands DR). Without this, a party
  -- who is both customer and supplier would offer their own supplier advances
  -- as settlement for a sales invoice.
  AND  abl_dr_cr         = 'CR'

  -- OPENING and JOURNAL credits are deliberately NOT offered yet — see
  -- AdjustableCreditBillType, which is where this list comes from.
  AND  abl_bill_type     = ANY($3::text[])

  -- Uses the partial predicate on ix_abl_open (WHERE abl_pending_amount <> 0).
  -- ">" rather than "<>" because ck_abl_settled already keeps allocations at or
  -- below the bill, so a CR credit can never be negative — and if one ever is,
  -- it is a bug to investigate, not a line to offer the cashier.
  AND  abl_pending_amount > 0

-- Oldest first: FIFO is what the ageing report assumes, what ix_abl_open is
-- keyed for, and what a customer expects of their own money. The refno
-- tie-break is not cosmetic — two credits dated the same day must not swap
-- places between two fetches, or the auto-prefill on import lands on a
-- different row than the operator last saw.
ORDER BY abl_doc_date, abl_doc_refno
`;
//# sourceMappingURL=transaction.service.js.map