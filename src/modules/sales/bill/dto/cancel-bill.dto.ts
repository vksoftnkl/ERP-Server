import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty } from 'class-validator';
import { RequiredUuid, TrimmedString } from 'src/common/dto/dtoDecorators';
// Body of POST /bills/delete. The route used to be a DELETE addressed entirely
// by query params; it now carries a payload because a cancellation has to say
// WHY and BY WHOM, and neither belongs in a query string.
//
// The four identifiers are the bill's primary key plus the scope it must be
// read under, unchanged from the query params they replace — sale_bill is
// partitioned by sb_acc_year, so the year is not optional garnish.
//
// Field names: `remarks` and `username` are the two the client screen sends,
// so they are kept verbatim rather than renamed to a sb* token. BillExceptionFilter's
// field-detection regex was widened to match them, so a validation failure on
// either still comes back with `field` attached the way an sbX failure does.
export class CancelBillDto {
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbCompanyId!: string;
  @ApiProperty({ format: 'uuid' })
  @RequiredUuid()
  sbBranchId!: string;
  @ApiProperty({ minLength: 9, maxLength: 9, example: '2026-2027' })
  @TrimmedString(9)
  @IsNotEmpty()
  sbAccYear!: string;
  // 250, not 255: this lands in sale_order_item.soi_cancel_reason, which is
  // VarChar(250). Rejecting the 251st character here is a 400 naming the field;
  // letting it through would be a Postgres 22001 rolling back the whole cancel.
  // (public.txn_status_log.tsl_remarks is VarChar(500) and so is never the
  // binding limit.)
  @ApiProperty({
    maxLength: 250,
    description:
      'Why the order is being cancelled. Written to sale_order_item.soi_cancel_reason on ' +
      'every line this call closes out, and to the status trail ' +
      '(public.txn_status_log.tsl_remarks) — which sale_order has no reason column of its own ' +
      'for, by design.',
  })
  @TrimmedString(250)
  @IsNotEmpty()
  remarks!: string;
  // varchar(50), matching the created_by / modified_by columns this is written
  // to. Free text like they are — a user id, a login or a name — so no uuid
  // pattern is imposed. It becomes the actor for every row this call writes:
  // soi_modified_by, so_modified_by, tsl_created_by and the audit-log entry.
  @ApiProperty({
    maxLength: 50,
    description: 'Who is cancelling. Recorded as the actor on every row this call writes.',
  })
  @TrimmedString(50)
  @IsNotEmpty()
  username!: string;
}