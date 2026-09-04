import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  AdjustableCreditBillType,
  AdjustableCreditSide,
  AdjustableCreditStatus,
  BillAdjType,
  BillSettlementMode,
} from '../types/transaction-api.types';

export class TransactionErrorFieldDto {
  @ApiProperty({ example: 'partyId' })
  field!: string;

  @ApiProperty({ example: 'partyId must be a UUID' })
  message!: string;
}

export class TransactionErrorResponseDto {
  @ApiProperty({ example: false })
  success!: false;

  @ApiProperty({ example: 'Validation failed' })
  message!: string;

  @ApiProperty({ type: TransactionErrorFieldDto, isArray: true })
  errors!: TransactionErrorFieldDto[];
}

export class AdjustableCreditDto {
  @ApiProperty({
    format: 'uuid',
    description:
      'acc_bill_balance.abl_id — the key the adjustment posts against (abj_bill_id). Not a key on its own: post billAccYear alongside it as abj_bill_acc_year.',
  })
  billId!: string;

  @ApiProperty({
    example: '2025-2026',
    minLength: 9,
    maxLength: 9,
    description:
      "The FY the credit originated in, and the second half of the bill key. A bill is never carried forward, so a March advance can settle an April invoice — this may differ from the entry screen's year.",
  })
  billAccYear!: string;

  @ApiProperty({
    enum: AdjustableCreditBillType,
    enumName: 'AdjustableCreditBillType',
    description:
      'Decides how the row settles; adjType and settlementMode below are derived from it.',
  })
  billType!: AdjustableCreditBillType;

  @ApiProperty({ example: 'SO-2201', maxLength: 100 })
  docRefno!: string;

  @ApiProperty({ format: 'date', example: '2026-03-27' })
  docDate!: string;

  @ApiProperty({
    example: 50000,
    description: 'Face value. Display only — the adjustable ceiling is pendingAmount.',
  })
  billAmount!: number;

  @ApiProperty({
    example: 18500,
    description:
      'What is LEFT: bill − allocated − discount − written off (generated column). Always > 0 on these rows.',
  })
  pendingAmount!: number;

  @ApiProperty({
    enum: AdjustableCreditStatus,
    enumName: 'AdjustableCreditStatus',
    description: 'CLOSED credits are never returned.',
  })
  status!: AdjustableCreditStatus;

  @ApiProperty({
    enum: AdjustableCreditSide,
    enumName: 'AdjustableCreditSide',
    description:
      "abl_dr_cr — the side this row sits on, echoing the request's type. ADVANCE on CR is the customer's money held; the same ADVANCE on DR is money paid to a supplier.",
  })
  drCr!: AdjustableCreditSide;

  @ApiPropertyOptional({ nullable: true, example: 'SALES', maxLength: 20 })
  srcModule!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'SALES_ORDER', maxLength: 30 })
  srcDocType!: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The sale order / sales return this credit came from. The bill screen matches on it to pre-fill the panel when an order is imported.',
  })
  srcDocId!: string | null;

  @ApiPropertyOptional({ nullable: true, example: '2025-2026', minLength: 9, maxLength: 9 })
  srcAccYear!: string | null;

  @ApiPropertyOptional({ nullable: true, example: 'Advance received on order' })
  narration!: string | null;

  @ApiProperty({
    enum: BillAdjType,
    enumName: 'BillAdjType',
    description: 'acc_bill_adjustment.abj_adj_type to post for this row.',
  })
  adjType!: BillAdjType;

  @ApiProperty({
    enum: BillSettlementMode,
    enumName: 'BillSettlementMode',
    description: 'acc_bill_adjustment.abj_settlement_mode to post for this row.',
  })
  settlementMode!: BillSettlementMode;
}

export class AdjustableCreditListSuccessDto {
  @ApiProperty({ example: true })
  success!: true;

  @ApiProperty({ example: 'Party adjustable credits fetched successfully' })
  message!: string;

  @ApiProperty({
    type: AdjustableCreditDto,
    isArray: true,
    description:
      'Oldest first (FIFO), tie-broken on docRefno. Empty when the party holds no credit.',
  })
  data!: AdjustableCreditDto[];
}
