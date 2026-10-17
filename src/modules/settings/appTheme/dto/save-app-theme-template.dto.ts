import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsISO8601, IsString } from 'class-validator';
import { NullableString, RequiredInteger } from 'src/common/dto/dtoDecorators';

/**
 * POST /app-themes/template/save — the stylesheet rules every client applies
 * (theme/plan-app-theme-template.md §4.1). `tplModifiedOn` is the value the
 * editor LOADED: when the row has changed since, the save is a 409 rather
 * than a silent overwrite of someone else's edit.
 */
export class SaveAppThemeTemplateDto {
  @ApiProperty({ example: 1, description: 'The template being edited (GET /app-themes/template).' })
  @RequiredInteger(1)
  tplId!: number;

  @ApiProperty({
    description:
      'The QSS, with {{key}} placeholders: every key a token (APP_THEME_TOKEN_KEYS) or ' +
      'size.font / size.icon / size.header; braces balanced; url() only to :/ resources; at ' +
      'most 512 KB. Each fault is a 400 on tplQss.',
  })
  @IsString()
  tplQss!: string;

  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableString(250)
  tplRemarks?: string | null;

  @ApiProperty({
    example: '2026-10-01T08:00:00.000Z',
    description: 'tplModifiedOn as the editor loaded it; a different value on the row is a 409.',
  })
  @IsISO8601()
  tplModifiedOn!: string;
}
