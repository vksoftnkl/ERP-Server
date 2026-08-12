import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  OptionalInteger,
  OptionalLowerMaxString,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
} from 'src/common/dto/dtoDecorators';
import { AppSettingScope } from '../types/app-settings-api.types';

// "What has anybody changed, and where?" — the diff view behind the settings
// screen. Filtering by an id answers for that target ALONE; it does not walk
// the layers above it, which is what /resolve is for.
export class ListAppSettingValueQueryDto {
  @ApiPropertyOptional({ description: 'Free-text search on setting key / value / remarks' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ maxLength: 80, example: 'sales.max_discount_percent' })
  @OptionalLowerMaxString(80)
  asvSettingKey?: string;

  @ApiPropertyOptional({ maxLength: 30, description: 'Every override belonging to one module' })
  @OptionalTrimmedString(30)
  asdModule?: string;

  @ApiPropertyOptional({ enum: AppSettingScope, enumName: 'AppSettingScope' })
  @OptionalUpperMaxString(10)
  @IsEnum(AppSettingScope)
  asvScope?: AppSettingScope;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  asvCompanyId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  asvBranchId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  asvDeviceId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  asvUserId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalInteger(1, 100)
  limit?: number;
}
