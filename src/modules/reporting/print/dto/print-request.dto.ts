import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayNotEmpty,
  IsArray,
  IsDefined,
  IsObject,
  IsOptional,
  IsString,
} from 'class-validator';
import {
  OptionalQueryBoolean,
  OptionalTrimmedString,
  OptionalUpperMaxString,
  OptionalUuid,
  TrimmedString,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { MAX_BULK_DOCUMENTS } from '../print.constants';

/**
 * Print request DTOs.
 *
 * `accYear` is REQUIRED on every document-scoped request and is not defaulted
 * here. sales.sale_bill is partitioned by sb_acc_year and carries the composite
 * key (sb_id, sb_acc_year), so a lookup without it scans every partition — and
 * on a customer with five years of history that turns a 2ms header read into a
 * sequential scan on every print. Making the caller state it is the difference.
 */

export class PrintQueryDto {
  @ApiProperty({
    description:
      'Accounting year of the document, e.g. 2026-2027. Required: the bill tables are partitioned by it.',
    example: '2026-2027',
  })
  @TrimmedString(9)
  accYear!: string;

  @ApiPropertyOptional({
    description: 'Paper code. A4 | A5 | T58 | T80 | DM80 | DM132.',
    default: 'A4',
  })
  @OptionalUpperMaxString(20)
  paper?: string;

  @ApiPropertyOptional({
    description: 'Output mode. PDF | ESCPOS | ESCP_DOTMATRIX.',
    default: 'PDF',
  })
  @OptionalUpperMaxString(20)
  mode?: string;

  @ApiPropertyOptional({ description: 'Use a specific template instead of the resolved default.' })
  @OptionalUuid()
  templateId?: string;

  @ApiPropertyOptional({ description: 'Branch scope for template resolution.' })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    description:
      'Printer profile code, for the raw output modes. Omitted = built-in Epson defaults.',
  })
  @OptionalTrimmedString(40)
  printerProfile?: string;

  @ApiPropertyOptional({
    description:
      'Party id, for statement-style reports whose subject is a ledger rather than a document.',
  })
  @OptionalUuid()
  partyId?: string;

  @ApiPropertyOptional({
    description: 'As-on date for an aged statement, ISO yyyy-MM-dd. Defaults to today.',
    example: '2026-08-24',
  })
  @OptionalTrimmedString(10)
  asOn?: string;
}

export class BulkPrintDto {
  @ApiProperty({ description: 'Document type, e.g. SALE_INVOICE.', maxLength: 40 })
  @UpperMaxString(40)
  docType!: string;

  @ApiProperty({
    description: `Document ids to render. Capped at ${MAX_BULK_DOCUMENTS} per job.`,
    type: [String],
  })
  @IsArray()
  @ArrayNotEmpty()
  @ArrayMaxSize(MAX_BULK_DOCUMENTS)
  @IsString({ each: true })
  docIds!: string[];

  @ApiProperty({ description: 'Accounting year of the documents.', example: '2026-2027' })
  @TrimmedString(9)
  accYear!: string;

  @ApiPropertyOptional({ default: 'A4' })
  @OptionalUpperMaxString(20)
  paper?: string;

  @ApiPropertyOptional({ default: 'PDF' })
  @OptionalUpperMaxString(20)
  mode?: string;

  @ApiPropertyOptional()
  @OptionalUuid()
  templateId?: string;

  @ApiPropertyOptional()
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional()
  @OptionalTrimmedString(40)
  printerProfile?: string;

  @ApiPropertyOptional({
    description: 'Extra parameters passed to every provider.',
    type: 'object',
    additionalProperties: true,
  })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}

export class PreviewDto {
  @ApiProperty({
    description: 'The definition to render. Need not be saved, and is validated in full first.',
    type: 'object',
    additionalProperties: true,
  })
  @IsDefined({ message: 'definition is required' })
  @IsObject({ message: 'definition must be an object' })
  definition!: Record<string, unknown>;

  @ApiPropertyOptional({
    description: 'Output mode. Defaults from the definition layout mode: GRID -> ESCPOS, else PDF.',
  })
  @OptionalUpperMaxString(20)
  mode?: string;

  @ApiPropertyOptional({
    type: Boolean,
    description:
      'Render against provider sample data rather than a real document. ' +
      'Defaults to true when no docId is supplied — which is what keeps the ' +
      'designer usable against a production tenant without reading its data.',
  })
  @OptionalQueryBoolean()
  useSampleData?: boolean;

  @ApiPropertyOptional({ description: 'Render a real document instead of sample data.' })
  @OptionalTrimmedString(64)
  docId?: string;

  @ApiPropertyOptional({ example: '2026-2027' })
  @OptionalTrimmedString(9)
  accYear?: string;

  @ApiPropertyOptional()
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional()
  @OptionalTrimmedString(40)
  printerProfile?: string;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  @IsOptional()
  @IsObject()
  params?: Record<string, unknown>;
}
