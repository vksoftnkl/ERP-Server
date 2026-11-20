import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  Allow,
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsBoolean,
  IsIn,
  IsNotEmpty,
  IsOptional,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import {
  NullableDateString,
  NullableStringStrict,
  NullableUuid,
  OptionalDateString,
  OptionalInteger,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { MOBILE_DEVICE_UID_MAX_LENGTH } from '../../item/dto/mobile-item.dto';

/** The four line conditions the phone offers (D3). */
export const MOBILE_RETURN_CONDITIONS = ['RESTOCK', 'DAMAGED', 'EXPIRED', 'SCRAP'] as const;
/** The settle modes a phone return may ask for (D4): never CASH. */
export const MOBILE_RETURN_SETTLE_MODES = ['ADJUST', 'ADVANCE'] as const;

/** One line of a phone return: the item, the qty in its unit and its condition. No money (D2). */
export class MobileReturnLineDto {
  @ApiProperty({ minimum: 1, example: 1 })
  @RequiredInteger(1)
  sriLineNo!: number;

  @ApiPropertyOptional({ minimum: 1, default: 1, description: 'Omitted = 1' })
  @OptionalInteger(1)
  sriSplitNo?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The bill line (billItemId of GET /mobile/returns/bill-lines); a bill return names one',
  })
  @NullableUuid()
  sriBillItemId?: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2026-2027' })
  @NullableStringStrict(9)
  sriBillAccYear?: string | null;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sriItemId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The unit the qty is in (item_unit_conversion.iuc_id)',
  })
  @RequiredUuid()
  sriItemUnitId!: string;

  @ApiProperty({ minimum: 0, exclusiveMinimum: true, example: 2 })
  @RequiredNumber(0.001)
  sriReturnQty!: number;

  @ApiProperty({ enum: MOBILE_RETURN_CONDITIONS })
  @IsIn(MOBILE_RETURN_CONDITIONS)
  sriCondition!: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  sriRemarks?: string | null;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'A no-bill line only: a bill line comes back into the lot it left',
  })
  @NullableStringStrict(100)
  sriBatchNo?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date', description: 'A no-bill line only' })
  @NullableDateString()
  sriExpiryDate?: string | null;
}

/** One bill the phone's Adjust sets the credit off against (D4 / D6). */
export class MobileReturnAdjustmentDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The acc_bill_balance id, as GET /mobile/receipts/open-bills answers billId',
  })
  @RequiredUuid()
  billId!: string;

  @ApiProperty({ example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  billAccYear!: string;

  @ApiProperty({ minimum: 0, example: 250 })
  @RequiredNumber(0)
  amount!: number;
}

/**
 * POST /mobile/returns/create: one sale return made on the phone (VKSMAN,
 * canvas page 6b). Only the keys below are taken: the money, the number, the
 * device, counter, user, salesmen, acc year and status are the server's, and
 * sending one is a 400 VALIDATION_WHITELIST.
 */
export class CreateMobileReturnDto {
  @ApiProperty({
    format: 'uuid',
    description:
      "The phone's own id for this return (uuid v7; also used as srId). Send the same one " +
      'again after a lost answer, or after fixing a SENT_BACK return: never a second return.',
  })
  @RequiredUuid()
  srClientUuid!: string;

  @ApiProperty({ maxLength: MOBILE_DEVICE_UID_MAX_LENGTH })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srCompanyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The branch picked in Switch company (422 MOBILE_BRANCH_NOT_OF_COMPANY). Omitted: the phone's " +
      'Device List branch when it is the company’s, else the company default, else its only branch.',
  })
  @OptionalUuid()
  srBranchId?: string;

  @ApiProperty({ format: 'uuid', description: 'The customer (its ledger id)' })
  @RequiredUuid()
  srCustId!: string;

  @ApiProperty({ description: 'true = against srBillId (D1); false = no bill' })
  @IsBoolean()
  srIsAgainstBill!: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Required when srIsAgainstBill',
  })
  @ValidateIf((o: CreateMobileReturnDto) => o.srIsAgainstBill === true || !!o.srBillId)
  @RequiredUuid()
  srBillId?: string | null;

  @ApiPropertyOptional({
    nullable: true,
    example: '2026-2027',
    description: 'Required when srIsAgainstBill',
  })
  @ValidateIf((o: CreateMobileReturnDto) => o.srIsAgainstBill === true || !!o.srBillAccYear)
  @TrimmedString(9)
  @IsNotEmpty()
  srBillAccYear?: string | null;

  @ApiProperty({
    format: 'uuid',
    description: 'A SALE_RETURN reason of GET /mobile/returns/options',
  })
  @RequiredUuid()
  srReasonId!: string;

  @ApiProperty({ enum: MOBILE_RETURN_SETTLE_MODES })
  @IsIn(MOBILE_RETURN_SETTLE_MODES)
  srSettleMode!: string;

  @ApiPropertyOptional({ format: 'date', description: "Omitted = today (the server's IST date)" })
  @OptionalDateString()
  srReturnDate?: string;

  @ApiProperty({
    maxLength: 30,
    example: 'R3F9A/2627/00005',
    description: "The phone's own number",
  })
  @TrimmedString(30)
  @IsNotEmpty()
  srMobileRefno!: string;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: "The shop's own debit note no.",
  })
  @NullableStringStrict(100)
  srUsrRefno?: string | null;

  @ApiPropertyOptional({ nullable: true, format: 'date' })
  @NullableDateString()
  srUsrRefdate?: string | null;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  srRemarks?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'D5: every line comes back into this godown (a live, active godown of the branch; 422 ' +
      "MOBILE_GODOWN_INVALID). Omitted: a bill line's own godown, a no-bill line the branch default.",
  })
  @OptionalUuid()
  godownId?: string;

  @ApiPropertyOptional({
    type: [MobileReturnAdjustmentDto],
    description:
      'ADJUST only: the bills to set the credit off against, this bill first. Rows that went stale ' +
      'since Sync are re-planned, never refused (D6; replanned[] in the answer). Omitted: the ' +
      "server's split (this bill first, then the Receipt's order). [] = nothing adjusted.",
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => MobileReturnAdjustmentDto)
  adjustments?: MobileReturnAdjustmentDto[];

  @ApiPropertyOptional({
    description: "The phone's own estimate (any JSON). Information only: never compared (D2).",
  })
  @IsOptional()
  @Allow()
  phoneEstimate?: unknown;

  @ApiProperty({ type: [MobileReturnLineDto], minItems: 1 })
  // Listed bottom-up so a missing array reports VALIDATION_IS_ARRAY first.
  @ArrayMaxSize(500)
  @ArrayMinSize(1)
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => MobileReturnLineDto)
  lines!: MobileReturnLineDto[];
}

/** POST /mobile/returns/delete */
export class DeleteMobileReturnDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srClientUuid!: string;

  @ApiProperty({ maxLength: MOBILE_DEVICE_UID_MAX_LENGTH })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srCompanyId!: string;
}

/** GET /mobile/returns/options */
export class MobileReturnOptionsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ maxLength: MOBILE_DEVICE_UID_MAX_LENGTH })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The Switch company branch (422 MOBILE_BRANCH_NOT_OF_COMPANY); omitted = the device rule',
  })
  @OptionalUuid()
  branchId?: string;
}

export const MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE = 50;
export const MOBILE_RETURN_BILLS_MAX_PAGE_SIZE = 200;

/** GET /mobile/returns/bill-lines */
export class MobileReturnBillLinesQueryDto extends MobileReturnOptionsQueryDto {
  @ApiPropertyOptional({
    format: 'date',
    example: '2026-08-22',
    description: 'The first bill date to read (YYYY-MM-DD). Omitted: today less billDays.',
  })
  @OptionalDateString()
  since?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MOBILE_RETURN_BILLS_MAX_PAGE_SIZE,
    default: MOBILE_RETURN_BILLS_DEFAULT_PAGE_SIZE,
    description: 'Bills per page (each with all its lines)',
  })
  @OptionalInteger(1, MOBILE_RETURN_BILLS_MAX_PAGE_SIZE)
  pageSize?: number;
}

export const MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE = 200;
export const MOBILE_RETURN_STATUS_MAX_PAGE_SIZE = 500;

/** GET /mobile/returns/status */
export class MobileReturnStatusQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ maxLength: MOBILE_DEVICE_UID_MAX_LENGTH })
  @TrimmedString(MOBILE_DEVICE_UID_MAX_LENGTH)
  @IsNotEmpty()
  deviceUid!: string;

  @ApiPropertyOptional({
    example: '2026-11-20T10:15:00.000Z',
    description:
      'Only returns changed at or after this instant (send the last asOf). Omitted: all.',
  })
  @OptionalDateString()
  since?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MOBILE_RETURN_STATUS_MAX_PAGE_SIZE,
    default: MOBILE_RETURN_STATUS_DEFAULT_PAGE_SIZE,
  })
  @OptionalInteger(1, MOBILE_RETURN_STATUS_MAX_PAGE_SIZE)
  pageSize?: number;
}
