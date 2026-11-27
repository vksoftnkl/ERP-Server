import { ApiProperty } from '@nestjs/swagger';
import { Matches } from 'class-validator';
import { RequiredUuid } from 'src/common/dto/dtoDecorators';

/**
 * Change Selling Price P2 (plan 2026-11-24 §7.2) — GET /stock/price-bulk/purchase-lines: the
 * posted purchase bill whose lines menu 30's purchase view loads. All four are required.
 */
export class PurchaseLinesQueryDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  companyId!: string;

  @ApiProperty({ format: 'uuid', description: "The bill's branch (pi_branch_id): a store user's own branch only." })
  @RequiredUuid()
  branchId!: string;

  @ApiProperty({ example: '2026-2027' })
  @Matches(/^\d{4}-\d{4}$/, { message: 'accYear must look like 2026-2027' })
  accYear!: string;

  @ApiProperty({ format: 'uuid', description: 'purchase.pur_invoice.pi_id' })
  @RequiredUuid()
  piId!: string;
}
