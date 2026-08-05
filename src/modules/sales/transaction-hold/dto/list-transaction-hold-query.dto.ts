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
  TransactionHoldDeviceType,
  TransactionHoldDocType,
  TransactionHoldStatus,
} from '../types/transaction-hold-api.types';
// Filters for the held-bills screen. Every one of them is optional; sending any
// of them takes the query off the configured-grid path (the stored grid SQL
// cannot apply them) and onto the Prisma one.
export class ListTransactionHoldQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search on hold no / customer name / remarks' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  thCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  thBranchId?: string;

  @ApiPropertyOptional({ description: 'Fiscal year as its starting year, e.g. 2026' })
  @OptionalInteger(1, 32767)
  thAccYear?: number;

  @ApiPropertyOptional({ format: 'uuid', description: 'Only holds taken on this till' })
  @OptionalUuid()
  thCounterId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  thSessionId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  thUserId?: string;

  // Trimmed but not upper-cased: th_device_id is stored as the till sends it, so
  // upper-casing the filter would miss a lower-case device id.
  @ApiPropertyOptional({ maxLength: 64 })
  @OptionalTrimmedString(64)
  thDeviceId?: string;

  @ApiPropertyOptional({ enum: TransactionHoldDeviceType, enumName: 'TransactionHoldDeviceType' })
  @OptionalUpperMaxString(20)
  @IsEnum(TransactionHoldDeviceType)
  thDeviceType?: TransactionHoldDeviceType;

  @ApiPropertyOptional({ enum: TransactionHoldStatus, enumName: 'TransactionHoldStatus' })
  @OptionalUpperMaxString(15)
  @IsEnum(TransactionHoldStatus)
  thStatus?: TransactionHoldStatus;

  @ApiPropertyOptional({ enum: TransactionHoldDocType, enumName: 'TransactionHoldDocType' })
  @OptionalUpperMaxString(20)
  @IsEnum(TransactionHoldDocType)
  thDocType?: TransactionHoldDocType;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Only holds parked on or after this instant',
  })
  @OptionalDateString()
  holdDateFrom?: string;

  @ApiPropertyOptional({
    type: 'string',
    format: 'date-time',
    description: 'Only holds parked on or before this instant',
  })
  @OptionalDateString()
  holdDateTo?: string;

  @ApiPropertyOptional({
    description: 'true → only holds whose thExpiresAt has passed; false → only those still valid',
  })
  @OptionalQueryBoolean()
  expired?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalInteger(1, 100)
  limit?: number;
}
