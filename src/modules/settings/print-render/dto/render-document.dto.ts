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
  MaxLength,
  Min,
} from 'class-validator';
import { PTA_OUTPUT_MODES } from '../../print-template-assignment/print-template-assignment.constants';
import { ACC_YEAR_PATTERN, IMPLEMENTED_RENDERERS, MAX_COPIES } from '../print-render.constants';

/**
 * What printing a real document needs to know.
 *
 * Note what is NOT here: a template id. Which design wins for this counter is
 * §5's question, already answered by data — "one row IS one choice" — so a
 * render that could be told which template to use would be a second place to
 * decide it, and the two would drift. A caller who genuinely wants a named
 * revision is previewing, and that endpoint takes one.
 */
export class RenderDocumentDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'WHAT is being printed OF the document — print_purpose.ppo_id. The same sale bill is a ' +
      'tax invoice, a delivery slip and a godown slip, and each is a different purpose.',
  })
  @IsUUID()
  purposeId!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'The document. Binds :doc_id.',
  })
  @IsUUID()
  docId!: string;

  @ApiProperty({
    description:
      "The DOCUMENT's accounting year — the partition it lives in. A reprint of last year's " +
      'bill names last year here and is still logged in this year.',
    example: '2026-2027',
  })
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' })
  accYear!: string;

  @ApiPropertyOptional({
    description:
      'The module the document belongs to (SALES, ACCOUNTS, STOCK …). Defaults to the purpose ' +
      "would-be answer SALES; it is recorded on the print log's polymorphic source quad.",
    default: 'SALES',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  srcModule?: string;

  @ApiPropertyOptional({
    description:
      "The document type (SALE_BILL, SALE_RETURN …), recorded on the log's source quad. " +
      "Defaults to the purpose's own ppo_doc_type.",
  })
  @IsOptional()
  @IsString()
  @MaxLength(40)
  srcDocType?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Binds :branch_id and narrows the ladder.' })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The counter. Binds :device_id and is the NARROWEST rung of the assignment ladder — a ' +
      'till with its own receipt design is resolved by this.',
  })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({
    type: 'object',
    additionalProperties: true,
    description: "The operator's answers to this revision's prompts (ptvParams).",
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({
    enum: PTA_OUTPUT_MODES as unknown as string[],
    default: 'PRINT',
    description:
      'WHERE this goes — a resolution axis, not a file format. A counter may be assigned one ' +
      'design for the paper it prints and another for the PDF it mails.',
  })
  @IsOptional()
  @IsIn(PTA_OUTPUT_MODES as unknown as string[])
  assignmentOutputMode?: string;

  @ApiPropertyOptional({
    enum: IMPLEMENTED_RENDERERS as unknown as string[],
    description:
      'Force a renderer, overriding what the assignment and the layout mode imply. Normally ' +
      'left out.',
  })
  @IsOptional()
  @IsIn(IMPLEMENTED_RENDERERS as unknown as string[])
  outputMode?: string;

  @ApiPropertyOptional({
    minimum: 1,
    maximum: MAX_COPIES,
    description:
      'Overrides the copy count the assignment and purpose agree on. Each copy is a row in ' +
      'print_log carrying the label that was printed on it.',
  })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(MAX_COPIES)
  copies?: number;

  @ApiPropertyOptional({
    default: false,
    description:
      'Log this as a REPRINT rather than a PRINT. A reprint is NOT a status transition — it is ' +
      'another row in the print log, which is the record of printing.',
  })
  @IsOptional()
  @IsBoolean()
  isReprint?: boolean;

  @ApiPropertyOptional({
    default: false,
    description: 'Return JSON about the render instead of the bytes. The render is still logged.',
  })
  @IsOptional()
  @IsBoolean()
  inspect?: boolean;

  @ApiPropertyOptional({ description: 'Filename stem for the download, without extension.' })
  @IsOptional()
  @IsString()
  filename?: string;
}
