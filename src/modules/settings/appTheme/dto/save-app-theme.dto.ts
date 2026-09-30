import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsNotEmpty, IsObject } from 'class-validator';
import {
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { APP_THEME_BASES, APP_THEME_TOKENS } from '../types/app-theme.types';

/**
 * POST /app-themes/save — create when `thmId` is absent, update when present
 * (theme/plan-app-theme.md §3.2). `tokens` REPLACES the stored object: a key
 * left out means "the client's compiled default", never "keep the old value".
 */
export class SaveAppThemeDto {
  @ApiPropertyOptional({ description: 'Absent = create (the id comes from the sequence).' })
  @OptionalInteger(1)
  thmId?: number;

  @ApiProperty({
    maxLength: 100,
    example: 'MAROON',
    description: 'Unique among live themes, case-insensitively (409 on a clash).',
  })
  @TrimmedString(100)
  @IsNotEmpty()
  thmName!: string;

  @ApiProperty({ enum: APP_THEME_BASES, example: 'LIGHT', description: 'DARK is reserved.' })
  @IsIn(APP_THEME_BASES, { message: `thmBase must be one of: ${APP_THEME_BASES.join(', ')}` })
  thmBase!: (typeof APP_THEME_BASES)[number];

  @ApiPropertyOptional({
    default: false,
    description:
      'true makes this THE default (the previous default loses the flag in the same ' +
      'transaction). The default cannot be un-set, deactivated or deleted — make another ' +
      'theme the default instead.',
  })
  @OptionalBoolean()
  thmIsDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  thmIsActive?: boolean;

  @ApiPropertyOptional({ type: String, nullable: true, maxLength: 250 })
  @NullableString(250)
  thmRemarks?: string | null;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string', example: '#7B1113' },
    example: { primary: '#7B1113', 'table.selected': '#0078D7' },
    description:
      `A flat { key: colour } object. Keys: ${Object.keys(APP_THEME_TOKENS).join(', ')}. ` +
      'Every value #rrggbb or #rrggbbaa. A key may be omitted (the client default applies), ' +
      'never null. Replaces the stored object.',
  })
  @IsObject()
  tokens!: Record<string, string>;
}
