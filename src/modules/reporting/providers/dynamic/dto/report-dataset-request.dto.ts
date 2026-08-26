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
  Max,
  MaxLength,
  Min,
} from 'class-validator';
import { Transform } from 'class-transformer';
import { OptionalTrimmedString, TrimmedString } from 'src/common/dto/dtoDecorators';

/**
 * Request DTOs for the runtime dataset admin API.
 *
 * Same split the templates API uses: class-validator for the envelope, a
 * purpose-built validator for the part that carries real invariants. Here the
 * deep part is the SQL — ReportDatasetSqlValidator owns it, because a rejection
 * has to explain WHICH token was undeclared, and no decorator can say that.
 *
 * `rdsDocTypes` defaults to [] rather than being left undefined: the column is a
 * Postgres text[], and Prisma reports a null scalar list as a missing relation
 * argument, which is a genuinely misleading error to debug.
 */

const emptyArrayWhenNullish = ({ value }: { value: unknown }): unknown =>
  value === null || value === undefined ? [] : value;

export class ReportDatasetParamDto {
  @ApiProperty({ description: "Token as written in the SQL, e.g. 'p_party_id'.", maxLength: 60 })
  @TrimmedString(60)
  name!: string;

  @ApiProperty({ enum: ['string', 'number', 'integer', 'boolean', 'date', 'uuid'] })
  @IsIn(['string', 'number', 'integer', 'boolean', 'date', 'uuid'])
  type!: 'string' | 'number' | 'integer' | 'boolean' | 'date' | 'uuid';

  @ApiProperty({ description: 'Whether a render must supply it.', default: false })
  @IsBoolean()
  required!: boolean;

  @ApiPropertyOptional({ description: 'Human label for the parameter prompt.', maxLength: 80 })
  @OptionalTrimmedString(80)
  label?: string;

  @ApiPropertyOptional({
    description:
      'Value used when the caller supplies nothing. Also the value used to probe the ' +
      'query at save time, so a required parameter is easiest to save with one set.',
  })
  @IsOptional()
  defaultValue?: unknown;
}

export class CreateReportDatasetDto {
  @ApiProperty({
    description:
      "Dataset token a template binds. Must be namespaced 'custom.<name>' so it can " +
      'never shadow a compiled provider.',
    example: 'custom.sales.daybook',
    maxLength: 120,
  })
  @TrimmedString(120)
  rdsToken!: string;

  @ApiProperty({ description: 'Label shown in the designer field tree.', maxLength: 160 })
  @TrimmedString(160)
  rdsLabel!: string;

  @ApiProperty({
    enum: ['one', 'many'],
    description: "'one' yields a single row; only 'many' can drive a repeating band.",
  })
  @IsIn(['one', 'many'])
  rdsCardinality!: 'one' | 'many';

  @ApiPropertyOptional({
    description: 'Document types this dataset is offered for. Empty = every document type.',
    type: [String],
    default: [],
  })
  @Transform(emptyArrayWhenNullish)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(40)
  rdsDocTypes: string[] = [];

  @ApiProperty({
    description:
      'SELECT statement. Must reference p_company_id; p_branch_id, p_acc_year, p_doc_id ' +
      'and p_user_id are also bound from the request context. Any other p_* token must ' +
      'be declared in rdsParams.',
    example:
      'SELECT sb_bill_refno AS bill_no, sb_bill_date AS bill_date, sb_bill_amt AS bill_amt ' +
      'FROM sales.sale_bill WHERE sb_company_id = p_company_id AND sb_acc_year = p_acc_year ' +
      'AND NOT sb_is_deleted',
  })
  @IsString()
  @MaxLength(20_000)
  rdsSql!: string;

  @ApiPropertyOptional({ type: [ReportDatasetParamDto], default: [] })
  @Transform(emptyArrayWhenNullish)
  @IsArray()
  @ArrayMaxSize(30)
  rdsParams: ReportDatasetParamDto[] = [];

  @ApiPropertyOptional({
    description:
      'Optional label/format overrides keyed by column name. Column TYPES are always ' +
      'introspected from the query and cannot be overridden — the type is a fact about ' +
      'the SQL, not a preference.',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  rdsFieldOverrides?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({
    description:
      'Hand-authored preview rows for the designer. Omit to synthesise them from the ' +
      'introspected field types. Never paste live rows here — one definition is visible ' +
      'to every tenant that opens the designer.',
    type: [Object],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  rdsSampleRows?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ description: 'Hard row cap applied as a LIMIT.', default: 5000 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  rdsMaxRows?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @OptionalTrimmedString(500)
  rdsNotes?: string;

  @ApiPropertyOptional({ default: true })
  @IsOptional()
  @IsBoolean()
  rdsIsActive?: boolean;
}

/**
 * Update is a full replace of the editable surface, minus the token.
 *
 * The token is immutable because templates reference it by value. Renaming one
 * would break every design that binds it, silently, at print time — so a rename
 * is a create plus a deliberate migration of the templates that use it.
 */
export class UpdateReportDatasetDto {
  @ApiPropertyOptional({ maxLength: 160 })
  @OptionalTrimmedString(160)
  rdsLabel?: string;

  @ApiPropertyOptional({ enum: ['one', 'many'] })
  @IsOptional()
  @IsIn(['one', 'many'])
  rdsCardinality?: 'one' | 'many';

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  @Transform(emptyArrayWhenNullish)
  @IsArray()
  @IsString({ each: true })
  @MaxLength(40, { each: true })
  @ArrayMaxSize(40)
  rdsDocTypes?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(20_000)
  rdsSql?: string;

  @ApiPropertyOptional({ type: [ReportDatasetParamDto] })
  @IsOptional()
  @Transform(emptyArrayWhenNullish)
  @IsArray()
  @ArrayMaxSize(30)
  rdsParams?: ReportDatasetParamDto[];

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(300)
  rdsFieldOverrides?: Array<Record<string, unknown>>;

  @ApiPropertyOptional({ type: [Object] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  rdsSampleRows?: Array<Record<string, unknown>>;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100_000)
  rdsMaxRows?: number;

  @ApiPropertyOptional({ maxLength: 500 })
  @OptionalTrimmedString(500)
  rdsNotes?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  rdsIsActive?: boolean;
}

/**
 * Dry-run: validate and introspect a candidate query without storing anything.
 *
 * This is what the admin screen calls on every keystroke pause, so an author
 * sees the resolved column list — and the reason a query is rejected — before
 * committing to a token.
 */
export class ProbeReportDatasetDto {
  @ApiProperty({ description: 'Candidate SELECT statement.' })
  @IsString()
  @MaxLength(20_000)
  rdsSql!: string;

  @ApiPropertyOptional({ type: [ReportDatasetParamDto], default: [] })
  @Transform(emptyArrayWhenNullish)
  @IsArray()
  @ArrayMaxSize(30)
  rdsParams: ReportDatasetParamDto[] = [];
}

/** Run a stored dataset for real, capped, so the author can see actual rows. */
export class PreviewReportDatasetDto {
  @ApiProperty({ description: 'Accounting year to resolve against, e.g. 2026-2027.' })
  @TrimmedString(20)
  accYear!: string;

  @ApiPropertyOptional({ description: 'Branch to resolve against. Omit for company-wide.' })
  @OptionalTrimmedString(64)
  branchId?: string;

  @ApiPropertyOptional({ description: 'Document id, for a document-scoped dataset.' })
  @OptionalTrimmedString(64)
  docId?: string;

  @ApiPropertyOptional({ description: 'Values for the declared p_* parameters.' })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;

  @ApiPropertyOptional({ description: 'Rows to return. Capped at 100.', default: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;
}
