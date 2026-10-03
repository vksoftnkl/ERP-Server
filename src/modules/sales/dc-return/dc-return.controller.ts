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
  DcReturnTransportDto,
  PostDcReturnDto,
} from './dto/dc-return-lifecycle.dto';

const ok = <T>(message: string, data: T) => ({ success: true as const, message, data });

/** HANDOVER §5 — `/api/v1/dc-returns`. No `/amend` on this document at all. */
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
    summary: 'Create or update a DRAFT DC return (sdrDcId + sdrDcAccYear, lines with sdriDcItemId)',
  })
  async save(@Body() dto: SaveDcReturnDto) {
    return ok(
      dto.sdrId ? 'DC return updated successfully' : 'DC return created successfully',
      await this.service.save(dto),
    );
  }

  @Post('post')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Post: goods back in (DC_RETURN), COGS reversed under PERPETUAL, inward challan register row',
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
  @ApiOperation({ summary: 'The challan lines still open for return' })
  @ApiQuery({ name: 'sdcId' })
  @ApiQuery({ name: 'sdcAccYear' })
  async openLines(
    @Query('sdcId', new ParseUUIDPipe({ version: '7' })) sdcId: string,
    @Query('sdcAccYear') sdcAccYear: string,
  ) {
    return ok('Open challan lines fetched', await this.service.openLines(sdcId, sdcAccYear));
  }

  @Put('transport')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'The transport band (direction INWARD); refused after the e-way bill' })
  async transport(@Body() dto: DcReturnTransportDto) {
    return ok('Transport details saved', await this.service.transport(dto));
  }
}
