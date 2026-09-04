import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TenderDrCr,
  TenderSettleStatus,
  TenderSrcDocType,
  TenderSrcModule,
} from '../types/tender-detail-api.types';
export class TenderDetailErrorFieldDto {
  @ApiProperty({ example: 'tdTenderId' })
  field!: string;
  @ApiProperty({ example: 'tdTenderId must be provided when creating a tender line' })
  message!: string;
}
export class TenderDetailErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: TenderDetailErrorFieldDto, isArray: true })
  errors!: TenderDetailErrorFieldDto[];
}
export class TenderDetailPayloadDto {
  @ApiProperty({ format: 'uuid' })
  tdId!: string;
  @ApiProperty({ format: 'uuid' })
  tdCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  tdBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tdTenantId!: string | null;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  tdAccYear!: string;
  @ApiProperty({ enum: TenderSrcModule, enumName: 'TenderSrcModule' })
  tdSrcModule!: TenderSrcModule;
  @ApiProperty({ enum: TenderSrcDocType, enumName: 'TenderSrcDocType' })
  tdSrcDocType!: TenderSrcDocType;
  @ApiProperty({ format: 'uuid', description: 'Parent document id (polymorphic, no FK)' })
  tdSrcDocId!: string;
  @ApiProperty({ minimum: 1 })
  tdRowNo!: number;
  @ApiProperty({ format: 'date', description: "Snapshot of the parent document's date" })
  tdDocDate!: string;
  @ApiProperty({ format: 'uuid' })
  tdPartyLedgerId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Filled at posting' })
  tdVoucherId!: string | null;
  @ApiProperty({ format: 'uuid', description: 'acc_tender_master.tndId' })
  tdTenderId!: string;
  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'Name of the picked tender (read-only, not stored)',
  })
  tdTenderName!: string | null;
  @ApiProperty({ example: '1', description: 'Integer carried as a string' })
  tdTenderTypeId!: string;
  @ApiProperty({ format: 'uuid' })
  tdTenderLedgerId!: string;
  @ApiPropertyOptional({
    maxLength: 200,
    nullable: true,
    description: 'Name of the posting ledger (read-only, not stored)',
  })
  tdTenderLedgerName!: string | null;
  @ApiProperty({ enum: TenderDrCr, enumName: 'TenderDrCr' })
  tdDrCr!: TenderDrCr;
  @ApiProperty()
  tdAmount!: number;
  @ApiProperty()
  tdSurchargePerc!: number;
  @ApiProperty()
  tdSurchargeAmt!: number;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Surcharge income ledger snapshot',
  })
  tdSurchargeLedgerId!: string | null;
  @ApiProperty({ description: 'tdAmount + tdSurchargeAmt, rounded to 2 decimals' })
  tdTotalAmt!: number;
  @ApiProperty()
  tdReceivedAmt!: number;
  @ApiProperty()
  tdChangeAmt!: number;
  @ApiProperty()
  tdUnitsUsed!: number;
  @ApiProperty()
  tdConversionRate!: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  tdRefNo!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  tdAuthCode!: string | null;
  @ApiPropertyOptional({ maxLength: 4, nullable: true })
  tdCardLast4!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  tdBankName!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  tdPayerVpa!: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  tdInstrumentDate!: string | null;
  @ApiProperty()
  tdIsPdc!: boolean;
  @ApiProperty({ enum: TenderSettleStatus, enumName: 'TenderSettleStatus' })
  tdSettleStatus!: TenderSettleStatus;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tdSettleLedgerId!: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  tdExpectedSettleOn!: string | null;
  @ApiPropertyOptional({ format: 'date', nullable: true })
  tdSettledOn!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  tdSettleAmount!: number | null;
  @ApiProperty()
  tdMdrAmt!: number;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  tdSettleRefNo!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tdSettleVoucherId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  tdSessionId!: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  tdDeviceId!: string | null;
  @ApiProperty({ format: 'uuid' })
  tdUserId!: string;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  tdNotes!: string | null;
  @ApiProperty()
  tdIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  tdSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' })
  tdCreatedOn!: string;
  // Text columns, not uuid — the actor may be an id or a name.
  @ApiProperty({ maxLength: 50 })
  tdCreatedBy!: string;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  tdModifiedOn!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  tdModifiedBy!: string | null;
}
export class TenderDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tender line fetched successfully' })
  message!: string;
  @ApiProperty({ type: TenderDetailPayloadDto })
  data!: TenderDetailPayloadDto;
}
export class TenderDetailSuccessManyDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tender lines fetched successfully' })
  message!: string;
  @ApiProperty({ type: TenderDetailPayloadDto, isArray: true })
  data!: TenderDetailPayloadDto[];
}
export class TenderDetailDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  tdId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class TenderDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Tender line deleted successfully' })
  message!: string;
  @ApiProperty({ type: TenderDetailDeleteResultDto })
  data!: TenderDetailDeleteResultDto;
}
