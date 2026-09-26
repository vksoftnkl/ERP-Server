import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, Matches, ValidateIf } from 'class-validator';
import {
  OptionalInteger,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';

/** §6.1 */
export class VoucherTypesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({
    description:
      'The menu the screen was opened from. A type’s own menu (101 … 261) returns that type only; ' +
      'the Voucher Register menu (or none) returns every type the caller may view.',
  })
  @OptionalInteger(1)
  menuId?: number;
}

/** §6.2 */
export class LedgerPickQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: 'PurA' })
  @TrimmedString(20)
  typeCode!: string;

  @ApiProperty({ enum: ['DR', 'CR'] })
  @IsIn(['DR', 'CR'])
  side!: 'DR' | 'CR';

  @ApiPropertyOptional({ description: 'Type-ahead on the ledger name / alias.' })
  @OptionalTrimmedString(100)
  q?: string;

  @ApiPropertyOptional({ default: 50, maximum: 500 })
  @OptionalInteger(1, 500)
  limit?: number;
}

/** §6.3 */
export class LedgerBalanceQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Omit for the company as a whole.' })
  @OptionalUuid()
  branchId?: string | null;

  @ApiProperty({ example: '2026-2027' })
  @Matches(/^\d{4}-\d{4}$/)
  accYear!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  ledgerId!: string;

  @ApiProperty({ example: '2026-09-15' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOn!: string;
}

/** §6.4 */
export class PartyFactsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({ example: '2026-09-15', description: 'The TDS rate in force on this date.' })
  @Matches(/^\d{4}-\d{2}-\d{2}$/)
  asOn!: string;
}

/** §6.5 */
export class OpenBillsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  partyId!: string;

  @ApiProperty({
    enum: ['DR', 'CR'],
    description: 'The bills’ side: DR = what the party owes, CR = what they hold.',
  })
  @IsIn(['DR', 'CR'])
  side!: 'DR' | 'CR';
}

/** §6.6 */
export class TaxRatesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiPropertyOptional({ description: 'Include inactive rates.' })
  @IsOptional()
  @ValidateIf((_, v) => v !== undefined)
  includeInactive?: string;
}
