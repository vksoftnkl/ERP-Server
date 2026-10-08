import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString } from 'class-validator';
import {
  NullableUpperMaxString,
  OptionalInteger,
  OptionalQueryBoolean,
} from 'src/common/dto/dtoDecorators';
import { CHARGE_MODULES } from '../types/charge-master-api.types';

export class ListChargeMasterQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search on name / code / role' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ enum: CHARGE_MODULES, description: 'Filter by module (P / S / B)' })
  @NullableUpperMaxString(1)
  @IsIn(CHARGE_MODULES)
  module?: string | null;

  @ApiPropertyOptional({ description: 'Filter by active flag' })
  @OptionalQueryBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalInteger(1, 100)
  limit?: number;
}
