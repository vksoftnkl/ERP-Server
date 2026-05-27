import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Delete, Get, ParseUUIDPipe, Post, Query, Version } from '@nestjs/common';
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
import { HttpErrorResponseDto } from '../dto/http-error-response.dto';
import { ListSequenceQueryDto } from './dto/list-sequence-query.dto';
import {
  SequenceErrorResponseDto,
  SequenceSuccessDeleteDto,
  SequenceSuccessListDto,
  SequenceSuccessSingleDto,
} from './dto/sequence-response.dto';
import { SaveSequenceDto } from './dto/save-sequence.dto';
import { SequenceService } from './sequence.service';
import {
  SequenceListItem,
  SequenceListMeta,
  SequencePayload,
  SequenceSuccessResponse,
} from './types/sequence-api.types';
import { API_VERSION } from '../constants/api-version';
@ApiTags('Sequence')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('sequences')
export class SequenceController {
  constructor(private readonly sequenceService: SequenceService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update sequence (by id presence)' })
  @ApiCreatedResponse({ type: SequenceSuccessSingleDto })
  @ApiBadRequestResponse({ type: SequenceErrorResponseDto })
  @ApiConflictResponse({ type: SequenceErrorResponseDto })
  @ApiNotFoundResponse({ type: SequenceErrorResponseDto })
  async save(
    @Body() saveSequenceDto: SaveSequenceDto,
  ): Promise<SequenceSuccessResponse<SequencePayload>> {
    const data = await this.sequenceService.save(saveSequenceDto);
    return {
      success: true,
      message: saveSequenceDto.id ? 'Sequence updated successfully' : 'Sequence saved successfully',
      data,
    };
  }
  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List sequences with filter/search/pagination' })
  @ApiOkResponse({ type: SequenceSuccessListDto })
  @ApiBadRequestResponse({ type: SequenceErrorResponseDto })
  async list(
    @Query() queryDto: ListSequenceQueryDto,
  ): Promise<SequenceSuccessResponse<SequenceListItem[], SequenceListMeta>> {
    const result = await this.sequenceService.list(queryDto);
    return {
      success: true,
      message: 'Sequences fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get sequence by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SequenceSuccessSingleDto })
  @ApiBadRequestResponse({ type: SequenceErrorResponseDto })
  @ApiNotFoundResponse({ type: SequenceErrorResponseDto })
  async getById(
    @Query('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<SequenceSuccessResponse<SequencePayload>> {
    const data = await this.sequenceService.getById(id);
    return {
      success: true,
      message: 'Sequence fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete sequence by id' })
  @ApiQuery({ name: 'id', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SequenceSuccessDeleteDto })
  @ApiBadRequestResponse({ type: SequenceErrorResponseDto })
  @ApiNotFoundResponse({ type: SequenceErrorResponseDto })
  async remove(
    @Query('id', new ParseUUIDPipe({ version: '7' })) id: string,
  ): Promise<SequenceSuccessResponse<{ id: string; deleted: true }>> {
    const data = await this.sequenceService.softDelete(id);
    return {
      success: true,
      message: 'Sequence deleted successfully',
      data,
    };
  }
}
