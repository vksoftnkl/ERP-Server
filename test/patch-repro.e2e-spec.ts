import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as request from 'supertest';
import { PriceLevelMasterModule } from '../src/modules/fixed/price-level-master/price-level-master.module';
import { PrismaModule } from '../src/database/prisma/prisma.module';

describe('PriceLevelMaster PATCH bulk (repro)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [PrismaModule, PriceLevelMasterModule],
    }).compile();
    app = moduleFixture.createNestApplication();
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    await app.init();
  }, 30000);

  afterAll(async () => {
    await app.close();
  });

  it('PATCH /price-level-masters/bulk', async () => {
    const httpServer = app.getHttpServer() as Parameters<typeof request>[0];
    const response = await request(httpServer)
      .patch('/price-level-masters/bulk')
      .send({
        priceLevels: [{ priceLvlId: 2, priceLvlName: 'Retail Repro Test' }],
      });
    // eslint-disable-next-line no-console
    console.log('STATUS:', response.statusCode);
    // eslint-disable-next-line no-console
    console.log('BODY:', JSON.stringify(response.body, null, 2));
  });
});
