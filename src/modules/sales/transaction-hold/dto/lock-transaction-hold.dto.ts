import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum } from 'class-validator';
import { NullableStringStrict, RequiredUuid, UpperMaxString } from 'src/common/dto/dtoDecorators';
import { TransactionHoldDocType } from '../types/transaction-hold-api.types';

// Body of POST /transaction-holds/:id/resume and /release. The tenant scope is
// required rather than inferred: transaction_hold carries no FKs and the
// request context knows only the company, so the branch has to come from the
// caller — and every lock query filters on BOTH halves so a hold can never be
// grabbed across a branch boundary.
//
// The device holding the lock is NOT here: it is the X-Device-Id header, so the
// same value identifies the caller on every endpoint and cannot be spoofed by a
// body field that disagrees with it.
export class LockTransactionHoldDto {
  @ApiProperty({ format: 'uuid', description: 'Company the hold was parked in' })
  @RequiredUuid()
  thCompanyId!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch the hold was parked in' })
  @RequiredUuid()
  thBranchId!: string;
}

// Body of POST /transaction-holds/:id/convert — the scope above plus the
// document the hold turned into.
export class ConvertTransactionHoldDto extends LockTransactionHoldDto {
  @ApiProperty({
    enum: TransactionHoldDocType,
    enumName: 'TransactionHoldDocType',
    description: 'Kind of document the hold became',
  })
  @UpperMaxString(20)
  @IsEnum(TransactionHoldDocType)
  thConvertedDocType!: TransactionHoldDocType;

  @ApiProperty({
    format: 'uuid',
    description: 'Id of that document (polymorphic — no FK, so the type above names it)',
  })
  @RequiredUuid()
  thConvertedDocId!: string;

  @ApiPropertyOptional({ maxLength: 30, nullable: true, description: 'That document’s number' })
  @NullableStringStrict(30)
  thConvertedNo?: string | null;

  @ApiPropertyOptional({
    maxLength: 50,
    nullable: true,
    description: 'Actor id or name; defaults to the caller',
  })
  @NullableStringStrict(50)
  thConvertedBy?: string | null;
}
