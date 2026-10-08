import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  OptionalDateString,
  OptionalInteger,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import {
  TxnHoldDocType,
  TxnHoldKind,
  TxnHoldPartyType,
  TxnHoldSrcModule,
  TxnHoldStatus,
} from '../types/txn-hold-api.types';
// Filters for the pick-list screen. Every one of them is optional; sending any
// of them takes the query off the configured-grid path (the stored grid SQL
// cannot apply them) and onto the Prisma one.
export class ListTxnHoldQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search on hold no / party name / party mobile / ref label / remarks',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  txhCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  txhBranchId?: string;

  // Worth sending on every pick-list query: it is the partition key, so it
  // prunes the scan to one year's partition instead of every year on record.
  @ApiPropertyOptional({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @OptionalTrimmedString(9)
  txhAccYear?: string;

  @ApiPropertyOptional({
    enum: TxnHoldKind,
    enumName: 'TxnHoldKind',
    description: 'Defaults to no filter — pass HOLD for the operator-facing pick list',
  })
  @OptionalUpperMaxString(15)
  @IsEnum(TxnHoldKind)
  txhKind?: TxnHoldKind;

  @ApiPropertyOptional({ enum: TxnHoldSrcModule, enumName: 'TxnHoldSrcModule' })
  @OptionalUpperMaxString(20)
  @IsEnum(TxnHoldSrcModule)
  txhSrcModule?: TxnHoldSrcModule;

  @ApiPropertyOptional({ enum: TxnHoldDocType, enumName: 'TxnHoldDocType' })
  @OptionalUpperMaxString(30)
  @IsEnum(TxnHoldDocType)
  txhDocType?: TxnHoldDocType;

  @ApiPropertyOptional({ enum: TxnHoldStatus, enumName: 'TxnHoldStatus' })
  @OptionalUpperMaxString(15)
  @IsEnum(TxnHoldStatus)
  txhStatus?: TxnHoldStatus;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only work parked on this device' })
  @OptionalUuid()
  txhDeviceId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only holds taken on this till' })
  @OptionalUuid()
  txhCounterId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Shift close reads this one' })
  @OptionalUuid()
  txhSessionId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Operator who parked it' })
  @OptionalUuid()
  txhHeldBy?: string;

  @ApiPropertyOptional({ enum: TxnHoldPartyType, enumName: 'TxnHoldPartyType' })
  @OptionalUpperMaxString(15)
  @IsEnum(TxnHoldPartyType)
  txhPartyType?: TxnHoldPartyType;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  txhPartyId?: string;

  @ApiPropertyOptional({
    maxLength: 20,
    description: 'Exact match — asked at the counter as often as the name',
  })
  @OptionalTrimmedString(20)
  txhPartyMobile?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  txhStaffId?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Only work parked on or after this instant',
  })
  @OptionalDateString()
  holdOnFrom?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Only work parked on or before this instant',
  })
  @OptionalDateString()
  holdOnTo?: string;

  @ApiPropertyOptional({
    description: 'true → only holds whose txhExpiresOn has passed; false → only those still valid',
  })
  @OptionalQueryBoolean()
  expired?: boolean;

  @ApiPropertyOptional({
    description: 'true → only holds that still owe stock back (the sweeper’s queue)',
  })
  @OptionalQueryBoolean()
  stockReserved?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalInteger(1, 100)
  limit?: number;
}
