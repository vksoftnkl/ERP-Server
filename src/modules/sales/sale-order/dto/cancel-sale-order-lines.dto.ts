import { ApiPropertyOptional } from '@nestjs/swagger';
import { NullableStringStrict } from 'src/common/dto/dtoDecorators';
// Body of PUT /sale-orders/cancel-lines. The order itself is identified by the
// three query params (srcModule / srcDocId / srcAccYear), so the only thing the
// body carries is why the remaining quantity is being written off. One reason
// serves both places it is recorded — the lines and the status trail — because
// a single call writes off the whole balance for a single stated reason.
//
// Named soiCancelReason rather than a bare `reason` on purpose:
// SaleOrderExceptionFilter infers the failing field from class-validator's
// message with /\b((?:so|cd|td)[A-Za-z0-9]+)\b/, so a name without one of those
// roots would come back as a 400 with no `field` attached.
export class CancelSaleOrderLinesDto {
  @ApiPropertyOptional({
    maxLength: 250,
    nullable: true,
    description:
      'Why the remaining quantity is being cancelled. Written to ' +
      'sale_order_item.soi_cancel_reason on every line this call closes out — the lines it ' +
      'leaves alone keep whatever they already held — and carried to the status trail ' +
      '(public.txn_status_log.tsl_remarks), which sale_order has no column of its own for. ' +
      "Omitted, the line column is left untouched and the trail records 'No reason recorded' " +
      'rather than failing the call.',
  })
  @NullableStringStrict(250)
  soiCancelReason?: string | null;
}
