import { ApiProperty } from '@nestjs/swagger';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/**
 * §4 — F12's bucket list for one item. `itemId` is in the path; both ids here
 * are required because a bucket's prices only mean anything relative to a
 * company and the branch reading them.
 */
export class PriceBucketsQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  branchId!: string;
}
