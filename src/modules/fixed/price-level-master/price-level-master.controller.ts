import { CacheTTL } from '@nestjs/cache-manager';
import { Body, Controller, Get, Patch, Query, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { GetPriceLevelMasterQueryDto } from './dto/get-price-level-master-query.dto';
import { UpdatePriceLevelMasterDto } from './dto/update-price-level-master.dto';
import {
  PriceLevelMasterErrorResponseDto,
  PriceLevelMasterSuccessGetDto,
  PriceLevelMasterSuccessUpdateDto,
} from './dto/price-level-master-response.dto';
import { PriceLevelMasterService } from './price-level-master.service';
import {
  PriceLevelMasterGetMeta,
  PriceLevelMasterPayload,
  PriceLevelMasterSuccessResponse,
} from './types/price-level-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Price Level Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('price-level-masters')
export class PriceLevelMasterController {
  constructor(private readonly priceLevelMasterService: PriceLevelMasterService) { }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({
    summary:
      'Get price levels from fixed.price_levels by priceLvlId or filters. Defaults to active and non-deleted.',
  })
  @ApiOkResponse({ type: PriceLevelMasterSuccessGetDto })
  @ApiBadRequestResponse({ type: PriceLevelMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: PriceLevelMasterErrorResponseDto })
  async get(
    @Query() queryDto: GetPriceLevelMasterQueryDto,
  ): Promise<PriceLevelMasterSuccessResponse<PriceLevelMasterPayload[], PriceLevelMasterGetMeta>> {
    const result = await this.priceLevelMasterService.get(queryDto);
    return {
      success: true,
      message:
        queryDto.priceLvlId !== undefined
          ? 'Price level fetched successfully'
          : 'Price levels fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Patch('bulk')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update one or more price levels in bulk' })
  @ApiOkResponse({ type: PriceLevelMasterSuccessUpdateDto })
  @ApiBadRequestResponse({ type: PriceLevelMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: PriceLevelMasterErrorResponseDto })
  async update(
    @Body() updateDto: UpdatePriceLevelMasterDto,
  ): Promise<PriceLevelMasterSuccessUpdateDto> {
    const data = await this.priceLevelMasterService.update(updateDto);
    return {
      success: true,
      message: 'Price levels updated successfully',
      data,
    };
  }
}