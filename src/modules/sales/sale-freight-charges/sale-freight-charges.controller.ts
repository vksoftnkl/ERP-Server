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
import { SaleFreightChargeExceptionFilter } from './sale-freight-charges-exception.filter';
import { SaleFreightChargeService } from './sale-freight-charges.service';
import { SaveSaleFreightChargeDto } from './dto/save-sale-freight-charges.dto';
import {
  SaleFreightChargeErrorResponseDto,
  SaleFreightChargeSuccessCreateDto,
  SaleFreightChargeSuccessDeleteDto,
  SaleFreightChargeSuccessSingleDto,
} from './dto/sale-freight-charges-response.dto';
import {
  SaleFreightChargePayload,
  SaleFreightChargeSuccessResponse,
} from './types/sale-freight-charges-api.types';
import { DEFAULT_ACTOR } from 'src/common/utils/module-service.utils';
import { RequestContextService } from '../../../common/request-context/request-context.service';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Sale Freight Charges')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('sale-freight-charges')
@UseFilters(SaleFreightChargeExceptionFilter)
export class SaleFreightChargeController {
  constructor(
    private readonly saleFreightChargeService: SaleFreightChargeService,
    private readonly requestContextService: RequestContextService,
  ) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update a sale freight charge (by frId presence)' })
  @ApiCreatedResponse({ type: SaleFreightChargeSuccessCreateDto })
  @ApiOkResponse({ type: SaleFreightChargeSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleFreightChargeErrorResponseDto })
  @ApiConflictResponse({ type: SaleFreightChargeErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleFreightChargeErrorResponseDto })
  async createSaleFreightCharge(
    @Body() dto: SaveSaleFreightChargeDto,
  ): Promise<SaleFreightChargeSuccessResponse<SaleFreightChargePayload>> {
    if (dto.frId) {
      const data = await this.saleFreightChargeService.save(dto);
      return {
        success: true,
        message: 'Sale freight charge updated successfully',
        data,
      };
    }
    const userId = this.requestContextService.getUserId() ?? DEFAULT_ACTOR;
    const data = await this.saleFreightChargeService.createSaleFreightCharge(dto, userId);
    return {
      success: true,
      message: 'Sale freight charge created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get a sale freight charge by id' })
  @ApiQuery({ name: 'frId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SaleFreightChargeSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleFreightChargeErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleFreightChargeErrorResponseDto })
  async getById(
    @Query('frId', new ParseUUIDPipe({ version: '7' })) frId: string,
  ): Promise<SaleFreightChargeSuccessResponse<SaleFreightChargePayload>> {
    const data = await this.saleFreightChargeService.getById(frId);
    return {
      success: true,
      message: 'Sale freight charge fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete a sale freight charge by id' })
  @ApiQuery({ name: 'frId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SaleFreightChargeSuccessDeleteDto })
  @ApiBadRequestResponse({ type: SaleFreightChargeErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleFreightChargeErrorResponseDto })
  async remove(
    @Query('frId', new ParseUUIDPipe({ version: '7' })) frId: string,
  ): Promise<SaleFreightChargeSuccessResponse<{ frId: string; deleted: true }>> {
    const data = await this.saleFreightChargeService.softDelete(frId);
    return {
      success: true,
      message: 'Sale freight charge deleted successfully',
      data,
    };
  }
}
