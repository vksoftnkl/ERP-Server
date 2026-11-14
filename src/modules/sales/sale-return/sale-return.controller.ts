import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Get,
  ParseUUIDPipe,
  Post,
  Put,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import { ApiBearerAuth, ApiOperation, ApiQuery, ApiTags } from '@nestjs/swagger';
import { API_VERSION } from '../../../common/constants/api-version';
import { SaleReturnExceptionFilter } from './sale-return-exception.filter';
import { SaleReturnService } from './sale-return.service';
import { SaveSaleReturnDto } from './dto/save-sale-return.dto';
import {
  AmendSaleReturnDto,
  CancelSaleReturnDto,
  PostSaleReturnDto,
  SaleReturnBillLinesQueryDto,
  SaleReturnKeysDto,
  SaleReturnTransportDto,
  ValidateSaleReturnDto,
} from './dto/sale-return-lifecycle.dto';

const ok = <T>(message: string, data: T) => ({ success: true as const, message, data });

/** HANDOVER §6 — `/api/v1/sale-returns`. The IRN here is a CREDIT NOTE. */
@ApiTags('Sale Returns')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('sale-returns')
@UseFilters(SaleReturnExceptionFilter)
export class SaleReturnController {
  constructor(private readonly service: SaleReturnService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Create (menu 13 CREATE) or update (EDIT) a DRAFT sale return. Money keys are ignored: the server works ' +
      'every figure out from the bill line (D45). Numbered per device at the first save (SRT/<year>/<device>/00001).',
  })
  async save(@Body() dto: SaveSaleReturnDto) {
    return ok(
      dto.srId ? 'Sale return updated successfully' : 'Sale return created successfully',
      await this.service.save(dto),
    );
  }

  @Post('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Dry-run the post (menu 13 CREATE). Writes nothing. Answers ok, refusals[], warnings[] (WARN + INFO), ' +
      'rights and preview { lines[], totals, charges[], emptiesBill, onOtherDrafts[], stockByBucket[], … } — ' +
      'the money the server works out from the bill (D45). A srReturnAmt that no longer matches → SALES_AMOUNT_MISMATCH.',
  })
  async validate(@Body() dto: ValidateSaleReturnDto) {
    return ok('Sale return validated', await this.service.validate(dto));
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Post: goods in, credit-note legs (SRt), CREDIT_NOTE register row, settlement (CASH | ADJUST | ADVANCE), loyalty claw-back',
  })
  async post(@Body() dto: PostSaleReturnDto) {
    return ok('Sale return posted successfully', await this.service.post(dto));
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Cancel a POSTED sale return by reversal (SALES_CN_APPLIED refuses it once the credit has been used)',
  })
  async cancel(@Body() dto: CancelSaleReturnDto) {
    return ok('Sale return cancelled successfully', await this.service.cancel(dto));
  }

  @Post('amend')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Amend a POSTED sale return (no IRN / e-way bill yet): unwind, re-apply, re-post, revision + 1',
  })
  async amend(@Body() dto: AmendSaleReturnDto) {
    return ok('Sale return amended successfully', await this.service.amend(dto));
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft-delete a DRAFT sale return' })
  async remove(@Body() dto: SaleReturnKeysDto) {
    return ok('Draft sale return deleted successfully', await this.service.delete(dto));
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiQuery({ name: 'srId' })
  @ApiQuery({ name: 'srCompanyId' })
  @ApiQuery({ name: 'srBranchId' })
  @ApiQuery({ name: 'srAccYear' })
  async get(
    @Query('srId', new ParseUUIDPipe({ version: '7' })) srId: string,
    @Query('srCompanyId', new ParseUUIDPipe({ version: '7' })) srCompanyId: string,
    @Query('srBranchId', new ParseUUIDPipe({ version: '7' })) srBranchId: string,
    @Query('srAccYear') srAccYear: string,
  ) {
    return ok(
      'Sale return fetched successfully',
      await this.service.get({
        id: srId,
        companyId: srCompanyId,
        branchId: srBranchId,
        accYear: srAccYear,
      }),
    );
  }

  @Get('bill-lines')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'A posted bill for a return (plan v5 §6.2): { bill, lines[], charges[] } — every line with its full money set, ' +
      'what earlier posted returns took and what is left in base units, what other drafts hold; every charge row. ' +
      'Menu 13 VIEW. 404 SALES_NOT_FOUND (not in this company / branch without allBranches); ' +
      '422 SALES_RETURN_BILL_NOT_POSTED; 403 SALES_RIGHT_VIEW.',
  })
  async billLines(@Query() q: SaleReturnBillLinesQueryDto) {
    return ok('Bill lines fetched', await this.service.billLines(q));
  }

  @Put('transport')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'The transport band (direction INWARD); refused after the credit-note IRN or the e-way bill',
  })
  async transport(@Body() dto: SaleReturnTransportDto) {
    return ok('Transport details saved', await this.service.transport(dto));
  }
}
