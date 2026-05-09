import {
  Body,
  Controller,
  Delete,
  Get,
  HttpStatus,
  Param,
  Post,
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
  PhysicalStockSuccessDeleteDto,
  PhysicalStockSuccessSingleDto,
  PhysicalStockSuccessResponse,
} from './types/physical-stock-response.types';
@ApiTags('Physical Stock')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: PhysicalStockErrorResponseDto })
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
}
