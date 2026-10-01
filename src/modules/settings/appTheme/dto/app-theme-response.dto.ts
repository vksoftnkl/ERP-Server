import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class AppThemeErrorFieldDto {
  @ApiProperty({ example: 'tokens.primary' })
  field!: string;
  @ApiProperty({ example: 'not a colour: #rrggbb or #rrggbbaa' })
  message!: string;
}

export class AppThemeErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;
  @ApiProperty({ example: 'Validation failed' })
  message!: string;
  @ApiProperty({ type: AppThemeErrorFieldDto, isArray: true })
  errors!: AppThemeErrorFieldDto[];
}

export class AppThemePayloadDto {
  @ApiProperty({ example: 1 })
  thmId!: number;
  @ApiProperty({ example: 'MAROON' })
  thmName!: string;
  @ApiProperty({ example: 'LIGHT' })
  thmBase!: string;
  @ApiProperty({ example: true })
  thmIsDefault!: boolean;
  @ApiProperty({ example: true })
  thmIsActive!: boolean;
  @ApiProperty({ example: false })
  thmIsDeleted!: boolean;
  @ApiPropertyOptional({ type: String, nullable: true })
  thmRemarks!: string | null;
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    example: { primary: '#7B1113', 'table.selected': '#0078D7' },
  })
  tokens!: Record<string, string>;
  @ApiProperty({
    example: 3,
    description: 'Live companies whose comp_stylesheet_id is this theme.',
  })
  usedByCount!: number;
  @ApiPropertyOptional({
    type: String,
    nullable: true,
    description: 'Compare with a cached copy: a client re-applies only when it changed.',
  })
  thmModifiedOn!: string | null;
}

/** The template as /effective and /bootstrap carry it. */
export class AppThemeTemplateRefDto {
  @ApiProperty({ example: 1 })
  tplId!: number;
  @ApiProperty({ description: 'QSS with {{key}} placeholders, to fill from the tokens.' })
  tplQss!: string;
  @ApiProperty({ example: '2026-10-01T08:00:00.000Z' })
  tplModifiedOn!: string;
}

export class AppThemeEffectivePayloadDto extends AppThemePayloadDto {
  @ApiProperty({
    enum: ['COMPANY', 'DEFAULT'],
    description:
      "COMPANY = the company's own theme; DEFAULT = it has none, or it points at an inactive " +
      'or deleted one.',
  })
  resolvedFrom!: 'COMPANY' | 'DEFAULT';

  @ApiProperty({
    type: AppThemeTemplateRefDto,
    nullable: true,
    description: 'The active stylesheet template; null only while there is none.',
  })
  template!: AppThemeTemplateRefDto | null;
}

/** GET /app-themes/template. */
export class AppThemeTemplatePayloadDto extends AppThemeTemplateRefDto {
  @ApiProperty({ example: 'NEXERP' })
  tplName!: string;
  @ApiProperty({ nullable: true, type: String })
  tplRemarks!: string | null;
  @ApiProperty({
    type: [String],
    example: ['primary', 'surface', 'text'],
    description: 'The distinct {{key}}s the template uses, in order of first use.',
  })
  placeholders!: string[];
}

export class AppThemeSuccessTemplateDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'App theme template fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppThemeTemplatePayloadDto })
  data!: AppThemeTemplatePayloadDto;
}

/** GET /app-themes/bootstrap — no token. */
export class AppThemeBootstrapPayloadDto {
  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'string' },
    description: "The default theme's colour tokens.",
  })
  tokens!: Record<string, string>;
  @ApiProperty({ nullable: true, type: String })
  thmModifiedOn!: string | null;
  @ApiProperty({ type: AppThemeTemplateRefDto, nullable: true })
  template!: AppThemeTemplateRefDto | null;
}

export class AppThemeSuccessBootstrapDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'App theme bootstrap fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppThemeBootstrapPayloadDto })
  data!: AppThemeBootstrapPayloadDto;
}

export class AppThemeSuccessSingleDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'App theme fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppThemePayloadDto })
  data!: AppThemePayloadDto;
}

export class AppThemeSuccessEffectiveDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'Effective app theme fetched successfully' })
  message!: string;
  @ApiProperty({ type: AppThemeEffectivePayloadDto })
  data!: AppThemeEffectivePayloadDto;
}

export class AppThemeDeleteResultDto {
  @ApiProperty({ example: 4 })
  thmId!: number;
  @ApiProperty({ example: true })
  deleted!: boolean;
}

export class AppThemeSuccessDeleteDto {
  @ApiProperty({ example: true })
  success!: true;
  @ApiProperty({ example: 'App theme deleted successfully' })
  message!: string;
  @ApiProperty({ type: AppThemeDeleteResultDto })
  data!: AppThemeDeleteResultDto;
}
