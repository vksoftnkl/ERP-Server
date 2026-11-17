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
import { DcReturnExceptionFilter } from './dc-return-exception.filter';
import { DcReturnService } from './dc-return.service';
import { SaveDcReturnDto } from './dto/save-dc-return.dto';
import {
  CancelDcReturnDto,
  DcReturnKeysDto,
  DcReturnOpenLinesQueryDto,
  DcReturnTransportDto,
  PostDcReturnDto,
  ValidateDcReturnDto,
} from './dto/dc-return-lifecycle.dto';

const ok = <T>(message: string, data: T) => ({ success: true as const, message, data });

/**
 * HANDOVER §5 + challan plan §8.3 — `/api/v1/dc-returns`, menu 251 "Challan
 * Return" (rights read on 251). No `/amend` on this document at all.
 */
@ApiTags('DC Returns')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('dc-returns')
@UseFilters(DcReturnExceptionFilter)
export class DcReturnController {
  constructor(private readonly service: DcReturnService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Create or update a DRAFT challan return (sdrDcId + sdrDcAccYear, lines with sdriDcItemId)',
    description:
      'Right CREATE (new) / EDIT (draft) on menu 251. Every line fact (item, unit, factor, lot, batch, rate, ' +
      'cost, tax, HSN) and the party are copied from the challan; the client sends sdriDcItemId, sdriReturnQty, ' +
      'sdriCondition, sdriGodownId (blank = the challan line\'s), sdriRemarks. Numbered per PC at the first save ' +
      '(DR2627D14-00001). 422 SALES_DC_CHARGES_NOT_ALLOWED / SALES_DCR_LINE_NOT_ON_DC / SALES_DCR_DC_NOT_POSTED / ' +
      'SEQUENCE_REFNO_TOO_LONG; 404 STOCK_DEVICE_NOT_FOUND.',
  })
  async save(@Body() dto: SaveDcReturnDto) {
    return ok(
      dto.sdrId ? 'DC return updated successfully' : 'DC return created successfully',
      await this.service.save(dto),
    );
  }

  @Post('validate')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Dry-run the post on the create body. Writes nothing.',
    description:
      'Right CREATE or EDIT on 251. data: {ok, refusals[], warnings[] (INFO SALES_DCR_DAMAGED_BUCKET), rights, ' +
      'totals {lines, qty, weightKg, costBack}}. Refusals: SALES_DCR_DC_NOT_POSTED, SALES_DCR_LINE_NOT_ON_DC, ' +
      'SALES_DCR_NO_LINES, SALES_DCR_REASON_REQUIRED, SALES_DC_CHARGES_NOT_ALLOWED, SALES_DCR_OVER_OPEN, ' +
      'SALES_BACKDATE, SALES_DAY_CLOSED.',
  })
  async validate(@Body() dto: ValidateDcReturnDto) {
    return ok('DC return validated', await this.service.validate(dto));
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Post: goods back in (DC_RETURN), COGS reversed under PERPETUAL, inward challan register row',
    description:
      'Right POST on 251. Answers the /get payload with challan {sdcId, sdcAccYear, refno, date, purpose, ageDays, ' +
      'ageLevel, value, openBefore, openAfter}.',
  })
  async post(@Body() dto: PostDcReturnDto) {
    return ok('DC return posted successfully', await this.service.post(dto));
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Cancel a POSTED DC return by reversal' })
  async cancel(@Body() dto: CancelDcReturnDto) {
    return ok('DC return cancelled successfully', await this.service.cancel(dto));
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft-delete a DRAFT DC return' })
  async remove(@Body() dto: DcReturnKeysDto) {
    return ok('Draft DC return deleted successfully', await this.service.delete(dto));
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiQuery({ name: 'sdrId' })
  @ApiQuery({ name: 'sdrCompanyId' })
  @ApiQuery({ name: 'sdrBranchId' })
  @ApiQuery({ name: 'sdrAccYear' })
  async get(
    @Query('sdrId', new ParseUUIDPipe({ version: '7' })) sdrId: string,
    @Query('sdrCompanyId', new ParseUUIDPipe({ version: '7' })) sdrCompanyId: string,
    @Query('sdrBranchId', new ParseUUIDPipe({ version: '7' })) sdrBranchId: string,
    @Query('sdrAccYear') sdrAccYear: string,
  ) {
    return ok(
      'DC return fetched successfully',
      await this.service.get({
        id: sdrId,
        companyId: sdrCompanyId,
        branchId: sdrBranchId,
        accYear: sdrAccYear,
      }),
    );
  }

  @Get('open-lines')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The challan and its lines still open for return (VIEW on 251, scoped to company + branch)',
    description:
      'data: challan {sdcId, sdcAccYear, refno, date, status, purpose, custId, custName, ageDays, ageLevel, value, ' +
      'bills[] {sbId, accYear, refno, date, qty}}, lines[] {dcItemId, lineNo, itemId, itemCode, itemName, ' +
      'itemUnitId, unitName, toBaseFactor, unitKg, godownId, godownName, lotId, lotNo, batchNo, bucket, dcQty, ' +
      'billedQty, returnedQty, openQty, onDrafts, rate, costPrice, taxPerc}. Quantities are Decimal strings.',
  })
  async openLines(@Query() q: DcReturnOpenLinesQueryDto) {
    return ok('Open challan lines fetched', await this.service.openLines(q));
  }

  @Put('transport')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'The transport band (direction INWARD, EDIT on 251); refused after the e-way bill. Answers /get.',
  })
  async transport(@Body() dto: DcReturnTransportDto) {
    return ok('Transport details saved', await this.service.transport(dto));
  }
}
