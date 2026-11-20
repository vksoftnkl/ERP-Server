import { ApiProperty } from '@nestjs/swagger';
import { MobileReceiptAdjustReason } from '../mobile-receipt-plan';

class MobileReceiptTenderOptionDto {
  @ApiProperty({ format: 'uuid', description: 'Send it as tdTenderId' }) tenderId!: string;
  @ApiProperty({ example: 3, description: 'Send it as tdTenderTypeId' }) typeId!: number;
  @ApiProperty({
    example: 'UPI',
    description:
      "The tender type's name: CASH, CARD, UPI, WALLET, CHEQUE, BANK, VOUCHER, ... (never CREDIT, LOYALTY, TEMP_CR, RRN or ADJUST)",
  })
  typeCode!: string;
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
  @ApiProperty({
    description: 'The row needs tdBankName (with tdRefNo and tdInstrumentDate): true for a cheque',
  })
  requiresBank!: boolean;
}

class MobileReceiptSettingsDto {
  @ApiProperty({
    enum: ['DUE_DATE', 'BILL_DATE'],
    description:
      "accounts.receipt_bill_sort, the company's: the order open bills are listed and filled in",
  })
  receiptBillSort!: string;
  @ApiProperty({
    description:
      "accounts.receipt_salesman_mandatory at the receipt's branch: a receipt must name its collector",
  })
  salesmanMandatory!: boolean;
  @ApiProperty({
    enum: ['ON_RECEIPT', 'ON_CLEARING'],
    description: "accounts.pdc_posting_mode at the receipt's branch",
  })
  pdcPostingMode!: string;
  @ApiProperty({
    description: "accounts.ppd_slabs (the company's) has a slab: open bills carry a ppdSchedule",
  })
  ppdEnabled!: boolean;
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
      'with a ledger, of every type the desktop Receipt screen offers, in display order',
  })
  tenders!: MobileReceiptTenderOptionDto[];
  @ApiProperty({ type: MobileReceiptSettingsDto }) settings!: MobileReceiptSettingsDto;
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
  @ApiProperty({
    example: '500.00',
    description:
      'What this receipt settled on the bill: money and credits, not the discount or round-off',
  })
  amount!: string;
  @ApiProperty({ example: '10.00', description: 'The prompt-payment discount given on the bill' })
  discount!: string;
  @ApiProperty({ example: '0.40', description: 'The round-off given on the bill' })
  roundoff!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: '680.00',
    description: 'What the bill still owes now',
  })
  pendingAmount!: string | null;
}

class MobileReceiptCreditAppliedDto {
  @ApiProperty({ format: 'uuid', description: 'The credit (acc_bill_balance.abl_id)' })
  billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({ example: 'ADV00012' }) docRefno!: string;
  @ApiProperty({ example: '400.00', description: 'How much of it this receipt applied to bills' })
  amount!: string;
  @ApiProperty({
    nullable: true,
    type: String,
    example: '100.00',
    description: 'What the credit still holds now',
  })
  pendingAmount!: string | null;
}

class MobileReceiptPdcVoucherDto {
  @ApiProperty({ format: 'uuid' }) voucherId!: string;
  @ApiProperty({ nullable: true, type: String, example: 'RCT00043' }) voucherRefno!: string | null;
  @ApiProperty({ example: '2026-11-30', description: "The cheque's date (the voucher's)" })
  chequeDate!: string;
  @ApiProperty({ example: '1500.00' }) amount!: string;
}

class MobileReceiptAdjustedDto {
  @ApiProperty({ format: 'uuid', description: 'The bill or the credit' }) billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({ example: 'bil01300' }) docRefno!: string;
  @ApiProperty({ example: '500.00', description: "The phone's amount for it" }) planned!: string;
  @ApiProperty({ example: '300.00', description: 'What was posted on it' }) applied!: string;
  @ApiProperty({
    enum: MobileReceiptAdjustReason,
    description:
      'BILL_SETTLED: the bill was no longer open, nothing posted on it. BILL_REDUCED: it took ' +
      'less (it owed less now, or a credit it was to get was spent). CREDIT_REDUCED: the credit ' +
      'held less, or the bills could not take it all. PDC_ON_CLEARING: reserved, never sent today.',
  })
  reason!: MobileReceiptAdjustReason;
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
  @ApiProperty({
    type: [MobileReceiptCreditAppliedDto],
    description: 'The credits it spends now. Empty once cancelled.',
  })
  creditsApplied!: MobileReceiptCreditAppliedDto[];
  @ApiProperty({
    type: [MobileReceiptPdcVoucherDto],
    description: "Its post-dated cheques' own vouchers, dated the cheque",
  })
  pdcVouchers!: MobileReceiptPdcVoucherDto[];
  @ApiProperty({
    type: [MobileReceiptAdjustedDto],
    description:
      "Where the server settled less than the phone planned (the plan against what the receipt settles now). Empty for an older phone's upload and once cancelled.",
  })
  adjusted!: MobileReceiptAdjustedDto[];
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: "The collector (employee_master.emp_id): the login's employee, or null",
  })
  employeeId!: string | null;
}

export class MobileReceiptCreateSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReceiptCreateResultDto }) data!: MobileReceiptCreateResultDto;
}

class MobilePpdStepDto {
  @ApiProperty({ example: '2026-11-26', description: 'The last receipt date this step applies to' })
  tillDate!: string;
  @ApiProperty({ example: '2.000', description: 'Percent of what is pending' }) perc!: string;
  @ApiProperty({
    example: '13.60',
    description: "That percent of today's pending: the most a discount may be (D4)",
  })
  amount!: string;
}

class MobileOpenBillDto {
  @ApiProperty({ format: 'uuid', description: 'The customer id (= its ledger id)' })
  partyId!: string;
  @ApiProperty({ format: 'uuid', description: 'accounts.acc_bill_balance.abl_id' }) billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({
    enum: ['SALES', 'OPENING', 'INTEREST', 'JOURNAL', 'PURCHASE_RETURN', 'ADVANCE', 'SALES_RETURN'],
  })
  billType!: string;
  @ApiProperty({ example: 'bil01300' }) docRefno!: string;
  @ApiProperty({ example: '2026-11-17' }) docDate!: string;
  @ApiProperty({ nullable: true, type: String, example: '2026-12-17' }) dueDate!: string | null;
  @ApiProperty({ example: '1180.00' }) billAmount!: string;
  @ApiProperty({
    example: '680.00',
    description: 'What it still owes (on a credit: what it still holds, always > 0)',
  })
  pendingAmount!: string;
  @ApiProperty({ example: 0, description: 'Days past the due date on onDate (0 on a credit)' })
  daysOverdue!: number;
  @ApiProperty({ enum: ['BILL', 'ADVANCE', 'SALES_RETURN', 'OPENING_CR', 'JOURNAL_CR'] })
  kind!: string;
  @ApiProperty({
    example: '500.00',
    description: 'billAmount - pendingAmount: already settled (on a credit: already used)',
  })
  paidAmount!: string;
  @ApiProperty({
    example: '0.00',
    description: 'Post-dated cheque money promised against the bill, not yet matured',
  })
  pdcHeld!: string;
  @ApiProperty({
    type: [MobilePpdStepDto],
    description:
      'The prompt-payment discount steps still ahead of onDate. For a receipt dated D take the ' +
      'FIRST step whose tillDate >= D; none = no discount. [] without PPD and on a credit.',
  })
  ppdSchedule!: MobilePpdStepDto[];
}

export class MobileOpenBillsDto {
  @ApiProperty({
    type: [MobileOpenBillDto],
    description:
      'By party, then in /receipts/open-items order within the party (accounts.receipt_bill_sort), then by id',
  })
  items!: MobileOpenBillDto[];
  @ApiProperty({
    description:
      "Every open bill of the company's customers (with withCredits, and every held credit)",
  })
  total!: number;
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

class MobileReceiptChequeDto {
  @ApiProperty({
    nullable: true,
    type: String,
    format: 'uuid',
    description: "The voucher carrying it now: the receipt, or the post-dated cheque's own voucher",
  })
  voucherId!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'RCT00043' }) voucherRefno!: string | null;
  @ApiProperty({ example: '445123' }) instrumentNo!: string;
  @ApiProperty({ example: '2026-11-30' }) chequeDate!: string;
  @ApiProperty({ example: '1500.00' }) amount!: string;
  @ApiProperty({
    enum: ['HELD', 'CLEARED', 'BOUNCED', 'CANCELLED'],
    description:
      'HELD (register HELD or DEPOSITED), CLEARED, BOUNCED, CANCELLED (RETURNED, CANCELLED, REPLACED)',
  })
  status!: string;
  @ApiProperty({
    enum: ['HELD', 'DEPOSITED', 'CLEARED', 'BOUNCED', 'RETURNED', 'CANCELLED', 'REPLACED'],
    description: 'acc_pdc_register.apd_status as is',
  })
  houseStatus!: string;
  @ApiProperty({ description: 'Dated after the receipt' }) isPostDated!: boolean;
}

class MobileReceiptStatusDto {
  @ApiProperty({ format: 'uuid' }) avhClientUuid!: string;
  @ApiProperty({ format: 'uuid' }) avhVoucherId!: string;
  @ApiProperty({ example: '2026-2027' }) avhAccYear!: string;
  @ApiProperty({ nullable: true, type: String, example: 'RCT00042' })
  avhVoucherRefno!: string | null;
  @ApiProperty({ example: 'POSTED', enum: ['POSTED', 'CANCELLED', 'DRAFT', 'APPROVED'] })
  avhVoucherStatus!: string;
  @ApiProperty({ nullable: true, type: String, example: '2026-11-19T09:30:00.000Z' })
  cancelledOn!: string | null;
  @ApiProperty({ nullable: true, type: String }) cancelReason!: string | null;
  @ApiProperty({ type: [MobileReceiptChequeDto] }) pdc!: MobileReceiptChequeDto[];
  @ApiProperty({
    example: '2026-11-19T09:30:00.000Z',
    description: 'The last change to the receipt or one of its cheques',
  })
  updatedOn!: string;
}

export class MobileReceiptStatusPayloadDto {
  @ApiProperty({ type: [MobileReceiptStatusDto], description: 'Oldest change first' })
  items!: MobileReceiptStatusDto[];
  @ApiProperty() total!: number;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({
    example: '2026-11-19T09:25:00.000Z',
    description:
      "This read's time less a five-minute overlap: send it back as `since` (inclusive) next time",
  })
  asOf!: string;
}

export class MobileReceiptStatusSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReceiptStatusPayloadDto }) data!: MobileReceiptStatusPayloadDto;
}
