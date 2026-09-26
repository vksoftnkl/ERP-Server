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
import { SaveSaleAgentDto } from './dto/save-sale-agent.dto';
import {
  SaleAgentErrorResponseDto,
  SaleAgentSuccessDeleteDto,
  SaleAgentSuccessSingleDto,
} from './dto/sale-agent-response.dto';
import { SaleAgentExceptionFilter } from './sale-agent-exception.filter';
import { SaleAgentService } from './sale-agent.service';
import { SaleAgentPayload, SaleAgentSuccessResponse } from './types/sale-agent-api.types';
import { API_VERSION } from '../../../common/constants/api-version';

@ApiTags('Sale Agents')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(1)
@Controller('sale-agents')
@UseFilters(SaleAgentExceptionFilter)
export class SaleAgentController {
  constructor(private readonly saleAgentService: SaleAgentService) {}

  @Post('create')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Create or update sale agent (by saId presence)' })
  @ApiCreatedResponse({ type: SaleAgentSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleAgentErrorResponseDto })
  @ApiConflictResponse({ type: SaleAgentErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleAgentErrorResponseDto })
  async save(
    @Body() saveSaleAgentDto: SaveSaleAgentDto,
  ): Promise<SaleAgentSuccessResponse<SaleAgentPayload>> {
    const data = await this.saleAgentService.save(saveSaleAgentDto);

    return {
      success: true,
      message: saveSaleAgentDto.saId
        ? 'Sale agent updated successfully'
        : 'Sale agent created successfully',
      data,
    };
  }

  @Get('get')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Get sale agent by id' })
  @ApiQuery({ name: 'saId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SaleAgentSuccessSingleDto })
  @ApiBadRequestResponse({ type: SaleAgentErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleAgentErrorResponseDto })
  async getById(
    @Query('saId', new ParseUUIDPipe({ version: '7' })) saId: string,
  ): Promise<SaleAgentSuccessResponse<SaleAgentPayload>> {
    const data = await this.saleAgentService.getById(saId);

    return {
      success: true,
      message: 'Sale agent fetched successfully',
      data,
    };
  }

  @Delete('delete')
  @Version(API_VERSION)
  @ApiOperation({ summary: 'Soft delete sale agent by id' })
  @ApiQuery({ name: 'saId', schema: { type: 'string', format: 'uuid' } })
  @ApiOkResponse({ type: SaleAgentSuccessDeleteDto })
  @ApiBadRequestResponse({ type: SaleAgentErrorResponseDto })
  @ApiNotFoundResponse({ type: SaleAgentErrorResponseDto })
  async remove(
    @Query('saId', new ParseUUIDPipe({ version: '7' })) saId: string,
  ): Promise<SaleAgentSuccessResponse<{ saId: string; deleted: true }>> {
    const data = await this.saleAgentService.softDelete(saId);

    return {
      success: true,
      message: 'Sale agent deleted successfully',
      data,
    };
  }
}
