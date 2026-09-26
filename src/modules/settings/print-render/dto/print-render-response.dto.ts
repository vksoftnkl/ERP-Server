import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * The JSON shapes, for Swagger only.
 *
 * The bytes path documents itself through `@ApiProduces`; these describe what
 * `inspect=true` returns and what a refusal looks like. They exist so the
 * designer's author can see, in the API docs, that a refused render names the
 * place in the design that caused it.
 */

export class PrintRenderErrorDetailDto {
  @ApiProperty({
    example: 'bands.3.elements.7.value',
    description:
      'A path into the DESIGN or the request — not a column name. `bands.3.elements.7.value` ' +
      'names a box on the canvas; `datasets.items.ptdSql` names a query on the Data tab; ' +
      '`params.from_date` names a prompt.',
  })
  field!: string;

  @ApiProperty({ example: 'band references unknown dataset "lines"' })
  message!: string;
}

export class PrintRenderErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'The stored design cannot be rendered as it stands' })
  message!: string;

  @ApiProperty({ type: [PrintRenderErrorDetailDto] })
  errors!: PrintRenderErrorDetailDto[];
}

export class ResolvedDatasetDto {
  @ApiProperty({ example: 'items' })
  name!: string;

  @ApiProperty({ example: 1 })
  datasetNo!: number;

  @ApiProperty({ enum: ['MASTER', 'DETAIL'], example: 'DETAIL' })
  role!: string;

  @ApiProperty({ enum: ['PROVIDER', 'SQL'], example: 'SQL' })
  sourceKind!: string;

  @ApiProperty({ example: 14 })
  rowCount!: number;

  @ApiProperty({ example: 21 })
  durationMs!: number;

  @ApiProperty({
    example: false,
    description:
      'True when ptdRowLimit cut the result short. A bill printing 5,000 of 5,140 lines is a ' +
      'legal document missing rows, so it is named rather than silently accepted.',
  })
  truncated!: boolean;
}

export class RenderWarningDto {
  @ApiProperty({ example: 'row-limit' })
  kind!: string;

  @ApiProperty({ example: "Dataset 'items' returned its full row limit of 5000 rows" })
  message!: string;
}

export class RenderInspectionDto {
  @ApiProperty({ example: 'PDF' })
  outputMode!: string;

  @ApiProperty({ example: 'application/pdf' })
  contentType!: string;

  @ApiProperty({ example: 3 })
  pageCount!: number;

  @ApiProperty({ type: [Number], example: [1, 1, 1], description: 'Pages per copy, in order.' })
  pagesPerCopy!: number[];

  @ApiProperty({ example: 3 })
  copies!: number;

  @ApiProperty({
    type: [String],
    example: ['ORIGINAL', 'DUPLICATE', 'TRIPLICATE'],
    description: 'What each copy said on the paper. An empty entry means it said nothing.',
  })
  copyLabels!: string[];

  @ApiProperty({ format: 'uuid' })
  templateId!: string;

  @ApiProperty({ example: 'Tax Invoice — A4', nullable: true })
  templateName!: string | null;

  @ApiProperty({ format: 'uuid', description: 'The exact bytes that were rendered.' })
  versionId!: string;

  @ApiProperty({ example: 4 })
  revNo!: number;

  @ApiProperty({ enum: ['DRAFT', 'PUBLISHED', 'RETIRED'] })
  status!: string;

  @ApiProperty({ example: 'JSON_BANDS' })
  engine!: string;

  @ApiProperty({ example: 'A4' })
  paperCode!: string;

  @ApiProperty({ example: 38 })
  layoutMs!: number;

  @ApiProperty({ example: 112 })
  renderMs!: number;

  @ApiProperty({ example: 14 })
  detailRows!: number;

  @ApiProperty({ example: 27_431 })
  byteCount!: number;

  @ApiProperty({ type: [ResolvedDatasetDto] })
  datasets!: ResolvedDatasetDto[];

  @ApiProperty({ type: [RenderWarningDto] })
  warnings!: RenderWarningDto[];

  @ApiPropertyOptional({
    type: [String],
    description: 'One print_log id per copy. Present on /print, absent on /preview.',
  })
  printLogIds?: string[];
}

export class PrintRenderInspectSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Preview rendered successfully' })
  message!: string;

  @ApiProperty({ type: RenderInspectionDto })
  data!: RenderInspectionDto;
}

export class PrintDataProviderDto {
  @ApiProperty({ example: 'sales.bill.header' })
  code!: string;

  @ApiProperty({ example: 'Sale bill — header' })
  label!: string;

  @ApiProperty({ enum: ['one', 'many'] })
  cardinality!: string;
}

export class PrintRenderProvidersSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Print data providers retrieved successfully' })
  message!: string;

  @ApiProperty({ type: [PrintDataProviderDto] })
  data!: PrintDataProviderDto[];
}
