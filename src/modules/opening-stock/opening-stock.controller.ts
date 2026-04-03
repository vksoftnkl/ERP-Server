import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Post,
  Query,
  Res,
  UseFilters,
  Version,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBearerAuth,
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { HttpErrorResponseDto } from '../../common/dto/http-error-response.dto';
import { ListOpeningStockQueryDto } from './dto/list-opening-stock-query.dto';
import { OpeningStockIdQueryDto } from './dto/opening-stock-id-query.dto';
import {
  OpeningStockErrorResponseDto,
  OpeningStockSuccessDeleteDto,
  OpeningStockSuccessListDto,
  OpeningStockSuccessSingleDto,
} from './dto/opening-stock-response.dto';
import { SaveOpeningStockDto } from './dto/save-opening-stock.dto';
import { OpeningStockExceptionFilter } from './opening-stock-exception.filter';
import { OpeningStockService } from './opening-stock.service';
import {
  OpeningStockDocumentPayload,
  OpeningStockHeaderPayload,
  OpeningStockListMeta,
  OpeningStockSuccessResponse,
} from './types/opening-stock-api.types';
@ApiTags('Opening Stock')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: HttpErrorResponseDto })
@CacheTTL(60)
@Controller('opening-stocks')
@UseFilters(OpeningStockExceptionFilter)
export class OpeningStockController {
  constructor(private readonly openingStockService: OpeningStockService) {}
  @Post()
  @Version('1')
  @ApiOperation({
    summary: 'Create or update opening stock document by avh_voucher_id presence',
  })
  @ApiCreatedResponse({ type: OpeningStockSuccessSingleDto })
  @ApiOkResponse({ type: OpeningStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async save(
    @Body() saveOpeningStockDto: SaveOpeningStockDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<OpeningStockSuccessResponse<OpeningStockDocumentPayload>> {
    const isUpdate = Boolean(saveOpeningStockDto.header.avh_voucher_id);
    response.status(isUpdate ? HttpStatus.OK : HttpStatus.CREATED);
    const data = await this.openingStockService.save(saveOpeningStockDto);
    return {
      success: true,
      message: isUpdate
        ? 'Opening stock updated successfully'
        : 'Opening stock created successfully',
      data,
    };
  }
  @Get()
  @Version('1')
  @ApiOperation({
    summary: 'List opening stock documents or get single document when avh_voucher_id is provided',
  })
  @ApiOkResponse({ type: OpeningStockSuccessListDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async listOrGet(
    @Query() queryDto: ListOpeningStockQueryDto,
  ): Promise<
    OpeningStockSuccessResponse<
      OpeningStockDocumentPayload | OpeningStockHeaderPayload[],
      OpeningStockListMeta
    >
  > {
    if (queryDto.avh_voucher_id) {
      const data = await this.openingStockService.getByVoucherId(queryDto.avh_voucher_id);
      return {
        success: true,
        message: 'Opening stock fetched successfully',
        data,
      };
    }
    const result = await this.openingStockService.list(queryDto);
    return {
      success: true,
      message: 'Opening stock documents fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get opening stock document by avh_voucher_id' })
  @ApiOkResponse({ type: OpeningStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async getById(
    @Query() queryDto: OpeningStockIdQueryDto,
  ): Promise<OpeningStockSuccessResponse<OpeningStockDocumentPayload>> {
    const data = await this.openingStockService.getByVoucherId(queryDto.avh_voucher_id);
    return {
      success: true,
      message: 'Opening stock fetched successfully',
      data,
    };
  }
  @Get('list')
  @Version('1')
  @ApiOperation({ summary: 'List opening stock documents' })
  @ApiOkResponse({ type: OpeningStockSuccessListDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  async getList(
    @Query() queryDto: ListOpeningStockQueryDto,
  ): Promise<OpeningStockSuccessResponse<OpeningStockHeaderPayload[], OpeningStockListMeta>> {
    const result = await this.openingStockService.getList(queryDto);
    return {
      success: true,
      message: 'Opening stock documents fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Delete()
  @Version('1')
  @ApiOperation({ summary: 'Soft delete opening stock by avh_voucher_id' })
  @ApiOkResponse({ type: OpeningStockSuccessDeleteDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async remove(
    @Query() queryDto: OpeningStockIdQueryDto,
  ): Promise<OpeningStockSuccessResponse<{ avh_voucher_id: string; deleted: true }>> {
    const data = await this.openingStockService.softDelete(queryDto.avh_voucher_id);
    return {
      success: true,
      message: 'Opening stock deleted successfully',
      data,
    };
  }
  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete opening stock by avh_voucher_id' })
  @ApiOkResponse({ type: OpeningStockSuccessDeleteDto })
  @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  async removeByQuery(
    @Query() queryDto: OpeningStockIdQueryDto,
  ): Promise<OpeningStockSuccessResponse<{ avh_voucher_id: string; deleted: true }>> {
    return this.remove(queryDto);
  }
}
