import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

// ── options ───────────────────────────────────────────────────────────────

class MobileReturnReasonDto {
  @ApiProperty({ format: 'uuid', description: 'Send it as srReasonId' }) reasonId!: string;
  @ApiProperty({ example: 'SR_DAMAGED' }) code!: string;
  @ApiProperty({ example: 'Damaged / leaking' }) name!: string;
  @ApiProperty({ nullable: true, enum: ['RESTOCK', 'DAMAGED', 'EXPIRED', 'SCRAP'] })
  defaultCondition!: string | null;
  @ApiProperty({
    nullable: true,
    type: Boolean,
    description: "Whether the bill's charges come back by default",
  })
  refundCharges!: boolean | null;
  @ApiProperty({
    description: 'A claim reason (code ends in _SHOP): the office only (D8); hide it',
  })
  isClaim!: boolean;
  @ApiProperty({ example: 410 }) sortOrder!: number;
}

class MobileReturnGodownDto {
  @ApiProperty({ format: 'uuid', description: 'Send it as godownId' }) godownId!: string;
  @ApiProperty({ example: 'Coimbatore' }) name!: string;
  @ApiProperty({ description: "The branch's default godown" }) isDefault!: boolean;
}

class MobileReturnSettingsDto {
  @ApiProperty({ example: 0, description: 'sales.return_window_days (0 = none)' })
  returnWindowDays!: number;
  @ApiProperty({ description: 'sales.free_return_allowed (D1)' }) freeReturnAllowed!: boolean;
  @ApiProperty({ nullable: true, enum: ['ADJUST', 'ADVANCE'] }) settleDefault!: string | null;
  @ApiProperty({
    nullable: true,
    type: Number,
    description: 'sales.return_expired_lot_days when above 0',
  })
  expiredLotDays!: number | null;
  @ApiProperty({ example: 90, description: 'returnWindowDays when above 0, else 90 (D9)' })
  billDays!: number;
}

class MobileReturnRightsDto {
  @ApiProperty() create!: boolean;
  @ApiProperty({ description: 'Without it every upload is HELD (D7)' }) post!: boolean;
}

export class MobileReturnOptionsDto {
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ type: [MobileReturnReasonDto] }) reasons!: MobileReturnReasonDto[];
  @ApiProperty({ type: [MobileReturnGodownDto] }) godowns!: MobileReturnGodownDto[];
  @ApiProperty({ type: MobileReturnSettingsDto }) settings!: MobileReturnSettingsDto;
  @ApiProperty({
    type: MobileReturnRightsDto,
    nullable: true,
    description: 'Menu 13; null without a token',
  })
  rights!: MobileReturnRightsDto | null;
}

export class MobileReturnOptionsSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReturnOptionsDto }) data!: MobileReturnOptionsDto;
}

// ── bill-lines ────────────────────────────────────────────────────────────

class MobileReturnBillLineDto {
  @ApiProperty({ format: 'uuid', description: 'Send it as sriBillItemId' }) billItemId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty() lineNo!: number;
  @ApiProperty({ format: 'uuid' }) itemId!: string;
  @ApiProperty({ nullable: true, type: String }) itemName!: string | null;
  @ApiProperty({ format: 'uuid' }) itemUnitId!: string;
  @ApiProperty({ nullable: true, type: String }) unitName!: string | null;
  @ApiProperty({ nullable: true, type: Number }) toBaseFactor!: number | null;
  @ApiProperty({ nullable: true, type: Number }) billQty!: number | null;
  @ApiProperty({ nullable: true, type: Number }) billQtyBase!: number | null;
  @ApiProperty({ nullable: true, type: Number, description: 'What POSTED returns took' })
  returnedQtyBase!: number | null;
  @ApiProperty({ nullable: true, type: Number }) qtyLeftBase!: number | null;
  @ApiProperty({ nullable: true, type: Number, description: 'What DRAFT returns hold (INFO only)' })
  onOtherDraftsBase!: number | null;
  @ApiProperty({
    nullable: true,
    type: String,
    example: '84.7458',
    description: 'Taxable value per base unit after every discount, 4 decimals',
  })
  ratePreTaxBase!: string | null;
  @ApiProperty({ nullable: true, type: String, example: '100.00' }) rate!: string | null;
  @ApiProperty({ example: '18.000' }) taxPerc!: string;
  @ApiProperty({ example: '9.000' }) cgstPerc!: string;
  @ApiProperty({ example: '9.000' }) sgstPerc!: string;
  @ApiProperty({ example: '0.000' }) igstPerc!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) lotId!: string | null;
  @ApiProperty({ nullable: true, type: String }) batchNo!: string | null;
  @ApiProperty({ nullable: true, type: String, format: 'date' }) expiryDate!: string | null;
  @ApiProperty({ format: 'uuid' }) godownId!: string;
  @ApiProperty() isFree!: boolean;
  @ApiProperty({ description: 'item_allow_sales_return' }) allowReturn!: boolean;
}

class MobileReturnBillDto {
  @ApiProperty({ format: 'uuid', description: 'Send it as srBillId' }) sbId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty({ nullable: true, type: String, example: 'bil05286' }) refno!: string | null;
  @ApiProperty({ example: '2026-11-20' }) date!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) custId!: string | null;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ example: '3011.00' }) billAmount!: string;
  @ApiProperty({ example: '3011.00' }) due!: string;
  @ApiProperty({ nullable: true, type: String }) payMode!: string | null;
  @ApiProperty({ example: '0.00' }) returnedAmt!: string;
  @ApiProperty({ enum: ['NONE', 'PARTIAL', 'FULL'] }) returnStatus!: string;
  @ApiProperty({ type: [MobileReturnBillLineDto] }) lines!: MobileReturnBillLineDto[];
}

export class MobileReturnBillLinesDto {
  @ApiProperty({ example: '2026-11-20T11:52:10.123Z' }) asOf!: string;
  @ApiProperty({ example: 90 }) billDays!: number;
  @ApiProperty({ example: '2026-08-22' }) since!: string;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty({ description: 'Bills, not lines' }) total!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ type: [MobileReturnBillDto] }) bills!: MobileReturnBillDto[];
}

export class MobileReturnBillLinesSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReturnBillLinesDto }) data!: MobileReturnBillLinesDto;
}

// ── create ────────────────────────────────────────────────────────────────

class MobileReturnUserWordingDto {
  @ApiProperty() title!: string;
  @ApiProperty() line!: string;
  @ApiProperty() todo!: string;
}

class MobileReturnNoteDto {
  @ApiProperty({ example: 'SALES_RETURN_OVER_QTY' }) code!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ nullable: true, type: String, example: 'sriReturnQty' }) field!: string | null;
  @ApiProperty({ nullable: true, type: Number, example: 1 }) line!: number | null;
  @ApiPropertyOptional({
    type: MobileReturnUserWordingDto,
    description: "The catalogue's plain words",
  })
  user?: MobileReturnUserWordingDto;
}

class MobileReturnTotalsDto {
  @ApiProperty({ example: '2950.00' }) goods!: string;
  @ApiProperty({ example: '450.00' }) tax!: string;
  @ApiProperty({ example: '0.00' }) chargesNet!: string;
  @ApiProperty({ example: '0.00' }) roundOff!: string;
  @ApiProperty({ example: '2950.00' }) creditNote!: string;
}

class MobileReturnAdjustedDto {
  @ApiProperty({ format: 'uuid', description: 'acc_bill_balance id' }) billId!: string;
  @ApiProperty({ example: '2026-2027' }) billAccYear!: string;
  @ApiProperty({ nullable: true, type: String }) refno!: string | null;
  @ApiProperty({ example: '250.00' }) amount!: string;
}

class MobileReturnSettlementDto {
  @ApiProperty({ nullable: true, enum: ['ADJUST', 'ADVANCE'] }) mode!: string | null;
  @ApiProperty({ example: '0.00', description: 'Left on the note as credit' }) credited!: string;
  @ApiProperty({ nullable: true, type: String, example: 'ADJUSTED' }) settleStatus!: string | null;
  @ApiProperty({ type: [MobileReturnAdjustedDto] }) adjusted!: MobileReturnAdjustedDto[];
}

class MobileReturnLineResultDto {
  @ApiProperty() sriLineNo!: number;
  @ApiProperty() sriSplitNo!: number;
  @ApiProperty({ format: 'uuid' }) sriId!: string;
  @ApiProperty({ nullable: true, type: String, enum: ['BILL', 'LAST_SALE', 'TODAY_PRICE'] })
  rateSource!: string | null;
  @ApiProperty({ example: '2500.00' }) taxableAmt!: string;
  @ApiProperty({ example: '450.00' }) taxAmt!: string;
  @ApiProperty({ example: '2950.00' }) netAmt!: string;
  @ApiProperty({ nullable: true, type: String, example: 'SALEABLE' }) bucket!: string | null;
}

class MobileReturnReplannedDto {
  @ApiProperty({ format: 'uuid' }) billId!: string;
  @ApiProperty() billAccYear!: string;
  @ApiProperty({ nullable: true, type: String }) refno!: string | null;
  @ApiProperty({ example: '500.00' }) from!: string;
  @ApiProperty({ example: '320.00' }) to!: string;
  @ApiProperty({ enum: ['BILL_SETTLED', 'BILL_REDUCED', 'NOTE_SMALLER', 'FREED_MONEY'] })
  reason!: string;
}

class MobileReturnApprovalDto {
  @ApiProperty({ enum: ['PENDING', 'APPROVED', 'REJECTED'] }) status!: string;
  @ApiProperty({ nullable: true, type: String }) note!: string | null;
}

export class MobileReturnCreateResultDto {
  @ApiProperty({
    description: 'true = POSTED or CANCELLED already under this uuid: nothing written',
  })
  duplicate!: boolean;
  @ApiProperty({ format: 'uuid' }) srId!: string;
  @ApiProperty({ format: 'uuid' }) srClientUuid!: string;
  @ApiProperty({ nullable: true, type: String, example: 'SRT/2026-2027/D15/00001' })
  srReturnRefno!: string | null;
  @ApiProperty({ nullable: true, type: String, example: 'R3F9A/2627/00005' }) srMobileRefno!:
    | string
    | null;
  @ApiProperty({ example: '2026-2027' }) srAccYear!: string;
  @ApiProperty({ format: 'uuid' }) srBranchId!: string;
  @ApiProperty({ enum: ['DRAFT', 'POSTED', 'CANCELLED'], description: 'The row itself, now' })
  srStatus!: string;
  @ApiProperty({ enum: ['POSTED', 'HELD', 'SENT_BACK'] }) status!: string;
  @ApiProperty({ example: '2950.00' }) srReturnAmt!: string;
  @ApiProperty({ type: MobileReturnTotalsDto }) totals!: MobileReturnTotalsDto;
  @ApiProperty({ type: MobileReturnSettlementDto }) settlement!: MobileReturnSettlementDto;
  @ApiProperty({ type: [MobileReturnLineResultDto] }) lines!: MobileReturnLineResultDto[];
  @ApiProperty({ type: MobileReturnNoteDto, nullable: true }) held!: MobileReturnNoteDto | null;
  @ApiProperty({ type: MobileReturnNoteDto, nullable: true }) refusal!: MobileReturnNoteDto | null;
  @ApiProperty({ type: [MobileReturnNoteDto], description: 'Every refusal of the refused post' })
  refusals!: MobileReturnNoteDto[];
  @ApiProperty({ type: [MobileReturnNoteDto] }) warnings!: MobileReturnNoteDto[];
  @ApiProperty({ type: [MobileReturnReplannedDto] }) replanned!: MobileReturnReplannedDto[];
  @ApiProperty({ type: MobileReturnApprovalDto, nullable: true })
  approval!: MobileReturnApprovalDto | null;
}

export class MobileReturnCreateSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReturnCreateResultDto }) data!: MobileReturnCreateResultDto;
}

// ── delete ────────────────────────────────────────────────────────────────

export class MobileReturnDeleteResultDto {
  @ApiProperty({ description: 'false = VK Nex never saw this uuid' }) deleted!: boolean;
  @ApiProperty({ format: 'uuid' }) srClientUuid!: string;
  @ApiProperty({ nullable: true, type: String, format: 'uuid' }) srId!: string | null;
  @ApiProperty({ nullable: true, type: String }) srReturnRefno!: string | null;
  @ApiProperty({ description: 'true = it was deleted before (a resend of the delete)' })
  duplicate!: boolean;
}

export class MobileReturnDeleteSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReturnDeleteResultDto }) data!: MobileReturnDeleteResultDto;
}

// ── status ────────────────────────────────────────────────────────────────

class MobileReturnStatusDto {
  @ApiProperty({ format: 'uuid' }) srClientUuid!: string;
  @ApiProperty({ format: 'uuid' }) srId!: string;
  @ApiProperty({ example: '2026-2027' }) srAccYear!: string;
  @ApiProperty({ nullable: true, type: String }) srReturnRefno!: string | null;
  @ApiProperty({ enum: ['DRAFT', 'POSTED', 'CANCELLED', 'DELETED'] }) status!: string;
  @ApiProperty({ type: MobileReturnApprovalDto, nullable: true })
  approval!: MobileReturnApprovalDto | null;
  @ApiProperty() revisionNo!: number;
  @ApiProperty({ example: '2950.00' }) srReturnAmt!: string;
  @ApiProperty({ nullable: true, type: String }) settleStatus!: string | null;
  @ApiProperty({ type: [MobileReturnAdjustedDto] }) adjusted!: MobileReturnAdjustedDto[];
  @ApiProperty({ nullable: true, type: String }) cancelledOn!: string | null;
  @ApiProperty({ nullable: true, type: String }) cancelReason!: string | null;
  @ApiProperty() updatedOn!: string;
}

export class MobileReturnStatusPayloadDto {
  @ApiProperty({ description: 'This read less five minutes: send it back as since' }) asOf!: string;
  @ApiProperty() page!: number;
  @ApiProperty() pageSize!: number;
  @ApiProperty() total!: number;
  @ApiProperty() hasMore!: boolean;
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({ type: [MobileReturnStatusDto] }) returns!: MobileReturnStatusDto[];
}

export class MobileReturnStatusSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: MobileReturnStatusPayloadDto }) data!: MobileReturnStatusPayloadDto;
}
