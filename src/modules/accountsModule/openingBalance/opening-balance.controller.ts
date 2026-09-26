import {
  Body,
  Controller,
  Delete,
  Get,
  ParseUUIDPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { API_VERSION } from '../../../common/constants/api-version';
import { OpeningBalanceExceptionFilter } from './opening-balance-exception.filter';
import { OpeningBalanceService } from './opening-balance.service';
import { BillWiseService } from './bill-wise.service';
import { CarryForwardService } from './carry-forward.service';
import { ListOpeningBalanceQueryDto } from './dto/list-opening-balance-query.dto';
import { SaveOpeningBalanceDto } from './dto/save-opening-balance.dto';
import { ListOpeningBillsQueryDto, SaveOpeningBillsDto } from './dto/save-opening-bill.dto';
import { CarryForwardDto } from './dto/carry-forward.dto';
import {
  CarryForwardSuccessDto,
  OpeningBalanceDeleteSuccessDto,
  OpeningBalanceErrorResponseDto,
  OpeningBalanceListSuccessDto,
  OpeningBalanceSaveSuccessDto,
  OpeningBillsSaveSuccessDto,
  OpeningBillsSuccessDto,
  TrialBalanceSuccessDto,
} from './dto/opening-balance-response.dto';
import type {
  CarryForwardPayload,
  OpeningBalanceDeletePayload,
  OpeningBalanceListPayload,
  OpeningBalanceSavePayload,
  OpeningBalanceSuccessResponse,
  OpeningBillsPayload,
  OpeningBillsSavePayload,
  TrialBalancePayload,
} from './types/opening-balance-api.types';

/**
 * Six endpoints (§4). The first four are the company-year set; the last two are
 * the carry-forward job and the bill-by-bill breakup.
 *
 * There is no PUT and no edit endpoint: `create` IS the edit (§5.5), because a
 * second code path for the same rules is a second place for them to drift.
 */
@ApiTags('Opening Balances')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('opening-balances')
@UseFilters(OpeningBalanceExceptionFilter)
export class OpeningBalanceController {
  constructor(
    private readonly openingBalanceService: OpeningBalanceService,
    private readonly billWiseService: BillWiseService,
    private readonly carryForwardService: CarryForwardService,
  ) {}

  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Every balance-sheet ledger for a company-year, with its opening if it has one',
    description:
      'A review surface over the FULL chart, not a list of rows that happen to exist — so there ' +
      'is no paging: a partial chart is a wrong trial balance, not a slow one.',
  })
  @ApiOkResponse({ type: OpeningBalanceListSuccessDto })
  @ApiBadRequestResponse({ type: OpeningBalanceErrorResponseDto })
  async list(
    @Query() query: ListOpeningBalanceQueryDto,
  ): Promise<OpeningBalanceSuccessResponse<OpeningBalanceListPayload>> {
    const data = await this.openingBalanceService.list(query);

    return { success: true, message: 'Opening balances fetched successfully', data };
  }

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Save the whole opening set for one company-year',
    description:
      'Upsert: rows carrying opId are updated, rows without one inserted, and with replace:true ' +
      'rows absent from the array are soft deleted. An amount of 0 writes no row — absence is ' +
      'the zero. This is also the EDIT endpoint; there is no other.',
  })
  @ApiCreatedResponse({ type: OpeningBalanceSaveSuccessDto })
  @ApiBadRequestResponse({ type: OpeningBalanceErrorResponseDto })
  async save(
    @Body() dto: SaveOpeningBalanceDto,
  ): Promise<OpeningBalanceSuccessResponse<OpeningBalanceSavePayload>> {
    const data = await this.openingBalanceService.save(dto);

    return {
      success: true,
      message: data.trialBalance.isBalanced
        ? 'Opening balances saved successfully'
        : `Opening balances saved — the set is out by ${Math.abs(data.trialBalance.difference).toFixed(2)}`,
      data,
    };
  }

  @Get('trial-balance')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Debit and credit totals for a company-year, and the plug ledger',
    description:
      'Its own endpoint because the screen shows it permanently and recomputes as the operator ' +
      'types. differenceLedgerId is the OPENING_DIFFERENCE role resolved through acc_ledger_map — ' +
      'null when the company has not mapped it, and the plug then cannot be offered.',
  })
  @ApiOkResponse({ type: TrialBalanceSuccessDto })
  @ApiBadRequestResponse({ type: OpeningBalanceErrorResponseDto })
  async trialBalance(
    @Query() query: ListOpeningBalanceQueryDto,
  ): Promise<OpeningBalanceSuccessResponse<TrialBalancePayload>> {
    const data = await this.openingBalanceService.trialBalance(query);

    return { success: true, message: 'Trial balance fetched successfully', data };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Soft delete one opening row',
    description: 'Refused while OPENING bills still point at it — delete the bills first.',
  })
  @ApiQuery({ name: 'opId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'accYear', schema: { type: 'string', example: '2026-2027' } })
  @ApiOkResponse({ type: OpeningBalanceDeleteSuccessDto })
  @ApiBadRequestResponse({ type: OpeningBalanceErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningBalanceErrorResponseDto })
  async remove(
    // accYear is not optional: the primary key is (op_id, op_acc_year) because
    // the table is partitioned on the year, so an id alone does not name a row.
    @Query('opId', new ParseUUIDPipe({ version: '7' })) opId: string,
    @Query('accYear') accYear: string,
  ): Promise<OpeningBalanceSuccessResponse<OpeningBalanceDeletePayload>> {
    const data = await this.openingBalanceService.softDelete(opId, accYear);

    return { success: true, message: 'Opening balance deleted successfully', data };
  }

  @Post('carry-forward')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Derive one year's openings from the previous year's closings",
    description:
      'One transaction. Carries the balance-sheet ledgers, the P&L result onto the ' +
      'RETAINED_EARNINGS ledger, and every still-open bill of a bill-wise party — without that ' +
      'last part a carry-forward silently destroys the ageing of every debtor. MANUAL and ' +
      'MIGRATION rows are spared unless overwriteManual is set, and are always reported.',
  })
  @ApiCreatedResponse({ type: CarryForwardSuccessDto })
  @ApiBadRequestResponse({ type: OpeningBalanceErrorResponseDto })
  async carryForward(
    @Body() dto: CarryForwardDto,
  ): Promise<OpeningBalanceSuccessResponse<CarryForwardPayload>> {
    const data = await this.carryForwardService.run(dto);

    return {
      success: true,
      message: `Carried ${data.created + data.updated} opening(s) and ${data.billsCarried} bill(s) into ${data.toAccYear}`,
      data,
    };
  }

  @Get('bills')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "One bill-by-bill party's opening bills, and the figures that must tie",
    description: 'branchId is required — abl_branch_id is NOT NULL, so a bill always has a branch.',
  })
  @ApiOkResponse({ type: OpeningBillsSuccessDto })
  @ApiBadRequestResponse({ type: OpeningBalanceErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningBalanceErrorResponseDto })
  async listBills(
    @Query() query: ListOpeningBillsQueryDto,
  ): Promise<OpeningBalanceSuccessResponse<OpeningBillsPayload>> {
    const data = await this.billWiseService.list(query);

    return { success: true, message: 'Opening bills fetched successfully', data };
  }

  @Post('bills')
  @Version(API_VERSION)
  @ApiOperation({
    summary: "Save one bill-by-bill party's whole breakup",
    description:
      "This endpoint OWNS the party's opening figure: it rewrites op_amount / op_dr_cr from " +
      'these bills in the same transaction, so the tie is true by construction. A bill that has ' +
      'been receipted against accepts only date, credit-day and narration changes. ' +
      'NOTE: replace:true is not "here is the whole breakup, sort it out" — a row WITHOUT an ' +
      'ablId is an insert, so re-sending a bill the screen loaded without carrying its ablId ' +
      'through is refused by ux_abl_doc_refno as a duplicate reference. Keep the ablId from GET ' +
      'on every existing row; only genuinely new bills omit it.',
  })
  @ApiCreatedResponse({ type: OpeningBillsSaveSuccessDto })
  @ApiBadRequestResponse({ type: OpeningBalanceErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningBalanceErrorResponseDto })
  async saveBills(
    @Body() dto: SaveOpeningBillsDto,
  ): Promise<OpeningBalanceSuccessResponse<OpeningBillsSavePayload>> {
    const data = await this.billWiseService.save(dto);

    return { success: true, message: 'Opening bills saved successfully', data };
  }
}
