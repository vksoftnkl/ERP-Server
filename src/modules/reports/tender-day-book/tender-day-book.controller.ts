import { Controller, Get, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiForbiddenResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { NoTenderQueryDto, TenderDayBookQueryDto } from './tender-day-book.dto';
import { TenderDayBookService } from './tender-day-book.service';
import type { NoTenderPayload, TenderDayBookPayload } from './tender-day-book.types';

interface Ok<T> {
  success: true;
  message: string;
  data: T;
}

const SCOPE_NOTE =
  'Every leg on a CASH / BANK ledger (led_ledger_type) of a POSTED or CANCELLED voucher, labelled by ' +
  'its tender rows: the voucher’s own (td_voucher_id / td_src_doc_id), the document’s (a bill’s, a ' +
  'return’s), a re-tender’s voided and replacing rows, a reversal mirror’s original’s (sides flipped). ' +
  'A row labels the ledger it names or its settlement ledger. Rows short of a leg leave the rest with ' +
  'no tender. Amounts are strings, 2 dp. Menu 284 (Account Day Summary) or 181 (Day Book Detail) view, ' +
  'else 403 NO_MENU_RIGHT.';

const REFUSALS = 'YEAR_UNKNOWN, BRANCH_NOT_IN_COMPANY, RANGE_REVERSED, RANGE_OUTSIDE_YEAR, DATE_REQUIRED';

/** Notes 126 §4 — the Day Book by tender, and the money lines with no tender (own URLs). */
@ApiTags('Reports — Day Book by tender')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'NO_MENU_RIGHT' })
@Controller('reports/tender-day-book')
export class TenderDayBookController {
  constructor(private readonly service: TenderDayBookService) {}

  @Get()
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Day Book by tender: cash / bank movement per tender (or tender type) and ledger',
    description:
      '`groups`: per ledger × tender master (groupBy TENDER — each machine / QR / cash tender on its ' +
      'own) or × tender type (groupBy TYPE), opening (the year’s lines before fromDate), debit, credit, ' +
      'closing; a group with tenderId and tenderTypeId null is the lines with NO tender. `ledgers`: the ' +
      'books per ledger — the opening set (acc_opening_balance: not a transaction, so in no tender group) ' +
      '+ every line — so Σ groups + openingSet = the ledger. `rows`: the range line by line (withRows=' +
      'false leaves them out; limit caps them, rowsTruncated says so). Filters: tenderIds, tenderTypeIds ' +
      '(groups and rows), sessionId (the voucher’s till session), branchId. ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async dayBook(@Query() q: TenderDayBookQueryDto): Promise<Ok<TenderDayBookPayload>> {
    const data = await this.service.dayBook(q);
    return { success: true, message: `${data.groups.length} tender group(s)`, data };
  }

  @Get('no-tender')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'Money lines with no tender — should always be empty',
    description:
      'Every cash / bank line no tender row labels, in the range (fromDate absent = the year’s start, ' +
      'toDate absent = today): count, amount, the count per voucher type, the lines. Each one is a ' +
      'transaction to look into — since notes 126 the server refuses (or, at the counter, labels) every ' +
      'new one. ' +
      SCOPE_NOTE,
  })
  @ApiBadRequestResponse({ type: HttpErrorResponseDto, description: REFUSALS })
  async noTender(@Query() q: NoTenderQueryDto): Promise<Ok<NoTenderPayload>> {
    const data = await this.service.noTender(q);
    return {
      success: true,
      message: data.count === 0 ? 'Every money line has its tender' : `${data.count} money line(s) with no tender`,
      data,
    };
  }
}
