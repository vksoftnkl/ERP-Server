import { Injectable } from '@nestjs/common';
import { OpenItemsService } from '../receipt/open-items.service';
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
 * Settlement reads over `accounts.acc_bill_balance` — the credit side of it.
 *
 * ── Why this file no longer holds a SELECT ───────────────────────────────
 * It used to carry its own statement over acc_bill_balance. The receipt plan's
 * §12 is explicit that there must be no second SELECT for "what does this party
 * owe and hold" — open-items is it, and party-balance calls it — and the reason
 * is not tidiness: this panel and the receipt screen were free to come to
 * different answers about the same advance, and the first time they did, one of
 * them would have let an advance be spent twice.
 *
 * So the read is `OpenItemsService.loadCredits`, and what is left here is the
 * SHAPE: this endpoint's rows carry `adjType` / `settlementMode` under their old
 * names for the callers that already read them.
 */
@Injectable()
export class TransactionService {
  constructor(private readonly openItemsService: OpenItemsService) {}

  /**
   * Every unspent credit the party holds, oldest first.
   *
   * `query.type` picks the side: CR (the default) is what the company owes the
   * party and what the adjustment panel offers, DR is a supplier advance
   * already paid out. The side is never left unfiltered — ADVANCE is
   * bidirectional in this schema, so a party who is both customer and supplier
   * would otherwise be offered their own supplier advances to settle a sales
   * invoice.
   *
   * Returns `[]` when the party holds nothing — which is also what an unknown
   * party returns. Deliberate: this is a panel feed, and "no credit to offer" is
   * the same screen either way.
   */
  async getPartyAdjustableCredits(
    query: GetPartyAdjustableCreditsDto,
  ): Promise<AdjustableCredit[]> {
    const side = query.type ?? DEFAULT_ADJUSTABLE_CREDIT_SIDE;
    const credits = await this.openItemsService.loadCredits(query.companyId, query.partyId, side);

    // open-items admits exactly the two types this endpoint has always offered
    // (ADVANCE, SALES_RETURN) — CREDIT_BILL_TYPES and AdjustableCreditBillType
    // are the same list — so the narrowing below is a cast, not a filter. The
    // guard stays anyway: the day a third type is admitted there, this is where
    // it has to be admitted here too, and a silent widening would send a
    // billType the routing map has no entry for.
    return credits
      .filter((credit) =>
        (Object.values(AdjustableCreditBillType) as string[]).includes(credit.billType),
      )
      .map((credit) => {
        const billType = credit.billType as unknown as AdjustableCreditBillType;
        const routing = CREDIT_ADJUSTMENT_ROUTING[billType];
        return {
          billId: credit.billId,
          billAccYear: credit.billAccYear,
          billType,
          docRefno: credit.docRefno,
          docDate: credit.docDate,
          billAmount: credit.billAmount,
          pendingAmount: credit.pendingAmount,
          status: credit.status as unknown as AdjustableCreditStatus,
          drCr: credit.drCr as unknown as AdjustableCreditSide,
          srcModule: credit.srcModule,
          srcDocType: credit.srcDocType,
          srcDocId: credit.srcDocId,
          srcAccYear: credit.srcAccYear,
          narration: credit.narration,
          adjType: routing.adjType,
          settlementMode: routing.settlementMode,
        } satisfies AdjustableCredit;
      });
  }
}
