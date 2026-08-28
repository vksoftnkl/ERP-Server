import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsIn,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
  Max,
  Min,
} from 'class-validator';
import { ACC_YEAR_PATTERN, MAX_COPIES } from '../print-render.constants';
import { IMPLEMENTED_RENDERERS } from '../print-render.constants';

/**
 * What a preview needs to know.
 *
 * The COMPANY is deliberately absent: it comes from the authenticated request
 * context and never from the body. A render reads a company's documents, and a
 * caller-supplied company id would make this endpoint a cross-tenant read with
 * a friendly name.
 */
export class RenderPreviewDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'The revision to render — print_template_version.ptv_id. A revision, not a template: ' +
      'the body lives on the version, and that is what makes print_log.plg_version_id able to ' +
      'point at the exact bytes rendered.',
  })
  @IsUUID()
  versionId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The document to render. Binds :doc_id. Omitted for a report whose subject is its ' +
      'parameters rather than one document.',
  })
  @IsOptional()
  @IsUUID()
  docId?: string;

  @ApiPropertyOptional({
    description:
      "The DOCUMENT's accounting year ('2026-2027'), not the current one — a reprint of last " +
      "year's bill needs last year's partition. Binds :acc_year.",
    example: '2026-2027',
  })
  @IsOptional()
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' })
  accYear?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Binds :branch_id.' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'The counter. Binds :device_id.' })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({
    description:
      "The operator's answers to this revision's prompts (ptvParams), keyed by prompt name. " +
      'An answer to a prompt the revision does not declare is refused rather than ignored — it ' +
      'is almost always a spelling mistake, and dropping it quietly makes the report subtly wrong.',
    type: 'object',
    additionalProperties: true,
    example: { from_date: '2026-04-01', godown_id: null },
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: IMPLEMENTED_RENDERERS as unknown as string[],
    description:
      'Force a renderer. Normally left out: a GRAPHIC design renders as PDF and a GRID design ' +
      'as ESCPOS, and asking for the other one is refused rather than reinterpreted.',
  })
  @IsOptional()
  @IsIn(IMPLEMENTED_RENDERERS as unknown as string[])
  outputMode?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_COPIES,
    default: 1,
    description: 'Copies to lay out. Each carries its own copy label and page numbering.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_COPIES)
  copies?: number;

  @ApiPropertyOptional({
    description:
      'An UNSAVED body from the canvas, previewed instead of the stored one. Allowed only ' +
      'against a DRAFT revision: a published revision is frozen so that print_log can point at ' +
      'it truthfully, and previewing something else against it would show a design nothing will ' +
      'ever print. The paper and the datasets still come from the revision regardless.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  body?: Record<string, unknown>;

  @ApiPropertyOptional({
    default: false,
    description:
      'Return JSON — page counts, dataset row counts, timings and warnings — instead of bytes. ' +
      'What the Data tab needs to answer "did my query return anything".',
  })
  @IsOptional()
  @IsBoolean()
  inspect?: boolean;

  @ApiPropertyOptional({
    description: 'Filename stem for the download, without extension.',
  })
  @IsOptional()
  @IsString()
  filename?: string;
}
