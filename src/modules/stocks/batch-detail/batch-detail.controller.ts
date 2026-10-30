import { Body, Controller, Get, Post, Query, Version } from '@nestjs/common';
import { CacheTTL } from '@nestjs/cache-manager';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnprocessableEntityResponse,
} from '@nestjs/swagger';
import { API_VERSION } from 'src/common/constants/api-version';
import { BatchDetailService, type BatchDetailRecord } from './batch-detail.service';
import { BatchDetailModelsQueryDto, UpdateBatchDetailDto } from './dto/batch-detail.dto';

@ApiTags('Stock')
@ApiBearerAuth('access-token')
@Controller('stock/batch-detail')
export class BatchDetailController {
  constructor(private readonly service: BatchDetailService) {}

  @Get('models')
  @Version(API_VERSION)
  // Not cached: a model typed on the last save must be offered on the next line.
  @CacheTTL(0)
  @ApiOperation({
    summary: 'The models used before for an item — the Model cell’s suggestions',
    description:
      'Textile addendum 2 E3.2. Distinct models (ignoring case) on the item’s live batch ' +
      'details, most recently used first, at most 20. q narrows to models containing it, ' +
      'ignoring case.',
  })
  @ApiOkResponse({ description: 'data: string[]' })
  @ApiBadRequestResponse({ description: 'VALIDATION_*' })
  async models(
    @Query() q: BatchDetailModelsQueryDto,
  ): Promise<{ success: true; message: string; data: string[] }> {
    const data = await this.service.models(q);
    return { success: true, message: `${data.length} model(s)`, data };
  }

  @Post('update')
  @Version(API_VERSION)
  @ApiOperation({
    summary: 'Put right a posted batch’s size, colour or model',
    description:
      'Textile addendum 2 E2. Once its inward document is posted, a batch’s detail changes only ' +
      'here: a field left out is kept, null clears it, and the reason is required. The before ' +
      'and after are kept on audit.audit_log (screen "Batch Detail"). Stock does not move.',
  })
  @ApiCreatedResponse({ description: 'data: BatchDetailRecord' })
  @ApiBadRequestResponse({ description: 'VALIDATION_*' })
  @ApiNotFoundResponse({ description: 'STOCK_BATCH_DETAIL_NOT_FOUND' })
  @ApiConflictResponse({ description: 'STOCK_BATCH_DETAIL_ON_DRAFT — change it on the draft' })
  @ApiUnprocessableEntityResponse({
    description: 'STOCK_BATCH_SIZE_NOT_FOUND, STOCK_BATCH_COLOUR_NOT_FOUND',
  })
  async update(
    @Body() dto: UpdateBatchDetailDto,
  ): Promise<{ success: true; message: string; data: BatchDetailRecord }> {
    const data = await this.service.update(dto);
    return { success: true, message: 'Batch detail updated', data };
  }
}
