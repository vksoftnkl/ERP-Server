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
import { AreaExceptionFilter } from './area-exception.filter';
import { AreaService } from './area.service';
import { SaveAreaDto } from './dto/save-area.dto';
import {
  AreaErrorResponseDto,
  AreaMasterCreateSuccessDto,
  AreaSuccessDeleteDto,
  AreaSuccessSingleDto,
} from './dto/area-response.dto';
import { AreaMasterCreateResult, AreaPayload, AreaSuccessResponse } from './types/area-api.types';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Areas')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('areas')
@UseFilters(AreaExceptionFilter)
export class AreaController {
  constructor(
    private readonly areaService: AreaService,
    private readonly requestContextService: RequestContextService,
  ) {}
  // userId is resolved from the request context since the service takes it as an argument.
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create an area master together with its parent account group' })
  @ApiCreatedResponse({ type: AreaMasterCreateSuccessDto })
  @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  @ApiConflictResponse({ type: AreaErrorResponseDto })
  async createAreaMaster(
    @Body() dto: SaveAreaDto,
  ): Promise<AreaSuccessResponse<AreaMasterCreateResult>> {
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data = await this.areaService.createAreaMaster(dto, userId);
    return {
      success: true,
      message: 'Area created successfully',
      data,
    };
  }

  // @Post('create')
  // @Version(API_VERSION)
  // @ApiOperation({ summary: 'Create or update area (by armId presence)' })
  // @ApiCreatedResponse({ type: AreaSuccessSingleDto })
  // @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  // @ApiConflictResponse({ type: AreaErrorResponseDto })
  // @ApiNotFoundResponse({ type: AreaErrorResponseDto })
  // async save(@Body() saveAreaDto: SaveAreaDto): Promise<AreaSuccessResponse<AreaPayload>> {
  //   const data = await this.areaService.save(saveAreaDto);
  //   return {
  //     success: true,
  //     message: saveAreaDto.armId ? 'Area updated successfully' : 'Area created successfully',
  //     data,
  //   };
  // }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get area by id' })
  @ApiQuery({ name: 'armId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AreaSuccessSingleDto })
  @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  @ApiNotFoundResponse({ type: AreaErrorResponseDto })
  async getById(
    @Query('armId', new ParseUUIDPipe({ version: '7' })) armId: string,
  ): Promise<AreaSuccessResponse<AreaPayload>> {
    const data = await this.areaService.getById(armId);
    return {
      success: true,
      message: 'Area fetched successfully',
      data,
    };
  }
  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete area by id' })
  @ApiQuery({ name: 'armId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: AreaSuccessDeleteDto })
  @ApiBadRequestResponse({ type: AreaErrorResponseDto })
  @ApiNotFoundResponse({ type: AreaErrorResponseDto })
  async remove(
    @Query('armId', new ParseUUIDPipe({ version: '7' })) armId: string,
  ): Promise<AreaSuccessResponse<{ armId: string; deleted: true }>> {
    const data = await this.areaService.softDelete(armId);
    return {
      success: true,
      message: 'Area deleted successfully',
      data,
    };
  }
}
