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
import { BatchPrefixExceptionFilter } from './batch-prefix-exception.filter';
import {
  BatchPrefixErrorResponseDto,
  BatchPrefixSuccessDeleteDto,
  BatchPrefixSuccessListDto,
  BatchPrefixSuccessSingleDto,
} from './dto/batch-prefix-response.dto';
import { ListBatchPrefixQueryDto } from './dto/list-batch-prefix-query.dto';
import { SaveBatchPrefixDto } from './dto/save-batch-prefix.dto';
import { BatchPrefixService } from './batch-prefix.service';
import {
  BatchPrefixListItem,
  BatchPrefixListMeta,
  BatchPrefixPayload,
  BatchPrefixSuccessResponse,
} from './types/batch-prefix-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Batch Prefix')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('batch-prefixes')
@UseFilters(BatchPrefixExceptionFilter)
export class BatchPrefixController {
  constructor(private readonly batchPrefixService: BatchPrefixService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update batch prefix (by id presence)' })
  @ApiCreatedResponse({ type: BatchPrefixSuccessSingleDto })
  @ApiBadRequestResponse({ type: BatchPrefixErrorResponseDto })
  @ApiConflictResponse({ type: BatchPrefixErrorResponseDto })
  @ApiNotFoundResponse({ type: BatchPrefixErrorResponseDto })
  async save(
    @Body() saveBatchPrefixDto: SaveBatchPrefixDto,
  ): Promise<BatchPrefixSuccessResponse<BatchPrefixPayload>> {
    const data = await this.batchPrefixService.save(saveBatchPrefixDto);
    return {
      success: true,
      message: saveBatchPrefixDto.id
        ? 'Batch prefix updated successfully'
        : 'Batch prefix created successfully',
      data,
    };
  }
  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List batch prefixes with search and pagination' })
  @ApiOkResponse({ type: BatchPrefixSuccessListDto })
  @ApiBadRequestResponse({ type: BatchPrefixErrorResponseDto })
  async list(
    @Query() queryDto: ListBatchPrefixQueryDto,
  ): Promise<BatchPrefixSuccessResponse<BatchPrefixListItem[], BatchPrefixListMeta>> {
    const result = await this.batchPrefixService.list(queryDto);
    return {
      success: true,
      message: 'Batch prefixes fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get batch prefix by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: BatchPrefixSuccessSingleDto })
  @ApiBadRequestResponse({ type: BatchPrefixErrorResponseDto })
  @ApiNotFoundResponse({ type: BatchPrefixErrorResponseDto })
  async getById(
    @Query('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<BatchPrefixSuccessResponse<BatchPrefixPayload>> {
    const data = await this.batchPrefixService.getById(id);
    return {
      success: true,
      message: 'Batch prefix fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Delete batch prefix by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: BatchPrefixSuccessDeleteDto })
  @ApiBadRequestResponse({ type: BatchPrefixErrorResponseDto })
  @ApiNotFoundResponse({ type: BatchPrefixErrorResponseDto })
  async remove(
    @Query('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<BatchPrefixSuccessResponse<{ id: string; deleted: true }>> {
    const data = await this.batchPrefixService.delete(id);
    return {
      success: true,
      message: 'Batch prefix deleted successfully',
      data,
    };
  }
}