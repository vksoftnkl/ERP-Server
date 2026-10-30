import { Body, Controller, Get, HttpCode, Post, Query, UseFilters, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiProperty,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { VoucherErrorResponseDto } from '../vouchers/dto/voucher-response.dto';
import type { VoucherSuccessResponse } from '../vouchers/types/vouchers-api.types';
import { IssuedChequesExceptionFilter } from './issued-cheques-exception.filter';
import { IssuedChequesService } from './issued-cheques.service';
import { ChequeBooksService } from './cheque-books.service';
import {
  ChequeBookKeysDto,
  CloseChequeBookDto,
  IssuedChequeKeysDto,
  PresentedChequeDto,
  ReplaceChequeDto,
  ReverseChequeDto,
  SaveChequeBookDto,
  VoidChequeDto,
} from './dto/issued-cheques.dto';
import type {
  ChequeBookPayload,
  IssuedChequeHistoryPayload,
  IssuedChequePayload,
  ReplacedChequePayload,
} from './types/issued-cheques-api.types';

class IssuedSuccessDto {
  @ApiProperty({ example: true }) success!: true;
  @ApiProperty() message!: string;
  @ApiProperty({ type: Object }) data!: unknown;
}

/**
 * notes (55) §4.10 — Issued Cheques, menu 52: our cheques handed to suppliers
 * by a Payment Voucher. The list is grid 121 ("MAIN LIST - ISSUED CHEQUES").
 * Rights are menu 52's; replace also needs post on the Payment Voucher (261),
 * which it raises.
 */
@ApiTags('Issued Cheques')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: VoucherErrorResponseDto })
@Controller('issued-cheques')
@UseFilters(IssuedChequesExceptionFilter)
export class IssuedChequesController {
  constructor(private readonly service: IssuedChequesService) {}

  @Get('get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One issued cheque',
    description:
      'The leaf, book, bank, supplier, favouring, A/c payee, status, the voucher behind it with its ' +
      'TYPE code (`typeCode`, PmtV), the reversal voucher once returned / stopped / voided, and the ' +
      'replacement link either way.',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiNotFoundResponse({ type: VoucherErrorResponseDto })
  async get(@Query() q: IssuedChequeKeysDto): Promise<VoucherSuccessResponse<IssuedChequePayload>> {
    const data = await this.service.get(q);
    return { success: true, message: `Cheque ${data.leaf} — ${data.status}`, data };
  }

  @Get('history')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({ summary: 'An issued cheque’s trail: issued, then every step (txn_status_log)' })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiNotFoundResponse({ type: VoucherErrorResponseDto })
  async history(
    @Query() q: IssuedChequeKeysDto,
  ): Promise<VoucherSuccessResponse<IssuedChequeHistoryPayload>> {
    const data = await this.service.history(q);
    return { success: true, message: `${data.entries.length} step(s) after issue`, data };
  }

  @Post('presented')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'The bank paid it: HELD → CLEARED',
    description:
      'No voucher: the cheque was posted (DR supplier / CR bank) when it was written. Right: post.',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiBadRequestResponse({ type: VoucherErrorResponseDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async presented(
    @Body() dto: PresentedChequeDto,
  ): Promise<VoucherSuccessResponse<IssuedChequePayload>> {
    const data = await this.service.presented(dto);
    return { success: true, message: `Cheque ${data.leaf} presented on ${data.presentedOn}`, data };
  }

  @Post('returned')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Our bank dishonoured it: HELD → BOUNCED, its line reversed',
    description:
      'A ChqBnc voucher against the payment: DR bank (the cheque) + DR TDS Payable (the line’s ' +
      'deduction, if any) / CR supplier (the gross the line discharged). Only THIS cheque’s line of ' +
      'a multi-party voucher comes back; its bill allocations are reversed and the bills reopen. ' +
      '`charges` = the bank’s fee: DR BANK_CHARGES / CR bank. The leaf stays used. Right: cancel.',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async returned(
    @Body() dto: ReverseChequeDto,
  ): Promise<VoucherSuccessResponse<IssuedChequePayload>> {
    const data = await this.service.returned(dto);
    return { success: true, message: `Cheque ${data.leaf} returned — ${data.reversalRefno}`, data };
  }

  @Post('stop')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Stop payment: HELD → CANCELLED (STOPPED), its line reversed',
    description: 'As /returned, filed as a stop. `charges` = the stop-payment fee. Right: cancel.',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async stop(@Body() dto: ReverseChequeDto): Promise<VoucherSuccessResponse<IssuedChequePayload>> {
    const data = await this.service.stop(dto);
    return { success: true, message: `Cheque ${data.leaf} stopped — ${data.reversalRefno}`, data };
  }

  @Post('void')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'It never left the office: HELD → CANCELLED (VOIDED), its line reversed',
    description:
      'A spoilt or wrongly written cheque. The leaf stays used (the book never hands it out again); ' +
      'no bank charge. Right: cancel.',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async void(@Body() dto: VoidChequeDto): Promise<VoucherSuccessResponse<IssuedChequePayload>> {
    const data = await this.service.void(dto);
    return { success: true, message: `Cheque ${data.leaf} voided — ${data.reversalRefno}`, data };
  }

  @Post('replace')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'A new cheque for the same payment: a new leaf, a new Payment Voucher',
    description:
      'From HELD the old cheque is stopped first (its line reversed). From BOUNCED / CANCELLED it ' +
      'already was. A NEW PmtV is raised for the supplier — the old cheque’s amount, the old line’s ' +
      'TDS treatment, the bills it had settled — taking the next leaf of `chequeBookId`. The old row ' +
      'goes REPLACED, pointing at the new one. Rights: amend on menu 52, post on 261.',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async replace(
    @Body() dto: ReplaceChequeDto,
  ): Promise<VoucherSuccessResponse<ReplacedChequePayload>> {
    const data = await this.service.replace(dto);
    return {
      success: true,
      message: `Cheque ${data.replaced.leaf} replaced by ${data.replacement.leaf} on ${data.replacement.voucherRefno}`,
      data,
    };
  }
}

/**
 * notes (55) §4.9 — cheque books; notes (58) — their own menu, 263 (Accounts →
 * Cheque Books), which Issued Cheques' "Cheque books" button also opens. Rights
 * are 263's on every route here. The list is grid 120 ("MAIN LIST - CHEQUE
 * BOOKS"); a Payment Voucher picks from GET /vouchers/cheque-books.
 */
@ApiTags('Cheque Books')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@ApiForbiddenResponse({ type: VoucherErrorResponseDto })
@Controller('cheque-books')
@UseFilters(IssuedChequesExceptionFilter)
export class ChequeBooksController {
  constructor(private readonly service: ChequeBooksService) {}

  @Get('get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One cheque book, with every leaf it has handed out and where it went',
    description: 'Right: view on menu 263 (Cheque Books).',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiNotFoundResponse({ type: VoucherErrorResponseDto })
  async get(@Query() q: ChequeBookKeysDto): Promise<VoucherSuccessResponse<ChequeBookPayload>> {
    const data = await this.service.get(q);
    return { success: true, message: `Book ${data.bookNo} — ${data.left} leaf(s) left`, data };
  }

  @Post('create')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Open a book, or edit one (upsert on chequeBookId)',
    description:
      'A bank account (Bank Accounts / Bank OD) and a leaf range. Two live books on one bank may not ' +
      'share a leaf (VCH_BOOK_OVERLAP). Once a leaf is out, the bank and first leaf are fixed and the ' +
      'last leaf may not drop below the leaves used. Rights: create / edit on menu 263 (Cheque Books).',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiBadRequestResponse({ type: VoucherErrorResponseDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async save(@Body() dto: SaveChequeBookDto): Promise<VoucherSuccessResponse<ChequeBookPayload>> {
    const data = await this.service.save(dto);
    return { success: true, message: `Book ${data.bookNo} saved`, data };
  }

  @Post('close')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Put a book away: no more leaves are handed out from it',
    description: 'The leaves already used stay as they are. Right: edit on menu 263 (Cheque Books).',
  })
  @ApiOkResponse({ type: IssuedSuccessDto })
  @ApiConflictResponse({ type: VoucherErrorResponseDto })
  async close(@Body() dto: CloseChequeBookDto): Promise<VoucherSuccessResponse<ChequeBookPayload>> {
    const data = await this.service.close(dto);
    return { success: true, message: `Book ${data.bookNo} closed`, data };
  }
}
