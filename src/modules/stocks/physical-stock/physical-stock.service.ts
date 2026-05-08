import { Injectable } from '@nestjs/common';
import { CreatePhysicalStockDto } from './dto/create-physical-stock.dto';
import { UpdatePhysicalStockDto } from './dto/update-physical-stock.dto';

@Injectable()
export class PhysicalStockService {
  create(createPhysicalStockDto: CreatePhysicalStockDto) {
    return 'This action adds a new physicalStock';
  }

  findAll() {
    return `This action returns all physicalStock`;
  }

  findOne(id: number) {
    return `This action returns a #${id} physicalStock`;
  }

  update(id: number, updatePhysicalStockDto: UpdatePhysicalStockDto) {
    return `This action updates a #${id} physicalStock`;
  }

  remove(id: number) {
    return `This action removes a #${id} physicalStock`;
  }
}
