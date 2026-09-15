import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalDateString, RequiredUuid } from 'src/common/dto/dtoDecorators';

/**
 * §4.1 — `GET /receipts/open-items`.
 *
 * ── ONE partyId ──────────────────────────────────────────────────────────
 * A customer id, a supplier id and a ledger id are the SAME VALUE in this
 * database. A customer is created by copying the new ledger's `led_id` into
 * `cus_id` — CustomerService.create says so in as many words, "reuse its
 * led_id as the customer's cus_id so the two masters share one identity" — and
 * `purchase.suppliers` does the same. So there is nothing to resolve, no
 * bridge column, and no 404 for a party whose bridge was never filled in: a
 * partyId that names no live ledger simply is not a party, and `loadParty`
 * says exactly that.
 *
 * ── No branch and no accounting year ─────────────────────────────────────
 * Both omissions are deliberate and both are the same reason:
 * `acc_bill_balance` is partitioned by the year a bill ORIGINATED in and is
 * never carried forward, so filtering on this year's partition would hide
 * every bill raised before it — which, given that clients run year-end
 * generation on 1 April and then key the March receipts they missed, is
 * guaranteed to be most of what the operator is looking for. The branch is
 * left out for the matching reason: a customer pays one cheque for bills
 * raised at three branches.
 */
export class ListOpenItemsQueryDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The party. A customer id, a supplier id and an accounts.acc_ledger_master led_id are the ' +
      'same value — pass whichever one the screen is holding.',
  })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    example: '2026-09-14',
    description:
      "The RECEIPT's date, not today. It is what ppdSuggested is aged against and what " +
      'daysOverdue is measured to, so a receipt being keyed for last Friday must send last ' +
      'Friday or it will be offered a discount the customer has lost. Defaults to today.',
  })
  @OptionalDateString()
  onDate?: string;
}

/** §4.2 — `GET /receipts/party-context`. Read-only; no paging needed. */
export class PartyContextQueryDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The party — the same id as the customer or supplier.',
  })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;
}
