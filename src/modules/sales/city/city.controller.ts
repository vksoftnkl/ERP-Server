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
import { ListCityQueryDto } from './dto/list-city-query.dto';
import { SaveCityDto } from './dto/save-city.dto';
import {
  CityErrorResponseDto,
  CitySuccessDeleteDto,
  CitySuccessListDto,
  CitySuccessSingleDto,
} from './dto/city-response.dto';
import {
  CityListItem,
  CityListMeta,
  CityPayload,
  CitySuccessResponse,
} from './types/city-api.types';

@ApiTags('Cities')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@Controller('cities')
@UseFilters(CityExceptionFilter)
export class CityController {
  constructor(private readonly cityService: CityService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update city (by ctmId presence)' })
  @ApiCreatedResponse({ type: CitySuccessSingleDto })
  @ApiBadRequestResponse({ type: CityErrorResponseDto })
  @ApiConflictResponse({ type: CityErrorResponseDto })
  @ApiNotFoundResponse({ type: CityErrorResponseDto })
  async save(@Body() saveCityDto: SaveCityDto): Promise<CitySuccessResponse<CityPayload>> {
    const data = await this.cityService.save(saveCityDto);

    return {
      success: true,
      message: saveCityDto.ctmId ? 'City updated successfully' : 'City created successfully',
      data,
    };
  }

  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List cities with filter/search/pagination' })
  @ApiOkResponse({ type: CitySuccessListDto })
  @ApiBadRequestResponse({ type: CityErrorResponseDto })
  async list(
    @Query() queryDto: ListCityQueryDto,
  ): Promise<CitySuccessResponse<CityListItem[], CityListMeta>> {
    const result = await this.cityService.list(queryDto);

    return {
      success: true,
      message: 'Cities fetched successfully',
      data: result.items,
      meta: result.meta,
      ...(result.styles !== undefined && { styles: result.styles }),
    };
  }

  @Get('get')
  @Version('1')
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
  @Version('1')
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
