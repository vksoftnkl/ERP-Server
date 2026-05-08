import { Response } from 'express';
import { Controller, Get, Post, Body, Patch, Param, Delete, Version, Res, HttpStatus } from '@nestjs/common';
import { PhysicalStockService } from './physical-stock.service';
import { CreatePhysicalStockHeaderDto } from './dto/create-physical-stock.dto';
import { UpdatePhysicalStockDto } from './dto/update-physical-stock.dto';
import { ApiCreatedResponse, ApiOperation } from '@nestjs/swagger';
import { PhysicalStockErrorResponseDto } from './dto/physical-stock-response.dto';
import { PhysicalStockDocumentResponse, PhysicalStockHeaderResponse, PhysicalStockSuccessResponse } from './types/physical-stock-response.types';

@Controller('physical-stock')
export class PhysicalStockController {
  constructor(private readonly physicalStockService: PhysicalStockService) {}

  @Post()
  @Version('1')
  @ApiOperation({
      summary: 'Create or update physical stock document by psc_id presence',
  })

  // @ApiCreatedResponse({ type: OpeningStockSuccessSingleDto })
  // @ApiOkResponse({ type: OpeningStockSuccessSingleDto })
  // @ApiBadRequestResponse({ type: OpeningStockErrorResponseDto })
  // @ApiConflictResponse({ type: OpeningStockErrorResponseDto })
  // @ApiNotFoundResponse({ type: OpeningStockErrorResponseDto })
  
  async createOrUpdate(
    @Body() CreatePhysicalStockHeaderDto: CreatePhysicalStockHeaderDto,
    @Res({ passthrough: true }) response: Response,
  ): Promise<PhysicalStockSuccessResponse<PhysicalStockDocumentResponse>> {
    const isUpdate = Boolean(CreatePhysicalStockHeaderDto.psId);
    response.status(isUpdate ? HttpStatus.OK : HttpStatus.CREATED);
    let data;
    if (isUpdate) {
      data = await this.physicalStockService.update(CreatePhysicalStockHeaderDto.psId, CreatePhysicalStockHeaderDto);
    } else {
      data = await this.physicalStockService.create(CreatePhysicalStockHeaderDto);
    }
    return {
      success: true,
      message: isUpdate
        ? 'Physical stock updated successfully'
        : 'Physical stock created successfully',
      data,
    };
  }

  create(@Body() createPhysicalStockDto: CreatePhysicalStockHeaderDto) {
    return this.physicalStockService.create(createPhysicalStockDto);
  }

  @Get()
  findAll() {
    return this.physicalStockService.findAll();
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.physicalStockService.findOne(+id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updatePhysicalStockDto: UpdatePhysicalStockDto) {
    return this.physicalStockService.update(+id, updatePhysicalStockDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.physicalStockService.remove(+id);
  }
}
