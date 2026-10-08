import {
  Body,
  Controller,
  Get,
  HttpCode,
  Post,
  Query,
  UploadedFile,
  UseFilters,
  UseInterceptors,
  Version,
} from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConflictResponse,
  ApiConsumes,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { assertMenuRight, type MenuRight } from '../../../common/posting/rights';
import { PrismaService } from '../../../database/prisma/prisma.service';
import {
  ConfirmSettlementLineDto,
  IgnoreSettlementLineDto,
  ImportSettlementDto,
  ResolveSettlementLineDto,
  SaveSettlementFormatDto,
  SettlementFormatQueryDto,
  SettlementKeyDto,
  SettlementLineKeyDto,
  TestSettlementFormatDto,
  VoidSettlementDto,
  WriteOffTenderDto,
} from './dto/tender-settlement.dto';
import { TenderSettlementExceptionFilter } from './tender-settlement-exception.filter';
import { TenderSettlementExceptionService } from './tender-settlement-exceptions.service';
import { TenderSettlementService, type UploadedStatement } from './tender-settlement.service';
import type {
  SettlementFormatPayload,
  SettlementFormatTestPayload,
  SettlementImportPayload,
  SettlementImportResultPayload,
  SettlementPostPayload,
  SettlementResolvePayload,
  SettlementSuccessResponse,
  WriteOffPayload,
} from './types/tender-settlement-api.types';
import { SETTLEMENT_MENU_ID, SETTLEMENT_RIGHT_PREFIX } from './types/tender-settlement-enum';

/**
 * /tender-settlement/* — non-cash tender control, layers 3 and 4
 * (till/plan-noncash-tender-control.md §5–§7): a provider's statement
 * imported, matched to our card / UPI / wallet rows and posted as one TSet per
 * payout; the not-received and unexplained lists decided. Every verb is judged
 * on menu 278 (no SUPER ADMIN bypass); write-off and resolve need OVERRIDE,
 * which stands in for their approvals until phase 3. Lists are configured
 * grids (20261008190000), not routes. Keys: companyId · branchId · accYear ·
 * asiId (aslId for a line).
 */
@ApiTags('Tender Settlement')
@ApiBearerAuth('access-token')
@ApiForbiddenResponse({ type: HttpErrorResponseDto, description: 'TSET_RIGHT_<VERB> on menu 278' })
@UseFilters(TenderSettlementExceptionFilter)
@Controller('tender-settlement')
export class TenderSettlementController {
  constructor(
    private readonly settlement: TenderSettlementService,
    private readonly exceptions: TenderSettlementExceptionService,
    private readonly prisma: PrismaService,
    private readonly requestContext: RequestContextService,
  ) {}

  @Get('format')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'A tender’s statement column map (tnd_statement_format) — menu 278 VIEW',
  })
  @ApiOkResponse({
    description: 'The tender, its terminal / VPA, its settlement ledger and its map',
  })
  async getFormat(
    @Query() query: SettlementFormatQueryDto,
  ): Promise<SettlementSuccessResponse<SettlementFormatPayload>> {
    await this.requireRight('view', 'read a statement format');
    const data = await this.settlement.getFormat(query.companyId, query.tenderId);
    return {
      success: true,
      message: data.format ? 'Statement format' : 'No statement format yet',
      data,
    };
  }

  @Post('format')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Set (or clear) a tender’s statement column map — menu 278 EDIT',
    description: 'Validated in full: every problem comes back at once (SETTLEMENT_FORMAT_INVALID).',
  })
  @ApiOkResponse({ description: 'The tender and its map' })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  async saveFormat(
    @Body() dto: SaveSettlementFormatDto,
  ): Promise<SettlementSuccessResponse<SettlementFormatPayload>> {
    await this.requireRight('edit', 'set a statement format');
    const data = await this.settlement.saveFormat(dto);
    return {
      success: true,
      message: data.format ? 'Statement format saved' : 'Statement format cleared',
      data,
    };
  }

  @Post('format/test')
  @Version(API_VERSION)
  @HttpCode(200)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: TestSettlementFormatDto })
  @ApiOperation({
    summary: 'What the saved map reads out of a sample file — nothing is written. Menu 278 VIEW',
  })
  @ApiOkResponse({ description: '{ lines (200 at most), problems, payouts }' })
  async testFormat(
    @Body() dto: TestSettlementFormatDto,
    @UploadedFile() file?: UploadedStatement,
  ): Promise<SettlementSuccessResponse<SettlementFormatTestPayload>> {
    await this.requireRight('view', 'test a statement format');
    const data = await this.settlement.testFormat(dto.companyId, dto.tenderId, file);
    return {
      success: true,
      message: `${data.lines.length} line(s) read, ${data.problems.length} problem(s)`,
      data,
    };
  }

  @Post('import')
  @Version(API_VERSION)
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @ApiBody({ type: ImportSettlementDto })
  @ApiOperation({
    summary:
      'Import a provider statement: one import per payout, matched at once — menu 278 CREATE',
    description:
      'Read with the tender’s column map; each line’s tender from its terminal id / VPA. Refused whole: ' +
      'a row that does not read (SETTLEMENT_FILE_INVALID, every row listed), another store’s terminal ' +
      '(SETTLEMENT_OTHER_STORE), an unknown terminal, the same file twice (SETTLEMENT_FILE_DUPLICATE). ' +
      'Then matched: REF, AUTH → MATCHED; AMOUNT_TIME → SUGGESTED.',
  })
  @ApiCreatedResponse({ description: 'The imports, with their lines and what each matched' })
  @ApiUnprocessableEntityResponse({ type: HttpErrorResponseDto })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async import(
    @Body() dto: ImportSettlementDto,
    @UploadedFile() file?: UploadedStatement,
  ): Promise<SettlementSuccessResponse<SettlementImportResultPayload>> {
    await this.requireRight('create', 'import a settlement statement');
    const data = await this.settlement.import(dto, file);
    return { success: true, message: `${data.imports.length} payout(s) imported`, data };
  }

  @Get('get')
  @Version(API_VERSION)
  @CacheTTL(0)
  @ApiOperation({
    summary: 'One payout: its totals, its lines and the tender row each points at — menu 278 VIEW',
  })
  @ApiOkResponse({ description: 'The import' })
  @ApiNotFoundResponse({ type: HttpErrorResponseDto })
  async get(
    @Query() query: SettlementKeyDto,
  ): Promise<SettlementSuccessResponse<SettlementImportPayload>> {
    await this.requireRight('view', 'view a settlement');
    const data = await this.settlement.get(query);
    return { success: true, message: `Payout is ${data.status}`, data };
  }

  @Post('match')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'Re-run matching on the lines still waiting (idempotent) — menu 278 EDIT',
  })
  @ApiOkResponse({ description: 'The import' })
  async match(
    @Body() dto: SettlementKeyDto,
  ): Promise<SettlementSuccessResponse<SettlementImportPayload>> {
    await this.requireRight('edit', 'match a settlement');
    const data = await this.settlement.match(dto);
    return { success: true, message: `Payout is ${data.status}`, data };
  }

  @Post('confirm')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Accept a SUGGESTED match, or link a line to a tender row by hand (MANUAL) — menu 278 EDIT',
  })
  @ApiOkResponse({ description: 'The import' })
  @ApiConflictResponse({
    type: HttpErrorResponseDto,
    description: 'SETTLEMENT_TD_ALREADY_MATCHED · SETTLEMENT_STATE',
  })
  async confirm(
    @Body() dto: ConfirmSettlementLineDto,
  ): Promise<SettlementSuccessResponse<SettlementImportPayload>> {
    await this.requireRight('edit', 'confirm a settlement line');
    const data = await this.settlement.confirm(dto);
    return { success: true, message: 'Line matched', data };
  }

  @Post('unlink')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary: 'A matched, suggested or ignored line back to UNMATCHED — menu 278 EDIT',
  })
  @ApiOkResponse({ description: 'The import' })
  async unlink(
    @Body() dto: SettlementLineKeyDto,
  ): Promise<SettlementSuccessResponse<SettlementImportPayload>> {
    await this.requireRight('edit', 'unlink a settlement line');
    const data = await this.settlement.unlink(dto);
    return { success: true, message: 'Line unlinked', data };
  }

  @Post('ignore')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'A line that is not part of this payout — out of its totals and its voucher. Menu 278 EDIT',
  })
  @ApiOkResponse({ description: 'The import' })
  async ignore(
    @Body() dto: IgnoreSettlementLineDto,
  ): Promise<SettlementSuccessResponse<SettlementImportPayload>> {
    await this.requireRight('edit', 'ignore a settlement line');
    const data = await this.settlement.ignore(dto);
    return { success: true, message: 'Line ignored', data };
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Post the payout: one TSet, the matched rows SETTLED — menu 278 POST',
    description:
      'Dr bank net · Dr bank charges fee · Dr GST on charges (pending) · Dr / Cr Tender suspense · Cr each ' +
      'matched row’s ledger. No approval: it records what the bank did. Refused while a suggestion waits ' +
      '(SETTLEMENT_SUGGESTIONS_OPEN).',
  })
  @ApiCreatedResponse({ description: 'The posted import and its legs' })
  @ApiConflictResponse({ type: HttpErrorResponseDto })
  async post(
    @Body() dto: SettlementKeyDto,
  ): Promise<SettlementSuccessResponse<SettlementPostPayload>> {
    await this.requireRight('post', 'post a settlement');
    const data = await this.settlement.post(dto);
    return {
      success: true,
      message: `Payout posted (${data.voucherRefno ?? data.voucherId})`,
      data,
    };
  }

  @Post('void')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Void a payout: a posted one’s TSet reversed and its rows PENDING again — menu 278 CANCEL',
    description:
      'Refused once a line was resolved or a row written off since (SETTLEMENT_POSTED_LOCKED).',
  })
  @ApiOkResponse({ description: 'The voided import' })
  async void(
    @Body() dto: VoidSettlementDto,
  ): Promise<SettlementSuccessResponse<SettlementImportPayload>> {
    await this.requireRight('cancel', 'void a settlement');
    const data = await this.settlement.void(dto);
    return { success: true, message: 'Payout voided', data };
  }

  @Post('resolve')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Decide a statement line no bill explains: LINKED · REFUNDED · INCOME · SUSPENSE — menu 278 OVERRIDE',
    description:
      'LINKED and INCOME post a TSet journal Dr Tender suspense / Cr the row’s ledger or the income ledger. ' +
      'OVERRIDE stands in for the SETTLEMENT_RESOLVE approval (403 SETTLEMENT_RESOLVE_NEEDS_APPROVAL).',
  })
  @ApiOkResponse({ description: 'The line, and the journal when one was posted' })
  async resolve(
    @Body() dto: ResolveSettlementLineDto,
  ): Promise<SettlementSuccessResponse<SettlementResolvePayload>> {
    await this.requireRight('view', 'resolve a settlement line');
    const data = await this.exceptions.resolve(dto);
    return { success: true, message: `Line resolved ${dto.resolution}`, data };
  }

  @Post('write-off')
  @Version(API_VERSION)
  @HttpCode(200)
  @ApiOperation({
    summary:
      'Write off a card / UPI amount that never arrived, or was charged back — menu 278 OVERRIDE',
    description:
      'RECOVER (a named ledger) · SUSPENSE (still chasing) · LOSS (WRITE_OFF role). A TVar Dr that ledger / Cr ' +
      'the row’s own ledger (Tender suspense for a charged-back row); the row FAILED; NONCASH_WRITTEN_OFF on the ' +
      'row’s own session. OVERRIDE stands in for the NONCASH_WRITE_OFF approval (403 NONCASH_WRITE_OFF_NEEDS_APPROVAL).',
  })
  @ApiOkResponse({ description: 'What was written off, where' })
  async writeOff(
    @Body() dto: WriteOffTenderDto,
  ): Promise<SettlementSuccessResponse<WriteOffPayload>> {
    await this.requireRight('view', 'write off a tender row');
    const data = await this.exceptions.writeOff(dto);
    return { success: true, message: `Written off (${dto.treatment})`, data };
  }

  private async requireRight(right: MenuRight, action: string): Promise<void> {
    await assertMenuRight(this.prisma, {
      userId: this.requestContext.getUserId(),
      menuId: SETTLEMENT_MENU_ID,
      right,
      codePrefix: SETTLEMENT_RIGHT_PREFIX,
      action,
    });
  }
}
