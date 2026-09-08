import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';
import { OptionalUuid } from 'src/common/dto/dtoDecorators';
export class BarcodeLookupQueryDto {
  @ApiProperty({
    example: '8901234567890',
    maxLength: 64,
    description:
      'Barcode / EAN code to resolve (legacy iflag=10). Matched case-insensitively against item_ean_codes.ean_code.',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @IsNotEmpty()
  @MaxLength(64)
  barcode!: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Company id (legacy icompany_id). When given, the barcode only resolves to an item that belongs to this company or to no company at all (legacy item_comp_id IN (0, icompany_id)). When omitted, the lookup is by barcode alone.',
  })
  @OptionalUuid()
  company_id?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description:
      'Branch id (legacy ibranch_id). When given, the barcode only resolves to an item that belongs to this branch or to no branch at all (item_branch_id IS NULL — a company-wide item). When omitted, branch is not checked.',
  })
  @OptionalUuid()
  branch_id?: string;
}
