import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, IsUUID } from 'class-validator';
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
}
