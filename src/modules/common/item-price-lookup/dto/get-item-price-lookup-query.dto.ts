import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import {
  OptionalNumber,
  OptionalTrimmedString,
  OptionalUpperString,
  OptionalUuid,
  RequiredUuid,
} from 'src/common/dto/dtoDecorators';
export class GetItemPriceLookupQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  item_id!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  unit_id?: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  company_id!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branch_id!: string;
  @ApiPropertyOptional({ format: 'uuid' })
  @OptionalUuid()
  customer_id?: string;
  @ApiPropertyOptional({ maxLength: 9, description: 'Accounting year, e.g. 2024-2025' })
  @OptionalTrimmedString(9)
  acccyear?: string;
  @ApiPropertyOptional({ maxLength: 1, description: 'Price level: A, B, C or D' })
  @OptionalUpperString(1)
  @Matches(/^[A-D]$/, { message: 'price_level must be one of A, B, C, D' })
  price_level?: string;
  @ApiPropertyOptional({ minimum: 0, description: 'Quantity, for quantity-based pricing' })
  @OptionalNumber(0)
  quantity?: number;
}
