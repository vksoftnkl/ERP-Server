import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  ParseIntPipe,
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
import { ConfigsExceptionFilter } from './configs-exception.filter';
import {
  ConfigsErrorResponseDto,
  ConfigsSuccessDeleteDto,
  ConfigsSuccessListDto,
  ConfigsSuccessSingleDto,
} from './dto/configs-response.dto';
import { SaveConfigsDto } from './dto/save-configs.dto';
import { ConfigsService } from './configs.service';
import { ConfigsPayload, ConfigsSuccessResponse } from './types/configs-api.types';
import { API_VERSION } from '../../../common/constants/api-version';
@ApiTags('Configs')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('configs')
@UseFilters(ConfigsExceptionFilter)
export class ConfigsController {
  constructor(private readonly configsService: ConfigsService) {}
  @Post('update')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Update a config' })
  @ApiCreatedResponse({ type: ConfigsSuccessSingleDto })
  @ApiBadRequestResponse({ type: ConfigsErrorResponseDto })
  @ApiConflictResponse({ type: ConfigsErrorResponseDto })
  @ApiNotFoundResponse({ type: ConfigsErrorResponseDto })
  async save(
    @Body() saveConfigsDto: SaveConfigsDto,
  ): Promise<ConfigsSuccessResponse<ConfigsPayload>> {
    const data = await this.configsService.save(saveConfigsDto);
    return {
      success: true,
      message: 'Config saved successfully',
      data,
    };
  }
  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get config by id' })
  @ApiQuery({ name: 'configId', schema: { type: 'integer' }, example: 1 })
  @ApiOkResponse({ type: ConfigsSuccessSingleDto })
  @ApiBadRequestResponse({ type: ConfigsErrorResponseDto })
  @ApiNotFoundResponse({ type: ConfigsErrorResponseDto })
  async getById(
    @Query('configId', ParseIntPipe) configId: number,
  ): Promise<ConfigsSuccessResponse<ConfigsPayload>> {
    const data = await this.configsService.getById(configId);
    return {
      success: true,
      message: 'Config fetched successfully',
      data,
    };
  }  
}