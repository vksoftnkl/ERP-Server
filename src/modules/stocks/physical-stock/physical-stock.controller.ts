import { CacheTTL } from '@nestjs/cache-manager';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
  Query,
  Res,
  UseFilters,
  Version,
} from '@nestjs/common';
import { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiBody,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { PhysicalStockService } from './physical-stock.service';
import { CreatePhysicalStockDto } from './dto/create-physical-stock.dto';
import { PhysicalStockErrorResponseDto } from './dto/physical-stock-response.dto';
import { PhysicalStockExceptionFilter } from './physical-stock-exception.filter';
import {
  PhysicalStockDeleteResponse,
  PhysicalStockDocumentResponse,
  PhysicalStockListItem,
  PhysicalStockListMeta,
  PhysicalStockSuccessDeleteDto,
  PhysicalStockSuccessSingleDto,
  PhysicalStockSuccessResponse,
} from './types/physical-stock-response.types';
import { ListPhysicalStockQueryDto } from './dto/list-physical-stock-query.dto';
@ApiTags('Physical Stock')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: PhysicalStockErrorResponseDto })
@CacheTTL(60)
@Controller('physical-stock')
@UseFilters(PhysicalStockExceptionFilter)
export class PhysicalStockController {
  constructor(private readonly physicalStockService: PhysicalStockService) {}
  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Create or update physical stock document by psId presence' })
  @ApiBody({ type: CreatePhysicalStockDto })
  @ApiCreatedResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiOkResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async save(
    @Body() createPhysicalStockDto: CreatePhysicalStockDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>> {
    const isUpdate = Boolean(createPhysicalStockDto.psId);
    response.status(isUpdate ? HttpStatus.OK : HttpStatus.CREATED);
    const data = await this.physicalStockService.save(createPhysicalStockDto);
    return {
      success: true,
      message: isUpdate
        ? 'Physical stock updated successfully'
        : 'Physical stock created successfully',
      data,
    };
  }
  @Get()
  @Version('1')
  @ApiOperation({
    summary:
      'List physical stock documents or get a single document when ps_id or ps_doc_refno is provided',
  })
  @ApiOkResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async listOrGet(
    @Query() queryDto: ListPhysicalStockQueryDto,
  ): Promise<
    PhysicalStockSuccessResponse<
      PhysicalStockDocumentResponse | PhysicalStockListItem[],
      PhysicalStockListMeta
    >
  > {
    const document = await this.resolveDocumentQuery(queryDto);
    if (document) {
      return {
        success: true,
        message: 'Physical stock fetched successfully',
        data: document,
      };
    }
    const result = await this.physicalStockService.list(queryDto);
    return {
      success: true,
      message: 'Physical stock documents fetched successfully',
      data: result.items,
      meta: result.meta,
    };
  }
  @Get('get')
  @Version('1')
  @ApiOperation({ summary: 'Get physical stock document by ps_id' })
  @ApiOkResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async getById(
    @Query() queryDto: ListPhysicalStockQueryDto,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>> {
    const data = await this.physicalStockService.getById(queryDto.ps_id ?? '');
    return {
      success: true,
      message: 'Physical stock fetched successfully',
      data,
    };
  }
  @Get('list')
  @Version('1')
  @ApiOperation({
    summary:
      'List physical stock documents or get a single document when ps_id or ps_doc_refno is provided',
  })
  @ApiOkResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async getList(
    @Query() queryDto: ListPhysicalStockQueryDto,
  ): Promise<
    PhysicalStockSuccessResponse<
      PhysicalStockDocumentResponse | PhysicalStockListItem[],
      PhysicalStockListMeta
    >
  > {
    return this.listOrGet(queryDto);
  }
  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get physical stock document by physical stock header id' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Physical stock header id',
  })
  @ApiOkResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async findOne(
    @Param('id') id: string,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>> {
    const data = await this.physicalStockService.findOne(id);
    return {
      success: true,
      message: 'Physical stock fetched successfully',
      data,
    };
  }
  @Delete()
  @Version('1')
  @ApiOperation({ summary: 'Soft delete physical stock document by ps_id' })
  @ApiOkResponse({ type: PhysicalStockSuccessDeleteDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async removeByQueryRoot(
    @Query() queryDto: ListPhysicalStockQueryDto,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDeleteResponse>> {
    return this.remove(queryDto.ps_id ?? '');
  }
  @Delete('delete')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete physical stock document by ps_id' })
  @ApiOkResponse({ type: PhysicalStockSuccessDeleteDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async removeByQuery(
    @Query() queryDto: ListPhysicalStockQueryDto,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDeleteResponse>> {
    return this.remove(queryDto.ps_id ?? '');
  }
  @Delete(':id')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete physical stock document by physical stock header id' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Physical stock header id',
  })
  @ApiOkResponse({ type: PhysicalStockSuccessDeleteDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async remove(
    @Param('id') id: string,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDeleteResponse>> {
    const data = await this.physicalStockService.remove(id);
    return {
      success: true,
      message: 'Physical stock deleted successfully',
      data,
    };
  }
  private async resolveDocumentQuery(
    queryDto: ListPhysicalStockQueryDto,
  ): Promise<PhysicalStockDocumentResponse | null> {
    if (queryDto.ps_id) {
      return this.physicalStockService.getById(queryDto.ps_id);
    }
    if (queryDto.ps_doc_refno) {
      return this.physicalStockService.getByRefNo(queryDto);
    }
    return null;
  }
}
