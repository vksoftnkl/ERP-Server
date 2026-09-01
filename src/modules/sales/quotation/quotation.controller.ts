import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  DefaultValuePipe,
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
import { QuotationExceptionFilter } from './quotation-exception.filter';
import { QuotationService } from './quotation.service';
import { SaveQuotationDto } from './dto/save-quotation.dto';
import {
  QuotationErrorResponseDto,
  QuotationSuccessDeleteDto,
  QuotationSuccessSingleDto,
} from './dto/quotation-response.dto';
import { QuotationPayload, QuotationSuccessResponse } from './types/quotation-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Quotations')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('quotations')
@UseFilters(QuotationExceptionFilter)
export class QuotationController {
  constructor(private readonly quotationService: QuotationService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update quotation (by sqId presence)' })
  @ApiCreatedResponse({ type: QuotationSuccessSingleDto })
  @ApiBadRequestResponse({ type: QuotationErrorResponseDto })
  @ApiConflictResponse({ type: QuotationErrorResponseDto })
  @ApiNotFoundResponse({ type: QuotationErrorResponseDto })
  async save(
    @Body() saveQuotationDto: SaveQuotationDto,
  ): Promise<QuotationSuccessResponse<QuotationPayload>> {
    const data = await this.quotationService.save(saveQuotationDto);
    return {
      success: true,
      message: saveQuotationDto.sqId
        ? 'Quotation updated successfully'
        : 'Quotation created successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Get quotation by id or quote no',
    description: 'Pass sqId or sqQuoteNo — at least one is required; both may be given together.',
  })
  @ApiQuery({ name: 'sqId', schema: { type: 'string', format: 'uuid' }, required: false })
  @ApiQuery({ name: 'sqQuoteNo', schema: { type: 'string' }, required: false })
  @ApiQuery({ name: 'sqCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sqBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sqAccYear', schema: { type: 'string' } })
  @ApiOkResponse({ type: QuotationSuccessSingleDto })
  @ApiBadRequestResponse({ type: QuotationErrorResponseDto })
  @ApiNotFoundResponse({ type: QuotationErrorResponseDto })
  async getById(
    @Query(
      'sqId',
      new DefaultValuePipe(undefined),
      new ParseUUIDPipe({ version: '7', optional: true }),
    )
    sqId: string | undefined,
    @Query('sqQuoteNo') sqQuoteNo: string | undefined,
    @Query('sqCompanyId', new ParseUUIDPipe({ version: '7' })) sqCompanyId: string,
    @Query('sqBranchId', new ParseUUIDPipe({ version: '7' })) sqBranchId: string,
    @Query('sqAccYear') sqAccYear: string,
  ): Promise<QuotationSuccessResponse<QuotationPayload>> {
    const data = await this.quotationService.getById(sqId, sqQuoteNo, sqCompanyId, sqBranchId, sqAccYear);
    return {
      success: true,
      message: 'Quotation fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete quotation by id' })
  @ApiQuery({ name: 'sqId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sqCompanyId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sqBranchId', schema: { type: 'string', format: 'uuid' } })
  @ApiQuery({ name: 'sqAccYear', schema: { type: 'string' } })
  @ApiOkResponse({ type: QuotationSuccessDeleteDto })
  @ApiBadRequestResponse({ type: QuotationErrorResponseDto })
  @ApiNotFoundResponse({ type: QuotationErrorResponseDto })
  async remove(
    @Query('sqId', new ParseUUIDPipe({ version: '7' })) sqId: string,
    @Query('sqCompanyId', new ParseUUIDPipe({ version: '7' })) sqCompanyId: string,
    @Query('sqBranchId', new ParseUUIDPipe({ version: '7' })) sqBranchId: string,
    @Query('sqAccYear') sqAccYear: string,
  ): Promise<QuotationSuccessResponse<{ sqId: string; deleted: true }>> {
    const data = await this.quotationService.softDelete(
      sqId,
      sqCompanyId,
      sqBranchId,
      sqAccYear,
    );
    return {
      success: true,
      message: 'Quotation deleted successfully',
      data,
    };
  }
}
