import { CacheTTL } from '@nestjs/cache-manager';
import { Controller, Get, Query, UseFilters, Version } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from 'src/common/dto/http-error-response.dto';
import { GetItemGstUnitQueryDto } from './dto/get-item-gst-unit-query.dto';
import {
  ItemGstUnitErrorResponseDto,
  ItemGstUnitSuccessListDto,
} from './dto/item-gst-unit-response.dto';
import { ItemGstUnitExceptionFilter } from './item-gst-unit-exception.filter';
import { ItemsGstUnitsMasterService } from './items-gst-units-master.service';
import { ItemGstUnitPayload, ItemGstUnitSuccessResponse } from './types/item-gst-unit-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Item GST Units')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('item-gst-units')
@UseFilters(ItemGstUnitExceptionFilter)
export class ItemsGstUnitsMasterController {
  constructor(private readonly itemsGstUnitsMasterService: ItemsGstUnitsMasterService) {}

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List item GST units with optional search' })
  @ApiOkResponse({ type: ItemGstUnitSuccessListDto })
  @ApiBadRequestResponse({ type: ItemGstUnitErrorResponseDto })
  async list(
    @Query() queryDto: GetItemGstUnitQueryDto,
  ): Promise<ItemGstUnitSuccessResponse<ItemGstUnitPayload[]>> {
    const data = await this.itemsGstUnitsMasterService.list(queryDto);
    return {
      success: true,
      message: 'Item GST units fetched successfully',
      data,
    };
  }
}
