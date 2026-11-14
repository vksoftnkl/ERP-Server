import { ApiProperty, ApiPropertyOptional, OmitType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsNotEmpty,
  IsObject,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import {
  NullableNumber,
  OptionalBoolean,
  OptionalQueryBoolean,
  OptionalUuid,
  RequiredInteger,
  RequiredNumber,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveSaleReturnDto } from './save-sale-return.dto';

export class SaleReturnKeysDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srCompanyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srBranchId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  srAccYear!: string;
}

/** One row of popup 25 — what the operator gives one open bill (D2). */
export class SaleReturnAdjustmentDto {
  @ApiProperty({
    format: 'uuid',
    description: "The bill's acc_bill_balance row (settlement.adjust.bills[].ablId)",
  })
  @RequiredUuid()
  ablId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  ablAccYear!: string;

  @ApiProperty({ description: 'Adjust now (> 0; a 0 row is ignored)' })
  @RequiredNumber()
  amount!: string | number;

  @ApiPropertyOptional({
    nullable: true,
    description:
      'What the screen showed the bill owing. A different figure now → 409 SALES_RETURN_ADJUST_STALE (open popup 25 again).',
  })
  @NullableNumber()
  dueNow?: string | number | null;
}

/** The approval of each gate event the return trips, as /till/approvals answered it (D26). */
const APPROVAL_IDS_DOC = {
  type: 'object',
  additionalProperties: { type: 'string', format: 'uuid' },
  example: { SALE_CLAIM: '019f0000-0000-7000-8000-000000000001' },
  description:
    'event → tapId (SALE_RETURN · SALE_CLAIM · RETURN_NO_RECEIPT · REFUND_CASH). An APPROVED, unused request of this ' +
    'return for that event; left out, the latest one of them is used when there is one.',
} as const;

export class ValidateSaleReturnDto extends SaveSaleReturnDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];

  @ApiPropertyOptional({
    type: () => SaleReturnAdjustmentDto,
    isArray: true,
    description:
      'Adjust (srSettleMode ADJUST): the operator’s split. Omit for the server’s proposal.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleReturnAdjustmentDto)
  adjustments?: SaleReturnAdjustmentDto[];

  @ApiPropertyOptional(APPROVAL_IDS_DOC)
  @IsOptional()
  @IsObject()
  approvalIds?: Record<string, string>;
}

export class PostSaleReturnDto extends SaleReturnKeysDto {
  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @IsString({ each: true })
  overrides?: string[];

  @ApiPropertyOptional({ default: false })
  @OptionalBoolean()
  printAfter?: boolean;

  @ApiPropertyOptional({
    type: () => SaleReturnAdjustmentDto,
    isArray: true,
    description:
      'Adjust (srSettleMode ADJUST): popup 25’s split, this bill first. Omit to take the server’s proposal ' +
      '(/validate preview.settlement.adjust.bills). 422 SALES_RETURN_ADJUST_OVER · 409 SALES_RETURN_ADJUST_STALE.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(200)
  @ValidateNested({ each: true })
  @Type(() => SaleReturnAdjustmentDto)
  adjustments?: SaleReturnAdjustmentDto[];

  @ApiPropertyOptional({
    type: SaveTenderDetailDto,
    isArray: true,
    description:
      'Refund (srSettleMode CASH): popup B’s rows, written over the draft’s before it posts — cash (1), UPI (3) or ' +
      'bank (6); UPI / bank need tdRefNo. Omit to post the rows saved on the draft.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @ValidateNested({ each: true })
  @Type(() => SaveTenderDetailDto)
  tenders?: SaveTenderDetailDto[];

  @ApiPropertyOptional(APPROVAL_IDS_DOC)
  @IsOptional()
  @IsObject()
  approvalIds?: Record<string, string>;
}

export class CancelSaleReturnDto extends SaleReturnKeysDto {
  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  reason!: string;
}

/**
 * srId is required here. OmitType + a fresh declaration, not `declare`: a
 * `declare` keeps the base's optional decorators and drops the required one.
 */
export class AmendSaleReturnDto extends OmitType(ValidateSaleReturnDto, ['srId'] as const) {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srId!: string;

  @ApiProperty()
  @RequiredInteger(1)
  baseRevision!: number;

  @ApiProperty({ maxLength: 250 })
  @TrimmedString(250)
  @IsNotEmpty()
  editRemark!: string;
}

export class SaleReturnTransportDto extends SaleReturnKeysDto {
  @ApiProperty({ type: TransportBandDto })
  @ValidateNested()
  @Type(() => TransportBandDto)
  transport!: TransportBandDto;
}

/** `GET /sale-returns/bill-lines` (plan v5 §6.1 / §6.2). */
export class SaleReturnBillLinesQueryDto {
  @ApiProperty({ format: 'uuid', description: 'The bill (sale_bill.sb_id)' })
  @RequiredUuid()
  sbId!: string;

  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  sbAccYear!: string;

  @ApiProperty({ format: 'uuid', description: 'The return’s company; the bill must be in it' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The return’s branch; the bill must be in it unless allBranches',
  })
  @RequiredUuid()
  branchId!: string;

  @ApiPropertyOptional({
    default: false,
    description: "D14 — another branch's bill (the picker's All branches tick)",
  })
  @OptionalQueryBoolean()
  allBranches?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The return on screen: left out of "on other drafts" and of what earlier returns took',
  })
  @OptionalUuid()
  srId?: string;
}
