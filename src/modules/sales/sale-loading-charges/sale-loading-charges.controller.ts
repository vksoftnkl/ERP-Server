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
import { SaleLoadingChargeExceptionFilter } from './sale-loading-charges-exception.filter';
import { SaleLoadingChargeService } from './sale-loading-charges.service';
import { SaveSaleLoadingChargeDto } from './dto/save-sale-loading-charges.dto';
import {
  SaleLoadingChargeErrorResponseDto,
  SaleLoadingChargeSuccessCreateDto,
  SaleLoadingChargeSuccessDeleteDto,
  SaleLoadingChargeSuccessSingleDto,
} from './dto/sale-loading-charges-response.dto';
import {
  SaleLoadingChargePayload,
  SaleLoadingChargeSuccessResponse,
} from './types/sale-loading-charges-api.types';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Sale Loading Charges')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('sale-loading-charges')
@UseFilters(SaleLoadingChargeExceptionFilter)
export class SaleLoadingChargeController {
  constructor(
    private readonly saleLoadingChargeService: SaleLoadingChargeService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update a sale loading charge (by ilcId presence)' })
  @ApiCreatedResponse({ type: SaleLoadingChargeSuccessCreateDto })
  @ApiOkResponse({ type: SaleLoadingChargeSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleLoadingChargeErrorResponseDto })
  @ApiConflictResponse({ type: SaleLoadingChargeErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleLoadingChargeErrorResponseDto })
  async createSaleLoadingCharge(
    @Body() dto: SaveSaleLoadingChargeDto,
  ): Promise<SaleLoadingChargeSuccessResponse<SaleLoadingChargePayload>> {
    if (dto.ilcId) {
      const data = await this.saleLoadingChargeService.save(dto);
      return {
        success: true,
        message: 'Sale loading charge updated successfully',
        data,
      };
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data = await this.saleLoadingChargeService.createSaleLoadingCharge(dto, userId);
    return {
      success: true,
      message: 'Sale loading charge created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get a sale loading charge by id' })
  @ApiQuery({ name: 'ilcId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SaleLoadingChargeSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleLoadingChargeErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleLoadingChargeErrorResponseDto })
  async getById(
    @Query('ilcId', new ParseUUIDPipe({ version: '7' })) ilcId: string,
  ): Promise<SaleLoadingChargeSuccessResponse<SaleLoadingChargePayload>> {
    const data = await this.saleLoadingChargeService.getById(ilcId);
    return {
      success: true,
      message: 'Sale loading charge fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a sale loading charge by id' })
  @ApiQuery({ name: 'ilcId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SaleLoadingChargeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: SaleLoadingChargeErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleLoadingChargeErrorResponseDto })
  async remove(
    @Query('ilcId', new ParseUUIDPipe({ version: '7' })) ilcId: string,
  ): Promise<SaleLoadingChargeSuccessResponse<{ ilcId: string; deleted: true }>> {
    const data = await this.saleLoadingChargeService.softDelete(ilcId);
    return {
      success: true,
      message: 'Sale loading charge deleted successfully',
      data,
    };
  }
}
