import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsBoolean, IsInt, IsOptional, Min } from 'class-validator';
import { toOptionalBoolean, toOptionalInteger } from 'src/common/dto/dto-transforms';

/**
 * Fetch a menu's widget config. When `visibility` is provided, only sections and fields whose
 * visibility matches the flag are returned; when it is omitted, both visible and hidden are returned.
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

  @ApiProperty({
    type: Boolean,
    example: true,
    required: false,
    description:
      'Optional flag applied to both section and field visibility. Omit it to return both visible and hidden sections/fields.',
  })
  @IsOptional()
  // Read the raw query value from `obj` rather than `value`: the global ValidationPipe runs with
  // `enableImplicitConversion: true`, which coerces the string via `Boolean(value)` BEFORE this
  // transform runs — and `Boolean('false') === true`, so `visibility=false` would otherwise be
  // read as `true`. Parsing the untouched raw string preserves the intended true/false.
  @Transform(({ obj, key }) => toOptionalBoolean(obj[key]))
  @IsBoolean()
  visibility?: boolean;
}
