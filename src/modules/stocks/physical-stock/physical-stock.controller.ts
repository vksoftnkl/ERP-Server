import { Body, Controller, Param, Patch, Post, Version } from '@nestjs/common';
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
import { UpdatePhysicalStockDto } from './dto/update-physical-stock.dto';
import { PhysicalStockErrorResponseDto } from './dto/physical-stock-response.dto';
import {
  PhysicalStockDocumentResponse,
  PhysicalStockSuccessSingleDto,
  PhysicalStockSuccessResponse,
} from './types/physical-stock-response.types';
@ApiTags('Physical Stock')
@ApiBearerAuth('access-token')
@ApiUnauthorizedResponse({ type: PhysicalStockErrorResponseDto })
@Controller('physical-stock')
export class PhysicalStockController {
  constructor(private readonly physicalStockService: PhysicalStockService) {}
  @Post()
  @Version('1')
  @ApiOperation({ summary: 'Create physical stock document' })
  @ApiBody({ type: CreatePhysicalStockDto })
  @ApiCreatedResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: PhysicalStockErrorResponseDto })
  async create(
    @Body() createPhysicalStockDto: CreatePhysicalStockDto,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>> {
    const data = await this.physicalStockService.create(createPhysicalStockDto);
    return {
      success: true,
      message: 'Physical stock created successfully',
      data,
    };
  }
  @Patch(':id')
  @Version('1')
  @ApiOperation({ summary: 'Update physical stock document by physical stock header id' })
  @ApiParam({
    name: 'id',
    format: 'uuid',
    description: 'Physical stock header id',
  })
  @ApiBody({ type: UpdatePhysicalStockDto })
  @ApiOkResponse({ type: PhysicalStockSuccessSingleDto })
  @ApiBadRequestResponse({ type: PhysicalStockErrorResponseDto })
  @ApiNotFoundResponse({ type: PhysicalStockErrorResponseDto })
  async update(
    @Param('id') id: string,
    @Body() updatePhysicalStockDto: UpdatePhysicalStockDto,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>> {
    const data = await this.physicalStockService.update(id, updatePhysicalStockDto);
    return {
      success: true,
      message: 'Physical stock updated successfully',
      data,
    };
  }
}
