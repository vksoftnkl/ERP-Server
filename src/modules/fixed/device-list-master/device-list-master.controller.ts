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
import { DeviceListMasterExceptionFilter } from './device-list-master-exception.filter';
import {
  DeviceListMasterErrorResponseDto,
  DeviceListMasterSuccessDeleteDto,
  DeviceListMasterSuccessListDto,
  DeviceListMasterSuccessSingleDto,
} from './dto/device-list-master-response.dto';
import { ListDeviceListMasterQueryDto } from './dto/list-device-list-master-query.dto';
import { SaveDeviceListMasterDto } from './dto/save-device-list-master.dto';
import { DeviceListMasterService } from './device-list-master.service';
import {
  DeviceListMasterListItem,
  DeviceListMasterListMeta,
  DeviceListMasterPayload,
  DeviceListMasterSuccessResponse,
} from './types/device-list-master-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Device List Master')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(300)
@Controller('device-list-masters')
@UseFilters(DeviceListMasterExceptionFilter)
export class DeviceListMasterController {
  constructor(private readonly deviceListMasterService: DeviceListMasterService) {}
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update device (by devId presence)' })
  @ApiCreatedResponse({ type: DeviceListMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: DeviceListMasterErrorResponseDto })
  @ApiConflictResponse({ type: DeviceListMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: DeviceListMasterErrorResponseDto })
  async save(
    @Body() saveDeviceListMasterDto: SaveDeviceListMasterDto,
  ): Promise<DeviceListMasterSuccessResponse<DeviceListMasterPayload>> {
    const data = await this.deviceListMasterService.save(saveDeviceListMasterDto);
    return {
      success: true,
      message: saveDeviceListMasterDto.devId
        ? 'Device updated successfully'
        : 'Device created successfully',
      data,
    };
  }
  @Get('list')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'List devices with filter/search/pagination' })
  @ApiOkResponse({ type: DeviceListMasterSuccessListDto })
  @ApiBadRequestResponse({ type: DeviceListMasterErrorResponseDto })
  async list(
    @Query() queryDto: ListDeviceListMasterQueryDto,
  ): Promise<
    DeviceListMasterSuccessResponse<DeviceListMasterListItem[], DeviceListMasterListMeta>
  > {
    const result = await this.deviceListMasterService.list(queryDto);
    return {
      success: true,
      message: 'Devices fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get device by id' })
  @ApiQuery({ name: 'devId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: DeviceListMasterSuccessSingleDto })
  @ApiBadRequestResponse({ type: DeviceListMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: DeviceListMasterErrorResponseDto })
  async getById(
    @Query('devId', new ParseUUIDPipe({ version: '7' })) devId: string,
  ): Promise<DeviceListMasterSuccessResponse<DeviceListMasterPayload>> {
    const data = await this.deviceListMasterService.getById(devId);
    return {
      success: true,
      message: 'Device fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete device by id' })
  @ApiQuery({ name: 'devId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: DeviceListMasterSuccessDeleteDto })
  @ApiBadRequestResponse({ type: DeviceListMasterErrorResponseDto })
  @ApiNotFoundResponse({ type: DeviceListMasterErrorResponseDto })
  async remove(
    @Query('devId', new ParseUUIDPipe({ version: '7' })) devId: string,
  ): Promise<DeviceListMasterSuccessResponse<{ devId: string; deleted: true }>> {
    const data = await this.deviceListMasterService.softDelete(devId);
    return {
      success: true,
      message: 'Device deleted successfully',
      data,
    };
  }
}