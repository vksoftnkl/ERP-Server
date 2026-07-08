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
import { FreightChargesExceptionFilter } from './freight-charges-exception.filter';
import { FreightChargesService } from './freight-charges.service';
import { SaveFreightChargesDto } from './dto/save-freight-charges.dto';
import {
  FreightChargesErrorResponseDto,
  FreightChargesSuccessCreateDto,
  FreightChargesSuccessDeleteDto,
  FreightChargesSuccessSingleDto,
} from './dto/freight-charges-response.dto';
import {
  FreightChargesPayload,
  FreightChargesSuccessResponse,
} from './types/freight-charges-api.types';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Freight Charges')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('freight-charges')
@UseFilters(FreightChargesExceptionFilter)
export class FreightChargesController {
  constructor(
    private readonly freightChargesService: FreightChargesService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update freight charges (by frId presence)' })
  @ApiCreatedResponse({ type: FreightChargesSuccessCreateDto })
  @ApiOkResponse({ type: FreightChargesSuccessSingleDto })
  @ApiBadRequestResponse({ type: FreightChargesErrorResponseDto })
  @ApiConflictResponse({ type: FreightChargesErrorResponseDto })
  @ApiNotFoundResponse({ type: FreightChargesErrorResponseDto })
  async createFreightCharges(
    @Body() dto: SaveFreightChargesDto,
  ): Promise<FreightChargesSuccessResponse<FreightChargesPayload>> {
    if (dto.frId) {
      const data = await this.freightChargesService.save(dto);
      return {
        success: true,
        message: 'Freight charges updated successfully',
        data,
      };
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data = await this.freightChargesService.createFreightCharges(dto, userId);
    return {
      success: true,
      message: 'Freight charges created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get freight charges by id' })
  @ApiQuery({ name: 'frId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: FreightChargesSuccessSingleDto })
  @ApiBadRequestResponse({ type: FreightChargesErrorResponseDto })
  @ApiNotFoundResponse({ type: FreightChargesErrorResponseDto })
  async getById(
    @Query('frId', new ParseUUIDPipe({ version: '7' })) frId: string,
  ): Promise<FreightChargesSuccessResponse<FreightChargesPayload>> {
    const data = await this.freightChargesService.getById(frId);
    return {
      success: true,
      message: 'Freight charges fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete freight charges by id' })
  @ApiQuery({ name: 'frId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: FreightChargesSuccessDeleteDto })
  @ApiBadRequestResponse({ type: FreightChargesErrorResponseDto })
  @ApiNotFoundResponse({ type: FreightChargesErrorResponseDto })
  async remove(
    @Query('frId', new ParseUUIDPipe({ version: '7' })) frId: string,
  ): Promise<FreightChargesSuccessResponse<{ frId: string; deleted: true }>> {
    const data = await this.freightChargesService.softDelete(frId);
    return {
      success: true,
      message: 'Freight charges deleted successfully',
      data,
    };
  }
}
