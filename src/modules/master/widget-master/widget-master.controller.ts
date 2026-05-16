import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseEnumPipe,
  ParseIntPipe,
  Post,
  Query,
  UseFilters,
  Version,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { WidgetPlatform } from '@prisma/client';
import { HttpErrorResponseDto } from '../../../common/dto/http-error-response.dto';
import { ListWidgetQueryDto } from './dto/list-widget-query.dto';
import { SaveWidgetDto } from './dto/save-widget.dto';
import {
  WidgetMasterErrorResponseDto,
  WidgetMasterSuccessDeleteDto,
  WidgetMasterSuccessListDto,
  WidgetMasterSuccessSingleDto,
} from './dto/widget-master-response.dto';
import {
  WidgetMasterListMeta,
  WidgetMasterPayload,
  WidgetMasterSuccessResponse,
} from './types/widget-master-api.types';
import { WidgetMasterExceptionFilter } from './widget-master-exception.filter';
import { WidgetMasterService } from './widget-master.service';

@ApiTags('Widget Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(3600)
@Controller('widget-masters')
@UseFilters(WidgetMasterExceptionFilter)
export class WidgetMasterController {
  constructor(private readonly widgetMasterService: WidgetMasterService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update widget (by widgetNo presence)' })
  @ApiCreatedResponse({ type: WidgetMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: WidgetMasterErrorResponseDto })
  async save(
    @Body() saveWidgetDto: SaveWidgetDto,
  ): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload>> {
    const data = await this.widgetMasterService.save(saveWidgetDto);

    return {
      success: true,
      message: saveWidgetDto.widgetNo
        ? 'Widget updated successfully'
        : 'Widget created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List widgets with group/type filter, search, and pagination' })
  @ApiOkResponse({ type: WidgetMasterSuccessListDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListWidgetQueryDto,
  ): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload[], WidgetMasterListMeta>> {
    const result = await this.widgetMasterService.list(queryDto);

    return {
      success: true,
      message: 'Widgets fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }

  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get widget by id, optionally constrained by widgetType' })
  @ApiQuery({ name: 'widgetNo', type: Number, example: 1 })
  @ApiQuery({
    name: 'widgetType',
    enum: WidgetPlatform,
    enumName: 'WidgetPlatform',
    required: false,
  })
  @ApiOkResponse({ type: WidgetMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: WidgetMasterErrorResponseDto })
  async getById(
    @Query('widgetNo', ParseIntPipe) widgetNo: number,
    @Query('widgetType', new ParseEnumPipe(WidgetPlatform, { optional: true }))
    widgetType?: WidgetPlatform,
  ): Promise<WidgetMasterSuccessResponse<WidgetMasterPayload>> {
    const data = await this.widgetMasterService.getById(widgetNo, widgetType);

    return {
      success: true,
      message: 'Widget fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Delete widget by id' })
  @ApiQuery({ name: 'widgetNo', type: Number, example: 1 })
  @ApiOkResponse({ type: WidgetMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: WidgetMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: WidgetMasterErrorResponseDto })
  async remove(
    @Query('widgetNo', ParseIntPipe) widgetNo: number,
  ): Promise<WidgetMasterSuccessResponse<{ widgetNo: number; deleted: true }>> {
    const data = await this.widgetMasterService.delete(widgetNo);

    return {
      success: true,
      message: 'Widget deleted successfully',
      data,
    };
  }
}
