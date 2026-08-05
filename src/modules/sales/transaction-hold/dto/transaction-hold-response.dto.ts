import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TransactionHoldDeviceType,
  TransactionHoldDocType,
  TransactionHoldStatus,
} from '../types/transaction-hold-api.types';
export class TransactionHoldErrorFieldDto {
  @ApiProperty({ example: 'thHoldNo' })
  field!: string;
  @ApiProperty({ example: 'thHoldNo must be provided when creating a hold' })
  message!: string;
}
export class TransactionHoldErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: TransactionHoldErrorFieldDto, isArray: true })
  errors!: TransactionHoldErrorFieldDto[];
}
export class TransactionHoldPayloadDto {
  @ApiProperty({ format: 'uuid' })
  thId!: string;
  @ApiProperty({ format: 'uuid' })
  thCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  thBranchId!: string;
  @ApiProperty({ example: 2026, description: 'Fiscal year as its starting year' })
  thAccYear!: number;
  @ApiProperty({ maxLength: 30 })
  thHoldNo!: string;
  @ApiProperty({ format: 'date-time' })
  thHoldDate!: string;
  @ApiProperty({ enum: TransactionHoldDocType, enumName: 'TransactionHoldDocType' })
  thDocType!: TransactionHoldDocType;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  thCounterId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  thSessionId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  thUserId!: string | null;
  @ApiProperty({ maxLength: 64 })
  thDeviceId!: string;
  @ApiProperty({ enum: TransactionHoldDeviceType, enumName: 'TransactionHoldDeviceType' })
  thDeviceType!: TransactionHoldDeviceType;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  thCustomerName!: string | null;
  @ApiProperty()
  thItemCount!: number;
  @ApiProperty({ description: 'Signed: a SALE_RETURN hold parks a negative quantity' })
  thTotalQty!: number;
  @ApiProperty({ minimum: 0 })
  thTotalAmount!: number;
  @ApiProperty({ enum: TransactionHoldStatus, enumName: 'TransactionHoldStatus' })
  thStatus!: TransactionHoldStatus;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  thHoldReason!: string | null;
  @ApiPropertyOptional({ maxLength: 255, nullable: true })
  thRemarks!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  thExpiresAt!: string | null;
  // Device ids (X-Device-Id), so 64 like thDeviceId — not the 50 the audit
  // actor columns carry.
  @ApiPropertyOptional({
    maxLength: 64,
    nullable: true,
    description: 'Device holding the edit lock while thStatus is LOCKED',
  })
  thLockedBy!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  thLockedAt!: string | null;
  @ApiPropertyOptional({ maxLength: 64, nullable: true })
  thResumedBy!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  thResumedAt!: string | null;
  @ApiProperty()
  thResumeCount!: number;
  @ApiPropertyOptional({
    enum: TransactionHoldDocType,
    enumName: 'TransactionHoldDocType',
    nullable: true,
  })
  thConvertedDocType!: TransactionHoldDocType | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  thConvertedDocId!: string | null;
  @ApiPropertyOptional({ maxLength: 30, nullable: true })
  thConvertedNo!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  thConvertedAt!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  thConvertedBy!: string | null;
  @ApiProperty()
  thIsStockReserved!: boolean;
  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    nullable: true,
    description: 'Screen state, stored and returned verbatim',
  })
  thUiState!: unknown;
  @ApiProperty()
  thIsDeleted!: boolean;
  // Text columns, not uuid — the actor may be an id or a name.
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  thCreatedBy!: string | null;
  @ApiProperty({ format: 'date-time' })
  thCreatedAt!: string;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  thModifiedBy!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  thModifiedAt!: string | null;
}
export class TransactionHoldListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 3 })
  total!: number;
  @ApiProperty({ example: 1 })
  total_pages!: number;
}
export class TransactionHoldDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  thId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class TransactionHoldSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Hold fetched successfully' })
  message!: string;
  @ApiProperty({ type: TransactionHoldPayloadDto })
  data!: TransactionHoldPayloadDto;
}
export class TransactionHoldSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Holds fetched successfully' })
  message!: string;
  @ApiProperty({ type: TransactionHoldPayloadDto, isArray: true })
  data!: TransactionHoldPayloadDto[];
  @ApiProperty({ type: TransactionHoldListMetaDto })
  meta!: TransactionHoldListMetaDto;
}
export class TransactionHoldSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Hold deleted successfully' })
  message!: string;
  @ApiProperty({ type: TransactionHoldDeleteResultDto })
  data!: TransactionHoldDeleteResultDto;
}
