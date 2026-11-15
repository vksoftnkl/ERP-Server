import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { VoucherNumberingMode, VoucherResetFreq } from '@prisma/client';
import { IsIn, IsOptional, IsString, MaxLength } from 'class-validator';
import {
  NullableInteger,
  NullableStringStrict,
  NullableUuid,
  OptionalBoolean,
  OptionalInteger,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';

const NUMBERING_MODES = Object.values(VoucherNumberingMode);
const RESET_FREQS = Object.values(VoucherResetFreq);

/**
 * POST /voucher-types/save and /validate (plan §7.1 / §7.2). No vchrTypeId = a new
 * CHILD type (Q1: under Sales Bill). A key left out keeps the stored value (an
 * edit) or the base's (a new child). Ranges (width 1–9, starting no ≥ 1, the
 * abbreviation's shape) answer their VT_ codes, not VALIDATION_, so the screen
 * words them.
 */
export class SaveVoucherTypeDto {
  @ApiProperty({
    format: 'uuid',
    description: 'The login company (VT_COMPANY_MISMATCH otherwise).',
  })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ description: 'Present = edit that type.' })
  @OptionalInteger(1)
  vchrTypeId?: number;

  @ApiPropertyOptional({
    nullable: true,
    description: 'A child names its base (3 Sales Bill); a base sends null.',
  })
  @NullableInteger(1)
  vchrParentId?: number | null;

  @ApiPropertyOptional({ maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  vchrTypeName?: string;

  @ApiPropertyOptional({
    maxLength: 30,
    description: 'Abbreviation: 1 to 6 letters or digits (a child).',
  })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  vchrTypeShort?: string;

  @ApiPropertyOptional({ minimum: 0 })
  @OptionalInteger(0)
  vchrSortOrder?: number;

  @ApiPropertyOptional({ description: 'A child only; a base keeps its Active (OP-2).' })
  @OptionalBoolean()
  vchrIsActive?: boolean;

  @ApiPropertyOptional({
    enum: NUMBERING_MODES,
    description: "Method. 'AUTO' only today (decision 42).",
  })
  @IsOptional()
  @IsIn(NUMBERING_MODES)
  vchrNumberingMode?: VoucherNumberingMode;

  @ApiPropertyOptional({ maxLength: 20, nullable: true, description: 'May hold {FY}, {YY}, {BR}.' })
  @NullableStringStrict(20)
  vchrNoPrefix?: string | null;

  @ApiPropertyOptional({ maxLength: 20, nullable: true })
  @NullableStringStrict(20)
  vchrNoSuffix?: string | null;

  @ApiPropertyOptional({ description: '1 to 9 (VT_WIDTH_INVALID).' })
  @OptionalInteger()
  vchrNoWidth?: number;

  @ApiPropertyOptional({ enum: RESET_FREQS })
  @IsOptional()
  @IsIn(RESET_FREQS)
  vchrResetFreq?: VoucherResetFreq;

  @ApiPropertyOptional({
    description: 'First number of every NEW counter, 1 or more (VT_START_NO_INVALID).',
  })
  @OptionalInteger()
  vchrStartNo?: number;

  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  vchrPrintTitle?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'A print design from /get printDesigns.',
  })
  @NullableUuid()
  vchrPrintPurposeId?: string | null;

  @ApiPropertyOptional()
  @OptionalBoolean()
  vchrPrintAfterPost?: boolean;

  @ApiPropertyOptional({
    maxLength: 100,
    nullable: true,
    description: 'Child only (Q9); stored, no export yet.',
  })
  @NullableStringStrict(100)
  vchrTallyVoucherTypeName?: string | null;

  @ApiPropertyOptional({
    description:
      'Base 3 only: "Offer Sales Bill itself on new bills" for this company (sales.offer_base_bill_type).',
  })
  @OptionalBoolean()
  offerBase?: boolean;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'The branch the preview / counters are shown for (default: the company default branch).',
  })
  @OptionalUuid()
  branchId?: string;

  @ApiPropertyOptional({
    example: '2026-2027',
    description: 'The year the preview / counters are shown for (default: today’s).',
  })
  @OptionalTrimmedString(9)
  accYear?: string;
}

/** POST /voucher-types/validate — the save body (plan §7.1). */
export class ValidateVoucherTypeDto extends SaveVoucherTypeDto {}
