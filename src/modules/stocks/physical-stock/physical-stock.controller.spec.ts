import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PhysicalStockController } from './physical-stock.controller';
import { PhysicalStockService } from './physical-stock.service';

describe('PhysicalStockController', () => {
  let controller: PhysicalStockController;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [PhysicalStockController],
      providers: [
        PhysicalStockService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    controller = module.get<PhysicalStockController>(PhysicalStockController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
