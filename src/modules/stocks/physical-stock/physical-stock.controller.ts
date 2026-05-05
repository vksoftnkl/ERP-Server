import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Version,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiCreatedResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PhysicalStockService } from './physical-stock.service';
import { CreatePhysicalStockDto } from './dto/create-physical-stock.dto';
import { UpdatePhysicalStockDto } from './dto/update-physical-stock.dto';

@ApiTags('Physical Stock')
@ApiBearerAuth('access-token')
@Controller('physical-stock')
export class PhysicalStockController {
  constructor(private readonly physicalStockService: PhysicalStockService) {}

  @Post('create')
  @Version('1')
  @ApiOperation({ summary: 'Create or update physical stock header by pscId presence' })
  @ApiCreatedResponse({ description: 'Physical stock header saved successfully' })
  async save(@Body() createPhysicalStockDto: CreatePhysicalStockDto) {
    const data = await this.physicalStockService.save(createPhysicalStockDto);

    return {
      success: true,
      message: createPhysicalStockDto.pscId
        ? 'Physical stock updated successfully'
        : 'Physical stock created successfully',
      data,
    };
  }

  @Get()
  @Version('1')
  @ApiOperation({ summary: 'List physical stock headers' })
  @ApiOkResponse({ description: 'Physical stock headers fetched successfully' })
  async findAll() {
    const data = await this.physicalStockService.findAll();

    return {
      success: true,
      message: 'Physical stock fetched successfully',
      data,
    };
  }

  @Get(':id')
  @Version('1')
  @ApiOperation({ summary: 'Get physical stock header by id' })
  @ApiOkResponse({ description: 'Physical stock header fetched successfully' })
  async findOne(@Param('id') id: string) {
    const data = await this.physicalStockService.findOne(id);

    return {
      success: true,
      message: 'Physical stock fetched successfully',
      data,
    };
  }

  @Patch(':id')
  @Version('1')
  @ApiOperation({ summary: 'Update physical stock header by id' })
  @ApiOkResponse({ description: 'Physical stock header updated successfully' })
  async update(@Param('id') id: string, @Body() updatePhysicalStockDto: UpdatePhysicalStockDto) {
    const data = await this.physicalStockService.update(id, updatePhysicalStockDto);

    return {
      success: true,
      message: 'Physical stock updated successfully',
      data,
    };
  }

  @Delete(':id')
  @Version('1')
  @ApiOperation({ summary: 'Soft delete physical stock header by id' })
  @ApiOkResponse({ description: 'Physical stock header deleted successfully' })
  async remove(@Param('id') id: string) {
    const data = await this.physicalStockService.remove(id);

    return {
      success: true,
      message: 'Physical stock deleted successfully',
      data,
    };
  }
}
