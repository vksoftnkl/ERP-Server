import { Injectable } from '@nestjs/common';
import { PgService } from '../../../database/pg/pg.service';
import { GetPartyAdjustableCreditsDto } from './dto/get-party-adjustable-credits.dto';
import {
  AdjustableCredit,
  AdjustableCreditBillType,
  AdjustableCreditSide,
  AdjustableCreditStatus,
  CREDIT_ADJUSTMENT_ROUTING,
  DEFAULT_ADJUSTABLE_CREDIT_SIDE,
} from './types/transaction-api.types';
/**
 * One row of the credit query. Every monetary column is `numeric(18,2)` and
 * node-pg surfaces `numeric` as a string, so the exact fixed-point value
 * survives the trip out of Postgres untouched by float. `date` columns arrive as
 * `YYYY-MM-DD` text (see PgService's DATE_AS_TEXT).
 */
interface AdjustableCreditRow {
  abl_id: string;
  abl_bill_type: string;
  abl_doc_refno: string;
  abl_doc_date: string;
  abl_bill_amount: string;
  abl_pending_amount: string;
  abl_status: string;
  abl_dr_cr: string;
  abl_acc_year: string;
  abl_src_module: string | null;
  abl_src_doc_type: string | null;
  abl_src_doc_id: string | null;
  abl_src_acc_year: string | null;
  abl_narration: string | null;
}
/**
 * Settlement reads over `accounts.acc_bill_balance` — the credit side of it.
 *
 * `getPartyAdjustableCredits` answers the adjustment panel's one question: what
 * has this party already paid or returned that has not been spent yet, and how
 * does each of those settle. The rows it hands back are what the panel adjusts
 * against and what `acc_bill_adjustment` is then posted from.
 */
@Injectable()
export class TransactionService {
  constructor(private readonly pg: PgService) {}
  /**
   * Every unspent credit the party holds, oldest first.
   *
   * `query.type` picks the side: CR (the default) is what the party is owed and
   * what the adjustment panel offers, DR is what the party owes. The side is
   * never left unfiltered — see the SQL's note on ADVANCE being bidirectional.
   *
   * Returns `[]` when the party holds nothing — which is also what an unknown
   * party returns. Deliberate: this is a panel feed, and "no credit to offer" is
   * the same screen either way. The party is validated where it is chosen (the
   * credit summary 404s on an unknown id); a second existence check here would
   * cost a round-trip on every keystroke to change nothing the operator sees.
   */
  async getPartyAdjustableCredits(
    query: GetPartyAdjustableCreditsDto,
  ): Promise<AdjustableCredit[]> {
    const side = query.type ?? DEFAULT_ADJUSTABLE_CREDIT_SIDE;
    const { rows } = await this.pg.query<AdjustableCreditRow>(ADJUSTABLE_CREDITS_SQL, [
      query.partyId,
      query.companyId,
      ADJUSTABLE_BILL_TYPES,
      side,
    ]);
    return rows.map((row) => toAdjustableCredit(row));
  }
}
/**
 * The bill types the SQL offers, bound as a parameter rather than written into
 * the statement, so {@link AdjustableCreditBillType} stays the single place the
 * list is stated — and admitting a third type cannot leave the enum, the routing
 * map and the query disagreeing.
 */
const ADJUSTABLE_BILL_TYPES: readonly string[] = Object.values(AdjustableCreditBillType);
function toAdjustableCredit(row: AdjustableCreditRow): AdjustableCredit {
  // The WHERE clause admits only the types in ADJUSTABLE_BILL_TYPES, which is
  // the enum itself, so the routing lookup is always a hit.
  const billType = row.abl_bill_type as AdjustableCreditBillType;
  const routing = CREDIT_ADJUSTMENT_ROUTING[billType];
  return {
    billId: row.abl_id,
    billAccYear: row.abl_acc_year,
    billType,
    docRefno: row.abl_doc_refno,
    docDate: row.abl_doc_date,
    billAmount: Number(row.abl_bill_amount),
    pendingAmount: Number(row.abl_pending_amount),
    // Generated column; `abl_pending_amount > 0` has already excluded CLOSED.
    status: row.abl_status as AdjustableCreditStatus,
    // The WHERE clause binds this to the requested side, so the cast is the
    // value that was asked for and not a widening guess.
    drCr: row.abl_dr_cr as AdjustableCreditSide,
    srcModule: row.abl_src_module,
    srcDocType: row.abl_src_doc_type,
    srcDocId: row.abl_src_doc_id,
    srcAccYear: row.abl_src_acc_year,
    narration: row.abl_narration,
    adjType: routing.adjType,
    settlementMode: routing.settlementMode,
  };
}
// $1 party_id, $2 company_id, $3 the admitted bill types, $4 the CR/DR side.
//
// No acc-year filter: acc_bill_balance is partitioned by the year the credit
// ORIGINATED in and is never carried forward, so the read scans every partition
// and each row reports its own abl_acc_year. That is what the table's design
// notes prescribe for outstanding reads, and it is why a March advance can
// settle an April invoice.
//
// Party and company lead the predicate because ix_abl_open is keyed
// (abl_company_id, abl_party_id, abl_doc_date) with the refno, bill amount and
// pending amount INCLUDEd — the same index the ordering below is written for.
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
    abl_dr_cr,              -- echoes the requested side; ADVANCE means different things on each
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

  -- The side, from the "type" parameter — CR when the caller omits it.
  --
  -- CR = payable = the company owes the party; DR = receivable = the party owes
  -- the company. Bound, but never dropped: ADVANCE is bidirectional in this
  -- schema (a SUPPLIER advance is money paid out, and lands DR). Leave the side
  -- unfiltered and a party who is both customer and supplier would offer their
  -- own supplier advances as settlement for a sales invoice — which is why the
  -- DTO defaults the parameter instead of treating "absent" as "both".
  AND  abl_dr_cr         = $4::text

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
