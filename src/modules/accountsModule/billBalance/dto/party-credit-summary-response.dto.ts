import { ApiProperty } from '@nestjs/swagger';

export class PartyCreditSummaryDto {
  @ApiProperty({ format: 'uuid', example: '0197f3a1-2b4c-7d8e-9f01-23456789abcd' })
  partyId!: string;

  @ApiProperty({ nullable: true, example: 'Sri Balaji Stores' })
  partyName!: string | null;

  @ApiProperty({
    nullable: true,
    example: '2025-2026',
    description:
      'Echoed from the request, null when omitted. Does not scope the outstanding figures below.',
  })
  accYear!: string | null;

  @ApiProperty({
    format: 'date',
    example: '2026-08-11',
    description:
      "The database server's date, which the overdue split was measured against. Read-only — there is no as-on-date parameter; it is reported so the client knows which \"today\" produced these numbers.",
  })
  asOnDate!: string;

  @ApiProperty({
    example: 125000,
    description:
      'Net outstanding — open receivables (DR) less advances and credit notes (CR). Negative when the party is in credit. Exact to two decimals.',
  })
  pendingAmount!: number;

  @ApiProperty({
    example: 12,
    description: 'Open receivables only; advances and credit notes are not bills owed.',
  })
  pendingBillCount!: number;

  @ApiProperty({ example: 45000 })
  overdueAmount!: number;

  @ApiProperty({ example: 4 })
  overdueBillCount!: number;

  @ApiProperty({
    format: 'date',
    nullable: true,
    example: '2026-05-12',
    description: 'Null when nothing is overdue.',
  })
  oldestOverdueDueDate!: string | null;

  @ApiProperty({
    example: 91,
    description: 'asOnDate − oldestOverdueDueDate; 0 when nothing is overdue.',
  })
  maxOverdueDays!: number;

  @ApiProperty({ example: 200000, description: 'customers.cus_credit_amt_limit' })
  creditAmtLimit!: number;

  @ApiProperty({ example: 20, description: 'customers.cus_credit_bill_limit' })
  creditBillLimit!: number;

  @ApiProperty({
    nullable: true,
    example: 75000,
    description:
      'creditAmtLimit − pendingAmount. Deliberately NOT clamped at zero — the negative value is what the entry screen renders as "limit exceeded by ₹X". Null when isCreditCheckEnabled is false.',
  })
  availableCreditAmount!: number | null;

  @ApiProperty({
    nullable: true,
    example: 8,
    description:
      'creditBillLimit − pendingBillCount, not clamped at zero. Null when isCreditCheckEnabled is false.',
  })
  availableBillCount!: number | null;

  @ApiProperty({ example: false })
  isAmtLimitExceeded!: boolean;

  @ApiProperty({ example: false })
  isBillLimitExceeded!: boolean;

  @ApiProperty({
    example: true,
    description:
      'customers.cus_credit_allowed. False means no ceiling is configured for this party: both available* fields come back null and neither exceeded flag can trip.',
  })
  isCreditCheckEnabled!: boolean;
}

export class PartyCreditSummarySuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Party credit summary fetched successfully' })
  message!: string;

  @ApiProperty({ type: PartyCreditSummaryDto })
  data!: PartyCreditSummaryDto;
}
