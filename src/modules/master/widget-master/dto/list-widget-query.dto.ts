import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, MaxLength, Min } from 'class-validator';
import { toOptionalInteger } from 'src/common/dto/dto-transforms';
import { WidgetPlatform } from '../types/widget-master-api.types';

export class ListWidgetQueryDto {
  @ApiPropertyOptional({ minimum: 1, description: 'Filter sections by menu/screen id' })
  @IsOptional()
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  sectionId?: number;

  @ApiPropertyOptional({ enum: WidgetPlatform, enumName: 'WidgetPlatform' })
  @IsOptional()
  @IsEnum(WidgetPlatform)
  sectionPlatform?: WidgetPlatform;

  @ApiPropertyOptional({ maxLength: 255, description: 'Matches section name or any of its field names' })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  search?: string;
}
