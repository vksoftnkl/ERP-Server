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
import { DeliveryChallanExceptionFilter } from './delivery-challan-exception.filter';
import { DeliveryChallanService } from './delivery-challan.service';
import { SaveDeliveryChallanDto } from './dto/save-delivery-challan.dto';
import {
  AmendDeliveryChallanDto,
  CancelDeliveryChallanDto,
  ConvertPurposeDto,
  DeliveryChallanKeysDto,
  DeliveryChallanTransportDto,
  PostDeliveryChallanDto,
  ValidateDeliveryChallanDto,
} from './dto/delivery-challan-lifecycle.dto';

type Ok<T> = { success: true; message: string; data: T };
const ok = <T>(message: string, data: T): Ok<T> => ({ success: true, message, data });

/** HANDOVER §4 — `/api/v1/delivery-challans`. Body prefix `sdc` / `sdi`. */
@ApiTags('Delivery Challans')
@ApiBearerAuth('access-token')
@CacheTTL(1)
@Controller('delivery-challans')
@UseFilters(DeliveryChallanExceptionFilter)
export class DeliveryChallanController {
  constructor(private readonly service: DeliveryChallanService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update a DRAFT challan (by sdcId presence)' })
  async save(@Body() dto: SaveDeliveryChallanDto) {
    return ok(
      dto.sdcId ? 'Challan updated successfully' : 'Challan created successfully',
      await this.service.save(dto),
    );
  }

  @Post('validate')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Dry-run the post. Writes nothing.' })
  async validate(@Body() dto: ValidateDeliveryChallanDto) {
    return ok('Challan validated', await this.service.validate(dto));
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Post a DRAFT challan: stock out (DC_ISSUE), COGS pair under PERPETUAL, e-way register row',
  })
  async post(@Body() dto: PostDeliveryChallanDto) {
    return ok('Challan posted successfully', await this.service.post(dto));
  }

  @Post('cancel')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Cancel a POSTED challan by reversal (SALES_DC_BILLED / SALES_DC_RETURNED refuse it)',
  })
  async cancel(@Body() dto: CancelDeliveryChallanDto) {
    return ok('Challan cancelled successfully', await this.service.cancel(dto));
  }

  @Post('amend')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Amend a POSTED challan (no e-way bill yet): unwind, re-apply, re-post, revision + 1',
  })
  async amend(@Body() dto: AmendDeliveryChallanDto) {
    return ok('Challan amended successfully', await this.service.amend(dto));
  }

  @Post('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft-delete a DRAFT challan' })
  async remove(@Body() dto: DeliveryChallanKeysDto) {
    return ok('Draft challan deleted successfully', await this.service.delete(dto));
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get a challan — header, items, charges, transport, posting, locks (with editable.purpose), rights',
  })
  @ApiQuery({ name: 'sdcId' })
  @ApiQuery({ name: 'sdcCompanyId' })
  @ApiQuery({ name: 'sdcBranchId' })
  @ApiQuery({ name: 'sdcAccYear' })
  async get(
    @Query('sdcId', new ParseUUIDPipe({ version: '7' })) sdcId: string,
    @Query('sdcCompanyId', new ParseUUIDPipe({ version: '7' })) sdcCompanyId: string,
    @Query('sdcBranchId', new ParseUUIDPipe({ version: '7' })) sdcBranchId: string,
    @Query('sdcAccYear') sdcAccYear: string,
  ) {
    return ok(
      'Challan fetched successfully',
      await this.service.get({
        id: sdcId,
        companyId: sdcCompanyId,
        branchId: sdcBranchId,
        accYear: sdcAccYear,
      }),
    );
  }

  @Get('open-for-bill')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Open challan lines of a party a bill can take (= /bills/open-sources?kind=DC)',
  })
  @ApiQuery({ name: 'companyId' })
  @ApiQuery({ name: 'branchId' })
  @ApiQuery({ name: 'partyId' })
  @ApiQuery({ name: 'accYear', required: false })
  async openForBill(
    @Query('companyId', new ParseUUIDPipe({ version: '7' })) companyId: string,
    @Query('branchId', new ParseUUIDPipe({ version: '7' })) branchId: string,
    @Query('partyId', new ParseUUIDPipe({ version: '7' })) partyId: string,
    @Query('accYear') accYear?: string,
  ) {
    return ok(
      'Open challans fetched',
      await this.service.openForBill({ companyId, branchId, partyId, accYear: accYear || null }),
    );
  }

  @Post('convert-purpose')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Change the purpose of a POSTED challan (refused after the e-way bill, or once billed / returned)',
  })
  async convertPurpose(@Body() dto: ConvertPurposeDto) {
    return ok('Purpose converted', await this.service.convertPurpose(dto));
  }

  @Put('transport')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'The transport band on its own verb; refused after the e-way bill (GST_DECLARED_LOCKED)',
  })
  async transport(@Body() dto: DeliveryChallanTransportDto) {
    return ok('Transport details saved', await this.service.transport(dto));
  }
}
