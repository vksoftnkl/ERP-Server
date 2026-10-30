import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsArray, IsIn, IsISO8601, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import {
  OptionalQueryInt,
  OptionalUuid,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';

const ACC_YEAR_PATTERN = /^\d{4}-\d{4}$/;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

/** "a,b" or ?k=a&k=b → ['a','b']; absent → undefined. */
const list = ({ value }: { value: unknown }): unknown => {
  if (value === undefined || value === null || value === '') {
    return undefined;
  }
  const items = (Array.isArray(value) ? value : String(value).split(','))
    .map((v) => String(v).trim())
    .filter(Boolean);
  return items.length ? items : undefined;
};

/** What both routes take (notes 126 §4). */
export class TenderBooksScopeDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  @Matches(ACC_YEAR_PATTERN, { message: 'accYear must look like 2026-2027' })
  accYear!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Absent = every branch.' })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    example: '2026-10-16',
    description: 'YYYY-MM-DD. Day Book: required. No-tender list: absent = the start of the year.',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'fromDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'fromDate is not a calendar date' })
  fromDate?: string;

  @ApiPropertyOptional({
    example: '2026-10-16',
    description: 'YYYY-MM-DD, ≥ fromDate. Absent = fromDate (Day Book) / today (no-tender list).',
  })
  @IsOptional()
  @IsString()
  @Matches(DATE_PATTERN, { message: 'toDate must be YYYY-MM-DD' })
  @IsISO8601({ strict: true }, { message: 'toDate is not a calendar date' })
  toDate?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'One till session (the voucher’s).' })
  @OptionalUuid()
  sessionId?: string;
}

/** GET /reports/tender-day-book. */
export class TenderDayBookQueryDto extends TenderBooksScopeDto {
  @ApiPropertyOptional({
    enum: ['TENDER', 'TYPE'],
    description:
      'TENDER = each tender master on its own ("CARD – HDFC machine 1" apart from "CARD – ICICI ' +
      'machine 2"); TYPE = all of a tender type together. Default TENDER.',
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @IsIn(['TENDER', 'TYPE'])
  groupBy?: 'TENDER' | 'TYPE';

  @ApiPropertyOptional({
    type: [String],
    description: 'Only these tender masters (comma-separated or repeated).',
  })
  @IsOptional()
  @Transform(list)
  @IsArray()
  @IsUUID('all', { each: true })
  tenderIds?: string[];

  @ApiPropertyOptional({
    type: [String],
    description: 'Only these tender types (ids, comma-separated or repeated).',
  })
  @IsOptional()
  @Transform(list)
  @IsArray()
  @Matches(/^\d+$/, { each: true })
  tenderTypeIds?: string[];

  @ApiPropertyOptional({
    description: 'Include the line-by-line rows of the range (default true).',
    enum: ['true', 'false'],
  })
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    value === undefined ? undefined : String(value).toLowerCase() !== 'false',
  )
  withRows?: boolean;

  @ApiPropertyOptional({ minimum: 1, maximum: 20000, description: 'Row cap (default 5000).' })
  @OptionalQueryInt(1, 20000)
  limit?: number;
}

/** GET /reports/tender-day-book/no-tender. */
export class NoTenderQueryDto extends TenderBooksScopeDto {
  @ApiPropertyOptional({ minimum: 1, maximum: 20000, description: 'Row cap (default 5000).' })
  @OptionalQueryInt(1, 20000)
  limit?: number;
}
