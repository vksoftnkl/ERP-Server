import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { ArrayMaxSize, IsArray, IsIn, IsOptional, ValidateNested } from 'class-validator';
import {
  NullableString,
  NullableUuid,
  OptionalBoolean,
  OptionalUuid,
  RequiredNumber,
  RequiredUuid,
  UpperMaxString,
} from 'src/common/dto/dtoDecorators';
import { OpeningDrCr, OpeningSource } from '../types/opening-balance-enum';

/** One ledger's opening. `opId` present = update, absent = insert (§4.2). */
export class SaveOpeningBalanceRowDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Present = update that row; absent = insert. The upsert is the edit (§5.5).',
  })
  @OptionalUuid()
  opId?: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  opLedgerId!: string;

  @ApiProperty({
    example: 124500.0,
    minimum: 0,
    description:
      'ALWAYS POSITIVE — the side is opDrCr, never a sign. 0 writes no row at all: absence ' +
      'is the zero (§5.1 rule 4).',
  })
  // Deliberately NOT @RequiredNumber(0): a negative is refused by the service
  // instead, so the message can name the ledger and the row (§5.1 rule 3). A
  // min here would answer first, with only the field name.
  @RequiredNumber()
  opAmount!: number;

  @ApiProperty({ enum: OpeningDrCr, description: "ONE character. acc_bill_balance uses two — do not unify them." })
  @IsIn(Object.values(OpeningDrCr))
  opDrCr!: OpeningDrCr;

  @ApiPropertyOptional({
    enum: OpeningSource,
    default: OpeningSource.MANUAL,
    description:
      'Echo back what the list returned. The service overrides it when an edit to a ' +
      'CARRY_FORWARD figure makes it MANUAL (§5.5 rule 1) — what is sent here cannot keep a ' +
      'corrected figure generated.',
  })
  @IsOptional()
  @IsIn(Object.values(OpeningSource))
  opSource?: OpeningSource;

  @ApiPropertyOptional({ maxLength: 500, nullable: true })
  @NullableString(500)
  opRemarks?: string | null;
}

/**
 * §4.2. The whole set for one company-year in one body, with the same replace
 * semantics as tax-rates `lines[]`.
 *
 * `rows: []` with `replace: true` is a legitimate request meaning "clear this
 * year". An OMITTED `rows` key is not the same thing and is refused — the two
 * must never be confused, because one of them deletes everything.
 */
export class SaveOpeningBalanceDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  opCompanyId!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Explicit null = the company-level set. Must be settable to null (§8 rule 4).',
  })
  @NullableUuid()
  opBranchId?: string | null;

  @ApiProperty({ example: '2026-2027' })
  @UpperMaxString(9)
  opAccYear!: string;

  @ApiPropertyOptional({ format: 'uuid', nullable: true, description: 'Stamped onto every row written.' })
  @NullableUuid()
  opTenantId?: string | null;

  @ApiProperty({
    type: () => SaveOpeningBalanceRowDto,
    isArray: true,
    description:
      'The whole set. Required — send [] with replace:true to clear the year, but never omit ' +
      'the key.',
  })
  @IsArray()
  @ArrayMaxSize(5000)
  @ValidateNested({ each: true })
  @Type(() => SaveOpeningBalanceRowDto)
  rows!: SaveOpeningBalanceRowDto[];

  @ApiPropertyOptional({
    default: false,
    description:
      'true = rows absent from the array are soft deleted. false = the array is a partial ' +
      'update and nothing is deleted.',
  })
  @OptionalBoolean()
  replace?: boolean;
}
