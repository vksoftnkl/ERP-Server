import { applyDecorators } from '@nestjs/common';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { IsArray, IsIn, IsNotEmpty, IsOptional, IsUUID, ValidateNested } from 'class-validator';
import {
  NullableDateString,
  NullableInteger,
  NullableNumber,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { SaveChargeDetailDto } from '../../../master/charge-detail/dto/save-charge-detail.dto';
import { SaveTenderDetailDto } from '../../../accountsModule/tenderDetail/dto/save-tender-detail.dto';
import { TransportBandDto } from '../../bill/dto/bill-lifecycle.dto';
import { SaveSaleReturnItemDto } from './save-sale-return-item.dto';

// GENERATED from information_schema for sales.sale_return (2026-09-22) and then
// hand-tuned: every column is accepted so forbidNonWhitelisted never rejects a
// GET echoed back, server-owned columns are ignored on input (see the service),
// and only the keys a new document genuinely needs are required.
const toUuidArray = (value: unknown): string[] | undefined => {
  if (value === undefined) return undefined;
  if (value === null || value === '') return [];
  if (Array.isArray(value)) return value.map((e) => (typeof e === 'string' ? e.trim() : String(e)));
  if (typeof value === 'string')
    return value
      .split(',')
      .map((e) => e.trim())
      .filter((e) => e.length > 0);
  return value as string[];
};
const NullableUuidArray = () =>
  applyDecorators(
    IsOptional(),
    Transform(({ value }: { value: unknown }) => toUuidArray(value)),
    IsArray(),
    IsUUID('all', { each: true }),
  );

/**
 * A charge row of a sale return as the client sends it. Every key of a stored
 * charge row is accepted (a /get echoed back passes the whitelist); the server
 * reads only cdSrcCdId, cdSrcAccYear, giveBack and — under a manual calc type —
 * cdAmount.
 */
export class SaleReturnChargeDto extends SaveChargeDetailDto {
  @ApiPropertyOptional({
    nullable: true,
    description: 'An after-tax addition: false = it stays with us (default true)',
  })
  @OptionalBoolean()
  giveBack?: boolean;
}

export class SaveSaleReturnDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'When provided, updates the existing DRAFT (uuidv7 minted by the client is accepted)',
  })
  @OptionalUuid()
  srId?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srTenantId?: string | null;
  @ApiProperty({ maxLength: 9 })
  @TrimmedString(9)
  @IsNotEmpty()
  srAccYear!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Ignored: the till session is stamped by the server at /post (the posting device’s live session).',
  })
  @NullableUuid()
  srSessionId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srCounterId?: string | null;
  @ApiProperty({ maxLength: 20 })
  @TrimmedString(20)
  @IsNotEmpty()
  srDeviceType!: string;
  @ApiProperty({})
  @TrimmedString()
  @IsNotEmpty()
  srDeviceId!: string;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  @NullableStringStrict(30)
  srDocType?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  srBillMode?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  srReturnSlno?: number | null;
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(100)
  srReturnRefno?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  srUsrRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  srUsrRefdate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  srReturnDate?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  srReturnDatetime?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  srIsAgainstBill?: boolean;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srBillId?: string | null;
  @ApiPropertyOptional({ maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  srBillAccYear?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  srBillRefno?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableDateString()
  srBillDate?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srReasonId?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  srReturnReason?: string | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srCustId!: string;
  @ApiProperty({ maxLength: 200 })
  @TrimmedString(200)
  @IsNotEmpty()
  srCustName!: string;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  srCustAddr?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  srCustPlace?: string | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  srCustPin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  srCustPhone?: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  @NullableStringStrict(15)
  srCustGstin?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  srCustGstType?: string | null;
  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  srCustStcd?: string | null;
  @ApiPropertyOptional({ maxLength: 2, nullable: true })
  @NullableStringStrict(2)
  srPosStcd?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  srStateName?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  srPriceLevel?: number | null;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  srUserId!: string;
  @ApiPropertyOptional({ nullable: true })
  @NullableUuidArray()
  srSalesmanId?: string[];
  @ApiPropertyOptional({ nullable: true })
  @NullableInteger()
  srTotItems?: number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srTotWeight?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srGrossAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srDiscAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srTaxableAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srCgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srSgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srIgstAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srCessAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srTaxAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srOtherAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srRoundOff?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srReturnAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srTotalCost?: string | number | null;
  @ApiPropertyOptional({ maxLength: 10, nullable: true })
  @NullableStringStrict(10)
  srSettleMode?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  srRefundAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  srAdjustedAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  srCreditAmt?: string | number | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(20)
  srSettleStatus?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  srLoyaltyReversePoints?: string | number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableNumber()
  srPromoClawbackAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  srHasLoad?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  srHasUnload?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  srHasFreight?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  srHasPromo?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  srHasLoyalty?: boolean;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srAgentId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srAgentCommAmt?: string | number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srDriverId?: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srSupervisorId?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableUuidArray()
  srLoadmanId?: string[];
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  srVehicleId?: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  srVehicleNo?: string | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srTotBags?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srItemDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srSplDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srSchDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srBillSchDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srCashDisc?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srFreightAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srLoadAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srUnloadAmt?: string | number | null;
  @ApiPropertyOptional({ nullable: true })
  @OptionalBoolean()
  srDiscAlterBase?: boolean;
  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  srRoundOffStep?: string | number | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableStringStrict(500)
  srRemarks?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableStringStrict(20)
  srStatus?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned',
  })
  @NullableUuid()
  srPostedVoucherId?: string | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  srRevisionNo?: number | null;
  @ApiPropertyOptional({ nullable: true, readOnly: true, description: 'Ignored — server-owned' })
  @NullableInteger()
  srPrintCount?: number | null;
  // ── Sale Return screen (plan v5 §5.1, migration 20261113160000) ────────
  @ApiPropertyOptional({
    enum: ['RETURN', 'CLAIM'],
    default: 'RETURN',
    description: 'RETURN = goods come back; CLAIM = damaged / expired at the shop (D23)',
  })
  @IsOptional()
  @IsIn(['RETURN', 'CLAIM'])
  srReturnKind?: string;
  @ApiPropertyOptional({
    maxLength: 12,
    nullable: true,
    readOnly: true,
    description:
      "Server-owned: the bill's sb_freight_calc_type, else sales.freight_calc_type (D20)",
  })
  @NullableStringStrict(12)
  srFreightCalcType?: string | null;
  @ApiPropertyOptional({
    maxLength: 12,
    nullable: true,
    readOnly: true,
    description:
      "Server-owned: the bill's sb_loading_calc_type, else sales.loading_calc_type (D20)",
  })
  @NullableStringStrict(12)
  srLoadingCalcType?: string | null;
  @ApiPropertyOptional({
    maxLength: 10,
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned (D8)',
  })
  @NullableStringStrict(10)
  srGstMode?: string | null;
  @ApiPropertyOptional({
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned (D48)',
  })
  @NullableNumber()
  srPointsBack?: string | number | null;
  @ApiPropertyOptional({
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned (D48)',
  })
  @NullableNumber()
  srPointsBackAmt?: string | number | null;
  @ApiPropertyOptional({
    nullable: true,
    readOnly: true,
    description: 'Ignored — server-owned (D48)',
  })
  @NullableNumber()
  srVoucherShareAmt?: string | number | null;

  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  srCreatedBy?: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  @NullableStringStrict(50)
  srModifiedBy?: string | null;

  @ApiPropertyOptional({ type: SaveSaleReturnItemDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveSaleReturnItemDto)
  items?: SaveSaleReturnItemDto[];

  @ApiPropertyOptional({
    type: () => SaleReturnChargeDto,
    isArray: true,
    description:
      "One row per bill charge the client has a say on, keyed by cdSrcCdId (the bill's cd_id): " +
      'giveBack (an after-tax ADDITION only — deductions always come back, before-tax rows are inside the ' +
      'lines, D46 / D70) and cdAmount (read only when the charge is manual, D20). The server writes the ' +
      "return's charge rows itself; every other key is ignored. Omitted = every addition given back.",
  })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaleReturnChargeDto)
  charges?: SaleReturnChargeDto[];

  @ApiPropertyOptional({ type: SaveTenderDetailDto, isArray: true })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => SaveTenderDetailDto)
  tenders?: SaveTenderDetailDto[];

  @ApiPropertyOptional({
    type: TransportBandDto,
    nullable: true,
    description: 'The transport band, written to public.txn_transport_detail',
  })
  @IsOptional()
  @ValidateNested()
  @Type(() => TransportBandDto)
  transport?: TransportBandDto | null;
}

/** The columns a save copies when present (server-owned ones excluded). */
export const SR_OPTIONAL_FIELDS = [
  'srTenantId',
  // srSessionId is server-owned (SR_SERVER_OWNED): stamped at /post only.
  'srCounterId',
  'srDocType',
  'srBillMode',
  'srUsrRefno',
  'srUsrRefdate',
  'srReturnDate',
  'srReturnDatetime',
  'srIsAgainstBill',
  'srBillId',
  'srBillAccYear',
  'srBillRefno',
  'srBillDate',
  'srReasonId',
  'srReturnReason',
  'srCustAddr',
  'srCustPlace',
  'srCustPin',
  'srCustPhone',
  'srCustGstin',
  'srCustGstType',
  'srCustStcd',
  'srPosStcd',
  'srStateName',
  'srPriceLevel',
  'srSalesmanId',
  'srTotItems',
  'srTotWeight',
  'srGrossAmt',
  'srDiscAmt',
  'srTaxableAmt',
  'srCgstAmt',
  'srSgstAmt',
  'srIgstAmt',
  'srCessAmt',
  'srTaxAmt',
  'srOtherAmt',
  'srRoundOff',
  'srReturnAmt',
  'srTotalCost',
  'srSettleMode',
  'srHasLoad',
  'srHasUnload',
  'srHasFreight',
  'srHasPromo',
  'srHasLoyalty',
  'srAgentId',
  'srAgentCommAmt',
  'srDriverId',
  'srSupervisorId',
  'srLoadmanId',
  'srVehicleId',
  'srVehicleNo',
  'srTotBags',
  'srItemDisc',
  'srSplDisc',
  'srSchDisc',
  'srBillSchDisc',
  'srCashDisc',
  'srFreightAmt',
  'srLoadAmt',
  'srUnloadAmt',
  'srDiscAlterBase',
  'srRoundOffStep',
  'srRemarks',
  'srCreatedBy',
  'srModifiedBy',
  'srReturnKind',
  'srFreightCalcType',
  'srLoadingCalcType',
] as const;
export const SR_DATE_FIELDS = [
  'srUsrRefdate',
  'srReturnDate',
  'srReturnDatetime',
  'srBillDate',
] as const;
export const SR_SERVER_OWNED = [
  'srReturnSlno',
  'srReturnRefno',
  'srRefundAmt',
  'srAdjustedAmt',
  'srCreditAmt',
  'srSettleStatus',
  'srLoyaltyReversePoints',
  'srPromoClawbackAmt',
  'srStatus',
  'srPostedVoucherId',
  'srRevisionNo',
  'srPrintCount',
  'srGstMode',
  'srPointsBack',
  'srPointsBackAmt',
  'srVoucherShareAmt',
  // The till session is the server's alone: /post stamps the posting device's
  // live session from TillSessionService.resolveForMoney (D7). A client-sent
  // id is dropped here, so it can never name another drawer's session.
  'srSessionId',
] as const;
