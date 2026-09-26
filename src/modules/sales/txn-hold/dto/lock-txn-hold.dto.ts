import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  NullableStringStrict,
  NullableUuid,
  OptionalInteger,
  OptionalTrimmedString,
  RequiredUuid,
  TrimmedString,
} from 'src/common/dto/dtoDecorators';
import {
  TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT,
  TXN_HOLD_LOCK_TTL_SECONDS_MAX,
  TXN_HOLD_LOCK_TTL_SECONDS_MIN,
} from '../types/txn-hold-api.types';

// Body of POST /txn-holds/:id/resume, /release and /force-release. The tenant
// scope is required rather than inferred: the request context knows only the
// company, so the branch has to come from the caller — and every lock query
// filters on BOTH halves so a hold can never be grabbed across a branch
// boundary.
//
// The device holding the lease is NOT here: it is the X-Device-Id header, so
// the same value identifies the caller on every endpoint and cannot be spoofed
// by a body field that disagrees with it.
export class LockTxnHoldDto {
  @ApiProperty({ format: 'uuid', description: 'Company the hold was parked in' })
  @RequiredUuid()
  txhCompanyId!: string;

  @ApiProperty({ format: 'uuid', description: 'Branch the hold was parked in' })
  @RequiredUuid()
  txhBranchId!: string;

  // txn_hold is partitioned by accounting year, so a request that names the
  // year is answered from one partition instead of every year on record. Left
  // optional because a till recalling a token slip has the id and not the year.
  @ApiPropertyOptional({
    minLength: 9,
    maxLength: 9,
    example: '2026-2027',
    description: 'Accounting year the hold was parked in; prunes the lookup to one partition',
  })
  @OptionalTrimmedString(9)
  txhAccYear?: string;

  @ApiPropertyOptional({
    minimum: TXN_HOLD_LOCK_TTL_SECONDS_MIN,
    maximum: TXN_HOLD_LOCK_TTL_SECONDS_MAX,
    default: TXN_HOLD_LOCK_TTL_SECONDS_DEFAULT,
    description:
      'How long the lease is good for. Once it lapses the next device may resume the hold ' +
      'without a force-release — which is what stops a till that died mid-edit from stranding ' +
      'the cart. Ignored on release',
  })
  @OptionalInteger(TXN_HOLD_LOCK_TTL_SECONDS_MIN, TXN_HOLD_LOCK_TTL_SECONDS_MAX)
  lockTtlSeconds?: number;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description:
      'The token resume answered with. Optional — the device must match anyway — but when sent ' +
      'it is checked, so a till cannot spend a lease that was force-released out from under it',
  })
  @NullableUuid()
  txhLockToken?: string | null;
}

// Body of POST /txn-holds/:id/convert — the scope above plus the document the
// hold turned into. There is no converted DOC TYPE: a hold becomes the document
// it was parked as, so txhDocType on the stored row already names the table
// txhConvertedDocId points into.
export class ConvertTxnHoldDto extends LockTxnHoldDto {
  @ApiProperty({
    format: 'uuid',
    description: 'Id of the document the hold became (polymorphic — no FK)',
  })
  @RequiredUuid()
  txhConvertedDocId!: string;

  // Its OWN year, which may differ from the hold's: a March hold can become an
  // April document. ck_txh_converted_block wants the whole trail or none of it.
  @ApiProperty({
    minLength: 9,
    maxLength: 9,
    example: '2026-2027',
    description: 'Accounting year of that document — may differ from the hold’s',
  })
  @TrimmedString(9)
  txhConvertedAccYear!: string;

  @ApiPropertyOptional({ maxLength: 100, nullable: true, description: 'That document’s number' })
  @NullableStringStrict(100)
  txhConvertedRefno?: string | null;

  @ApiPropertyOptional({
    format: 'uuid',
    nullable: true,
    description: 'Operator who converted it; defaults to the caller',
  })
  @NullableUuid()
  txhConvertedBy?: string | null;
}
