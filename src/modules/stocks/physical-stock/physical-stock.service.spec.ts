import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../database/prisma/prisma.service';
import { PhysicalStockService } from './physical-stock.service';

describe('PhysicalStockService', () => {
  let service: PhysicalStockService;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PhysicalStockService,
        {
          provide: PrismaService,
          useValue: {},
        },
      ],
    }).compile();

    service = module.get<PhysicalStockService>(PhysicalStockService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });
});
