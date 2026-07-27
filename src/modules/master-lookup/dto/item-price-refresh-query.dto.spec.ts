import { BadRequestException, ValidationPipe } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ItemPriceRefreshQueryDto } from './item-price-refresh-query.dto';

const ITEM_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45678';
const UNIT_ID = '018f0a2b-7c4d-7e8f-9a0b-c1d2e3f45679';

const validationPipe = new ValidationPipe({
  whitelist: true,
  forbidNonWhitelisted: true,
  transform: true,
  transformOptions: { enableImplicitConversion: true },
});

const transformQuery = (query: Record<string, unknown>) =>
  validationPipe.transform(query, { type: 'query', metatype: ItemPriceRefreshQueryDto });

describe('ItemPriceRefreshQueryDto', () => {
  it('accepts an item and the unit currently on screen', () => {
    const dto = plainToInstance(ItemPriceRefreshQueryDto, {
      item_id: ITEM_ID,
      unit_id: UNIT_ID,
    });

    expect(validateSync(dto)).toHaveLength(0);
  });

  it('rejects a missing unit_id', async () => {
    // unit_id is optional on the plain lookup but required here — it is the
    // unit the cycle steps from, so there is nothing to resolve without it.
    await expect(transformQuery({ item_id: ITEM_ID })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a missing item_id', async () => {
    await expect(transformQuery({ unit_id: UNIT_ID })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-UUID unit_id', async () => {
    await expect(
      transformQuery({ item_id: ITEM_ID, unit_id: 'not-a-uuid' }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('rejects a non-UUID item_id', async () => {
    await expect(transformQuery({ item_id: '42', unit_id: UNIT_ID })).rejects.toBeInstanceOf(
      BadRequestException,
    );
  });

  it('rejects the lookup scope parameters it does not take', async () => {
    // The global pipe runs with forbidNonWhitelisted, so a caller reusing the
    // /item-price query string verbatim gets a 400 rather than a silently
    // ignored scope.
    await expect(
      transformQuery({ item_id: ITEM_ID, unit_id: UNIT_ID, price_level: 1 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});
