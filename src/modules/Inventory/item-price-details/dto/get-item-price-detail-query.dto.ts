import { ApiProperty } from '@nestjs/swagger';
import { IsUUID } from 'class-validator';

export class GetItemPriceDetailQueryDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('all')
  item_id!: string;
}
