import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { TXN_DOC_TYPES, type TxnDocType } from '../txn-adjacent.registry';

export class TxnAdjacentDocDto {
  @ApiProperty({ format: 'uuid' }) docId!: string;
  @ApiProperty({ format: 'uuid' }) companyId!: string;
  @ApiProperty({ format: 'uuid' }) branchId!: string;
  @ApiProperty({ example: '2026-2027' }) accYear!: string;
  @ApiProperty({
    example: 'OPENING',
    description: 'The row’s own type: svh_voucher_type, the *_doc_type, or the voucher type code.',
  })
  typeCode!: string;
  @ApiProperty({
    type: String,
    nullable: true,
    description: 'null on a draft that has no number yet (a sale bill, a voucher).',
  })
  refno!: string | null;
  @ApiProperty({ example: '2026-10-23' }) date!: string;
  @ApiProperty({ example: 'POSTED' }) status!: string;
}

export class TxnAdjacentPayloadDto {
  @ApiProperty({ enum: TXN_DOC_TYPES }) docType!: TxnDocType;
  @ApiProperty({ enum: ['prev', 'next'] }) direction!: 'prev' | 'next';
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'null when the walk started from an empty screen.',
  })
  fromDocId!: string | null;
  @ApiPropertyOptional({
    type: TxnAdjacentDocDto,
    nullable: true,
    description: 'null at either end of the list.',
  })
  doc!: TxnAdjacentDocDto | null;
}

export class TxnAdjacentSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: TxnAdjacentPayloadDto }) data!: TxnAdjacentPayloadDto;
}

export class TxnAdjacentErrorDetailDto {
  @ApiProperty() field!: string;
  @ApiProperty() message!: string;
  @ApiProperty({ example: 'TXN_DOC_NOT_FOUND' }) code!: string;
}

export class TxnAdjacentErrorResponseDto {
  @ApiProperty({ example: false }) success!: false;
  @ApiProperty() message!: string;
  @ApiProperty({ type: [TxnAdjacentErrorDetailDto] }) errors!: TxnAdjacentErrorDetailDto[];
}
