import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, IsString, ValidateNested } from 'class-validator';
import {
  NullableNumber,
  NullableInteger,
  NullableString,
  OptionalBoolean,
  OptionalInteger,
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUuid,
  NullableUuid,
  SkipOnNullish,
} from 'src/common/dto/dtoDecorators';
import {
  PTV_COLUMNS_MAX,
  PTV_COLUMNS_MIN,
  PTV_ENGINES,
  PTV_FONT_FAMILY_MAX_LENGTH,
  PTV_NOTE_MAX_LENGTH,
  PTV_ORIENTATIONS,
  PTV_PAPER_CODE_MAX_LENGTH,
  PTV_STATUSES,
} from '../print-template.constants';
import { SavePrintTemplateDatasetDto } from './save-print-template-dataset.dto';

/** The most datasets one version may carry — ptdDatasetNo runs 0..99. */
const MAX_DATASETS_PER_VERSION = 100;

/**
 * ptv_body is a text column, but a JSON_BANDS body is a JSON object and a
 * client that has one in hand should not have to stringify it by hand only for
 * the server to parse it back. An object or an array arrives as JSON text; a
 * string is passed through untouched, which is what HTML_CSS, QTRPT_XML,
 * ESCPOS_TEXT and RAW need.
 *
 * An array is deliberately NOT rejected here — ck_ptv_body_is_json is what says
 * a JSON_BANDS body must be an OBJECT, and it says so with a message that
 * explains why.
 */
const toBodyText = (value: unknown): unknown =>
  typeof value === 'object' && value !== null ? JSON.stringify(value) : value;

/**
 * One row of a template's `versions` array — §3, the design itself.
 *
 * THE RULE THAT SHAPES THIS DTO: a published version is never UPDATEd. Send
 * ptvId to edit a DRAFT; to change a design that is already live, send a row
 * with NO ptvId and the next revision number is assigned. The service refuses
 * an edit to a PUBLISHED or RETIRED row rather than quietly rewriting history
 * that print_log points at.
 *
 * Set ptvStatus to PUBLISHED to publish: the service stamps ptvApprovedOn, and
 * moves the template's ptl_published_rev_id pointer to this row.
 */
export class SavePrintTemplateVersionDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Present = update this version, absent = add a new revision. Only a DRAFT may be updated.',
  })
  @OptionalUuid()
  ptvId?: string;

  @ApiPropertyOptional({
    minimum: 1,
    description:
      'Omit it and the next number for this template is assigned. Dense, unique per template ' +
      'and never reused — the history is append-only.',
  })
  @OptionalInteger(1)
  ptvRevNo?: number;

  @ApiPropertyOptional({
    enum: PTV_STATUSES,
    default: 'DRAFT',
    description:
      'DRAFT is editable and nothing else is. PUBLISHED needs an approver and moves the ' +
      "template's published pointer to this revision. RETIRED takes it out of service.",
  })
  @IsOptional()
  @IsIn(PTV_STATUSES)
  ptvStatus?: string;

  @ApiPropertyOptional({
    enum: PTV_ENGINES,
    default: 'JSON_BANDS',
    description: 'What ptvBody IS. Without this column, changing engines is a flag day.',
  })
  @IsOptional()
  @IsIn(PTV_ENGINES)
  ptvEngine?: string;

  @ApiPropertyOptional({
    description:
      'The design. Send a JSON object for JSON_BANDS — it is stored as text — or a string for ' +
      'the text and markup engines.',
  })
  @IsOptional()
  @Transform(({ value }) => toBodyText(value))
  @IsString()
  ptvBody?: string;

  @ApiPropertyOptional({ default: 1 })
  @OptionalInteger(1)
  ptvSchemaVer?: number;

  @ApiPropertyOptional({ maxLength: PTV_PAPER_CODE_MAX_LENGTH, default: 'A4', example: 'A4' })
  @OptionalTrimmedString(PTV_PAPER_CODE_MAX_LENGTH)
  ptvPaperCode?: string;

  @ApiPropertyOptional({ enum: PTV_ORIENTATIONS, default: 'PORTRAIT' })
  @IsOptional()
  @IsIn(PTV_ORIENTATIONS)
  ptvOrientation?: string;

  @ApiPropertyOptional({
    nullable: true,
    description: 'Greater than 0, or null to take the width from the paper',
  })
  @NullableNumber()
  ptvWidthMm?: number | null;

  @ApiPropertyOptional({ nullable: true })
  @NullableNumber()
  ptvHeightMm?: number | null;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalNumber(0)
  ptvMarginTopMm?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalNumber(0)
  ptvMarginBottomMm?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalNumber(0)
  ptvMarginLeftMm?: number;

  @ApiPropertyOptional({ default: 0, minimum: 0 })
  @OptionalNumber(0)
  ptvMarginRightMm?: number;

  @ApiPropertyOptional({
    nullable: true,
    minimum: PTV_COLUMNS_MIN,
    maximum: PTV_COLUMNS_MAX,
    description:
      'Characters per line for the text engines. Meaningless for a page one — send null.',
  })
  @NullableInteger()
  ptvColumns?: number | null;

  @ApiPropertyOptional({
    default: 'en-IN',
    example: 'ta-IN',
    description:
      'The DEFAULT, not a resolution key — a render may override it. Language must never fork a ' +
      'template.',
  })
  @OptionalTrimmedString(5)
  ptvLang?: string;

  @ApiPropertyOptional({ maxLength: PTV_FONT_FAMILY_MAX_LENGTH, nullable: true })
  @NullableString(PTV_FONT_FAMILY_MAX_LENGTH)
  ptvFontFamily?: string | null;

  @ApiPropertyOptional({
    type: 'array',
    items: { type: 'object' },
    nullable: true,
    example: [
      { name: 'from_date', type: 'DATE', required: true, label: 'From date' },
      { name: 'godown_id', type: 'UUID', required: false, label: 'Godown' },
    ],
    description:
      'What the OPERATOR is asked, ONCE, for the whole render. ANY name may be declared, ' +
      'including a context one (:company_id, :branch_id, :acc_year, :doc_id, :user_id, ' +
      ':device_id): those are filled in from the render when this array leaves them out, and a ' +
      "row here overrides that — except company_id, whose value stays the session's.",
  })
  @IsOptional()
  @SkipOnNullish()
  @IsArray()
  ptvParams?: unknown[] | null;

  @ApiPropertyOptional({ maxLength: PTV_NOTE_MAX_LENGTH, nullable: true })
  @NullableString(PTV_NOTE_MAX_LENGTH)
  ptvNote?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'Required to publish. A version whose datasets carry stored SQL is, in every meaningful ' +
      'sense, code — so publishing takes a signature. ptvApprovedOn is stamped by the server.',
  })
  @NullableUuid()
  ptvApprovedBy?: string | null;

  @ApiPropertyOptional({
    default: false,
    description:
      'Soft delete this revision. Omitting a version from the array does NOT delete it — the ' +
      'history is append-only, so removal is an explicit act. Refused for a PUBLISHED revision ' +
      'and for the one the template currently points at.',
  })
  @OptionalBoolean()
  ptvIsDeleted?: boolean;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptvCreatedBy?: string | null;

  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  ptvModifiedBy?: string | null;

  @ApiPropertyOptional({
    type: [SavePrintTemplateDatasetDto],
    description:
      'The queries that feed this revision. An array that is PRESENT replaces the set: rows ' +
      'carrying ptdId are updated, rows without one are inserted, and rows already on the ' +
      'version but missing from the array are soft deleted. Omit the key to leave the datasets ' +
      'alone — "datasets": [] means "delete every one of them", which is not the same thing.',
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_DATASETS_PER_VERSION)
  @ValidateNested({ each: true })
  @Type(() => SavePrintTemplateDatasetDto)
  datasets?: SavePrintTemplateDatasetDto[];
}
