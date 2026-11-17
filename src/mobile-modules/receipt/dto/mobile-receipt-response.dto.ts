import { ApiProperty } from '@nestjs/swagger';

class MobileReceiptTenderOptionDto {
  @ApiProperty({ format: 'uuid', description: 'Send it as tdTenderId' }) tenderId!: string;
  @ApiProperty({ example: 3, description: 'Send it as tdTenderTypeId' }) typeId!: number;
  @ApiProperty({ enum: ['CASH', 'CARD', 'UPI', 'WALLET', 'CHEQUE', 'BANK'] }) typeCode!: string;
  @ApiProperty({ example: 'UPI' }) name!: string;
  @ApiProperty({ nullable: true, type: String }) shortName!: string | null;
  @ApiProperty({
    description:
      'The row needs tdRefNo. A CHEQUE always does, and tdBankName and tdInstrumentDate too; a ' +
      "card's reference is its last 4 digits",
  })
  needsRef!: boolean;
  @ApiProperty({ nullable: true, type: String, example: 'UTR No' }) refLabel!: string | null;
  @ApiProperty() isDefault!: boolean;
  @ApiProperty({
    example: '1.000',
    description:
      'Surcharge the customer pays for this tender, INSIDE tdAmount (200 by UPI at 1% is tdAmount 202.00, of which 2.00 is surcharge and settles no bill)',
  })
  surchargePerc!: string;
  @ApiProperty({ example: '0.00', description: 'Flat surcharge when there is no percentage' })
  surchargeAmount!: string;
}

export class MobileReceiptOptionsDto {
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({
    format: 'uuid',
    description:
      "The branch the phone's receipts for this company land in: the phone's own branch when " +
      "it belongs to the company, else the company's default branch, else its only branch",
  })
  branchId!: string;
  @ApiProperty({
    type: [MobileReceiptTenderOptionDto],
    description:
      "The company's live, active tenders of that branch (or of every branch) in force today, " +
      'with a ledger, of type CASH / CARD / UPI / WALLET / CHEQUE / BANK, in display order',
  })
  tenders!: MobileReceiptTenderOptionDto[];
}

export class MobileReceiptOptionsSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReceiptOptionsDto }) data!: MobileReceiptOptionsDto;
}

class MobileReceiptAllocationDto {
  @ApiProperty({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id' }) billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({ example: 'bil01234', description: "The bill's number" }) docRefno!: string;
  @ApiProperty({ example: '500.00', description: 'What this receipt settled on the bill' })
  amount!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: '680.00',
    description: 'What the bill still owes now',
  })
  pendingAmount!: string | null;
}

export class MobileReceiptCreateResultDto {
  @ApiProperty({ format: 'uuid' }) avhVoucherId!: string;
  @ApiProperty({ format: 'uuid' }) avhCompanyId!: string;
  @ApiProperty({ format: 'uuid' }) avhBranchId!: string;
  @ApiProperty({ example: '2026-2027' }) avhAccYear!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: 'RCT00042',
    description: "VK Nex's receipt number. Store it on the phone.",
  })
  avhVoucherRefno!: string | null;
  @ApiProperty({ nullable: true, type: String, description: "The phone's own number, as sent" })
  avhUsrRefno!: string | null;
  @ApiProperty({ example: '2026-11-17' }) avhVoucherDate!: string;
  @ApiProperty({ example: '1000.00', description: 'Σ tdAmount' }) avhDocAmount!: string;
  @ApiProperty({
    example: 'POSTED',
    description: 'Now: POSTED when just saved; a resend reads the stored one (CANCELLED)',
  })
  avhVoucherStatus!: string;
  @ApiProperty({
    type: [MobileReceiptAllocationDto],
    description:
      'The bills it settles now, in the order the money filled them (open-items order). Empty once cancelled.',
  })
  allocations!: MobileReceiptAllocationDto[];
  @ApiProperty({
    example: '320.00',
    description: 'What it holds on account (its ADVANCE bill); 0.00 when the bills took it all',
  })
  onAccount!: string;
  @ApiProperty({ description: 'true = saved before under this avhClientUuid; nothing written now' })
  duplicate!: boolean;
  @ApiProperty({ description: 'A resend of a receipt the office has since deleted' })
  avhIsDeleted!: boolean;
}

export class MobileReceiptCreateSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReceiptCreateResultDto }) data!: MobileReceiptCreateResultDto;
}

class MobileOpenBillDto {
  @ApiProperty({ format: 'uuid', description: 'The customer id (= its ledger id)' })
  partyId!: string;
  @ApiProperty({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id' }) billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({ enum: ['SALES', 'OPENING', 'INTEREST', 'JOURNAL', 'PURCHASE_RETURN'] })
  billType!: string;
  @ApiProperty({ example: 'bil01300' }) docRefno!: string;
  @ApiProperty({ example: '2026-11-17' }) docDate!: string;
  @ApiProperty({ nullable: true, type: String, example: '2026-12-17' }) dueDate!: string | null;
  @ApiProperty({ example: '1180.00' }) billAmount!: string;
  @ApiProperty({ example: '680.00', description: 'What it still owes' }) pendingAmount!: string;
  @ApiProperty({ example: 0, description: 'Days past the due date on onDate' })
  daysOverdue!: number;
}

export class MobileOpenBillsDto {
  @ApiProperty({
    type: [MobileOpenBillDto],
    description:
      'By party, then in /receipts/open-items order within the party (accounts.receipt_bill_sort), then by id',
  })
  items!: MobileOpenBillDto[];
  @ApiProperty({ description: 'Every open bill of the company' }) total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({ example: '2026-11-17', description: 'The day daysOverdue is measured on' })
  onDate!: string;
}

export class MobileOpenBillsSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileOpenBillsDto }) data!: MobileOpenBillsDto;
}
