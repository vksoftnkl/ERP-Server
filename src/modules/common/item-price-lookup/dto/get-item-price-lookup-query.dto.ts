import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';
export class GetItemPriceLookupQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  item_id!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  unit_id!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branch_id!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  company_id!: string;
}
