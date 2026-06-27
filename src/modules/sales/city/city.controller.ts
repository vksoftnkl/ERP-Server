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
import { CityExceptionFilter } from './city-exception.filter';
import { CityService } from './city.service';
import { SaveCityDto } from './dto/save-city.dto';
import {
  CityErrorResponseDto,
  CityMasterCreateSuccessDto,
  CitySuccessDeleteDto,
  CitySuccessSingleDto,
} from './dto/city-response.dto';
import { CityMasterCreateResult, CityPayload, CitySuccessResponse } from './types/city-api.types';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Cities')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('cities')
@UseFilters(CityExceptionFilter)
export class CityController {
  constructor(
    private readonly cityService: CityService,
    private readonly requestContextService: RequestContextService,
  ) {}

  // userId is resolved from the request context since the service takes it as an argument.
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create a city master together with its parent account group' })
  @ApiCreatedResponse({ type: CityMasterCreateSuccessDto })
  @ApiBadRequestResponse({ type: CityErrorResponseDto })
  @ApiConflictResponse({ type: CityErrorResponseDto })
  async createCityMaster(
    @Body() dto: SaveCityDto,
  ): Promise<CitySuccessResponse<CityMasterCreateResult>> {
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data = await this.cityService.createCityMaster(dto, userId);

    return {
      success: true,
      message: 'City created successfully',
      data,
    };
  }

  // @Post('create')
  // @Version(API_VERSION)
  // @ApiOperation({ summary: 'Create or update city (by ctmId presence)' })
  // @ApiCreatedResponse({ type: CitySuccessSingleDto })
  // @ApiBadRequestResponse({ type: CityErrorResponseDto })
  // @ApiConflictResponse({ type: CityErrorResponseDto })
  // @ApiNotFoundResponse({ type: CityErrorResponseDto })
  // async save(@Body() saveCityDto: SaveCityDto): Promise<CitySuccessResponse<CityPayload>> {
  //   const data = await this.cityService.save(saveCityDto);

  //   return {
  //     success: true,
  //     message: saveCityDto.ctmId ? 'City updated successfully' : 'City created successfully',
  //     data,
  //   };
  // }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get city by id' })
  @ApiQuery({ name: 'ctmId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: CitySuccessSingleDto })
  @ApiBadRequestResponse({ type: CityErrorResponseDto })
  @ApiNotFoundResponse({ type: CityErrorResponseDto })
  async getById(
    @Query('ctmId', new ParseUUIDPipe({ version: '7' })) ctmId: string,
  ): Promise<CitySuccessResponse<CityPayload>> {
    const data = await this.cityService.getById(ctmId);

    return {
      success: true,
      message: 'City fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete city by id' })
  @ApiQuery({ name: 'ctmId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: CitySuccessDeleteDto })
  @ApiBadRequestResponse({ type: CityErrorResponseDto })
  @ApiNotFoundResponse({ type: CityErrorResponseDto })
  async remove(
    @Query('ctmId', new ParseUUIDPipe({ version: '7' })) ctmId: string,
  ): Promise<CitySuccessResponse<{ ctmId: string; deleted: true }>> {
    const data = await this.cityService.softDelete(ctmId);

    return {
      success: true,
      message: 'City deleted successfully',
      data,
    };
  }
}
