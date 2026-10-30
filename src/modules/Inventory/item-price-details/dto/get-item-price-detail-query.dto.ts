import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
import { OptionalUuid } from 'src/common/dto/dtoDecorators';
export class GetItemPriceDetailQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  item_id!: string;
}
export class GetItemPriceDetailByBarcodeQueryDto {
  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  barcode!: string;

  @ApiPropertyOptional({
    format: 'uuid',
    description:
      "Restricts the match to the company's own items and the shared ones (notes 137 B4). Omitted: any company's.",
  })
  @OptionalUuid()
  company_id?: string;
}
