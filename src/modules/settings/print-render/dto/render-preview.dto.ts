import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
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
import { ACC_YEAR_PATTERN, MAX_BATCH_DOCS, MAX_COPIES } from '../print-render.constants';
import { IMPLEMENTED_RENDERERS } from '../print-render.constants';

/**
 * What a preview needs to know.
 *
 * The COMPANY defaults to the authenticated request context, and a caller may
 * name one — then it wins, exactly as it does on `/print-template-assignments/
 * resolve`. It was once absent on purpose (a caller-supplied company reads
 * another tenant's documents), but the access token carries the USER's home
 * company (`user_master.usr_company_id`) while the client's header picker lets a
 * session work in any company it lists — and every other screen scopes its
 * reads by that working company (`grid_param`, `ptlCompanyId`, `companyId` on
 * `/resolve`). A render that bound only the token's company printed BLANK paper
 * for any document raised in the working company: every dataset filters on
 * `:company_id`, so the header, the lines and the totals all came back empty.
 *
 * The branch, the counter and the accounting year come from the session too, and
 * are OPTIONAL rather than absent — a caller may still name one, and then it
 * wins. Nothing has to name one to state the default.
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
    type: [String],
    format: 'uuid',
    maxItems: MAX_BATCH_DOCS,
    description:
      'SEVERAL documents, rendered back to back into ONE file — the list screen ticking five ' +
      'bills and getting a single PDF. Each id gets its own dataset pass, so each binds its ' +
      'own :doc_id, and the resulting pages are merged exactly the way copies already are. ' +
      'Mutually exclusive with docId: send one or the other, never both, because a render ' +
      'that was told the subject twice has no way to say which answer it used. Everything ' +
      'else — the company, the year, the design — is one value for the whole batch, so every ' +
      'document in it must belong to the same company and the same accounting year.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_BATCH_DOCS)
  @IsUUID(undefined, { each: true })
  docIds?: string[];

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The DOCUMENT's company. Binds :company_id, scopes the purpose and the design, and is " +
      "what the print log records. Defaults to the session's company; name it where the " +
      "session works in a company other than the one on its token — the client's header " +
      'picker — or every company-scoped dataset reads nothing and the paper comes out blank.',
  })
  @IsOptional()
  @IsUUID()
  companyId?: string;

  @ApiPropertyOptional({
    description:
      "The DOCUMENT's accounting year ('2026-2027'). Omitted, the company's current fiscal " +
      "year is bound — a reprint of last year's bill is the case that has to name its own, " +
      "because that is where last year's partition is. Binds :acc_year.",
    example: '2026-2027',
  })
  @IsOptional()
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' })
  accYear?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description: "Binds :branch_id. Defaults to the session's own branch.",
  })
  @IsOptional()
  @IsUUID()
  branchId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "The counter. Binds :device_id. Defaults to the session's own counter, from the access " +
      'token — no caller has to hold a device id.',
  })
  @IsOptional()
  @IsUUID()
  deviceId?: string;

  @ApiPropertyOptional({
    description:
      "The operator's answers to this revision's prompts (ptvParams), keyed by prompt name. " +
      'An answer to a prompt the revision does not declare is refused rather than ignored — it ' +
      'is almost always a spelling mistake, and dropping it quietly makes the report subtly ' +
      'wrong. A context name declared as a prompt (:doc_id, :branch_id, :acc_year, :user_id, ' +
      ':device_id) may be answered here and the answer wins over what the render holds; ' +
      ':company_id may not, whatever the revision declares.',
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
