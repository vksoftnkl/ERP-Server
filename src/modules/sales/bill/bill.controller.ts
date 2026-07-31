import { CacheTTL } from '@nestjs/cache-manager';
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
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { BillExceptionFilter } from './bill-exception.filter';
import { BillService } from './bill.service';
import { SaveBillDto } from './dto/save-bill.dto';
import {
  BillErrorResponseDto,
  BillSuccessDeleteDto,
  BillSuccessSingleDto,
} from './dto/bill-response.dto';
import { BillPayload, BillSuccessResponse } from './types/bill-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Bills')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('bills')
@UseFilters(BillExceptionFilter)
export class BillController {
  constructor(private readonly billService: BillService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update a bill (by sbId presence)' })
  @ApiCreatedResponse({ type: BillSuccessSingleDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiConflictResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async save(@Body() saveBillDto: SaveBillDto): Promise<BillSuccessResponse<BillPayload>> {
    const data = await this.billService.save(saveBillDto);
    return {
      success: true,
      message: saveBillDto.sbId ? 'Bill updated successfully' : 'Bill created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get bill by id' })
  @ApiQuery({ name: 'sbId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sbAccYear', schema: { type: 'string' } })
  @ApiOkResponse({ type: BillSuccessSingleDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async getById(
    @Query('sbId', new ParseUUIDPipe({ version: '7' })) sbId: string,
    @Query('sbCompanyId', new ParseUUIDPipe({ version: '7' })) sbCompanyId: string,
    @Query('sbBranchId', new ParseUUIDPipe({ version: '7' })) sbBranchId: string,
    @Query('sbAccYear') sbAccYear: string,
  ): Promise<BillSuccessResponse<BillPayload>> {
    const data = await this.billService.getById(sbId, sbCompanyId, sbBranchId, sbAccYear);
    return {
      success: true,
      message: 'Bill fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete bill by id' })
  @ApiQuery({ name: 'sbId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: BillSuccessDeleteDto })
  @ApiBadRequestResponse({ type: BillErrorResponseDto })
  @ApiNotFoundResponse({ type: BillErrorResponseDto })
  async remove(
    @Query('sbId', new ParseUUIDPipe({ version: '7' })) sbId: string,
  ): Promise<BillSuccessResponse<{ sbId: string; deleted: true }>> {
    const data = await this.billService.softDelete(sbId);
    return {
      success: true,
      message: 'Bill deleted successfully',
      data,
    };
  }
}
