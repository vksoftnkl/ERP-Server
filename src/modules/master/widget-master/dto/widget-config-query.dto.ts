import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, Min } from 'class-validator';
import { toOptionalInteger } from 'src/common/dto/dto-transforms';
import { WidgetPlatform, WidgetVisibilityFilter } from '../types/widget-master-api.types';

/**
 * Fetch a menu's widget config.
 * - `visibility=false` returns only hidden sections, each carrying its hidden fields plus any field
 *   that has secondary text (even when that field is itself visible).
 * - `visibility=all` (or omitting it) returns both visible and hidden sections and fields.
 * - `platform`, when provided, restricts results to sections scoped to that platform.
 */
export class WidgetConfigQueryDto {
  @ApiProperty({
    minimum: 1,
    example: 10,
    description: 'Menu/screen id whose widget config is fetched',
  })
  @Transform(({ value }) => toOptionalInteger(value))
  @IsInt()
  @Min(1)
  menu_id!: number;

  @ApiPropertyOptional({
    enum: WidgetVisibilityFilter,
    enumName: 'WidgetVisibilityFilter',
    description:
      '`false` returns only hidden sections (their hidden fields, plus any field that has secondary text); `all` returns both visible and hidden. Omit it to return all.',
  })
  @IsOptional()
  @IsEnum(WidgetVisibilityFilter)
  visibility?: WidgetVisibilityFilter;

  @ApiPropertyOptional({
    enum: WidgetPlatform,
    enumName: 'WidgetPlatform',
    description: 'Optional platform filter; returns only sections scoped to this platform.',
  })
  @IsOptional()
  @IsEnum(WidgetPlatform)
  platform?: WidgetPlatform;
}
