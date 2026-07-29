import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ChargeApplyOn,
  ChargeCostAlloc,
  ChargeDocType,
  ChargeMethod,
  ChargeRole,
  ChargeType,
} from '../types/charge-detail-api.types';
export class ChargeDetailErrorFieldDto {
  @ApiProperty({ example: 'cdChgId' })
  field!: string;
  @ApiProperty({ example: 'cdChgId is required when creating a charge line' })
  message!: string;
}
export class ChargeDetailErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: ChargeDetailErrorFieldDto, isArray: true })
  errors!: ChargeDetailErrorFieldDto[];
}
export class ChargeDetailPayloadDto {
  @ApiProperty({ format: 'uuid' })
  cdId!: string;
  @ApiProperty({ enum: ChargeDocType, enumName: 'ChargeDocType' })
  cdDocType!: ChargeDocType;
  @ApiProperty({ format: 'uuid', description: 'Parent document id (polymorphic, no FK)' })
  cdDocId!: string;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdSlno!: number | null;
  @ApiProperty({ format: 'uuid' })
  cdCompId!: string;
  @ApiProperty({ format: 'uuid' })
  cdBranchId!: string;
  @ApiProperty({ minLength: 9, maxLength: 9 })
  cdAccYear!: string;
  @ApiPropertyOptional({ nullable: true, description: 'bigint carried as a string' })
  cdVoucherNo!: string | null;
  @ApiProperty({ format: 'uuid' })
  cdChgId!: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  cdChgName!: string | null;
  @ApiPropertyOptional({ enum: ChargeRole, enumName: 'ChargeRole', nullable: true })
  cdRole!: ChargeRole | null;
  @ApiPropertyOptional({ enum: ChargeMethod, enumName: 'ChargeMethod', nullable: true })
  cdMethod!: ChargeMethod | null;
  @ApiProperty({ enum: ChargeType, enumName: 'ChargeType' })
  cdType!: ChargeType;
  @ApiPropertyOptional({ enum: ChargeApplyOn, enumName: 'ChargeApplyOn', nullable: true })
  cdApplyOn!: ChargeApplyOn | null;
  @ApiProperty({ format: 'uuid' })
  cdLedgerCode!: string;
  @ApiPropertyOptional({
    maxLength: 200,
    nullable: true,
    description: 'Name of the mapped GL ledger (read-only, not stored)',
  })
  cdLedgerName!: string | null;
  @ApiProperty()
  cdLandingCost!: boolean;
  @ApiPropertyOptional({ enum: ChargeCostAlloc, enumName: 'ChargeCostAlloc', nullable: true })
  cdCostAlloc!: ChargeCostAlloc | null;
  @ApiProperty()
  cdBeforeTax!: boolean;
  @ApiProperty()
  cdTaxApl!: boolean;
  @ApiProperty()
  cdSepPost!: boolean;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  cdUnit!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdQtyVal!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdWeight!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdRate!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdAmount!: number | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cdTaxCode!: string | null;
  @ApiPropertyOptional({ maxLength: 15, nullable: true })
  cdHsn!: string | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdTaxPerc!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdTaxAmt!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdSgstPerc!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdSgstAmt!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdCgstPerc!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdCgstAmt!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdIgstPerc!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdIgstAmt!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdCessPerc!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdCessAmt!: number | null;
  @ApiPropertyOptional({ nullable: true, type: Number })
  cdNetAmt!: number | null;
  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  cdRemarks!: string | null;
  @ApiProperty()
  cdIsActive!: boolean;
  @ApiProperty()
  cdIsDeleted!: boolean;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  cdSyncDate!: string | null;
  @ApiProperty({ format: 'date-time' })
  cdCreatedOn!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cdCreatedBy!: string | null;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  cdModifiedOn!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  cdModifiedBy!: string | null;
}
export class ChargeDetailSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Charge line fetched successfully' })
  message!: string;
  @ApiProperty({ type: ChargeDetailPayloadDto })
  data!: ChargeDetailPayloadDto;
}
export class ChargeDetailSuccessManyDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Charge lines fetched successfully' })
  message!: string;
  @ApiProperty({ type: ChargeDetailPayloadDto, isArray: true })
  data!: ChargeDetailPayloadDto[];
}
export class ChargeDetailDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  cdId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class ChargeDetailSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Charge line deleted successfully' })
  message!: string;
  @ApiProperty({ type: ChargeDetailDeleteResultDto })
  data!: ChargeDetailDeleteResultDto;
}
