import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalDateString, RequiredUuid } from 'src/common/dto/dtoDecorators';

/**
 * §4.1 / §4.2 / R-B4 / R-B6 — the read queries. The receipt's, verbatim where
 * the question is the same: the four keys and a direction; a party, a date
 * and an amount. Nothing about those changes when the money goes the other
 * way, so the DTO classes are the receipt's own.
 */
export {
  AdjacentVoucherQueryDto,
  DuplicateCheckQueryDto,
  PartyContextQueryDto,
} from '../../receipt/dto/open-item.dto';

/**
 * §4.1 — `GET /payments/open-items`. The receipt's query less `mobile`
 * (notes 62 D3): that filter is the receipt's temporary-credit lookup, which
 * has no payment side, and a filter the route accepts and then ignores tells
 * the client its list was narrowed when it was not. Sending it is now a 400,
 * like any other field the route does not take.
 *
 * No branch and no accounting year, for the receipt's reason: bills are
 * partitioned by the year they ORIGINATED in and a supplier is paid for bills
 * raised at every branch.
 */
export class ListPaymentOpenItemsQueryDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The party. A supplier id and an accounts.acc_ledger_master led_id are the same value — ' +
      'pass whichever one the screen is holding.',
  })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    example: '2026-09-14',
    description:
      "The PAYMENT's date, not today. It is what ppdSuggested is aged against (the supplier's " +
      'cash-discount window) and what daysOverdue is measured to. Defaults to today.',
  })
  @OptionalDateString()
  onDate?: string;
}
