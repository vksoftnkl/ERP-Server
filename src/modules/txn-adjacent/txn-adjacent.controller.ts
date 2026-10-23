import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { API_VERSION } from '../../common/constants/api-version';
import { TxnAdjacentQueryDto } from './dto/txn-adjacent-query.dto';
import {
  TxnAdjacentErrorResponseDto,
  TxnAdjacentSuccessDto,
} from './dto/txn-adjacent-response.dto';
import { TXN_DOC_REGISTRY } from './txn-adjacent.registry';
import { TxnAdjacentService, type TxnAdjacentPayload } from './txn-adjacent.service';

/** Notes 142 — one Previous / Next route for every document type. */
@ApiTags('Transactions')
@ApiBearerAuth('access-token')
@Controller('txn')
export class TxnAdjacentController {
  constructor(private readonly service: TxnAdjacentService) {}

  @Get('adjacent')
  @Version(API_VERSION)
  // No cache: the lists change all day, a cached neighbour is a walk that
  // loops or skips a document somebody just keyed, and the cache key does not
  // carry the user whose rights filtered the answer.
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The document entered just before or just after this one, for any document type',
    description:
      'notes 142 — Previous / Next (Ctrl+PgUp / Ctrl+PgDn) on every transaction screen. ' +
      'Returns a KEY; load it with the screen’s own /get.\n\n' +
      '**prev = older, next = newer**, on (date, serial, created on, id) — the order the lists ' +
      'show. A draft with no serial yet sits where its list draws it: at the NEW end of its date ' +
      'for a sale bill, receipt or payment, at the OLD end for a Voucher Register voucher.\n\n' +
      'Walked: this company / branch / year, not deleted, cancelled included, the docType’s own ' +
      'rows only (OPENING_STOCK walks svh_voucher_type OPENING; STOCK_ADJUSTMENT its four kinds; ' +
      'STOCK_TRANSFER TRANSFER_OUT; STOCK_TRANSFER_RECEIPT TRANSFER_IN; RECEIPT / PAYMENT their ' +
      'one type, never a PDC child or a reversal; VOUCHER the register types), and only on a menu ' +
      'the caller may VIEW. VOUCHER reads each row on its own type’s menu, as /vouchers/adjacent.\n\n' +
      '`typeCode` walks one type; `status` / `fromDate` / `toDate` are the list’s filters. Omit ' +
      '`docId` on an empty screen: prev → the newest document, next → the oldest. `doc` is null ' +
      'at either end.',
  })
  @ApiOkResponse({ type: TxnAdjacentSuccessDto })
  @ApiBadRequestResponse({ type: TxnAdjacentErrorResponseDto })
  @ApiNotFoundResponse({ type: TxnAdjacentErrorResponseDto })
  @ApiForbiddenResponse({ type: TxnAdjacentErrorResponseDto })
  async adjacent(
    @Query() q: TxnAdjacentQueryDto,
  ): Promise<{ success: true; message: string; data: TxnAdjacentPayload }> {
    const data = await this.service.adjacent(q);
    const label = TXN_DOC_REGISTRY[q.docType].label;
    return {
      success: true,
      message: data.doc
        ? `${data.doc.refno ?? '(draft)'} is the ${q.direction} ${label}`
        : `No ${q.direction} ${label} — this is the end of the list`,
      data,
    };
  }
}
