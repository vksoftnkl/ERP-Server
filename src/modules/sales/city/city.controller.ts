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

  // Single write endpoint: dispatches on ctmId. With ctmId it updates the existing city
  // (returns the updated CityPayload); without it, it creates a city master together with its
  // parent account group (returns CityMasterCreateResult). userId is resolved from the request
  // context since the create service takes it as an argument.
  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update city (by ctmId presence)' })
  @ApiCreatedResponse({ type: CityMasterCreateSuccessDto })
  @ApiOkResponse({ type: CitySuccessSingleDto })
  @ApiBadRequestResponse({ type: CityErrorResponseDto })
  @ApiConflictResponse({ type: CityErrorResponseDto })
  @ApiNotFoundResponse({ type: CityErrorResponseDto })
  async createCityMaster(
    @Body() dto: SaveCityDto,
  ): Promise<CitySuccessResponse<CityMasterCreateResult | CityPayload>> {
    if (dto.ctmId) {
      const data = await this.cityService.save(dto);

      return {
        success: true,
        message: 'City updated successfully',
        data,
      };
    }

    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data = await this.cityService.createCityMaster(dto, userId);

    return {
      success: true,
      message: 'City created successfully',
      data,
    };
  }

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
