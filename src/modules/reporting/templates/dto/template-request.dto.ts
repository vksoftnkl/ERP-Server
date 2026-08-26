import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDefined, IsObject, IsOptional } from 'class-validator';
import {
  OptionalBoolean,
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

/**
 * Request DTOs for the templates API.
 *
 * class-validator for the envelope, zod for the DEFINITION. That split is
 * deliberate rather than inconsistent: the envelope is a handful of scalars
 * that Swagger has to document and Nest's ValidationPipe already handles, while
 * the definition is a deep discriminated union with cross-field invariants that
 * class-validator cannot express (element-id uniqueness across bands, dataset
 * references resolving, GRID-vs-GRAPHIC geometry).
 *
 * So `definition` arrives here as an opaque object and is validated by
 * `templateDefinitionSchema` inside the service, where a failure can be
 * reported with the JSON path the designer needs to highlight.
 */

export class CreateTemplateDto {
  @ApiProperty({
    description: 'Document type this design prints, e.g. SALE_INVOICE.',
    example: 'SALE_INVOICE',
    maxLength: 40,
  })
  @UpperMaxString(40)
  ptDocType!: string;

  @ApiProperty({
    description: 'Output mode: PDF | ESCPOS | ESCP_DOTMATRIX | HTML.',
    example: 'PDF',
    maxLength: 20,
  })
  @UpperMaxString(20)
  ptOutputMode!: string;

  @ApiProperty({
    description: 'Paper code, e.g. A4 | A5 | T58 | T80 | DM80 | DM132.',
    example: 'A4',
    maxLength: 20,
  })
  @UpperMaxString(20)
  ptPaperCode!: string;

  @ApiProperty({ description: 'Template name, unique within its scope.', maxLength: 120 })
  @TrimmedString(120)
  ptName!: string;

  @ApiPropertyOptional({
    description:
      'Owning company. Omitted = a SYSTEM template, which only an administrator ' +
      'should create; ordinary callers get their request context company.',
  })
  @OptionalUuid()
  ptCompanyId?: string;

  @ApiPropertyOptional({ description: 'Owning branch. Omitted = every branch of the company.' })
  @OptionalUuid()
  ptBranchId?: string;

  @ApiPropertyOptional({
    description: 'Make this the default for its (company, branch, docType, mode, paper).',
    default: false,
  })
  @OptionalBoolean()
  ptIsDefault?: boolean;

  @ApiPropertyOptional({ default: true })
  @OptionalBoolean()
  ptIsActive?: boolean;

  @ApiProperty({
    description:
      'The template definition. Validated against the schemaVersion-1 contract; ' +
      'see GET /reports/templates/schema for the full shape.',
    type: 'object',
    additionalProperties: true,
  })
  @IsDefined({ message: 'definition is required' })
  @IsObject({ message: 'definition must be an object' })
  definition!: Record<string, unknown>;
}

export class UpdateTemplateDto {
  @ApiPropertyOptional({ maxLength: 120 })
  @OptionalTrimmedString(120)
  ptName?: string;

  @ApiPropertyOptional()
  @OptionalBoolean()
  ptIsActive?: boolean;

  @ApiPropertyOptional({
    description:
      'A new definition. Supplying it bumps ptVersion and writes the previous ' +
      'body to a revision row. Omit it to change only the metadata above.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject({ message: 'definition must be an object' })
  definition?: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Note recorded against the revision this update creates.',
    maxLength: 200,
  })
  @OptionalTrimmedString(200)
  note?: string;
}

export class GetTemplatesQueryDto {
  @ApiPropertyOptional({ description: 'Filter by document type.', maxLength: 40 })
  @OptionalUpperMaxString(40)
  ptDocType?: string;

  @ApiPropertyOptional({ description: 'Filter by output mode.', maxLength: 20 })
  @OptionalUpperMaxString(20)
  ptOutputMode?: string;

  @ApiPropertyOptional({ description: 'Filter by paper code.', maxLength: 20 })
  @OptionalUpperMaxString(20)
  ptPaperCode?: string;

  @ApiPropertyOptional({
    description: 'Company to list for. Defaults to the request context company.',
  })
  @OptionalUuid()
  ptCompanyId?: string;

  @ApiPropertyOptional()
  @OptionalUuid()
  ptBranchId?: string;

  @ApiPropertyOptional({
    type: Boolean,
    default: true,
    description:
      'Include the shipped system templates (ptCompanyId NULL) alongside the ' +
      "tenant's own. These are what a customer clones to start from.",
  })
  @OptionalQueryBoolean()
  includeSystem?: boolean;

  @ApiPropertyOptional({ type: Boolean, default: true })
  @OptionalQueryBoolean()
  activeOnly?: boolean;
}

export class CloneTemplateDto {
  @ApiPropertyOptional({
    description: 'Name for the copy. Defaults to the source name plus " (copy)".',
    maxLength: 120,
  })
  @OptionalTrimmedString(120)
  ptName?: string;

  @ApiPropertyOptional({
    description: 'Company for the copy. Defaults to the request context company.',
  })
  @OptionalUuid()
  ptCompanyId?: string;

  @ApiPropertyOptional({ description: 'Branch for the copy.' })
  @OptionalUuid()
  ptBranchId?: string;

  @ApiPropertyOptional({
    description: 'Make the copy the default for its scope immediately.',
    default: false,
  })
  @OptionalBoolean()
  ptIsDefault?: boolean;
}

export class ImportTemplateDto {
  @ApiProperty({
    description: 'An exported template file, as produced by GET .../:id/export.',
    type: 'object',
    additionalProperties: true,
  })
  @IsDefined({ message: 'payload is required' })
  @IsObject({ message: 'payload must be an object' })
  payload!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Override the imported name.',
    maxLength: 120,
  })
  @OptionalTrimmedString(120)
  ptName?: string;

  @ApiPropertyOptional({ description: 'Company to import into. Defaults to the context company.' })
  @OptionalUuid()
  ptCompanyId?: string;

  @ApiPropertyOptional()
  @OptionalUuid()
  ptBranchId?: string;
}
