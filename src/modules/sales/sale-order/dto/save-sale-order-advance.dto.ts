import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalTrimmedString,
  OptionalUuid,
  RequiredNumber,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import { IsNotEmpty } from 'class-validator';
// One application of an advance the order holds — where money taken up front
// actually went (sales.sale_order_advance_alloc). The tender row
// (accounts.acc_tender_detail) is the money coming IN; this is the money being
// USED: adjusted into an invoice, refunded, forfeited on cancellation, or
// transferred to another order. Owned by the order module itself — unlike the
// charges[] / tenders[] arrays there is no separate owner module.
export class SaveSaleOrderAdvanceDto {
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'When provided, updates the existing allocation; otherwise a new row is created',
  })
  @OptionalUuid()
  soaId?: string;
  @ApiPropertyOptional({ format: 'uuid', description: 'Defaults to the parent order scope' })
  @OptionalUuid()
  soaCompanyId?: string;
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'Branch that APPLIED the allocation; defaults to the parent order scope',
  })
  @OptionalUuid()
  soaBranchId?: string;
  @ApiPropertyOptional({ format: 'uuid', nullable: true })
  @NullableUuid()
  soaTenantId?: string | null;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description:
      "Year of the APPLICATION (defaults to the parent order's year — an advance taken " +
      'in March is routinely adjusted into an April invoice, so it may differ)',
  })
  @OptionalTrimmedString(9)
  soaAccYear?: string;
  // The order the advance was taken against — always the parent order. Kept on
  // the DTO so clients that echo it back are not rejected, but a value naming a
  // DIFFERENT order is a 400 (mirror of the charge module's immutability rule).
  @ApiPropertyOptional({
    format: 'uuid',
    description: 'The parent order; must be omitted or match it',
  })
  @OptionalUuid()
  soaOrderId?: string;
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    description: "The parent order's accounting year; must be omitted or match it",
  })
  @OptionalTrimmedString(9)
  soaOrderAccYear?: string;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soaOrderRefno?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The acc_tender_detail row that brought the money in. Nullable only for opening ' +
      'balances migrated from the legacy system. Must be sent together with soaTenderAccYear ' +
      '(ck_soa_tender_pair).',
  })
  @NullableUuid()
  soaTenderId?: string | null;
  @ApiPropertyOptional({ minLength: 9, maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  soaTenderAccYear?: string | null;
  @ApiProperty({
    maxLength: 20,
    description: 'ADJUSTED / REFUNDED / FORFEITED / TRANSFERRED (ck_soa_alloc_type)',
  })
  @TrimmedString(20)
  @IsNotEmpty()
  soaAllocType!: string;
  @ApiProperty({ type: 'string', format: 'date' })
  @TrimmedString()
  @IsNotEmpty()
  soaAllocDate!: string;
  @ApiProperty({ description: 'Must be > 0 (ck_soa_amount)' })
  @RequiredNumber()
  soaAmount!: string | number;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'ADJUSTED → the invoice it was set against (required for that type only)',
  })
  @NullableUuid()
  soaBillId?: string | null;
  @ApiPropertyOptional({ minLength: 9, maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  soaBillAccYear?: string | null;
  @ApiPropertyOptional({ maxLength: 100, nullable: true })
  @NullableStringStrict(100)
  soaBillRefno?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'TRANSFERRED → the order it was moved to (required for that type only)',
  })
  @NullableUuid()
  soaTargetOrderId?: string | null;
  @ApiPropertyOptional({ minLength: 9, maxLength: 9, nullable: true })
  @NullableStringStrict(9)
  soaTargetAccYear?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'REFUNDED → the CR tender row the refund went out on',
  })
  @NullableUuid()
  soaRefundTenderId?: string | null;
  @ApiPropertyOptional({
    maxLength: 20,
    nullable: true,
    description: 'CASH / BANK / UPI / CARD / CREDIT_NOTE / ADJUSTMENT (ck_soa_refund_mode)',
  })
  @NullableStringStrict(20)
  soaRefundMode?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Filled at posting, server-side',
  })
  @NullableUuid()
  soaVoucherId?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'The advance liability ledger relieved',
  })
  @NullableUuid()
  soaLedgerId?: string | null;
  @ApiPropertyOptional({ maxLength: 250, nullable: true })
  @NullableStringStrict(250)
  soaRemarks?: string | null;
  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Refunds / forfeits need a sign-off',
  })
  @NullableUuid()
  soaApprovedBy?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict(50)
  soaCreatedBy?: string | null;
  @ApiPropertyOptional({ nullable: true, description: 'Actor id or name; defaults to the caller' })
  @NullableStringStrict(50)
  soaModifiedBy?: string | null;
}
