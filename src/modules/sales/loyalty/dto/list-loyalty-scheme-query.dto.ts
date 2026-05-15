import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn } from 'class-validator';
import {
  OptionalDateString,
  OptionalQueryBoolean,
  OptionalQueryInt,
  OptionalTrimmedString,
  OptionalUuid,
} from './loyalty-dto.helpers';

const LOYALTY_SCHEME_TYPES = ['REDEEM', 'BOTH', 'GIFT'] as const;
const LOYALTY_SCHEME_STATUSES = ['DRAFT', 'APPROVED', 'ACTIVE', 'CLOSED', 'CANCELLED'] as const;

export class ListLoyaltySchemeQueryDto {
  @ApiPropertyOptional({ maxLength: 150 })
  @OptionalTrimmedString(150)
  search?: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @OptionalUuid()
  ls_comp_id?: string;

  @ApiPropertyOptional({ example: '01963d86-caf0-7b26-89f0-58ac380a2d5e' })
  @OptionalUuid()
  ls_branch_id?: string;

  @ApiPropertyOptional({ type: Boolean, example: true })
  @OptionalQueryBoolean()
  ls_is_active?: boolean;

  @ApiPropertyOptional({ maxLength: 20, example: 'GENERAL' })
  @OptionalTrimmedString(20)
  @IsIn(LOYALTY_SCHEME_TYPES)
  ls_type?: string;

  @ApiPropertyOptional({ maxLength: 20, example: 'ACTIVE' })
  @OptionalTrimmedString(20)
  @IsIn(LOYALTY_SCHEME_STATUSES)
  ls_status?: string;

  @ApiPropertyOptional({ format: 'date' })
  @OptionalDateString()
  ls_start_date_from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @OptionalDateString()
  ls_start_date_to?: string;

  @ApiPropertyOptional({ format: 'date' })
  @OptionalDateString()
  ls_end_date_from?: string;

  @ApiPropertyOptional({ format: 'date' })
  @OptionalDateString()
  ls_end_date_to?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalQueryInt(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalQueryInt(1, 100)
  limit?: number;
}
