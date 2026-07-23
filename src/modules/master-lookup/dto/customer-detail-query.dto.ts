import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { OptionalQueryBoolean, RequiredUuid } from 'src/common/dto/dtoDecorators';
export class CustomerDetailQueryDto {
  @ApiProperty({ format: 'uuid', description: 'Customer id (legacy isale_cust_id)' })
  @RequiredUuid()
  cus_id!: string;
  @ApiProperty({ format: 'uuid', description: 'Company id (legacy icompany_id)' })
  @RequiredUuid()
  company_id!: string;
  @ApiProperty({ format: 'uuid', description: 'Branch id (sales context)' })
  @RequiredUuid()
  branch_id!: string;
  @ApiPropertyOptional({
    description:
      'Regional name (legacy iregional). When true, name/address use the regional-language fields, else the English fields.',
  })
  @OptionalQueryBoolean()
  regional?: boolean;
}