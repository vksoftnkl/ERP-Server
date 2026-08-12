import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString } from 'class-validator';
import {
  OptionalInteger,
  OptionalLowerMaxString,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { AppSettingDataType, AppSettingScope } from '../types/app-settings-api.types';

// Filters for the settings-screen tree. Every one is optional; sending any of
// them takes the query off the configured-grid path (the stored grid SQL cannot
// apply them) and onto the Prisma one.
export class ListAppSettingDefQueryDto {
  @ApiPropertyOptional({
    description: 'Free-text search on key / label / description / module / group',
  })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ maxLength: 30, example: 'sales' })
  @OptionalTrimmedString(30)
  asdModule?: string;

  @ApiPropertyOptional({ maxLength: 40, example: 'Billing' })
  @OptionalTrimmedString(40)
  asdGroup?: string;

  @ApiPropertyOptional({ maxLength: 80, description: 'Exact key match' })
  @OptionalLowerMaxString(80)
  asdKey?: string;

  @ApiPropertyOptional({ enum: AppSettingDataType, enumName: 'AppSettingDataType' })
  @OptionalUpperMaxString(10)
  @IsEnum(AppSettingDataType)
  asdDataType?: AppSettingDataType;

  @ApiPropertyOptional({ enum: AppSettingScope, enumName: 'AppSettingScope' })
  @OptionalUpperMaxString(10)
  @IsEnum(AppSettingScope)
  asdMaxScope?: AppSettingScope;

  @ApiPropertyOptional({
    description: 'Defaults to no filter — pass true for the live catalog the settings screen draws',
  })
  @OptionalQueryBoolean()
  asdIsActive?: boolean;

  @ApiPropertyOptional({ description: 'true → only settings that need a re-login to take effect' })
  @OptionalQueryBoolean()
  asdNeedsRelogin?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @OptionalInteger(1)
  page?: number;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: 20 })
  @OptionalInteger(1, 100)
  limit?: number;
}
