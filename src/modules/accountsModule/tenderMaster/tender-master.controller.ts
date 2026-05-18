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
import {
  TenderMasterErrorResponseDto,
  TenderMasterSuccessDeleteDto,
  TenderMasterSuccessListDto,
  TenderMasterSuccessSingleDto,
} from './dto/tender-master-response.dto';
import { ListTenderMasterQueryDto } from './dto/list-tender-master-query.dto';
import { SaveTenderMasterDto } from './dto/save-tender-master.dto';
import { TenderMasterExceptionFilter } from './tender-master-exception.filter';
import { TenderMasterService } from './tender-master.service';
import {
  TenderMasterListItem,
  TenderMasterListMeta,
  TenderMasterPayload,
  TenderMasterSuccessResponse,
} from './types/tender-master-api.types';

@ApiTags('Tender Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('tender-masters')
@UseFilters(TenderMasterExceptionFilter)
export class TenderMasterController {
  constructor(private readonly tenderMasterService: TenderMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update tender (by tndId presence)' })
  @ApiCreatedResponse({ type: TenderMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: TenderMasterErrorResponseDto })
  @ApiConflictResponse({ type: TenderMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderMasterErrorResponseDto })
  async save(
    @Body() saveTenderMasterDto: SaveTenderMasterDto,
  ): Promise<TenderMasterSuccessResponse<TenderMasterPayload>> {
    const data = await this.tenderMasterService.save(saveTenderMasterDto);

    return {
      success: true,
      message: saveTenderMasterDto.tndId
        ? 'Tender updated successfully'
        : 'Tender created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List tenders with filter/search/pagination' })
  @ApiOkResponse({ type: TenderMasterSuccessListDto })
  @ApiBadRequestResponse({ type: TenderMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListTenderMasterQueryDto,
  ): Promise<TenderMasterSuccessResponse<TenderMasterListItem[], TenderMasterListMeta>> {
    const result = await this.tenderMasterService.list(queryDto);

    return {
      success: true,
      message: 'Tenders fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get tender by id' })
  @ApiQuery({ name: 'tndId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: TenderMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: TenderMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderMasterErrorResponseDto })
  async getById(
    @Query('tndId', new ParseUUIDPipe({ version: '7' })) tndId: string,
  ): Promise<TenderMasterSuccessResponse<TenderMasterPayload>> {
    const data = await this.tenderMasterService.getById(tndId);

    return {
      success: true,
      message: 'Tender fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete tender by id' })
  @ApiQuery({ name: 'tndId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: TenderMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: TenderMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: TenderMasterErrorResponseDto })
  async remove(
    @Query('tndId', new ParseUUIDPipe({ version: '7' })) tndId: string,
  ): Promise<TenderMasterSuccessResponse<{ tndId: string; deleted: true }>> {
    const data = await this.tenderMasterService.softDelete(tndId);

    return {
      success: true,
      message: 'Tender deleted successfully',
      data,
    };
  }
}
