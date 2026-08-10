import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  TxnHoldDocType,
  TxnHoldKind,
  TxnHoldPartyType,
  TxnHoldSrcModule,
  TxnHoldStatus,
} from '../types/txn-hold-api.types';
export class TxnHoldErrorFieldDto {
  @ApiProperty({ example: 'txhHoldNo' })
  field!: string;
  @ApiProperty({ example: 'txhHoldNo must be provided when creating a hold' })
  message!: string;
}
export class TxnHoldErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: TxnHoldErrorFieldDto, isArray: true })
  errors!: TxnHoldErrorFieldDto[];
}
export class TxnHoldPayloadDto {
  @ApiProperty({ format: 'uuid' })
  txhId!: string;
  @ApiProperty({ format: 'uuid' })
  txhCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  txhBranchId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhTenantId!: string | null;
  // Half the primary key: an id alone does not name a row, the year says which
  // partition it lives in.
  @ApiProperty({ example: '2026-2027', description: 'Accounting year — half the primary key' })
  txhAccYear!: string;
  @ApiProperty({ enum: TxnHoldKind, enumName: 'TxnHoldKind' })
  txhKind!: TxnHoldKind;
  @ApiProperty({ enum: TxnHoldSrcModule, enumName: 'TxnHoldSrcModule' })
  txhSrcModule!: TxnHoldSrcModule;
  @ApiProperty({ enum: TxnHoldDocType, enumName: 'TxnHoldDocType' })
  txhDocType!: TxnHoldDocType;
  @ApiProperty({ maxLength: 30, description: 'Printed on the token slip' })
  txhHoldNo!: string;
  @ApiProperty({ minimum: 1, description: 'Per-device counter behind txhHoldNo' })
  txhHoldSlno!: number;
  @ApiProperty({ format: 'date-time' })
  txhHoldOn!: string;
  @ApiProperty({ format: 'uuid', description: 'fixed.device_master.dev_id' })
  txhDeviceId!: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhCounterId!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhSessionId!: string | null;
  @ApiProperty({ format: 'uuid', description: 'Operator who parked it' })
  txhHeldBy!: string;
  @ApiPropertyOptional({ enum: TxnHoldPartyType, enumName: 'TxnHoldPartyType', nullable: true })
  txhPartyType!: TxnHoldPartyType | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhPartyId!: string | null;
  @ApiPropertyOptional({ maxLength: 150, nullable: true })
  txhPartyName!: string | null;
  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  txhPartyMobile!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhStaffId!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  txhRefLabel!: string | null;
  // The three numbers a pick list shows. Every other total is in txhPayload,
  // where the module that computed it reads it back.
  @ApiProperty({ minimum: 0 })
  txhItemCount!: number;
  @ApiProperty({ minimum: 0 })
  txhTotalQty!: number;
  @ApiProperty({ minimum: 0 })
  txhNetAmount!: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    description: 'The module’s own save body, stored and returned verbatim',
  })
  txhPayload!: unknown;
  @ApiProperty({ minimum: 1 })
  txhPayloadVersion!: number;
  @ApiProperty({ minimum: 1, description: 'Bumped on every overwrite of the same hold' })
  txhRevision!: number;
  @ApiProperty({ enum: TxnHoldStatus, enumName: 'TxnHoldStatus' })
  txhStatus!: TxnHoldStatus;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  txhHoldReason!: string | null;
  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  txhRemarks!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  txhExpiresOn!: string | null;
  // The lease. All five move together (ck_txh_lock_block) — a lock with no end
  // is the bug this column set exists to prevent.
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Operator holding the lease while txhStatus is LOCKED',
  })
  txhLockedBy!: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Device holding the lease — this is what release and convert match on',
  })
  txhLockedDeviceId!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  txhLockedOn!: string | null;
  @ApiPropertyOptional({
    format: 'date-time',
    nullable: true,
    description: 'Once past, the next device may resume the hold without a force-release',
  })
  txhLockExpiresOn!: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Proves the holder; send it back on release / convert',
  })
  txhLockToken!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhResumedBy!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  txhResumedOn!: string | null;
  @ApiProperty({ minimum: 0 })
  txhResumeCount!: number;
  // The conversion trail. No doc TYPE — txhDocType above already names the
  // table these point into.
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhConvertedDocId!: string | null;
  @ApiPropertyOptional({
    example: '2026-2027',
    nullable: true,
    description: 'That document’s year — may differ from txhAccYear',
  })
  txhConvertedAccYear!: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  txhConvertedRefno!: string | null;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  txhConvertedOn!: string | null;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  txhConvertedBy!: string | null;
  @ApiProperty({ description: 'Does this hold still owe stock back?' })
  txhIsStockReserved!: boolean;
  @ApiProperty({ minimum: 0 })
  txhPrintCount!: number;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  txhLastPrintedOn!: string | null;
  @ApiProperty()
  txhIsDeleted!: boolean;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  txhSyncDate!: string | null;
  // Text columns, not uuid — the audit actor may be an id or a name.
  @ApiProperty({ format: 'date-time' })
  txhCreatedOn!: string;
  @ApiProperty({ maxLength: 50 })
  txhCreatedBy!: string;
  @ApiPropertyOptional({ format: 'date-time', nullable: true })
  txhModifiedOn!: string | null;
  @ApiPropertyOptional({ maxLength: 50, nullable: true })
  txhModifiedBy!: string | null;
}
export class TxnHoldListMetaDto {
  @ApiProperty({ example: 1 })
  page!: number;
  @ApiProperty({ example: 20 })
  limit!: number;
  @ApiProperty({ example: 3 })
  total!: number;
  @ApiProperty({ example: 1 })
  total_pages!: number;
}
export class TxnHoldDeleteResultDto {
  @ApiProperty({ format: 'uuid' })
  txhId!: string;
  @ApiProperty({ example: true })
  deleted!: true;
}
export class TxnHoldSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Hold fetched successfully' })
  message!: string;
  @ApiProperty({ type: TxnHoldPayloadDto })
  data!: TxnHoldPayloadDto;
}
export class TxnHoldSuccessListDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Holds fetched successfully' })
  message!: string;
  @ApiProperty({ type: TxnHoldPayloadDto, isArray: true })
  data!: TxnHoldPayloadDto[];
  @ApiProperty({ type: TxnHoldListMetaDto })
  meta!: TxnHoldListMetaDto;
}
export class TxnHoldSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Hold deleted successfully' })
  message!: string;
  @ApiProperty({ type: TxnHoldDeleteResultDto })
  data!: TxnHoldDeleteResultDto;
}
