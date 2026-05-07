import { Controller, Get, Post, Body, Patch, Param, Delete } from '@nestjs/common';
import { PhysicalStockService } from './physical-stock.service';
import { CreatePhysicalStockDto } from './dto/create-physical-stock.dto';
import { UpdatePhysicalStockDto } from './dto/update-physical-stock.dto';

@Controller('physical-stock')
export class PhysicalStockController {
  constructor(private readonly physicalStockService: PhysicalStockService) {}

  @Post()
  create(@Body() createPhysicalStockDto: CreatePhysicalStockDto) {
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
